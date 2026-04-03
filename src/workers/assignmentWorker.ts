import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../config/db';
import { selectItem } from '../services/itemSelector';
import { tagOrder } from '../services/shoplineService';
import { captureException } from '../config/sentry';
import { logger } from '../utils/logger';
import { BLIND_BOX_QUEUE_NAME, AssignBlindBoxItemPayload } from './queues';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const workerConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * BullMQ worker for the "blind-box-assignment" queue.
 * Handles weighted random item selection and stock decrement for each order.
 */
export function createAssignmentWorker(): Worker<AssignBlindBoxItemPayload> {
  const worker = new Worker<AssignBlindBoxItemPayload>(
    BLIND_BOX_QUEUE_NAME,
    async (job: Job<AssignBlindBoxItemPayload>) => {
      const { shoplineOrderId, shoplineCustomerId, blindBoxId, quantity } =
        job.data;

      const jobLogger = logger.child({
        jobId: job.id,
        shoplineOrderId,
        blindBoxId,
        attemptNumber: job.attemptsMade + 1,
      });

      jobLogger.info('Processing blind box assignment job');

      // ── Step 1: Idempotency check ───────────────────────────────────────
      const existing = await prisma.blindBoxOrder.findUnique({
        where: { shoplineOrderId },
        select: { id: true, status: true, assignedItemId: true },
      });

      if (existing && ['ASSIGNED', 'FULFILLED'].includes(existing.status)) {
        jobLogger.info('Order already assigned — skipping (idempotent)', {
          status: existing.status,
          assignedItemId: existing.assignedItemId,
        });
        return;
      }

      // ── Step 2: Select item using weighted random + DB transaction ──────
      const assignedItem = await selectItem(blindBoxId, quantity);

      // ── Step 3: Create BlindBoxOrder record ─────────────────────────────
      const order = await prisma.blindBoxOrder.upsert({
        where: { shoplineOrderId },
        create: {
          shoplineOrderId,
          shoplineCustomerId,
          blindBoxId,
          assignedItemId: assignedItem.id,
          quantity,
          status: 'ASSIGNED',
        },
        update: {
          assignedItemId: assignedItem.id,
          status: 'ASSIGNED',
        },
      });

      // ── Step 4: Tag Shopline order with assigned item SKU (stub) ─────────
      try {
        const store = await prisma.shoplineStore.findFirst({
          select: { shopDomain: true, accessToken: true },
        });
        if (store) {
          await tagOrder({
            orderId: shoplineOrderId,
            shopDomain: store.shopDomain,
            accessToken: store.accessToken,
            tags: [`blind-box-item:${assignedItem.sku}`],
          });
        }
      } catch (tagError) {
        // TODO: Implement full Shopline Order tag API when credentials confirmed
        jobLogger.warn('Failed to tag Shopline order (non-fatal)', {
          error: tagError instanceof Error ? tagError.message : String(tagError),
        });
      }

      jobLogger.info('Blind box item assigned successfully', {
        orderId: order.id,
        assignedItemId: assignedItem.id,
        assignedItemSku: assignedItem.sku,
      });
    },
    {
      connection: workerConnection,
      concurrency: 5,
    }
  );

  // ── Event handlers ──────────────────────────────────────────────────────

  worker.on('completed', (job) => {
    logger.info('Assignment job completed', {
      jobId: job.id,
      shoplineOrderId: job.data.shoplineOrderId,
    });
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);
    const context = {
      jobId: job.id,
      shoplineOrderId: job.data.shoplineOrderId,
      blindBoxId: job.data.blindBoxId,
      attemptNumber: job.attemptsMade,
      isLastAttempt,
    };

    logger.error('Assignment job failed', {
      ...context,
      error: err.message,
    });

    if (isLastAttempt) {
      // Create FAILED order record so the reveal endpoint can report failure
      try {
        // We need a placeholder item to satisfy the FK — use first available item
        const anyItem = await prisma.blindBoxItem.findFirst({
          where: { blindBoxId: job.data.blindBoxId },
          select: { id: true },
        });

        if (anyItem) {
          await prisma.blindBoxOrder.upsert({
            where: { shoplineOrderId: job.data.shoplineOrderId },
            create: {
              shoplineOrderId: job.data.shoplineOrderId,
              shoplineCustomerId: job.data.shoplineCustomerId,
              blindBoxId: job.data.blindBoxId,
              assignedItemId: anyItem.id,
              quantity: job.data.quantity,
              status: 'FAILED',
            },
            update: { status: 'FAILED' },
          });
        }
      } catch (dbError) {
        logger.error('Failed to create FAILED order record', {
          shoplineOrderId: job.data.shoplineOrderId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
      }

      captureException(err, context);
    }
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { error: err.message });
    captureException(err, { worker: BLIND_BOX_QUEUE_NAME });
  });

  return worker;
}
