import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Payment from '../../models/Payment';
import PaymentConfig, { DEFAULT_PAYMENT_TERMS } from '../../models/PaymentConfig';
import { UPI_ID_RE, approvePayment, loadPaymentConfig, rejectPayment } from '../../services/payment.service';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

/** UPI payments customers have submitted, oldest first, so the longest-waiting is on top. */
export const getPendingPayments = async (_req: AdminRequest, res: Response): Promise<void> => {
  const [payments, config] = await Promise.all([
    Payment.find({ status: 'awaiting_verification' })
      .populate({ path: 'application', select: 'referenceId status visaType country', populate: [{ path: 'visaType', select: 'name' }, { path: 'country', select: 'name flag' }] })
      .populate('user', 'name email phone')
      .populate('promoCode', 'code')
      .sort({ submittedAt: 1 }),
    loadPaymentConfig(),
  ]);
  sendSuccess(res, { payments, verificationHours: config.verificationHours, upiId: config.upiId });
};

export const approveUpiPayment = async (req: AdminRequest, res: Response): Promise<void> => {
  const payment = await approvePayment(req.params.id, req.admin!, String(req.body?.note ?? '').trim());
  if (!payment) { sendError(res, 'This payment is no longer awaiting verification', 409); return; }
  logActivity(req, 'update', 'Payment', `Verified UPI payment ${payment.transactionId}`);
  sendSuccess(res, payment, 'Payment verified');
};

export const rejectUpiPayment = async (req: AdminRequest, res: Response): Promise<void> => {
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) { sendError(res, 'A reason is required so the customer knows what to fix'); return; }
  const payment = await rejectPayment(req.params.id, req.admin!, reason);
  if (!payment) { sendError(res, 'This payment is no longer awaiting verification', 409); return; }
  logActivity(req, 'update', 'Payment', `Rejected UPI payment ${payment.rejectedUtr}: ${reason}`);
  sendSuccess(res, payment, 'Payment rejected');
};

export const getPaymentConfig = async (_req: AdminRequest, res: Response): Promise<void> => {
  const config = await loadPaymentConfig();
  sendSuccess(res, { config, defaultTerms: DEFAULT_PAYMENT_TERMS });
};

export const updatePaymentConfig = async (req: AdminRequest, res: Response): Promise<void> => {
  const { upiId, payeeName, merchantCode, verificationHours, terms } = req.body || {};
  const update: Record<string, unknown> = {};

  if (upiId !== undefined) {
    const value = String(upiId).trim();
    if (value && !UPI_ID_RE.test(value)) { sendError(res, 'That does not look like a UPI ID (e.g. business@okbank)'); return; }
    update.upiId = value;
  }
  if (payeeName !== undefined) update.payeeName = String(payeeName).trim();
  if (merchantCode !== undefined) {
    const value = String(merchantCode).trim();
    if (value && !/^\d{4}$/.test(value)) { sendError(res, 'Merchant category code is 4 digits, or leave it blank'); return; }
    update.merchantCode = value;
  }
  if (verificationHours !== undefined) {
    const hours = Number(verificationHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) { sendError(res, 'Verification time must be between 1 and 168 hours'); return; }
    update.verificationHours = hours;
  }
  if (terms !== undefined) {
    if (!Array.isArray(terms)) { sendError(res, 'terms must be a list'); return; }
    const cleaned = terms.map((t) => String(t).trim()).filter(Boolean);
    if (!cleaned.length) { sendError(res, 'Keep at least one confirmation for customers to accept'); return; }
    update.terms = cleaned;
  }

  const config = await PaymentConfig.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true });
  logActivity(req, 'update', 'Payment Config', config.upiId || 'UPI settings');
  sendSuccess(res, { config, defaultTerms: DEFAULT_PAYMENT_TERMS }, 'Payment settings saved');
};
