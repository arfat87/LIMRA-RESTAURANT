import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { productQuerySchema } from './product.schema';
import * as ProductService from './product.service';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { query } = productQuerySchema.parse({ query: req.query });
  const result = await ProductService.getProducts(query);
  res.json(new ApiResponse(200, 'Products fetched', result));
});

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductService.getProductBySlug(req.params.slug);
  res.json(new ApiResponse(200, 'Product fetched', product));
});

export const getFeaturedProducts = asyncHandler(async (req: Request, res: Response) => {
  const products = await ProductService.getFeaturedProducts();
  res.json(new ApiResponse(200, 'Featured products fetched', products));
});

export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) throw new ApiError(400, 'Search query (q) is required.');
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const result = await ProductService.searchProducts(q, page, limit);
  res.json(new ApiResponse(200, `Search results for "${q}"`, result));
});
