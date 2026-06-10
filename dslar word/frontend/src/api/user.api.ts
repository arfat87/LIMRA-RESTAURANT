import api from './axios';
import type { User } from '../types/auth.types';
import type { Address } from '../types/order.types';

export const userApi = {
  getMe: () => api.get<{ data: User }>('/user/me'),
  updateMe: (data: Partial<{ name: string; phone: string }>) =>
    api.put<{ data: User }>('/user/me', data),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.put<{ data: { avatar: string } }>('/user/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAddresses: () => api.get<{ data: Address[] }>('/user/me/addresses'),
  addAddress: (data: Omit<Address, 'id' | 'userId' | 'createdAt'>) =>
    api.post<{ data: Address }>('/user/me/addresses', data),
  updateAddress: (id: string, data: Partial<Omit<Address, 'id' | 'userId' | 'createdAt'>>) =>
    api.put<{ data: Address }>(`/user/me/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/user/me/addresses/${id}`),
  setDefaultAddress: (id: string) => api.put(`/user/me/addresses/${id}/default`),

  // Shipping
  checkServiceability: (pincode: string) =>
    api.post('/shipping/check-serviceability', { pincode }),
};
