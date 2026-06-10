import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { placeOrderSchema } from './order.schema';
import * as OrderService from './order.service';

export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { body } = placeOrderSchema.parse({ body: req.body });
  const order = await OrderService.placeOrder(req.user.id, body);
  res.status(201).json(new ApiResponse(201, 'Order placed successfully', order));
});

export const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await OrderService.getUserOrders(req.user.id, page, limit);
  res.json(new ApiResponse(200, 'Orders fetched', result));
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const order = await OrderService.getOrderById(req.user.id, req.params.id);
  res.json(new ApiResponse(200, 'Order fetched', order));
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const order = await OrderService.cancelOrder(req.user.id, req.params.id);
  res.json(new ApiResponse(200, 'Order cancelled', order));
});

export const trackOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const tracking = await OrderService.trackOrder(req.user.id, req.params.id);
  res.json(new ApiResponse(200, 'Tracking info fetched', tracking));
});
