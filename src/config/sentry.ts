import * as Sentry from '@sentry/node';
import { logger } from '../utils/logger';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('SENTRY_DSN not set — Sentry error reporting disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Strip sensitive headers before sending
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['x-admin-api-key'];
        delete event.request.headers['x-shopline-hmac-sha256'];
      }
      return event;
    },
  });

  logger.info('Sentry initialized');
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureMessage(message, level);
  });
}

export { Sentry };
