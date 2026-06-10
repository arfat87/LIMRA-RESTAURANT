import axios from 'axios';
import { logger } from './logger';

// ─── In-Memory OTP Store ───────────────────────────────────────────────────────
// For production, replace with Redis for distributed/persistent storage

interface OtpEntry {
  otp: string;
  expiry: Date;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

/**
 * Generate a 6-digit OTP
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store OTP in memory with expiry
 */
export const storeOTP = (phone: string, otp: string): void => {
  const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  otpStore.set(phone, { otp, expiry, attempts: 0 });
  logger.info(`OTP stored for phone: ${phone.slice(0, 6)}***`);
};

/**
 * Verify OTP from store
 */
export const verifyOTPFromStore = (
  phone: string,
  inputOtp: string
): { valid: boolean; message: string } => {
  const entry = otpStore.get(phone);

  if (!entry) {
    return { valid: false, message: 'OTP not found or already used. Request a new one.' };
  }

  if (new Date() > entry.expiry) {
    otpStore.delete(phone);
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { valid: false, message: 'Too many failed attempts. Request a new OTP.' };
  }

  if (entry.otp !== inputOtp) {
    entry.attempts += 1;
    return { valid: false, message: `Invalid OTP. ${MAX_ATTEMPTS - entry.attempts} attempts remaining.` };
  }

  // Valid — remove from store (single use)
  otpStore.delete(phone);
  return { valid: true, message: 'OTP verified successfully' };
};

/**
 * Send OTP via MSG91 (Indian SMS gateway)
 */
export const sendOTPviaMSG91 = async (phone: string, otp: string): Promise<void> => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'DSLRWL';
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    // Development fallback — log to console
    logger.warn(`[DEV] OTP for ${phone}: ${otp}`);
    console.log(`\n🔐 [DEV MODE] OTP for ${phone}: ${otp}\n`);
    return;
  }

  try {
    await axios.post(
      'https://api.msg91.com/api/v5/otp',
      {
        template_id: templateId,
        mobile: `91${phone}`, // India country code
        authkey: authKey,
        otp,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    logger.info(`📱 OTP SMS sent to ${phone.slice(0, 6)}***`);
  } catch (error) {
    logger.error('❌ SMS send failed:', error);
    throw new Error('Failed to send OTP. Please try again.');
  }
};

/**
 * Combined: generate, store, and send OTP
 */
export const sendOTP = async (phone: string): Promise<string> => {
  const otp = generateOTP();
  storeOTP(phone, otp);
  await sendOTPviaMSG91(phone, otp);
  return otp;
};
