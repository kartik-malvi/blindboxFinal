import cors, { CorsOptions } from 'cors';
import { RequestHandler } from 'express';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Public and Reveal APIs — open to any origin (called from merchant storefronts)
 */
export const publicCors: RequestHandler = cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
});

export const revealCors: RequestHandler = cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
});

/**
 * Admin API — restricted to the app's own URL
 */
export const adminCors: RequestHandler = cors({
  origin: APP_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Api-Key'],
  credentials: true,
});

/**
 * Shopline admin domains — for the embedded React admin panel
 */
const shoplineAdminOrigins = [
  /^https:\/\/[a-z0-9-]+\.myshopline\.com$/,
  /^https:\/\/admin\.shopline\.com$/,
  APP_URL,
];

export const shoplineAdminCors: RequestHandler = cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    const allowed = shoplineAdminOrigins.some((pattern) =>
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    );
    callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
} as CorsOptions);
