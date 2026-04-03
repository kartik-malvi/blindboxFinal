/**
 * Webhook endpoint tests.
 * Tests HMAC verification, job enqueueing, stock restoration, and idempotency.
 */

import request from 'supertest';
import { createHmac } from 'crypto';
import express from 'express';

// ── Mock dependencies ────────────────────────────────────────────────────────

const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
jest.mock('../src/workers/queues', () => ({
  BLIND_BOX_QUEUE_NAME: 'blind-box-assignment',
  blindBoxAssignmentQueue: { add: (...args: unknown[]) => mockQueueAdd(...args) },
}));

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue({});
const mockTransaction = jest.fn();

jest.mock('../src/config/db', () => ({
  prisma: {
    blindBox: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    blindBoxOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    blindBoxItem: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

jest.mock('../src/config/sentry', () => ({
  Sentry: { Handlers: { requestHandler: () => (_: unknown, __: unknown, next: () => void) => next(), errorHandler: () => (_: unknown, __: unknown, next: () => void) => next() } },
  captureException: jest.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test-webhook-secret';

function signPayload(payload: object): string {
  const body = JSON.stringify(payload);
  return createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from(body)).digest('base64');
}

async function buildTestApp() {
  // Set env before importing app
  process.env.SHOPLINE_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const webhookRouter = (await import('../src/routes/webhook')).default;

  const app = express();
  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use('/api/webhooks/shopline', webhookRouter);

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Webhook: order-created', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validOrderPayload = {
    id: 'order-123',
    customer: { id: 'customer-456' },
    line_items: [{ product_id: 'prod-111', quantity: 1, variant_id: 'var-1' }],
  };

  test('1. Returns 401 on invalid HMAC signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/shopline/order-created')
      .set('X-Shopline-Hmac-Sha256', 'invalid-signature')
      .send(validOrderPayload);

    expect(res.status).toBe(401);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  test('2. Enqueues correct BullMQ job on valid order-created webhook', async () => {
    // Mock: this product IS a blind box
    mockFindUnique
      .mockResolvedValueOnce({ id: 'box-uuid-1' })  // blindBox.findUnique
      .mockResolvedValueOnce(null);                  // blindBoxOrder.findUnique (not exists)

    const sig = signPayload(validOrderPayload);

    const res = await request(app)
      .post('/api/webhooks/shopline/order-created')
      .set('X-Shopline-Hmac-Sha256', sig)
      .send(validOrderPayload);

    expect(res.status).toBe(200);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'assign-blind-box-item',
      {
        shoplineOrderId: 'order-123',
        shoplineCustomerId: 'customer-456',
        blindBoxId: 'box-uuid-1',
        quantity: 1,
      },
      expect.objectContaining({ jobId: 'assign-order-123-box-uuid-1' })
    );
  });

  test('3. Ignores line items whose productId does not match any BlindBox', async () => {
    // Mock: no blind box found for this product
    mockFindUnique.mockResolvedValue(null);

    const sig = signPayload(validOrderPayload);

    const res = await request(app)
      .post('/api/webhooks/shopline/order-created')
      .set('X-Shopline-Hmac-Sha256', sig)
      .send(validOrderPayload);

    expect(res.status).toBe(200);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  test('4. Idempotent — duplicate webhook does not re-enqueue if already processed', async () => {
    // First call: blind box found, order does not yet exist
    mockFindUnique
      .mockResolvedValueOnce({ id: 'box-uuid-1' })
      .mockResolvedValueOnce({ id: 'existing-order', status: 'ASSIGNED' }); // Already assigned

    const sig = signPayload(validOrderPayload);

    const res = await request(app)
      .post('/api/webhooks/shopline/order-created')
      .set('X-Shopline-Hmac-Sha256', sig)
      .send(validOrderPayload);

    expect(res.status).toBe(200);
    expect(mockQueueAdd).not.toHaveBeenCalled(); // Should NOT enqueue again
  });
});

describe('Webhook: order-cancelled', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('3. Restores stock on order-cancelled for ASSIGNED order', async () => {
    const cancelPayload = { id: 'order-123' };

    mockFindUnique.mockResolvedValue({
      id: 'blind-order-1',
      shoplineOrderId: 'order-123',
      assignedItemId: 'item-a',
      quantity: 1,
      status: 'ASSIGNED',
    });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        blindBoxOrder: { update: mockUpdate },
        blindBoxItem: { update: mockUpdate },
      };
      return fn(tx);
    });
    // Also ensure prisma.blindBoxItem.update is mocked for restoreStock calls without tx
    mockUpdate.mockResolvedValue({});

    const sig = signPayload(cancelPayload);

    const res = await request(app)
      .post('/api/webhooks/shopline/order-cancelled')
      .set('X-Shopline-Hmac-Sha256', sig)
      .send(cancelPayload);

    expect(res.status).toBe(200);
    // Stock restoration triggers an update call
    expect(mockUpdate).toHaveBeenCalled();
  });
});
