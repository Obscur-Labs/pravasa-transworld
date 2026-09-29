import { asyncRouter } from '../utils/asyncRouter';
import { sendOtp, sendLoginOtp, verifyOtp, sendAdminOtp, verifyAdminOtp } from '../controllers/auth.controller';
import { otpSendLimiter, otpVerifyLimiter } from '../middleware/rateLimiter';

const router = asyncRouter();

router.post('/send-otp', otpSendLimiter, sendOtp);
router.post('/send-login-otp', otpSendLimiter, sendLoginOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/admin/send-otp', otpSendLimiter, sendAdminOtp);
router.post('/admin/verify-otp', otpVerifyLimiter, verifyAdminOtp);

export default router;
