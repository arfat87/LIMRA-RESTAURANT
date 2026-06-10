import { Router } from 'express';
import * as AuthController from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authLimiter, otpLimiter } from '../../middlewares/rateLimit.middleware';

const router = Router();

// Public routes
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/send-otp', otpLimiter, AuthController.sendOtp);
router.post('/verify-otp', AuthController.verifyOtp);
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
router.post('/reset-password/:token', AuthController.resetPassword);

// Protected routes
router.post('/logout', authMiddleware, AuthController.logout);

export default router;
