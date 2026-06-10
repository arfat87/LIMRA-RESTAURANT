import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

/**
 * Global Error Handling Middleware
 * Catches all errors thrown in the app and returns a consistent error response.
 * Must be registered LAST in Express middleware chain.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the error
  logger.error(`[${req.method}] ${req.path} — ${err.message}`, {
    stack: err.stack,
    body: req.body,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    res.status(422).json({
      success: false,
      statusCode: 422,
      message: 'Validation failed',
      errors,
    });
    return;
  }

  // Custom ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // Prisma unique constraint violation (P2002)
  if (err.message.includes('Unique constraint failed')) {
    res.status(409).json({
      success: false,
      statusCode: 409,
      message: 'A record with these details already exists.',
      errors: [],
    });
    return;
  }

  // Prisma record not found (P2025)
  if (err.message.includes('Record to update not found') || err.message.includes('No')) {
    res.status(404).json({
      success: false,
      statusCode: 404,
      message: 'Resource not found.',
      errors: [],
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Invalid or expired token.',
      errors: [],
    });
    return;
  }

  // Generic/unhandled errors
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    statusCode,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : err.message || 'Internal Server Error',
    errors: process.env.NODE_ENV === 'development' ? [err.stack || ''] : [],
  });
};
