import { asyncRouter } from '../utils/asyncRouter';
import { sendOtp, sendLoginOtp, verifyOtp, adminLogin, adminVerifyTwoFactor, getAdminInvite, acceptAdminInvite } from '../controllers/auth.controller';
import { otpSendLimiter, otpVerifyLimiter, adminLoginLimiter } from '../middleware/rateLimiter';

const router = asyncRouter();

router.post('/send-otp', otpSendLimiter, sendOtp);
router.post('/send-login-otp', otpSendLimiter, sendLoginOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/admin/login', adminLoginLimiter, adminLogin);
router.post('/admin/2fa', adminLoginLimiter, adminVerifyTwoFactor);
router.get('/admin/invite/:token', adminLoginLimiter, getAdminInvite);
router.post('/admin/accept-invite', adminLoginLimiter, acceptAdminInvite);

export default router;
