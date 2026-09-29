import Razorpay from 'razorpay';
import crypto from 'crypto';

// Test-mode (rzp_test_*) and live-mode (rzp_live_*) keys work identically —
// switching to production is purely an .env change.
const getKeys = () => ({
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
});

export const isRazorpayConfigured = (): boolean => {
  const { keyId, keySecret } = getKeys();
  return Boolean(keyId && keySecret);
};

export const getRazorpayKeyId = (): string => getKeys().keyId;

let instance: Razorpay | null = null;
const getInstance = (): Razorpay => {
  if (!instance) {
    const { keyId, keySecret } = getKeys();
    instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return instance;
};

export interface RazorpayOrder {
  id: string;
  amount: number; // in subunits (paise)
  currency: string;
  receipt?: string;
  status: string;
}

export const createRazorpayOrder = async (
  amount: number,
  receipt: string,
  notes: Record<string, string> = {}
): Promise<RazorpayOrder> => {
  const currency = process.env.RAZORPAY_CURRENCY || 'INR';
  const order = await getInstance().orders.create({
    amount: Math.round(amount * 100), // major units -> subunits
    currency,
    receipt: receipt.slice(0, 40), // Razorpay caps receipt at 40 chars
    notes,
  });
  return order as unknown as RazorpayOrder;
};

export const getWebhookSecret = (): string => process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';

// Webhook signature = HMAC-SHA256(raw request body, webhook secret). Must be computed on
// the exact bytes received, before any JSON parsing.
export const verifyWebhookSignature = (rawBody: Buffer, signature: string, secret: string): boolean => {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
};

// Razorpay checkout signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  const { keySecret } = getKeys();
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
};
