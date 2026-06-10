import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as CategoryService from './category.service';

export const getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await CategoryService.getAllCategories();
  res.json(new ApiResponse(200, 'Categories fetched', categories));
});

export const getProductsByCategory = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const result = await CategoryService.getProductsByCategory(req.params.slug, page, limit);
  res.json(new ApiResponse(200, 'Products fetched', result));
});
