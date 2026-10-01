import { asyncRouter } from '../utils/asyncRouter';
import { sendOtp, sendLoginOtp, verifyOtp, adminLogin } from '../controllers/auth.controller';
import { otpSendLimiter, otpVerifyLimiter, adminLoginLimiter } from '../middleware/rateLimiter';

const router = asyncRouter();

router.post('/send-otp', otpSendLimiter, sendOtp);
router.post('/send-login-otp', otpSendLimiter, sendLoginOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/admin/login', adminLoginLimiter, adminLogin);

export default router;
