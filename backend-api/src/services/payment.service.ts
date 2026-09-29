import Payment, { IPayment } from '../models/Payment';
import Application from '../models/Application';
import PromoCode from '../models/PromoCode';
import User from '../models/User';
import AdminNotification from '../models/AdminNotification';
import Notification from '../models/Notification';
import { getIO } from '../utils/socket';

// Stages an application can be in while its payment is still outstanding. A payment
// confirmed late (e.g. by webhook) must not drag an application that already moved on
// back to 'payment_completed'.
const PRE_PAYMENT_STAGES = ['submitted', 'documents_under_review', 'documents_approved', 'payment_pending'];

/**
 * Marks a gateway payment as completed and runs everything that follows from it.
 * Both the browser's verify call and the Razorpay webhook land here, often for the same
 * payment within seconds, so the status flip is atomic: only the caller that actually
 * completes it runs the side effects (promo usage, notifications).
 *
 * Returns the completed payment, or null when it was already completed.
 */
export async function completeOnlinePayment(
  paymentId: unknown,
  details: { razorpayPaymentId: string; razorpaySignature?: string }
): Promise<IPayment | null> {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $ne: 'completed' } },
    {
      $set: {
        status: 'completed',
        transactionId: details.razorpayPaymentId,
        razorpayPaymentId: details.razorpayPaymentId,
        ...(details.razorpaySignature ? { razorpaySignature: details.razorpaySignature } : {}),
        paidAt: new Date(),
      },
    },
    { new: true }
  );
  if (!payment) return null;

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
          usedAt: new Date(),
          discountApplied: payment.discountApplied || 0,
        },
      },
    });
  }

  const amount = `₹${payment.amount.toLocaleString('en-IN')}`;
  const adminNotif = await AdminNotification.create({
    title: 'Payment Received',
    message: `Payment of ${amount} received for application ${application.referenceId}.`,
    type: 'payment_received',
    application: application._id,
  });
  const userNotif = await Notification.create({
    user: payment.user,
    title: 'Payment Successful',
    message: `Your payment of ${amount} for application ${application.referenceId} was successful.`,
    type: 'status_update',
    application: application._id,
  });

  try {
    getIO().to('admin_room').emit('admin_notification', adminNotif);
    getIO().to(`user_${payment.user}`).emit('notification', userNotif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  return payment;
}
