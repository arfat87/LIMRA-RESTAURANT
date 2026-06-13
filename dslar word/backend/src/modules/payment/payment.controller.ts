import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as PaymentService from './payment.service';

const createOrderSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID'),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID'),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { orderId } = createOrderSchema.parse(req.body);
  const result = await PaymentService.createRazorpayOrder(orderId, req.user.id);
  res.json(new ApiResponse(200, 'Razorpay order created', result));
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
    verifyPaymentSchema.parse(req.body);
  const order = await PaymentService.verifyPayment(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    orderId
  );
  res.json(new ApiResponse(200, 'Payment verified successfully', { orderId: order.id }));
});

export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) throw new ApiError(400, 'Missing webhook signature.');

  // rawBody is set by Express raw body middleware in app.ts for /webhook route
  const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);
  const result = await PaymentService.handleWebhook(rawBody, signature);
  res.json({ status: 'ok', event: result.event });
});
