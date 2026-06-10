import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

/**
 * Generate an access token (short-lived: 15m)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  } as SignOptions);
};

/**
 * Generate a refresh token (long-lived: 7d)
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  } as SignOptions);
};

/**
 * Verify an access token
 */
export const verifyAccessToken = (token: string): TokenPayload & JwtPayload => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as TokenPayload & JwtPayload;
};

/**
 * Verify a refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload & JwtPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload & JwtPayload;
};

/**
 * Generate a secure random hex token for password reset
 */
export const generateResetToken = (): string => {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a reset token for storage
 */
export const hashResetToken = (token: string): string => {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
};
