import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as WishlistService from './wishlist.service';

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const wishlist = await WishlistService.getWishlist(req.user.id);
  res.json(new ApiResponse(200, 'Wishlist fetched', wishlist));
});

export const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const item = await WishlistService.addToWishlist(req.user.id, req.params.productId);
  res.status(201).json(new ApiResponse(201, 'Added to wishlist', item));
});

export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  await WishlistService.removeFromWishlist(req.user.id, req.params.productId);
  res.json(new ApiResponse(200, 'Removed from wishlist', null));
});
