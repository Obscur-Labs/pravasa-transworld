import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import Payment from '../../models/Payment';
import Application from '../../models/Application';
import PromoCode from '../../models/PromoCode';
import { generateReceiptPDF } from '../../services/pdf.service';
import { deleteFromCloudinary, uploadToCloudinary } from '../../services/cloudinary.service';
import {
  METHOD_LABELS, PRE_PAYMENT_STAGES, availableMethods, buildUpiLink, hasCompletedPayment, isValidReference,
  loadPaymentConfig, normalizeReference, notifyAdmins, notifyUser, renderPaymentTerms, type PaymentMethodChoice,
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
 * Step 1: works out the amount (with any promo), keeps one open payment record for it, and
 * returns everything the customer needs to pay by any enabled method (UPI details and QR
 * link, bank account details) plus the confirmations they must accept when submitting.
 * The method itself is chosen at submit, so switching tabs needs no round trip.
 */
export const startPayment = async (req: AuthRequest, res: Response): Promise<void> => {
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
  const methods = availableMethods(config);
  if (!methods.length) {
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
    { application: application._id, user: req.user!._id, status: 'pending' },
    {
      $set: {
        amount, currency: 'INR', discountApplied,
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
    methods,
    upi: methods.includes('upi') ? {
      upiId: config.upiId,
      payeeName: config.payeeName,
      link: buildUpiLink(config, amount, application.referenceId, String(payment._id)),
    } : null,
    bank: methods.includes('bank_transfer') ? {
      bankName: config.bankName,
      accountName: config.accountName,
      accountNumber: config.accountNumber,
      ifsc: config.ifsc,
      branch: config.branch,
    } : null,
    terms: renderPaymentTerms(config),
    verificationHours: config.verificationHours,
  });
};

/** acceptedTerms arrives as a JSON array (JSON body) or a JSON string (multipart form). */
function parseTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
  }
  return [];
}

/**
 * Step 2: the customer has paid and hands over the transaction reference, optionally with
 * a screenshot. Nothing is marked paid here: the payment waits for an admin to match the
 * reference against the bank statement.
 */
export const submitPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { paymentId } = req.body || {};
  const method: PaymentMethodChoice = req.body?.method === 'bank_transfer' ? 'bank_transfer' : 'upi';
  const utr = normalizeReference(req.body?.utr ?? req.body?.reference);
  if (!paymentId) { sendError(res, 'paymentId is required'); return; }
  if (!isValidReference(method, utr)) {
    sendError(res, method === 'upi'
      ? 'Enter the 12-digit UPI transaction reference (UTR) from your UPI app'
      : 'Enter the transaction reference (UTR) from your bank: 12 to 22 letters and numbers');
    return;
  }

  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }

  const config = await loadPaymentConfig();
  if (!availableMethods(config).includes(method)) { sendError(res, 'This payment method is not available'); return; }
  const terms = renderPaymentTerms(config);
  const accepted = parseTerms(req.body?.acceptedTerms);
  if (terms.some((t) => !accepted.includes(t))) { sendError(res, 'Please tick all the confirmations before submitting'); return; }

  if (await Payment.exists({ utr })) {
    sendError(res, 'This reference has already been submitted. Please check it in your payment app or bank statement.', 409); return;
  }

  // Screenshot last, so a rejected submission never leaves a file behind.
  let proof: { url: string; publicId: string } | null = null;
  if (req.file) {
    proof = await uploadToCloudinary(req.file.buffer, `users/${req.user!._id}/payments/${application.referenceId}`, 'auto', { private: true });
  }

  const submittedAt = new Date();
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, application: application._id, user: req.user!._id, status: 'pending' },
    {
      $set: {
        status: 'awaiting_verification', method, gateway: method, utr, acceptedTerms: terms, submittedAt,
        verifyBy: new Date(submittedAt.getTime() + config.verificationHours * 60 * 60 * 1000),
        remindersSent: [],
        ...(proof ? { proofUrl: proof.url, proofPublicId: proof.publicId } : {}),
      },
    },
    { new: true }
  );
  if (!payment) {
    if (proof) deleteFromCloudinary(proof.publicId, proof.url).catch(() => {});
    sendError(res, 'This payment was already submitted. Please refresh the page.', 409); return;
  }

  const amount = `₹${payment.amount.toLocaleString('en-IN')}`;
  const via = METHOD_LABELS[method];
  await notifyAdmins({
    title: `${via} Payment to Verify`,
    message: `${req.user!.name} submitted a ${via.toLowerCase()} payment of ${amount} for ${application.referenceId} (UTR ${utr})${proof ? ' with a screenshot' : ''}. Match it against the bank statement.`,
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
