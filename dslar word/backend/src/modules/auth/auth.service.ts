import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/generateToken';
import {
  sendEmail,
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
} from '../../utils/sendEmail';
import { sendOTP, verifyOTPFromStore } from '../../utils/sendSMS';
import type { RegisterInput, LoginInput } from './auth.schema';

const SALT_ROUNDS = 12;

// ─── In-memory password reset store ──────────────────────────────────────────
interface ResetEntry {
  hashedToken: string;
  expiry: Date;
  userId: string;
}
const resetStore = new Map<string, ResetEntry>();

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const registerUser = async (data: RegisterInput) => {
  const { name, email, phone, password } = data;

  // Check duplicates
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    if (existing.email === email) throw new ApiError(409, 'Email already in use.');
    throw new ApiError(409, 'Phone number already in use.');
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, phone, password: hashedPassword },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  // Send welcome email (non-blocking)
  sendEmail({
    to: email,
    subject: 'Welcome to DSLR WORLD! 📷',
    html: welcomeEmailTemplate(name),
  }).catch(() => {}); // Silently fail

  return user;
};

export const loginUser = async (data: LoginInput) => {
  const { email, password } = data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password.');

  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store hashed refresh token
  const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashedRefresh },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
    },
  };
};

export const logoutUser = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
};

export const refreshAccessToken = async (refreshToken: string) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token. Please login again.');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.refreshToken) {
    throw new ApiError(401, 'Session expired. Please login again.');
  }

  const hashedInput = crypto.createHash('sha256').update(refreshToken).digest('hex');
  if (hashedInput !== user.refreshToken) {
    throw new ApiError(401, 'Token mismatch. Please login again.');
  }

  const payload = { id: user.id, email: user.email, role: user.role };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  const hashedNewRefresh = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: hashedNewRefresh },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const sendOtpService = async (phone: string) => {
  await sendOTP(phone);
};

export const verifyOtpService = async (phone: string, otp: string) => {
  const result = verifyOTPFromStore(phone, otp);
  if (!result.valid) throw new ApiError(400, result.message);

  // Mark user as verified if they exist
  const user = await prisma.user.findUnique({ where: { phone } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
  }
  return result.message;
};

export const forgotPasswordService = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success to prevent email enumeration
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  resetStore.set(hashedToken, { hashedToken, expiry, userId: user.id });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
  await sendEmail({
    to: email,
    subject: 'Password Reset Request — DSLR WORLD',
    html: passwordResetEmailTemplate(user.name, resetUrl),
  });
};

export const resetPasswordService = async (token: string, newPassword: string) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const entry = resetStore.get(hashedToken);

  if (!entry || new Date() > entry.expiry) {
    throw new ApiError(400, 'Reset token is invalid or has expired.');
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: entry.userId },
    data: { password: hashedPassword, refreshToken: null },
  });

  resetStore.delete(hashedToken);
};
