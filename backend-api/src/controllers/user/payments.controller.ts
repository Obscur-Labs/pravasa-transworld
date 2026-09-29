import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import Payment from '../../models/Payment';
import Application from '../../models/Application';
import PromoCode from '../../models/PromoCode';
import { generateReceiptPDF } from '../../services/pdf.service';
import {
  PRE_PAYMENT_STAGES, UTR_RE, buildUpiLink, hasCompletedPayment, isUpiConfigured,
  loadPaymentConfig, notifyAdmins, notifyUser, renderPaymentTerms,
} from '../../services/payment.service';
import { alertAdminsOfPayment } from '../../services/paymentAlerts.service';
import { buildReceiptData } from '../../utils/receiptData';
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

/**
 * Step 1 of a UPI payment: works out the amount (with any promo), keeps one open payment
 * record for it, and returns what the customer needs to pay: UPI ID, payee name, the
 * upi:// link for the QR, and the confirmations they must accept when submitting.
 */
export const startUpiPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }
  if (!PRE_PAYMENT_STAGES.includes(application.status) || await hasCompletedPayment(application._id)) {
    sendError(res, 'Payment is not required at this stage'); return;
  }
  if (!application.paymentAmount || application.paymentAmount <= 0) { sendError(res, 'Invalid payment amount'); return; }
  if (await Payment.exists({ application: application._id, status: 'awaiting_verification' })) {
    sendError(res, 'Your payment has already been submitted and is being verified.', 409); return;
  }

  const config = await loadPaymentConfig();
  if (!isUpiConfigured(config)) {
    sendError(res, 'Online payment is not available right now. Please contact our team to complete your payment.', 503); return;
  }

  let amount = application.paymentAmount;
  let promoId: unknown;
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
      discountApplied = promo.discountType === 'percentage'
        ? Math.round((amount * promo.discountValue) / 100)
        : Math.min(promo.discountValue, amount);
      amount = Math.max(0, amount - discountApplied);
      promoId = promo._id;
    }
  }
  if (amount < 1) {
    sendError(res, 'This promo code covers the full amount. Please contact our team to complete your application.'); return;
  }

  const payment = await Payment.findOneAndUpdate(
    { application: application._id, user: req.user!._id, status: 'pending', method: 'upi' },
    {
      $set: {
        amount, currency: 'INR', gateway: 'upi', discountApplied,
        ...(promoId ? { promoCode: promoId } : {}),
      },
      ...(promoId ? {} : { $unset: { promoCode: '' } }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  sendSuccess(res, {
    paymentId: payment._id,
    referenceId: application.referenceId,
    amount,
    originalAmount: application.paymentAmount,
    discountApplied,
    upi: {
      upiId: config.upiId,
      payeeName: config.payeeName,
      link: buildUpiLink(config, amount, application.referenceId, String(payment._id)),
    },
    terms: renderPaymentTerms(config),
    verificationHours: config.verificationHours,
  });
};

/**
 * Step 2: the customer has paid in their UPI app and hands over the transaction reference.
 * Nothing is marked paid here. The payment waits for an admin to match the UTR against
 * the bank statement.
 */
export const submitUpiPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { paymentId, acceptedTerms } = req.body || {};
  const utr = String(req.body?.utr ?? '').replace(/\s+/g, '');
  if (!paymentId) { sendError(res, 'paymentId is required'); return; }
  if (!UTR_RE.test(utr)) { sendError(res, 'Enter the 12-digit UPI transaction reference (UTR) from your UPI app'); return; }

  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }

  const config = await loadPaymentConfig();
  const terms = renderPaymentTerms(config);
  const accepted: string[] = Array.isArray(acceptedTerms) ? acceptedTerms.map(String) : [];
  if (terms.some((t) => !accepted.includes(t))) { sendError(res, 'Please tick all the confirmations before submitting'); return; }

  if (await Payment.exists({ utr })) {
    sendError(res, 'This UTR has already been submitted. Please check the reference in your UPI app.', 409); return;
  }

  const submittedAt = new Date();
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, application: application._id, user: req.user!._id, status: 'pending' },
    {
      $set: {
        status: 'awaiting_verification', utr, acceptedTerms: terms, submittedAt,
        verifyBy: new Date(submittedAt.getTime() + config.verificationHours * 60 * 60 * 1000),
        remindersSent: [],
      },
    },
    { new: true }
  );
  if (!payment) { sendError(res, 'This payment was already submitted. Please refresh the page.', 409); return; }

  const amount = `₹${payment.amount.toLocaleString('en-IN')}`;
  await notifyAdmins({
    title: 'UPI Payment to Verify',
    message: `${req.user!.name} submitted a UPI payment of ${amount} for ${application.referenceId} (UTR ${utr}). Match it against the bank statement.`,
    type: 'payment_submitted',
    application: application._id,
  });
  await notifyUser(req.user!._id, {
    title: 'Payment Submitted',
    message: `We received your payment details for ${application.referenceId}. We will verify them within ${config.verificationHours} hours, and processing starts once verified.`,
    type: 'status_update',
    application: application._id,
  });

  // Emails go out in the background so the customer isn't kept waiting on them.
  alertAdminsOfPayment(payment, 'new').catch((err) => console.error('[PAYMENT_ALERT] New payment alert failed', err));

  sendSuccess(res, payment, 'Payment submitted for verification');
};
