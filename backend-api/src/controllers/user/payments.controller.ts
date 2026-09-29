import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import Payment from '../../models/Payment';
import Application from '../../models/Application';
import PromoCode from '../../models/PromoCode';
import { generateReceiptPDF } from '../../services/pdf.service';
import { completeOnlinePayment } from '../../services/payment.service';
import { buildReceiptData } from '../../utils/receiptData';
import {
  isRazorpayConfigured,
  getRazorpayKeyId,
  createRazorpayOrder,
  verifyPaymentSignature,
} from '../../services/razorpay.service';
import { sendSuccess, sendError } from '../../utils/response';

export const getUserPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  const payments = await Payment.find({ user: req.user!._id, status: 'completed' })
    .populate({
      path: 'application',
      populate: [{ path: 'visaType', select: 'name' }, { path: 'country', select: 'name flag' }],
    })
    .sort({ createdAt: -1 });
  sendSuccess(res, payments);
};

export const downloadReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  const payment = await Payment.findOne({ _id: req.params.id, user: req.user!._id, status: 'completed' })
    .populate({
      path: 'application',
      populate: [{ path: 'visaType', select: 'name visaCategory' }, { path: 'country', select: 'name flag' }],
    })
    .populate('user', 'name email accountType gstNumber')
    .populate('promoCode', 'code');

  if (!payment) { sendError(res, 'Payment not found', 404); return; }

  const app = payment.application as any;

  try {
    const countryCode = (app.country?.flag || 'XX').toUpperCase();
    const yearShort = new Date().getFullYear().toString().slice(-2);
    const appLastNum = (app.referenceId || '').split('-').pop() || '0000';

    const allPayments = await Payment.find({ application: app._id, status: 'completed' }).sort({ paidAt: 1 });
    const seqIdx = allPayments.findIndex((p) => String(p._id) === String(payment._id));
    const seqNo = String((seqIdx >= 0 ? seqIdx : 0) + 1).padStart(3, '0');
    const receiptNumber = `${countryCode}-${appLastNum}-${yearShort}-${seqNo}`;

    const receiptData = await buildReceiptData(payment, receiptNumber);
    const pdfBuffer = await generateReceiptPDF(receiptData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${app.referenceId}.pdf"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('[receipt] Failed to generate user receipt PDF:', err);
    sendError(res, 'Failed to generate receipt', 500);
  }
};

