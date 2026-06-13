import api from './axios';
import type { Category } from '../types/product.types';

// ─── Admin Product APIs ────────────────────────────────────────────────────────
export const adminProductApi = {
  create: (data: FormData | object) =>
    api.post('/admin/products', data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }),

  update: (id: string, data: FormData | object) =>
    api.put(`/admin/products/${id}`, data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }),

  delete: (id: string) => api.delete(`/admin/products/${id}`),

  uploadImages: (id: string, files: FileList) => {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('images', f));
    return api.post(`/admin/products/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Admin Category APIs ───────────────────────────────────────────────────────
export const adminCategoryApi = {
  getAll: () => api.get<{ data: Category[] }>('/categories'),

  create: (data: { name: string; description?: string; image?: string }) =>
    api.post<{ data: Category }>('/admin/categories', data),

  update: (id: string, data: { name?: string; description?: string; image?: string }) =>
    api.put<{ data: Category }>(`/admin/categories/${id}`, data),

  delete: (id: string) => api.delete(`/admin/categories/${id}`),
};

// ─── Admin Order APIs ──────────────────────────────────────────────────────────
export const adminOrderApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/orders', { params }),

  getById: (id: string) => api.get(`/admin/orders/${id}`),

  updateStatus: (id: string, status: string, trackingId?: string) =>
    api.put(`/admin/orders/${id}/status`, { status, trackingId }),
};

// ─── Admin User APIs ───────────────────────────────────────────────────────────
export const adminUserApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/users', { params }),

  ban: (id: string) => api.put(`/admin/users/${id}/ban`),
  unban: (id: string) => api.put(`/admin/users/${id}/unban`),
  makeAdmin: (id: string) => api.put(`/admin/users/${id}/role`, { role: 'ADMIN' }),

  getDashboard: () => api.get('/admin/dashboard'),
};
