import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { publicRateLimit } from '../middleware/rateLimiter';
import { publicCors } from '../middleware/cors';
import { getTotalStock } from '../services/inventoryService';

const router = Router();
router.use(publicCors);
router.use(publicRateLimit);

/**
 * GET /api/public/blind-boxes/:shoplineProductId
 * Returns safe summary — no probabilities, no per-item stock.
 */
router.get(
  '/blind-boxes/:shoplineProductId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const box = await prisma.blindBox.findUnique({
        where: {
          shoplineProductId: req.params.shoplineProductId,
          isActive: true,
        },
        include: {
          items: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      });

      if (!box) {
        res.status(404).json({ error: 'Not a blind box product' });
        return;
      }

      const totalStock = await getTotalStock(box.id);

      res.json({
        id: box.id,
        name: box.name,
        description: box.description,
        price: box.price,
        itemCount: box.items.length,
        totalStock,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/public/blind-boxes/:shoplineProductId/teaser
 * Returns item names and images only — NEVER probabilities or stock counts.
 */
router.get(
  '/blind-boxes/:shoplineProductId/teaser',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const box = await prisma.blindBox.findUnique({
        where: {
          shoplineProductId: req.params.shoplineProductId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!box) {
        res.status(404).json({ error: 'Not a blind box product' });
        return;
      }

      const items = await prisma.blindBoxItem.findMany({
        where: { blindBoxId: box.id, isActive: true },
        select: { name: true, imageUrl: true },
        orderBy: { createdAt: 'asc' },
      });

      res.json(items);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
