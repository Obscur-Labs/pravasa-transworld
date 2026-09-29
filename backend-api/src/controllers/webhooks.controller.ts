import { Request, Response } from 'express';
import Payment from '../models/Payment';
import { completeOnlinePayment } from '../services/payment.service';
import { getWebhookSecret, verifyWebhookSignature } from '../services/razorpay.service';

const COMPLETION_EVENTS = new Set(['payment.captured', 'order.paid']);

/**
 * Razorpay's server-to-server confirmation. Without it a payment only completes when the
 * applicant's browser calls /payment/verify, so a closed tab or dropped connection after
 * the money is taken leaves the application stuck at payment_pending.
 *
 * Always answers 2xx for events it has handled or chosen to ignore; Razorpay retries
 * anything else.
 */
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  const secret = getWebhookSecret();
  if (!secret) {
    console.error('[WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not set; ignoring Razorpay webhook');
    res.status(503).json({ success: false, message: 'Webhook not configured' });
    return;
  }

  const rawBody = req.body as Buffer;
  const signature = req.header('x-razorpay-signature') || '';
  if (!Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature, secret)) {
    res.status(400).json({ success: false, message: 'Invalid signature' });
    return;
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  if (!COMPLETION_EVENTS.has(event?.event)) {
    res.json({ success: true, ignored: true });
    return;
  }

  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id ? String(entity.order_id) : '';
  const razorpayPaymentId = entity?.id ? String(entity.id) : '';
  if (!orderId || !razorpayPaymentId) {
    res.json({ success: true, ignored: true });
    return;
  }

  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment) {
    // An order created outside this app (or already purged). Nothing to reconcile.
    console.warn(`[WEBHOOK] No payment record for Razorpay order ${orderId}`);
    res.json({ success: true, ignored: true });
    return;
  }

  const expectedPaise = Math.round(payment.amount * 100);
  if (Number(entity.amount) !== expectedPaise) {
    console.error(`[WEBHOOK] Amount mismatch on order ${orderId}: got ${entity.amount}, expected ${expectedPaise}`);
    res.json({ success: true, ignored: true });
    return;
  }

  const completed = await completeOnlinePayment(payment._id, { razorpayPaymentId });
  if (completed) console.log(`[WEBHOOK] Payment completed via webhook for order ${orderId}`);
  res.json({ success: true });
};
