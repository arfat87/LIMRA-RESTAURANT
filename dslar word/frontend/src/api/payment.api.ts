import api from './axios';

export const paymentApi = {
  createOrder: (orderId: string) =>
    api.post<{ data: { razorpayOrderId: string; amount: number; currency: string; keyId: string } }>(
      '/payment/create-order', { orderId }
    ),

  verifyPayment: (data: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => api.post<{ data: { orderId: string } }>('/payment/verify', data),
};
