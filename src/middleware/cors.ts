import cors, { CorsOptions } from 'cors';
import { RequestHandler } from 'express';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// ADMIN_PANEL_URL is the Vercel URL of the React admin panel (separate from APP_URL)
const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || APP_URL;

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
 * Admin API — restricted to the app URL and the Vercel admin panel URL
 */
export const adminCors: RequestHandler = cors({
  origin: [APP_URL, ADMIN_PANEL_URL].filter(Boolean),
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
