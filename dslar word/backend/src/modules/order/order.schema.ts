import { z } from 'zod';

export const placeOrderSchema = z.object({
  body: z.object({
    addressId: z.string().uuid('Invalid address ID'),
    paymentMethod: z.enum(['razorpay', 'cod']).default('razorpay'),
    notes: z.string().max(500).optional(),
    couponCode: z.string().optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'RETURNED',
    ]),
    trackingId: z.string().optional(),
    shiprocketOrderId: z.string().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>['body'];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>['body'];
