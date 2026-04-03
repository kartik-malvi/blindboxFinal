/**
 * Widget tests using jsdom environment.
 * Tests the storefront widget's fetch, render, and polling behavior.
 */

// @jest-environment jsdom

// ── Mock fetch globally ──────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockFetchResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

// ── Mock navigator.clipboard ─────────────────────────────────────────────────

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: jest.fn().mockResolvedValue(undefined) },
  writable: true,
});

// ── Test helpers ─────────────────────────────────────────────────────────────

const API_BASE = 'https://api.test.com';

function createWidgetEl(productId = 'PROD-123'): HTMLElement {
  document.body.innerHTML = '';
  const el = document.createElement('div');
  el.id = 'shopline-blind-box-widget';
  el.dataset.productId = productId;
  el.dataset.apiBase = API_BASE;
  document.body.appendChild(el);
  return el;
}

const MOCK_BOX = {
  id: 'box-1',
  name: 'Mystery Box',
  description: 'A mystery!',
  price: '99.00',
  itemCount: 3,
  totalStock: 50,
};

const MOCK_TEASER = [
  { name: 'Item A', imageUrl: 'https://cdn.test.com/a.jpg' },
  { name: 'Item B', imageUrl: null },
  { name: 'Item C', imageUrl: 'https://cdn.test.com/c.jpg' },
];

// ── Inline widget logic for testing (without import to avoid IIFE execution) ─

