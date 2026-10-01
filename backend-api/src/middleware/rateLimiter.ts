import rateLimit from 'express-rate-limit';

// Per-IP ceilings. Kept loose because an office NAT puts many customers behind one IP;
// the per-email resend cooldown and per-code attempt cap in auth.controller are the real
// protection, and they live in the database so they hold across server instances.
const limiter = (limit: number, message: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

export const otpSendLimiter = limiter(20, 'Too many OTP requests from this network. Please try again in a few minutes.');
export const otpVerifyLimiter = limiter(50, 'Too many verification attempts from this network. Please try again in a few minutes.');
export const inquiryLimiter = limiter(30, 'Too many requests from this network. Please try again in a few minutes.');

// Per signed-in admin (runs after adminProtect), to keep the Groq quota from being drained.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String((req as { admin?: { _id: unknown } }).admin?._id ?? 'anonymous'),
  message: { success: false, message: 'Too many AI requests. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
