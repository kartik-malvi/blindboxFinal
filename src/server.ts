import 'dotenv/config';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { initSentry } from './config/sentry';
import { createAssignmentWorker } from './workers/assignmentWorker';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main(): Promise<void> {
  // Initialize Sentry before anything else
  initSentry();

  // Connect to database
  await connectDatabase();

  // Start BullMQ worker
  const worker = createAssignmentWorker();
  logger.info('Assignment worker started');

  // Create and start Express app
  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info(`Blind Box API listening on port ${PORT}`, {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
    });
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal} — shutting down gracefully`);

    server.close(async () => {
      try {
        await worker.close();
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', {
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
