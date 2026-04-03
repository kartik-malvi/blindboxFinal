import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { revealRateLimit } from '../middleware/rateLimiter';
import { revealCors } from '../middleware/cors';
import { OrderNotFoundError } from '../utils/errors';

const router = Router();
router.use(revealCors);
router.use(revealRateLimit);

/**
 * GET /api/reveal/:shoplineOrderId
 * Returns the reveal status and (if assigned) the assigned item details.
 *
 * On first ASSIGNED call: sets revealedAt + transitions status to FULFILLED.
 */
router.get(
  '/:shoplineOrderId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await prisma.blindBoxOrder.findUnique({
        where: { shoplineOrderId: req.params.shoplineOrderId },
        include: {
          assignedItem: {
            select: { name: true, sku: true, imageUrl: true },
          },
        },
      });

      if (!order) {
        throw new OrderNotFoundError(req.params.shoplineOrderId);
      }

      switch (order.status) {
        case 'PENDING':
          res.status(202).json({
            status: 'pending',
            message: 'Assignment in progress',
          });
          return;

        case 'ASSIGNED': {
          // First reveal — transition to FULFILLED and record revealedAt
          await prisma.blindBoxOrder.update({
            where: { id: order.id },
            data: {
              status: 'FULFILLED',
              revealedAt: new Date(),
            },
          });

          res.status(200).json({
            status: 'assigned',
            item: order.assignedItem,
          });
          return;
        }

        case 'FULFILLED':
          res.status(200).json({
            status: 'fulfilled',
            item: order.assignedItem,
          });
          return;

        case 'FAILED':
          res.status(500).json({
            status: 'failed',
            message: 'There was an issue with your order. Please contact support.',
          });
          return;

        default:
          next(new Error(`Unknown order status: ${order.status}`));
      }
    } catch (err) {
      next(err);
    }
  }
);

export default router;
