import Payment, { IPayment } from '../models/Payment';
import PaymentConfig, { IPaymentConfig } from '../models/PaymentConfig';
import Application from '../models/Application';
import PromoCode from '../models/PromoCode';
import User from '../models/User';
import AdminNotification from '../models/AdminNotification';
import Notification from '../models/Notification';
import { sendPaymentReviewEmail } from './email.service';
import { getIO } from '../utils/socket';

// Stages an application can be in while its payment is still outstanding.
export const PRE_PAYMENT_STAGES = ['submitted', 'documents_under_review', 'documents_approved', 'payment_pending'];

// Stages that mean work has started. Reaching them needs a completed payment.
export const POST_PAYMENT_STAGES = ['payment_completed', 'visa_processing', 'embassy_review', 'visa_approved', 'visa_delivered'];

export const UPI_ID_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
// A UPI transaction reference (RRN / UTR) is always 12 digits.
export const UTR_RE = /^\d{12}$/;

export const loadPaymentConfig = () =>
  PaymentConfig.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });

export const isUpiConfigured = (config: IPaymentConfig) => UPI_ID_RE.test(config.upiId) && !!config.payeeName;

/** The confirmations exactly as the customer sees them. */
export const renderPaymentTerms = (config: IPaymentConfig): string[] =>
  config.terms
    .map((t) => t.split('{hours}').join(String(config.verificationHours)).trim())
    .filter(Boolean);

/**
 * upi:// deep link, also encoded into the QR. Built by hand rather than with
 * URLSearchParams, which writes spaces as "+" and some UPI apps show them literally.
 * `tr` is only valid for merchant UPI IDs, so it goes in only with a merchant code.
 */
export function buildUpiLink(config: IPaymentConfig, amount: number, note: string, reference: string): string {
  const params: [string, string][] = [
    ['pa', config.upiId],
    ['pn', config.payeeName],
    ['am', amount.toFixed(2)],
    ['cu', 'INR'],
    ['tn', note],
  ];
  if (config.merchantCode) params.push(['mc', config.merchantCode], ['tr', reference]);
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export async function hasCompletedPayment(applicationId: unknown): Promise<boolean> {
  return !!(await Payment.exists({ application: applicationId, status: 'completed' }));
}

export async function notifyUser(userId: unknown, notif: { title: string; message: string; type: string; application: unknown }) {
  const created = await Notification.create({ user: userId, ...notif });
  try { getIO().to(`user_${userId}`).emit('notification', created); } catch (err) { console.error('Socket emission failed', err); }
}

export async function notifyAdmins(notif: { title: string; message: string; type: string; application: unknown }) {
  const created = await AdminNotification.create(notif);
  try { getIO().to('admin_room').emit('admin_notification', created); } catch (err) { console.error('Socket emission failed', err); }
}

/** Tells every open admin screen that the verification queue changed. */
export function announceQueueChange(): void {
  try { getIO().to('admin_room').emit('payments_changed'); } catch { /* sockets not running (e.g. serverless) */ }
}

type Reviewer = { _id: unknown; name: string };

/**
 * Marks a submitted UPI payment as verified and starts the application. The status flip
 * is conditional, so two admins clicking at once can't both run the side effects.
 * Returns null when the payment was not awaiting verification.
 */
export async function approvePayment(paymentId: string, admin: Reviewer, note = ''): Promise<IPayment | null> {
  const current = await Payment.findOne({ _id: paymentId, status: 'awaiting_verification' }).select('utr');
  if (!current) return null;

  const now = new Date();
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'awaiting_verification' },
    {
      $set: {
        status: 'completed',
        transactionId: current.utr || '',
        paidAt: now,
        verifiedAt: now,
        verifiedBy: admin._id,
        verifiedByName: admin.name,
        ...(note ? { adminNote: note } : {}),
      },
    },
    { new: true }
  );
  if (!payment) return null;
  announceQueueChange();

  const application = await Application.findById(payment.application);
  if (!application) return payment;
  if (PRE_PAYMENT_STAGES.includes(application.status)) {
    application.status = 'payment_completed';
    await application.save();
  }

  const user = await User.findById(payment.user).select('name email');

  if (payment.promoCode) {
    await PromoCode.findByIdAndUpdate(payment.promoCode, {
      $inc: { usageCount: 1 },
      $push: {
        usedBy: {
          user: payment.user,
          userName: user?.name || '',
          userEmail: user?.email || '',
          applicationId: application._id,
          applicationRef: application.referenceId,
          usedAt: now,
          discountApplied: payment.discountApplied || 0,
        },
      },
    });
  }

  await notifyUser(payment.user, {
    title: 'Payment Verified',
    message: `Your payment of ₹${payment.amount.toLocaleString('en-IN')} for application ${application.referenceId} has been verified. Visa processing has started.`,
    type: 'status_update',
    application: application._id,
  });

  if (user) {
    sendPaymentReviewEmail(user.email, user.name, application.referenceId, String(application._id), { verified: true, amount: payment.amount })
      .catch((err) => console.error('Payment verified email failed', err));
  }

  return payment;
}

/**
 * Rejects a submitted UPI payment. The UTR is moved aside so the customer can submit
 * the same reference again if the rejection was a mistake on either side.
 */
export async function rejectPayment(paymentId: string, admin: Reviewer, reason: string): Promise<IPayment | null> {
  const current = await Payment.findOne({ _id: paymentId, status: 'awaiting_verification' }).select('utr');
  if (!current) return null;

  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'awaiting_verification' },
    {
      $set: {
        status: 'failed',
        failureReason: reason,
        failedAt: new Date(),
        verifiedBy: admin._id,
        verifiedByName: admin.name,
        rejectedUtr: current.utr || '',
      },
      $unset: { utr: '' },
    },
    { new: true }
  );
  if (!payment) return null;
  announceQueueChange();

  const application = await Application.findById(payment.application);
  if (!application) return payment;
  if (application.status === 'submitted') {
    application.status = 'payment_pending';
    await application.save();
  }

  await notifyUser(payment.user, {
    title: 'Payment Could Not Be Verified',
    message: `We could not verify your payment for application ${application.referenceId}: ${reason}. Please check the details and submit the payment again from the application page.`,
    type: 'payment_failed',
    application: application._id,
  });

  const user = await User.findById(payment.user).select('name email');
  if (user) {
    sendPaymentReviewEmail(user.email, user.name, application.referenceId, String(application._id), { verified: false, reason })
      .catch((err) => console.error('Payment rejected email failed', err));
  }

  return payment;
}
