import api from './axios';
import type { ProductQuery, ProductsResponse, Product } from '../types/product.types';

export const productApi = {
  getProducts: (query: ProductQuery = {}) =>
    api.get<{ data: ProductsResponse }>('/products', { params: query }),

  getProduct: (slug: string) =>
    api.get<{ data: Product }>(`/products/${slug}`),

  getFeatured: () =>
    api.get<{ data: Product[] }>('/products/featured'),

  search: (q: string, page = 1, limit = 12) =>
    api.get<{ data: ProductsResponse }>('/products/search', { params: { q, page, limit } }),
};
