import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';

/**
 * Verify the ADMIN_API_KEY header for all /api/admin/* routes.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-admin-api-key'];
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    next(new Error('ADMIN_API_KEY environment variable is not configured'));
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    next(new UnauthorizedError('Invalid or missing admin API key'));
    return;
  }

  next();
}
