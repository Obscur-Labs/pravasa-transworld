import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncRouter } from '../utils/asyncRouter';
import { runPaymentReminders } from '../services/paymentAlerts.service';

// For serverless hosting, where no background loop survives between requests: an
// external scheduler calls this every minute with "Authorization: Bearer <CRON_SECRET>".
// Hidden entirely when CRON_SECRET is not set.
const router = asyncRouter();

const authorized = (req: Request): boolean => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

router.get('/payment-reminders', async (req: Request, res: Response) => {
  if (!authorized(req)) { res.status(404).json({ success: false, message: 'Route not found' }); return; }
  const sent = await runPaymentReminders();
  res.json({ success: true, sent });
});

export default router;
