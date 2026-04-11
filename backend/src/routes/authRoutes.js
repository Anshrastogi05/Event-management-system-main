import { Router } from 'express';
import {
  forgotPassword,
  login,
  me,
  resetPassword,
  resendOtp,
  signup,
  verifyOtp,
  verifyResetPasswordToken,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.post('/signup', signup);
router.post('/login', login);
router.post('/otp/verify', verifyOtp);
router.post('/otp/resend', resendOtp);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/verify/:token', verifyResetPasswordToken);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, me);

export default router;
