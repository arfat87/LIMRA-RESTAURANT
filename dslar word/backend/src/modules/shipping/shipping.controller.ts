import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as ShippingService from './shipping.service';

const checkServiceabilitySchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Invalid 6-digit pincode'),
  weight: z.number().optional().default(0.5),
});

export const checkServiceability = asyncHandler(async (req: Request, res: Response) => {
  const { pincode, weight } = checkServiceabilitySchema.parse(req.body);
  const result = await ShippingService.checkServiceability(pincode, weight);
  res.json(new ApiResponse(200, 'Serviceability checked', result));
});

export const trackShipment = asyncHandler(async (req: Request, res: Response) => {
  const { trackingId } = req.params;
  if (!trackingId) throw new ApiError(400, 'Tracking ID is required.');
  const result = await ShippingService.trackByTrackingId(trackingId);
  res.json(new ApiResponse(200, 'Tracking info fetched', result));
});
