import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../../models/User.model';
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

  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    if (existing.email === email) throw new ApiError(409, 'Email already in use.');
    throw new ApiError(409, 'Phone number already in use.');
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, phone, password: hashedPassword });

  sendEmail({
    to: email,
    subject: 'Welcome to DSLR WORLD! 📷',
    html: welcomeEmailTemplate(name),
  }).catch(() => {});

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
};

export const loginUser = async (data: LoginInput) => {
  const { email, password } = data;

  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password.');

  const payload = { id: user._id.toString(), email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const hashedRefresh = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await User.findByIdAndUpdate(user._id, { refreshToken: hashedRefresh });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
    },
  };
};

export const logoutUser = async (userId: string) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

export const refreshAccessToken = async (refreshToken: string) => {
  let decoded: { id: string; email: string; role: string };
  try {
    decoded = verifyRefreshToken(refreshToken) as typeof decoded;
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token. Please login again.');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.refreshToken) {
    throw new ApiError(401, 'Session expired. Please login again.');
  }

  const hashedInput = crypto.createHash('sha256').update(refreshToken).digest('hex');
  if (hashedInput !== user.refreshToken) {
    throw new ApiError(401, 'Token mismatch. Please login again.');
  }

  const payload = { id: user._id.toString(), email: user.email, role: user.role };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  const hashedNewRefresh = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  await User.findByIdAndUpdate(user._id, { refreshToken: hashedNewRefresh });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const sendOtpService = async (phone: string) => {
  await sendOTP(phone);
};

export const verifyOtpService = async (phone: string, otp: string) => {
  const result = verifyOTPFromStore(phone, otp);
  if (!result.valid) throw new ApiError(400, result.message);

  const user = await User.findOne({ phone });
  if (user) {
    await User.findByIdAndUpdate(user._id, { isVerified: true });
  }
  return result.message;
};

export const forgotPasswordService = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) return; // Silent — prevent email enumeration

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  resetStore.set(hashedToken, { hashedToken, expiry, userId: user._id.toString() });

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
  await User.findByIdAndUpdate(entry.userId, { password: hashedPassword, refreshToken: null });

  resetStore.delete(hashedToken);
};
