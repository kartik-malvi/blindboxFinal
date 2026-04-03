import 'dotenv/config';
import express, { Request, Response } from 'express';
import { Sentry } from './config/sentry';

import adminRouter from './routes/admin';
import webhookRouter from './routes/webhook';
import publicRouter from './routes/public';
import revealRouter from './routes/reveal';
import shoplineAuthRouter from './routes/shoplineAuth';
import { errorHandler } from './middleware/errorHandler';
import path from 'path';

export function createApp(): express.Application {
  const app = express();

  // ── Sentry request handler (must be first middleware) ──────────────────
  app.use(Sentry.Handlers.requestHandler());

  // ── Parse JSON with raw body capture for webhook HMAC verification ──────
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.use(express.urlencoded({ extended: true }));

  // ── Static assets (fallback for manual script tag method) ───────────────
  app.use(
    '/static',
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: '1d',
      setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    })
  );

  // ── Routes ──────────────────────────────────────────────────────────────
  app.use('/api/admin', adminRouter);
  app.use('/api/webhooks/shopline', webhookRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/reveal', revealRouter);
  app.use('/api/shopline', shoplineAuthRouter);

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Sentry error handler (must be before custom error handler) ───────────
  app.use(Sentry.Handlers.errorHandler());

  // ── Centralized error handler ────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
