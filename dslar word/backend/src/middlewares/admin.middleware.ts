import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Admin Role Guard Middleware
 * Must be used AFTER authMiddleware.
 * Blocks access for non-ADMIN users with 403 Forbidden.
 */
export const adminMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new ApiError(401, 'Unauthorized. Please login first.'));
  }

  if (req.user.role !== 'ADMIN') {
    return next(new ApiError(403, 'Forbidden. Admin access required.'));
  }

  next();
};
