import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { WebhookVerificationError } from '../utils/errors';

/**
 * Verify Shopline webhook HMAC-SHA256 signature.
 * Shopline sends: X-Shopline-Hmac-Sha256: base64(HMAC-SHA256(body, secret))
 *
 * IMPORTANT: Must be registered BEFORE express.json() to access raw body.
 */
export function webhookVerify(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-shopline-hmac-sha256'] as string | undefined;

  if (!signature) {
    next(new WebhookVerificationError());
    return;
  }

  const secret = process.env.SHOPLINE_WEBHOOK_SECRET;
  if (!secret) {
    next(new Error('SHOPLINE_WEBHOOK_SECRET environment variable is not set'));
    return;
  }

  // rawBody is attached by the express.json verify callback in app.ts
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    next(new WebhookVerificationError());
    return;
  }

  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);

  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    next(new WebhookVerificationError());
    return;
  }

  next();
}
