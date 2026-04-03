import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../config/db';
import { buildAuthUrl, exchangeCodeForToken } from '../services/shoplineService';
import { logger } from '../utils/logger';

const router = Router();

// In-memory nonce store (use Redis in production for multi-instance deployments)
const pendingNonces = new Map<string, { shopDomain: string; expiresAt: number }>();

/**
 * GET /api/shopline/auth
 * Initiates the OAuth installation flow.
 * Called by Shopline when a merchant installs the app.
 */
router.get('/auth', (req: Request, res: Response) => {
  const { shop } = req.query as { shop?: string };

  if (!shop || !shop.match(/^[a-z0-9-]+\.myshopline\.com$/i)) {
    res.status(400).json({ error: 'Invalid or missing shop parameter' });
    return;
  }

  const state = randomBytes(16).toString('hex');
  pendingNonces.set(state, { shopDomain: shop, expiresAt: Date.now() + 10 * 60 * 1000 });

  const authUrl = buildAuthUrl(shop, state);
  res.redirect(authUrl);
});

/**
 * GET /api/shopline/callback
 * Handles the OAuth callback after merchant authorization.
 */
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, code, state } = req.query as {
      shop?: string;
      code?: string;
      state?: string;
    };

    if (!shop || !code || !state) {
      res.status(400).json({ error: 'Missing required OAuth parameters' });
      return;
    }

    // Validate nonce
    const pending = pendingNonces.get(state);
    if (!pending || pending.expiresAt < Date.now() || pending.shopDomain !== shop) {
      res.status(400).json({ error: 'Invalid or expired state parameter' });
      return;
    }

    pendingNonces.delete(state);

    const accessToken = await exchangeCodeForToken(shop, code);

    await prisma.shoplineStore.upsert({
      where: { shopDomain: shop },
      update: { accessToken, updatedAt: new Date() },
      create: { shopDomain: shop, accessToken },
    });

    logger.info('Shopline app installed', { shopDomain: shop });

    // Redirect merchant to the embedded admin panel
    res.redirect(`${process.env.APP_URL}/admin/?shop=${shop}`);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shopline/uninstall
 * Called when merchant uninstalls the app.
 */
router.post('/uninstall', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.body as { shop?: string };

    if (shop) {
      await prisma.shoplineStore.updateMany({
        where: { shopDomain: shop },
        data: { accessToken: '' },
      });
      logger.info('Shopline app uninstalled', { shopDomain: shop });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

export default router;
