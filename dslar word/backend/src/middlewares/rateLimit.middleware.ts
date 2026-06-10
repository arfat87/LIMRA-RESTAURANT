import rateLimit from 'express-rate-limit';

/**
 * General rate limiter — 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * Strict rate limiter for auth routes — 5 requests per 15 minutes
 * Protects against brute-force and credential stuffing attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many auth attempts. Please wait 15 minutes before trying again.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * OTP rate limiter — 3 OTP requests per 10 minutes
 */
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many OTP requests. Please wait 10 minutes.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});
