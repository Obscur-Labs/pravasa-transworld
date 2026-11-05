import Notification, { NotificationType } from '../models/Notification';
import User from '../models/User';
import { sendApplicationUpdateEmail } from '../services/email.service';

type AppRef = { _id: unknown; user: unknown; referenceId: string };

/**
 * Tells the customer about a processing step: an in-app notification, a live push to
 * their open tabs, and an email with the details. Email failures are logged, never thrown,
 * so the admin action that triggered it still succeeds.
 */
export async function notifyCustomer(app: AppRef, opts: {
  title: string;
  message: string;
  type?: NotificationType;
  emailSubject?: string;
  lines?: [string, string][];
}): Promise<void> {
  const userId = (app.user as { _id?: unknown })?._id ?? app.user;
  const notif = await Notification.create({
    user: userId,
    title: opts.title,
    message: opts.message,
    type: opts.type || 'status_update',
    application: app._id,
  });

  try {
    const { getIO } = await import('./socket');
    getIO().to(`user_${userId}`).emit('notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  const user = await User.findById(userId).select('name email');
  if (!user?.email) return;
  try {
    await sendApplicationUpdateEmail({
      email: user.email,
      name: user.name,
      subject: opts.emailSubject || opts.title,
      title: opts.title,
      message: opts.message,
      lines: opts.lines,
      referenceId: app.referenceId,
      applicationId: String(app._id),
    });
  } catch (err) {
    console.error('Application update email failed', err);
  }
}
