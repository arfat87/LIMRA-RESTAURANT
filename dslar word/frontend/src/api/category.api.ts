import api from './axios';
import type { Category } from '../types/product.types';

export const categoryApi = {
  getAll: () => api.get<{ data: Category[] }>('/categories'),
  getProducts: (slug: string, page = 1, limit = 12) =>
    api.get(`/categories/${slug}/products`, { params: { page, limit } }),
};
