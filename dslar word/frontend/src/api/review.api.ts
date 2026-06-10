import api from './axios';
import type { Review } from '../types/product.types';

export const reviewApi = {
  getProductReviews: (productId: string, page = 1, limit = 10) =>
    api.get<{ data: { reviews: Review[]; avgRating: number; pagination: object } }>(
      `/reviews/product/${productId}`, { params: { page, limit } }
    ),

  addReview: (productId: string, data: { rating: number; comment?: string }) =>
    api.post<{ data: Review }>(`/reviews/product/${productId}`, data),

  deleteReview: (reviewId: string) =>
    api.delete(`/reviews/${reviewId}`),
};
