import rateLimit from 'express-rate-limit';

/**
 * Public storefront API — 20 req/min per IP
 */
export const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
});

/**
 * Reveal API — 30 req/min per IP
 */
export const revealRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
});

/**
 * Admin API — 100 req/min per API key
 */
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    return (req.headers['x-admin-api-key'] as string) || req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Admin rate limit exceeded.' },
});
