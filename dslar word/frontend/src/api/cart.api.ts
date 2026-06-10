import api from './axios';
import type { Cart } from '../types/order.types';

export const cartApi = {
  getCart: () => api.get<{ data: Cart }>('/cart'),
  addItem: (productId: string, quantity = 1) =>
    api.post<{ data: Cart }>('/cart/add', { productId, quantity }),
  updateItem: (productId: string, quantity: number) =>
    api.put<{ data: Cart }>('/cart/update', { productId, quantity }),
  removeItem: (productId: string) =>
    api.delete<{ data: Cart }>(`/cart/remove/${productId}`),
  clearCart: () => api.delete('/cart/clear'),
};
