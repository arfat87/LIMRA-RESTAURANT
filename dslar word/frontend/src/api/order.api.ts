import api from './axios';
import type { Order } from '../types/order.types';

interface PlaceOrderInput {
  addressId: string;
  paymentMethod?: 'razorpay' | 'cod';
  notes?: string;
}

export const orderApi = {
  placeOrder: (data: PlaceOrderInput) =>
    api.post<{ data: Order }>('/orders', data),

  getOrders: (page = 1, limit = 10) =>
    api.get<{ data: { orders: Order[]; pagination: object } }>('/orders', { params: { page, limit } }),

  getOrder: (id: string) =>
    api.get<{ data: Order }>(`/orders/${id}`),

  cancelOrder: (id: string) =>
    api.post<{ data: Order }>(`/orders/${id}/cancel`),

  trackOrder: (id: string) =>
    api.get(`/orders/${id}/track`),
};
