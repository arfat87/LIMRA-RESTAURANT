import crypto from 'crypto';
import razorpay from '../../config/razorpay';
import { Order } from '../../models/Order.model';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

export const createRazorpayOrder = async (orderId: string, userId: string) => {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentStatus === 'PAID') throw new ApiError(400, 'Order is already paid.');

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.totalAmount), // already in paise
    currency: 'INR',
    receipt: `receipt_${orderId.toString().slice(-16)}`,
    notes: {
      orderId: orderId.toString(),
      userId: userId.toString(),
      storeName: process.env.STORE_NAME || 'DSLR WORLD',
    },
  });

  await Order.findByIdAndUpdate(orderId, { razorpayOrderId: razorpayOrder.id });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

export const verifyPayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  orderId: string
) => {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    throw new ApiError(400, 'Payment verification failed. Invalid signature.');
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    {
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    },
    { new: true }
  );

  logger.info(`✅ Payment verified for order: ${orderId}`);
  return { ...order!.toObject(), id: order!._id.toString() };
};

export const handleWebhook = async (
  rawBody: string,
  signature: string
): Promise<{ event: string }> => {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new ApiError(400, 'Invalid webhook signature.');
  }

  const payload = JSON.parse(rawBody);
  const event = payload.event as string;

  logger.info(`🔔 Razorpay webhook received: ${event}`);

  switch (event) {
    case 'payment.captured': {
      const paymentId = payload.payload.payment.entity.id as string;
      const notes = payload.payload.payment.entity.notes as { orderId?: string };
      if (notes?.orderId) {
        await Order.findByIdAndUpdate(notes.orderId, {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          razorpayPaymentId: paymentId,
        });
      }
      break;
    }
    case 'payment.failed': {
      const notes = payload.payload.payment.entity.notes as { orderId?: string };
      if (notes?.orderId) {
        await Order.findByIdAndUpdate(notes.orderId, { paymentStatus: 'FAILED' });
      }
      break;
    }
    case 'refund.created': {
      const notes = payload.payload.refund.entity.notes as { orderId?: string };
      if (notes?.orderId) {
        await Order.findByIdAndUpdate(notes.orderId, { paymentStatus: 'REFUNDED' });
      }
      break;
    }
    default:
      logger.info(`Unhandled webhook event: ${event}`);
  }

  return { event };
};
