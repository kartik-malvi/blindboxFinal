import { Router, Request, Response, NextFunction } from 'express';
import { webhookVerify } from '../middleware/webhookVerify';
import { prisma } from '../config/db';
import { blindBoxAssignmentQueue } from '../workers/queues';
import { restoreStock } from '../services/itemSelector';
import { logger } from '../utils/logger';

const router = Router();

// Apply HMAC verification to all webhook routes
router.use(webhookVerify);

interface ShoplineLineItem {
  product_id: string;
  quantity: number;
  variant_id: string;
}

interface ShoplineOrderPayload {
  id: string;
  customer?: { id: string };
  line_items: ShoplineLineItem[];
}

/**
 * POST /api/webhooks/shopline/order-created
 * Triggered when a new order is placed.
 */
router.post(
  '/order-created',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = req.body as ShoplineOrderPayload;
      const shoplineOrderId = String(order.id);
      const shoplineCustomerId = String(order.customer?.id ?? 'unknown');

      logger.info('Webhook: order-created received', { shoplineOrderId });

      // Process each line item — check if it maps to a BlindBox
      for (const lineItem of order.line_items) {
        const productId = String(lineItem.product_id);

        const box = await prisma.blindBox.findUnique({
          where: { shoplineProductId: productId, isActive: true },
          select: { id: true },
        });

        if (!box) continue;

        // Idempotency: skip if job already queued / processed
        const existing = await prisma.blindBoxOrder.findUnique({
          where: { shoplineOrderId },
          select: { id: true, status: true },
        });

        if (existing) {
          logger.info('Webhook: order already processed — skipping', {
            shoplineOrderId,
            status: existing.status,
          });
          continue;
        }

        await blindBoxAssignmentQueue.add(
          'assign-blind-box-item',
          {
            shoplineOrderId,
            shoplineCustomerId,
            blindBoxId: box.id,
            quantity: lineItem.quantity,
          },
          {
            jobId: `assign-${shoplineOrderId}-${box.id}`, // Idempotent job ID
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          }
        );

        logger.info('Webhook: enqueued assignment job', {
          shoplineOrderId,
          blindBoxId: box.id,
        });
      }

      // Always respond 200 immediately — never make Shopline wait
      res.status(200).json({ received: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/webhooks/shopline/order-cancelled
 * Triggered when an order is cancelled — restore stock if already assigned.
 */
router.post(
  '/order-cancelled',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = req.body as { id: string };
      const shoplineOrderId = String(order.id);

      logger.info('Webhook: order-cancelled received', { shoplineOrderId });

      const blindBoxOrder = await prisma.blindBoxOrder.findUnique({
        where: { shoplineOrderId },
      });

      if (!blindBoxOrder) {
        res.status(200).json({ received: true });
        return;
      }

      if (blindBoxOrder.status === 'ASSIGNED') {
        await prisma.$transaction(async (tx) => {
          await restoreStock(
            blindBoxOrder.assignedItemId,
            blindBoxOrder.quantity
          );

          await (tx as typeof prisma).blindBoxOrder.update({
            where: { id: blindBoxOrder.id },
            data: { status: 'FAILED' },
          });
        });

        logger.info('Webhook: stock restored on order cancellation', {
          shoplineOrderId,
          assignedItemId: blindBoxOrder.assignedItemId,
        });
      }

      res.status(200).json({ received: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
