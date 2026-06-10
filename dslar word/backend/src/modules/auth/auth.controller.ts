import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from './auth.schema';
import * as AuthService from './auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { body } = registerSchema.parse({ body: req.body });
  const user = await AuthService.registerUser(body);
  res.status(201).json(new ApiResponse(201, 'Registration successful. Welcome to DSLR WORLD!', user));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { body } = loginSchema.parse({ body: req.body });
  const result = await AuthService.loginUser(body);
  res.status(200).json(new ApiResponse(200, 'Login successful', result));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  await AuthService.logoutUser(req.user.id);
  res.status(200).json(new ApiResponse(200, 'Logged out successfully', null));
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { body } = refreshTokenSchema.parse({ body: req.body });
  const tokens = await AuthService.refreshAccessToken(body.refreshToken);
  res.status(200).json(new ApiResponse(200, 'Token refreshed', tokens));
});

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { body } = sendOtpSchema.parse({ body: req.body });
  await AuthService.sendOtpService(body.phone);
  res.status(200).json(new ApiResponse(200, 'OTP sent successfully', null));
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { body } = verifyOtpSchema.parse({ body: req.body });
  const message = await AuthService.verifyOtpService(body.phone, body.otp);
  res.status(200).json(new ApiResponse(200, message, null));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { body } = forgotPasswordSchema.parse({ body: req.body });
  await AuthService.forgotPasswordService(body.email);
  res.status(200).json(
    new ApiResponse(200, 'If an account exists, a password reset link has been sent.', null)
  );
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { body, params } = resetPasswordSchema.parse({ body: req.body, params: req.params });
  await AuthService.resetPasswordService(params.token, body.password);
  res.status(200).json(new ApiResponse(200, 'Password reset successfully. Please login.', null));
});