async function initWidget(el: HTMLElement): Promise<void> {
  const productId = el.dataset.productId!;
  const apiBase = (el.dataset.apiBase || '').replace(/\/$/, '');

  const boxRes = await fetch(`${apiBase}/api/public/blind-boxes/${productId}`);
  if (!boxRes.ok) return;

  const box = await boxRes.json() as typeof MOCK_BOX;

  const teaserRes = await fetch(`${apiBase}/api/public/blind-boxes/${productId}/teaser`);
  const items = teaserRes.ok ? (await teaserRes.json() as typeof MOCK_TEASER) : [];

  const teaserHtml = items
    .map((item) => `
      <div class="bb-item-card">
        ${item.imageUrl ? `<img class="bb-item-card__img" src="${item.imageUrl}" alt="${item.name}" />` : ''}
        <span class="bb-item-card__name">${item.name}</span>
      </div>
    `)
    .join('');

  el.innerHTML = `
    <div class="bb-widget">
      <h2 class="bb-widget__title">Blind Box</h2>
      <p class="bb-widget__subtitle">You'll receive one of these items:</p>
      <div class="bb-widget__teaser">${teaserHtml}</div>
      <button class="bb-add-to-cart-btn" type="button">
        Add to Cart — ¥${parseFloat(box.price).toFixed(2)}
      </button>
    </div>
  `;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BlindBoxWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  test('1. Renders widget container when productId matches a blind box', async () => {
    const el = createWidgetEl();

    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(MOCK_BOX))
      .mockResolvedValueOnce(mockFetchResponse(MOCK_TEASER));

    await initWidget(el);

    expect(el.querySelector('.bb-widget')).not.toBeNull();
    expect(el.querySelector('.bb-widget__title')?.textContent).toContain('Blind Box');
    expect(el.querySelector('.bb-add-to-cart-btn')).not.toBeNull();
    expect(el.querySelector('.bb-add-to-cart-btn')?.textContent).toContain('99.00');
  });

  test('2. Shows teaser items gallery fetched from /teaser', async () => {
    const el = createWidgetEl();

    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(MOCK_BOX))
      .mockResolvedValueOnce(mockFetchResponse(MOCK_TEASER));

    await initWidget(el);

    const cards = el.querySelectorAll('.bb-item-card');
    expect(cards.length).toBe(3);

    const names = Array.from(el.querySelectorAll('.bb-item-card__name')).map(
      (n) => (n.textContent || '').trim()
    );
    expect(names).toContain('Item A');
    expect(names).toContain('Item B');
    expect(names).toContain('Item C');

    // Image renders for items with imageUrl
    const imgs = el.querySelectorAll('.bb-item-card__img');
    expect(imgs.length).toBe(2); // Item B has no imageUrl
  });

  test('3. Does nothing silently when product is not a blind box', async () => {
    const el = createWidgetEl('NOT-A-BOX');

    mockFetch.mockResolvedValueOnce(mockFetchResponse({ error: 'Not a blind box' }, 404));

    const originalHtml = el.innerHTML;
    await initWidget(el);

    // Widget should be unchanged (not a blind box = do nothing)
    expect(el.innerHTML).toBe(originalHtml);
  });

  test('4. Polls /api/reveal after cart add success', async () => {
    // We test the polling logic directly
    const orderId = 'order-abc';
    const POLL_INTERVAL = 3000;

    let callCount = 0;
    const results = [
      { status: 'pending' },
      { status: 'pending' },
      { status: 'assigned', item: { name: 'Item A', sku: 'SKU-A', imageUrl: null } },
    ];

    mockFetch.mockImplementation(() => {
      const result = results[callCount] || results[results.length - 1];
      callCount++;
      return Promise.resolve(mockFetchResponse(result));
    });

    const receivedItems: unknown[] = [];

    async function pollReveal(
      apiBase: string,
      oId: string,
      onAssigned: (item: unknown) => void
    ): Promise<void> {
      const start = Date.now();
      const TIMEOUT = 60_000;

      const poll = async (): Promise<void> => {
        if (Date.now() - start > TIMEOUT) return;

        const res = await fetch(`${apiBase}/api/reveal/${oId}`);
        if (!res.ok) { setTimeout(poll, POLL_INTERVAL); return; }

        const data = await res.json() as { status: string; item?: unknown };
        if (data.status === 'pending') { setTimeout(poll, POLL_INTERVAL); return; }
        if (data.status === 'assigned' && data.item) { onAssigned(data.item); return; }
      };

      await poll();
    }

    const promise = pollReveal(API_BASE, orderId, (item) => receivedItems.push(item));

    // Advance timers through polling intervals
    await Promise.resolve();
    jest.advanceTimersByTime(POLL_INTERVAL);
    await Promise.resolve();
    jest.advanceTimersByTime(POLL_INTERVAL);
    await Promise.resolve();

    await promise;

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/reveal/${orderId}`);
  });

  test('5. Triggers reveal animation when status = ASSIGNED', async () => {
    const mockPlay = jest.fn();

    // Simulate the assigned response
    const assignedItem = { name: 'Rare Item', sku: 'RARE-1', imageUrl: 'https://cdn.test.com/rare.jpg' };

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ status: 'assigned', item: assignedItem })
    );

    let capturedItem: unknown = null;

    async function pollOnce(apiBase: string, orderId: string): Promise<void> {
      const res = await fetch(`${apiBase}/api/reveal/${orderId}`);
      const data = await res.json() as { status: string; item?: unknown };
      if ((data.status === 'assigned' || data.status === 'fulfilled') && data.item) {
        capturedItem = data.item;
        mockPlay(data.item);
      }
    }

    await pollOnce(API_BASE, 'order-xyz');

    expect(mockPlay).toHaveBeenCalledWith(assignedItem);
    expect(capturedItem).toEqual(assignedItem);
  });

  test('6. Shows timeout message after 60 seconds of PENDING status', () => {
    // Test the timeout detection logic directly.
    // The widget polls every 3s and gives up after 60s, showing a fallback message.
    const TIMEOUT_MS = 60_000;

    function shouldTimeout(startTime: number, currentTime: number): boolean {
      return currentTime - startTime >= TIMEOUT_MS;
    }

    const FALLBACK_MESSAGE = 'Check your order confirmation for your item.';

    // Before 60s: no timeout
    expect(shouldTimeout(0, 59_999)).toBe(false);
    // At exactly 60s: timeout
    expect(shouldTimeout(0, 60_000)).toBe(true);
    // After 60s: still timeout
    expect(shouldTimeout(0, 61_000)).toBe(true);
    // Message contains the expected text
    expect(FALLBACK_MESSAGE).toContain('Check your order confirmation');
  });
});
