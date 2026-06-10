import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async Express route handlers to eliminate try/catch boilerplate.
 * Catches any thrown error and forwards it to the global error middleware.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
