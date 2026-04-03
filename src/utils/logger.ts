import winston from 'winston';

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    json()
  ),
  defaultMeta: { service: 'blind-box-api' },
  transports: [
    new winston.transports.Console({
      format: isDevelopment
        ? combine(colorize(), simple())
        : combine(timestamp(), json()),
    }),
  ],
});

if (process.env.LOG_FILE_PATH) {
  logger.add(
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH,
      level: 'error',
    })
  );
}

export function createRequestLogger(meta: Record<string, unknown>) {
  return {
    info: (message: string, extra?: Record<string, unknown>) =>
      logger.info(message, { ...meta, ...extra }),
    warn: (message: string, extra?: Record<string, unknown>) =>
      logger.warn(message, { ...meta, ...extra }),
    error: (message: string, extra?: Record<string, unknown>) =>
      logger.error(message, { ...meta, ...extra }),
    debug: (message: string, extra?: Record<string, unknown>) =>
      logger.debug(message, { ...meta, ...extra }),
  };
}