// Step 1: create a Razorpay order + pending Payment record
export const createPaymentOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }
  if (!['submitted', 'payment_pending'].includes(application.status)) { sendError(res, 'Payment is not required at this stage'); return; }
  if (!application.paymentAmount || application.paymentAmount <= 0) { sendError(res, 'Invalid payment amount'); return; }
  if (!isRazorpayConfigured()) { sendError(res, 'Payment gateway is not configured. Please contact support.', 503); return; }

  let billAmount = application.paymentAmount;
  let promoId: string | undefined;
  let discountApplied = 0;

  const promoCode = req.body?.promoCode;
  if (promoCode && req.user!.promoApplicable !== false) {
    const now = new Date();
    const promo = await PromoCode.findOne({
      code: String(promoCode).toUpperCase(),
      isDeleted: false,
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    if (promo && (promo.usageLimit === undefined || promo.usageCount < promo.usageLimit)) {
      if (promo.discountType === 'percentage') {
        discountApplied = Math.round((billAmount * promo.discountValue) / 100);
      } else {
        discountApplied = Math.min(promo.discountValue, billAmount);
      }
      billAmount = Math.max(0, billAmount - discountApplied);
      promoId = String(promo._id);
    }
  }

  try {
    const order = await createRazorpayOrder(billAmount, `rcpt_${application.referenceId}`, {
      applicationId: String(application._id),
      referenceId: application.referenceId,
    });

    await Payment.findOneAndUpdate(
      { application: application._id, user: req.user!._id, status: 'pending', gateway: 'razorpay' },
      {
        application: application._id,
        user: req.user!._id,
        amount: billAmount,
        currency: order.currency,
        method: 'online',
        status: 'pending',
        gateway: 'razorpay',
        razorpayOrderId: order.id,
        ...(promoId ? { promoCode: promoId, discountApplied } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    sendSuccess(res, {
      keyId: getRazorpayKeyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: 'Pravasa Transworld',
      description: `Visa application ${application.referenceId}`,
      prefill: {
        name: req.user!.name,
        email: req.user!.email,
        contact: (req.user as any).phone || '',
      },
      discountApplied,
      originalAmount: application.paymentAmount,
    });
  } catch (err) {
    console.error('Razorpay order creation failed', err);
    sendError(res, 'Could not initiate payment. Please try again.', 502);
  }
};

/**
 * A turned-down payment is a dead end for the applicant unless someone is told, so
 * every failure raises it on both sides: the applicant gets the gateway's own wording
 * and a nudge to retry, the admin gets a heads-up that the application is stuck at
 * payment. The application also drops to 'payment_pending' so it stops reading as a
 * fresh submission awaiting review.
 */
async function announcePaymentFailure(
  application: any,
  payment: any,
  userId: unknown,
  userName: string,
): Promise<void> {
  if (application.status === 'submitted') {
    application.status = 'payment_pending';
    await application.save();
  }

  const AdminNotification = (await import('../../models/AdminNotification')).default;
  const Notification = (await import('../../models/Notification')).default;
  const reason = payment.failureReason || 'The payment could not be completed';

  const adminNotif = await AdminNotification.create({
    title: 'Payment Failed',
    message: `${userName}'s payment of ₹${Number(payment.amount || 0).toLocaleString('en-IN')} for application ${application.referenceId} failed: ${reason}`,
    type: 'payment_failed',
    application: application._id,
  });

  const userNotif = await Notification.create({
    user: userId,
    title: 'Payment Failed',
    message: `Your payment for application ${application.referenceId} did not go through: ${reason}. No money has been taken — you can try again from the application page.`,
    type: 'payment_failed',
    application: application._id,
  });

  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to('admin_room').emit('admin_notification', adminNotif);
    getIO().to(`user_${userId}`).emit('notification', userNotif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }
}

/**
 * Records a checkout the gateway turned down. Razorpay reports these to the browser
 * through its `payment.failed` event and never calls our server, so the client hands
 * the reason over here — otherwise a declined card is indistinguishable from the user
 * simply closing the window.
 */
export const recordPaymentFailure = async (req: AuthRequest, res: Response): Promise<void> => {
  const { razorpayOrderId, razorpayPaymentId, code, description, reason } = req.body || {};

  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }

  // Pin to the order the failure belongs to; fall back to the open attempt when the
  // client could not tell us (the order id is absent on some gateway error payloads).
  const payment = razorpayOrderId
    ? await Payment.findOne({ application: application._id, user: req.user!._id, razorpayOrderId })
    : await Payment.findOne({ application: application._id, user: req.user!._id, status: 'pending' }).sort({ createdAt: -1 });

  if (!payment) { sendError(res, 'Payment order not found', 404); return; }
  // A late failure report must never undo a payment that already went through.
  if (payment.status === 'completed') { sendSuccess(res, payment, 'Payment already completed'); return; }
  // Retries of the same report must not re-notify anyone about the same failure.
  if (payment.status === 'failed') { sendSuccess(res, payment, 'Payment failure already recorded'); return; }

  payment.status = 'failed';
  payment.failureReason = String(description || reason || 'The payment could not be completed');
  payment.failureCode = String(code || '');
  payment.failedAt = new Date();
  if (razorpayPaymentId) payment.razorpayPaymentId = String(razorpayPaymentId);
  await payment.save();

  await announcePaymentFailure(application, payment, req.user!._id, req.user!.name);

  sendSuccess(res, payment, 'Payment failure recorded');
};

// Step 2: verify checkout signature, then mark payment complete
export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    sendError(res, 'Missing payment verification details'); return;
  }

  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }

  const payment = await Payment.findOne({
    application: application._id,
    user: req.user!._id,
    razorpayOrderId: razorpay_order_id,
  });
  if (!payment) { sendError(res, 'Payment order not found', 404); return; }

  // Idempotent: checkout handler + retries may both hit this endpoint
  if (payment.status === 'completed') { sendSuccess(res, { payment, application }, 'Payment already verified'); return; }

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    payment.status = 'failed';
    payment.failureReason = 'Payment signature verification failed';
    payment.failureCode = 'SIGNATURE_MISMATCH';
    payment.failedAt = new Date();
    payment.razorpayPaymentId = razorpay_payment_id;
    await payment.save();
    await announcePaymentFailure(application, payment, req.user!._id, req.user!.name);
    sendError(res, 'Payment verification failed. If money was deducted, it will be refunded automatically.', 400);
    return;
  }

  // The webhook may have completed it a moment ago; either way the result is the same.
  await completeOnlinePayment(payment._id, {
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  const [completed, updatedApp] = await Promise.all([
    Payment.findById(payment._id),
    Application.findById(application._id),
  ]);
  sendSuccess(res, { payment: completed, application: updatedApp }, 'Payment successful');
};
