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
