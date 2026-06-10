import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as ReviewService from './review.service';

const addReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const addReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const data = addReviewSchema.parse(req.body);
  const review = await ReviewService.addReview(req.user.id, req.params.productId, data);
  res.status(201).json(new ApiResponse(201, 'Review added', review));
});

export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await ReviewService.getProductReviews(req.params.productId, page, limit);
  res.json(new ApiResponse(200, 'Reviews fetched', result));
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  await ReviewService.deleteReview(req.user.id, req.params.id, req.user.role === 'ADMIN');
  res.json(new ApiResponse(200, 'Review deleted', null));
});
