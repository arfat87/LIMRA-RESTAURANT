import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { updateProfileSchema, addAddressSchema, updateAddressSchema } from './user.schema';
import * as UserService from './user.service';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const user = await UserService.getUserById(req.user.id);
  res.json(new ApiResponse(200, 'Profile fetched', user));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { body } = updateProfileSchema.parse({ body: req.body });
  const user = await UserService.updateProfile(req.user.id, body);
  res.json(new ApiResponse(200, 'Profile updated successfully', user));
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  if (!req.file) throw new ApiError(400, 'No image file provided.');
  const avatarUrl = await UserService.updateAvatar(req.user.id, req.file.buffer);
  res.json(new ApiResponse(200, 'Avatar updated', { avatar: avatarUrl }));
});

export const getAddresses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const addresses = await UserService.getAddresses(req.user.id);
  res.json(new ApiResponse(200, 'Addresses fetched', addresses));
});

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { body } = addAddressSchema.parse({ body: req.body });
  const address = await UserService.addAddress(req.user.id, body);
  res.status(201).json(new ApiResponse(201, 'Address added', address));
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const { body, params } = updateAddressSchema.parse({ body: req.body, params: req.params });
  const address = await UserService.updateAddress(req.user.id, params.id, body);
  res.json(new ApiResponse(200, 'Address updated', address));
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  await UserService.deleteAddress(req.user.id, req.params.id);
  res.json(new ApiResponse(200, 'Address deleted', null));
});

export const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const address = await UserService.setDefaultAddress(req.user.id, req.params.id);
  res.json(new ApiResponse(200, 'Default address updated', address));
});
