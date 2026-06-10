import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import * as PaymentController from './payment.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// Webhook needs raw body for signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, _res: Response, next: NextFunction) => {
    // Attach rawBody for signature verification
    (req as Request & { rawBody?: string }).rawBody = req.body.toString('utf8');
    next();
  },
  PaymentController.webhook
);

// Protected routes
router.post('/create-order', authMiddleware, PaymentController.createOrder);
router.post('/verify', authMiddleware, PaymentController.verifyPayment);

export default router;
