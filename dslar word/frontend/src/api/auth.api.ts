import api from './axios';
import type { LoginInput, RegisterInput, LoginResponse } from '../types/auth.types';

export const authApi = {
  register: (data: RegisterInput) => api.post<{ data: { id: string; name: string; email: string } }>('/auth/register', data),
  login: (data: LoginInput) => api.post<{ data: LoginResponse }>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (refreshToken: string) => api.post<{ data: { accessToken: string; refreshToken: string } }>('/auth/refresh-token', { refreshToken }),
  sendOtp: (phone: string) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/auth/verify-otp', { phone, otp }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string, confirmPassword: string) =>
    api.post(`/auth/reset-password/${token}`, { password, confirmPassword }),
};
