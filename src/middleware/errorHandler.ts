import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { captureException } from '../config/sentry';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const context = {
    route: req.path,
    method: req.method,
    orderId: (req.params.shoplineOrderId || req.body?.shoplineOrderId) ?? undefined,
    blindBoxId: (req.params.id || req.body?.blindBoxId) ?? undefined,
  };

  if (err instanceof AppError) {
    logger.warn('Operational error', {
      ...context,
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
    });

    // Send non-4xx operational errors to Sentry too
    if (err.statusCode >= 500) {
      captureException(err, context);
    }

    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
    return;
  }

  // Unexpected / programmer errors
  logger.error('Unexpected error', {
    ...context,
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  captureException(err, context);

  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred. Please try again later.',
  });
}
