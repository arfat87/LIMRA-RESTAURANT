import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { createProductSchema, updateProductSchema } from '../product/product.schema';
import { updateOrderStatusSchema } from '../order/order.schema';
import * as AdminService from './admin.service';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await AdminService.getDashboardStats();
  res.json(new ApiResponse(200, 'Dashboard stats fetched', stats));
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await AdminService.getAllUsers(page, limit);
  res.json(new ApiResponse(200, 'Users fetched', result));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await AdminService.deleteUser(req.params.id);
  res.json(new ApiResponse(200, 'User deleted', null));
});

// ─── Products ─────────────────────────────────────────────────────────────────

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const { body } = createProductSchema.parse({ body: req.body });
  const product = await AdminService.createProduct(body);
  res.status(201).json(new ApiResponse(201, 'Product created', product));
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { body } = updateProductSchema.parse({ body: req.body, params: req.params });
  const product = await AdminService.updateProduct(req.params.id, body);
  res.json(new ApiResponse(200, 'Product updated', product));
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await AdminService.deleteProduct(req.params.id);
  res.json(new ApiResponse(200, 'Product deactivated', null));
});

export const uploadProductImages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    throw new ApiError(400, 'No image files provided.');
  }
  const product = await AdminService.uploadProductImages(req.params.id, req.files);
  res.json(new ApiResponse(200, 'Images uploaded', product));
});

// ─── Categories ───────────────────────────────────────────────────────────────

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await AdminService.createCategory(req.body);
  res.status(201).json(new ApiResponse(201, 'Category created', category));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await AdminService.updateCategory(req.params.id, req.body);
  res.json(new ApiResponse(200, 'Category updated', category));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await AdminService.deleteCategory(req.params.id);
  res.json(new ApiResponse(200, 'Category deleted', null));
});

// ─── Orders ───────────────────────────────────────────────────────────────────

export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await AdminService.getAllOrders(page, limit);
  res.json(new ApiResponse(200, 'Orders fetched', result));
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { body } = updateOrderStatusSchema.parse({ body: req.body, params: req.params });
  const order = await AdminService.updateOrderStatus(req.params.id, body);
  res.json(new ApiResponse(200, 'Order status updated', order));
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await AdminService.getAllReviews(page, limit);
  res.json(new ApiResponse(200, 'Reviews fetched', result));
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await AdminService.deleteReview(req.params.id);
  res.json(new ApiResponse(200, 'Review deleted', null));
});
