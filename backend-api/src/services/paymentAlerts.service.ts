import Admin from '../models/Admin';
import Payment, { IPayment } from '../models/Payment';
import { sendAdminPaymentAlert } from './email.service';
import { METHOD_LABELS, notifyAdmins } from './payment.service';

// Reminders before the verification deadline, in minutes: 12h, 6h, 4h, 2h, then a final
// one just before it's due. Nothing is sent once the deadline has passed.
export const REMINDER_MINUTES_BEFORE = [12 * 60, 6 * 60, 4 * 60, 2 * 60, 15];

const CHECK_EVERY_MS = 60 * 1000;

export function formatTimeLeft(minutes: number): string {
  if (minutes >= 90) {
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const mins = Math.max(1, Math.round(minutes));
  return `${mins} minute${mins === 1 ? '' : 's'}`;
}

/** Email every admin and drop an in-app notification about one waiting payment. */
export async function alertAdminsOfPayment(payment: IPayment, kind: 'new' | 'reminder'): Promise<void> {
  const populated = await Payment.findById(payment._id)
    .populate('application', 'referenceId')
    .populate('user', 'name');
  if (!populated?.verifyBy || !populated.submittedAt) return;

  const app = populated.application as unknown as { _id: unknown; referenceId: string } | null;
  const customer = populated.user as unknown as { name: string } | null;
  const minutesLeft = (populated.verifyBy.getTime() - Date.now()) / 60000;
  const timeLeft = formatTimeLeft(minutesLeft);
  const referenceId = app?.referenceId || 'an application';
  const amount = `₹${populated.amount.toLocaleString('en-IN')}`;

  if (kind === 'reminder') {
    await notifyAdmins({
      title: `Payment verification due in ${timeLeft}`,
      message: `${amount} from ${customer?.name || 'a customer'} for ${referenceId} (UTR ${populated.utr}) is still waiting for verification.`,
      type: 'payment_reminder',
      application: app?._id ?? null,
    });
  }

  const admins = await Admin.find().select('email');
  await Promise.all(admins.map((a) =>
    sendAdminPaymentAlert(a.email, {
      kind,
      timeLeft,
      customerName: customer?.name || 'A customer',
      referenceId,
      amount: populated.amount,
      utr: populated.utr || '',
      method: METHOD_LABELS[populated.method] || 'UPI',
      hasScreenshot: !!populated.proofUrl,
      submittedAt: populated.submittedAt!,
      verifyBy: populated.verifyBy!,
    }).catch((err) => console.error(`[PAYMENT_ALERT] Mail to ${a.email} failed`, err?.message ?? err))
  ));
}

/**
 * Sends whichever reminders have come due. Safe to run on several servers at once and
 * after downtime: each offset is claimed atomically before sending, and if several fell
 * due while nothing was running, only the most urgent one goes out.
 */
export async function runPaymentReminders(now = new Date()): Promise<number> {
  const waiting = await Payment.find({ status: 'awaiting_verification', verifyBy: { $gt: now } })
    .select('submittedAt verifyBy remindersSent');
  let sent = 0;

  for (const p of waiting) {
    if (!p.submittedAt || !p.verifyBy) continue;
    const windowMin = (p.verifyBy.getTime() - p.submittedAt.getTime()) / 60000;
    const leftMin = (p.verifyBy.getTime() - now.getTime()) / 60000;
    // Offsets longer than the whole window (e.g. 12h on a 6h promise) never apply.
    const due = REMINDER_MINUTES_BEFORE.filter((m) => m < windowMin && leftMin <= m && !p.remindersSent.includes(m));
    if (!due.length) continue;

    const claimed = await Payment.findOneAndUpdate(
      { _id: p._id, status: 'awaiting_verification', remindersSent: { $nin: due } },
      { $addToSet: { remindersSent: { $each: due } } }
    );
    if (!claimed) continue;

    await alertAdminsOfPayment(p, 'reminder');
    sent++;
  }
  return sent;
}

/** Long-running server only. Serverless deployments call the cron endpoint instead. */
export function startPaymentReminderLoop(): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const sent = await runPaymentReminders();
      if (sent) console.log(`[PAYMENT_REMINDER] Sent ${sent} reminder(s)`);
    } catch (err) {
      console.error('[PAYMENT_REMINDER] Run failed', err);
    } finally {
      running = false;
    }
  };
  tick();
  setInterval(tick, CHECK_EVERY_MS);
}
