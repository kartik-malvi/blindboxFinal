import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedError } from '../utils/errors';

/**
 * Verify Shopline App Bridge JWT session token.
 * In a real deployment this would validate the JWT signature using
 * SHOPLINE_API_SECRET and check exp/iss/sub claims.
 *
 * For now this middleware verifies the Authorization: Bearer <token> header
 * and validates the HMAC of the session payload.
 */
export function shoplineAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing Shopline session token'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Decode the JWT payload (base64url, middle segment)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT');
    }

    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as {
      exp?: number;
      iss?: string;
      dest?: string;
      sub?: string;
    };

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Session token expired');
    }

    // Verify HMAC signature
    const secret = process.env.SHOPLINE_API_SECRET;
    if (!secret) {
      throw new Error('SHOPLINE_API_SECRET not configured');
    }

    const signingInput = `${parts[0]}.${parts[1]}`;
    const expectedSig = createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    const actualSig = Buffer.from(parts[2]);
    const expectedSigBuf = Buffer.from(expectedSig);

    if (
      actualSig.length !== expectedSigBuf.length ||
      !timingSafeEqual(actualSig, expectedSigBuf)
    ) {
      throw new Error('Invalid session token signature');
    }

    // Attach shop info to request
    (req as Request & { shopDomain?: string; shoplineUserId?: string }).shopDomain =
      payload.dest?.replace('https://', '');
    (req as Request & { shoplineUserId?: string }).shoplineUserId = payload.sub;

    next();
  } catch {
    next(new UnauthorizedError('Invalid Shopline session token'));
  }
}
