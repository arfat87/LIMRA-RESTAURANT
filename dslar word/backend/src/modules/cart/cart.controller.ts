import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as CartService from './cart.service';

const addToCartSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.number().int().min(1).default(1),
});

const updateCartSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.number().int().min(1),
});

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const cart = await CartService.getCart(req.user.id);
  res.json(new ApiResponse(200, 'Cart fetched', cart));
});

export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { productId, quantity } = addToCartSchema.parse(req.body);
  const cart = await CartService.addToCart(req.user.id, productId, quantity);
  res.status(201).json(new ApiResponse(201, 'Item added to cart', cart));
});

export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { productId, quantity } = updateCartSchema.parse(req.body);
  const cart = await CartService.updateCartItem(req.user.id, productId, quantity);
  res.json(new ApiResponse(200, 'Cart updated', cart));
});

export const removeFromCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const cart = await CartService.removeFromCart(req.user.id, req.params.productId);
  res.json(new ApiResponse(200, 'Item removed from cart', cart));
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  await CartService.clearCart(req.user.id);
  res.json(new ApiResponse(200, 'Cart cleared', null));
});
