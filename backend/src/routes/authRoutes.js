import { Router } from 'express';
import {
  forgotPassword,
  login,
  googleAuthCallback,
  startGoogleAuth,
  me,
  resetPassword,
  resendOtp,
  signup,
  verifyOtp,
  verifyResetPasswordToken,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateForgotPassword,
  validateLogin,
  validateResendOtp,
  validateResetPassword,
  validateResetPasswordToken,
  validateSignup,
  validateVerifyOtp,
} from '../modules/auth/auth.validator.js';

const router = Router();
router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.get('/google', startGoogleAuth);
router.get('/google/callback', googleAuthCallback);
router.post('/otp/verify', validateVerifyOtp, verifyOtp);
router.post('/otp/resend', validateResendOtp, resendOtp);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.get('/reset-password/verify/:token', validateResetPasswordToken, verifyResetPasswordToken);
router.post('/reset-password', validateResetPassword, resetPassword);
router.get('/me', authenticate, me);

export default router;
