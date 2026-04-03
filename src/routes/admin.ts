import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { adminAuth } from '../middleware/adminAuth';
import { adminRateLimit } from '../middleware/rateLimiter';
import { adminCors } from '../middleware/cors';
import { validateProbabilities, bulkRestock } from '../services/inventoryService';
import { InvalidProbabilityError } from '../utils/errors';

const router = Router();
router.use(adminCors);
router.use(adminRateLimit);
router.use(adminAuth);

// ── Blind Box CRUD ──────────────────────────────────────────────────────────

router.post('/blind-boxes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, price, shoplineProductId } = req.body as {
      name: string;
      description?: string;
      price: number;
      shoplineProductId: string;
    };

    const box = await prisma.blindBox.create({
      data: { name, description, price, shoplineProductId },
      include: { items: true },
    });

    res.status(201).json(box);
  } catch (err) {
    next(err);
  }
});

router.get('/blind-boxes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const boxes = await prisma.blindBox.findMany({
      where: { isActive: true },
      include: { items: { where: { isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(boxes);
  } catch (err) {
    next(err);
  }
});

router.get('/blind-boxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const box = await prisma.blindBox.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    res.json(box);
  } catch (err) {
    next(err);
  }
});

router.put('/blind-boxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const box = await prisma.blindBox.update({
      where: { id: req.params.id },
      data: req.body as {
        name?: string;
        description?: string;
        price?: number;
        isActive?: boolean;
      },
      include: { items: { where: { isActive: true } } },
    });
    res.json(box);
  } catch (err) {
    next(err);
  }
});

router.delete('/blind-boxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.blindBox.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Blind Box Items ─────────────────────────────────────────────────────────

router.post(
  '/blind-boxes/:id/items',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, sku, imageUrl, stock, probability } = req.body as {
        name: string;
        sku: string;
        imageUrl?: string;
        stock: number;
        probability: number;
      };

      const item = await prisma.blindBoxItem.create({
        data: {
          blindBoxId: req.params.id,
          name,
          sku,
          imageUrl,
          stock,
          probability,
        },
      });

      await validateProbabilities(req.params.id).catch((e) => {
        // Don't fail creation, just warn — merchant must fix before going live
        if (!(e instanceof InvalidProbabilityError)) throw e;
      });

      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/blind-boxes/:id/items/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await prisma.blindBoxItem.update({
        where: { id: req.params.itemId },
        data: req.body as {
          name?: string;
          imageUrl?: string;
          stock?: number;
          probability?: number;
          isActive?: boolean;
        },
      });

      await validateProbabilities(req.params.id).catch((e) => {
        if (!(e instanceof InvalidProbabilityError)) throw e;
      });

      res.json(item);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/blind-boxes/:id/items/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.blindBoxItem.update({
        where: { id: req.params.itemId },
        data: { isActive: false },
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/blind-boxes/:id/items/restock',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await bulkRestock(req.params.id, req.body as {
        sku: string;
        additionalStock: number;
      }[]);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
);

// ── Orders ──────────────────────────────────────────────────────────────────

router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, blindBoxId, from, to, page = '1', limit = '20' } = req.query as {
      status?: string;
      blindBoxId?: string;
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await prisma.blindBoxOrder.findMany({
      where: {
        ...(status ? { status: status as 'PENDING' | 'ASSIGNED' | 'FULFILLED' | 'FAILED' } : {}),
        ...(blindBoxId ? { blindBoxId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        blindBox: { select: { name: true } },
        assignedItem: { select: { name: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    });

    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/orders/:shoplineOrderId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await prisma.blindBoxOrder.findUniqueOrThrow({
        where: { shoplineOrderId: req.params.shoplineOrderId },
        include: {
          blindBox: true,
          assignedItem: true,
        },
      });
      res.json(order);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
