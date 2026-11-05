import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Payment from '../../models/Payment';
import PaymentConfig, { DEFAULT_PAYMENT_TERMS } from '../../models/PaymentConfig';
import { IFSC_RE, METHOD_LABELS, availableMethods, UPI_ID_RE, approvePayment, loadPaymentConfig, rejectPayment } from '../../services/payment.service';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

const todayStartIst = () => new Date(`${new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)}T00:00:00+05:30`);

// A received amount that differs from what was due sends the payment to the Mismatch tab.
const MISMATCH = { status: 'awaiting_verification', receivedAmount: { $ne: null }, $expr: { $ne: ['$receivedAmount', '$amount'] } };
const TABS: Record<string, () => Record<string, unknown>> = {
  pending: () => ({ status: 'awaiting_verification', $or: [{ receivedAmount: null }, { $expr: { $eq: ['$receivedAmount', '$amount'] } }] }),
  mismatch: () => MISMATCH,
  approved_today: () => ({ status: 'completed', verifiedAt: { $gte: todayStartIst() } }),
  rejected: () => ({ status: 'failed', failedAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
};

/**
 * The verification queue by tab (pending, mismatch, approved today, rejected in the last
 * 30 days), oldest first, with whether each UTR was ever seen on another payment.
 */
export const getPendingPayments = async (req: AdminRequest, res: Response): Promise<void> => {
  const tab = TABS[String(req.query.tab)] ? String(req.query.tab) : 'pending';
  const [payments, config, ...counts] = await Promise.all([
    Payment.find(TABS[tab]())
      .populate({ path: 'application', select: 'referenceId status visaType country adults children', populate: [{ path: 'visaType', select: 'name' }, { path: 'country', select: 'name flag' }] })
      .populate('user', 'name email phone')
      .populate('promoCode', 'code')
      .sort(tab === 'pending' || tab === 'mismatch' ? { submittedAt: 1 } : { updatedAt: -1 })
      .limit(100),
    loadPaymentConfig(),
    ...Object.values(TABS).map((f) => Payment.countDocuments(f())),
  ]);

  const utrs = payments.map((p) => p.utr || p.rejectedUtr).filter(Boolean);
  const seen = await Payment.find({ $or: [{ utr: { $in: utrs } }, { rejectedUtr: { $in: utrs } }] }).select('utr rejectedUtr').lean();
  const withChecks = payments.map((p) => {
    const ref = p.utr || p.rejectedUtr;
    const reused = !!ref && seen.some((s) => String(s._id) !== String(p._id) && (s.utr === ref || s.rejectedUtr === ref));
    return { ...p.toJSON(), utrReused: reused };
  });

  sendSuccess(res, {
    tab,
    payments: withChecks,
    counts: Object.fromEntries(Object.keys(TABS).map((k, i) => [k, counts[i]])),
    verificationHours: config.verificationHours, upiId: config.upiId, methods: availableMethods(config),
  });
};

/** Records what actually reached the bank when it differs from the amount due. */
export const flagPaymentMismatch = async (req: AdminRequest, res: Response): Promise<void> => {
  const received = Number(req.body?.receivedAmount);
  if (!Number.isFinite(received) || received < 0) { sendError(res, 'Enter the amount that reached the bank'); return; }
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, status: 'awaiting_verification' },
    { $set: { receivedAmount: received, mismatchNote: String(req.body?.note ?? '').trim().slice(0, 300), bankCreditDate: String(req.body?.bankCreditDate ?? '').slice(0, 10) } },
    { new: true },
  );
  if (!payment) { sendError(res, 'This payment is no longer awaiting verification', 409); return; }
  logActivity(req, 'update', 'Payment', `Mismatch on ${payment.utr}: received ${received} of ${payment.amount}`);
  sendSuccess(res, payment, received === payment.amount ? 'Amount matches; back in Pending' : 'Moved to Mismatch');
};

export const approveUpiPayment = async (req: AdminRequest, res: Response): Promise<void> => {
  const received = req.body?.receivedAmount === undefined || req.body?.receivedAmount === '' ? null : Number(req.body.receivedAmount);
  if (received !== null && (!Number.isFinite(received) || received < 0)) { sendError(res, 'Enter a valid received amount'); return; }
  const due = await Payment.findById(req.params.id).select('amount');
  // Short payments are not approved; they go to Mismatch or are rejected with the balance due.
  if (received !== null && due && received < due.amount) {
    sendError(res, `Only ${received} of ${due.amount} was received. Move it to Mismatch or reject it.`); return;
  }
  const payment = await approvePayment(req.params.id, req.admin!, String(req.body?.note ?? '').trim(), {
    amount: received, bankCreditDate: String(req.body?.bankCreditDate ?? '').slice(0, 10),
  });
  if (!payment) { sendError(res, 'This payment is no longer awaiting verification', 409); return; }
  logActivity(req, 'update', 'Payment', `Verified ${METHOD_LABELS[payment.method] || 'UPI'} payment ${payment.transactionId}`);
  sendSuccess(res, payment, 'Payment verified');
};

export const rejectUpiPayment = async (req: AdminRequest, res: Response): Promise<void> => {
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) { sendError(res, 'A reason is required so the customer knows what to fix'); return; }
  const payment = await rejectPayment(req.params.id, req.admin!, reason);
  if (!payment) { sendError(res, 'This payment is no longer awaiting verification', 409); return; }
  logActivity(req, 'update', 'Payment', `Rejected ${METHOD_LABELS[payment.method] || 'UPI'} payment ${payment.rejectedUtr}: ${reason}`);
  sendSuccess(res, payment, 'Payment rejected');
};

export const getPaymentConfig = async (_req: AdminRequest, res: Response): Promise<void> => {
  const config = await loadPaymentConfig();
  sendSuccess(res, { config, defaultTerms: DEFAULT_PAYMENT_TERMS });
};

export const updatePaymentConfig = async (req: AdminRequest, res: Response): Promise<void> => {
  const { upiId, payeeName, merchantCode, verificationHours, terms, accountNumber, ifsc } = req.body || {};
  const update: Record<string, unknown> = {};

  for (const field of ['bankName', 'accountName', 'branch'] as const) {
    if (req.body?.[field] !== undefined) update[field] = String(req.body[field]).trim();
  }
  if (accountNumber !== undefined) {
    const value = String(accountNumber).replace(/\s+/g, '');
    if (value && !/^\d{6,20}$/.test(value)) { sendError(res, 'Account number should be 6 to 20 digits'); return; }
    update.accountNumber = value;
  }
  if (ifsc !== undefined) {
    const value = String(ifsc).trim().toUpperCase();
    if (value && !IFSC_RE.test(value)) { sendError(res, 'That does not look like an IFSC code (e.g. AUBL0002132)'); return; }
    update.ifsc = value;
  }

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
  logActivity(req, 'update', 'Payment Config', 'Payment settings');
  sendSuccess(res, { config, defaultTerms: DEFAULT_PAYMENT_TERMS }, 'Payment settings saved');
};
