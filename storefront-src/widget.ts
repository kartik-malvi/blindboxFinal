// CSS import — extracted by rollup-plugin-postcss into blindbox.css
import './widget.css';
import { RevealAnimation } from './reveal-animation';

interface BlindBoxSummary {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  itemCount: number;
  totalStock: number;
}

interface TeaserItem {
  name: string;
  imageUrl?: string | null;
}

interface RevealResponse {
  status: 'pending' | 'assigned' | 'fulfilled' | 'failed';
  item?: { name: string; sku: string; imageUrl?: string | null };
  message?: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(num) ? String(price) : `¥${num.toFixed(2)}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

class BlindBoxWidget {
  private el: HTMLElement;
  private productId: string;
  private apiBase: string;
  private animation: RevealAnimation;

  constructor(el: HTMLElement) {
    this.el = el;
    this.productId = el.dataset.productId!;
    this.apiBase = (el.dataset.apiBase || '').replace(/\/$/, '');
    this.animation = new RevealAnimation(el);
  }

  async init(): Promise<void> {
    // Fetch blind box summary
    const box = await fetchJson<BlindBoxSummary>(
      `${this.apiBase}/api/public/blind-boxes/${encodeURIComponent(this.productId)}`
    );

    // Not a blind box product — do nothing, log nothing
    if (!box) return;

    // Fetch teaser items
    const teaserItems = await fetchJson<TeaserItem[]>(
      `${this.apiBase}/api/public/blind-boxes/${encodeURIComponent(this.productId)}/teaser`
    ) ?? [];

    this.render(box, teaserItems);
  }

  private render(box: BlindBoxSummary, items: TeaserItem[]): void {
    const teaserHtml = items
      .map(
        (item) => `
          <div class="bb-item-card">
            ${
              item.imageUrl
                ? `<img class="bb-item-card__img" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
                : `<div class="bb-item-card__placeholder" aria-hidden="true">🎁</div>`
            }
            <span class="bb-item-card__name">${escapeHtml(item.name)}</span>
          </div>
        `
      )
      .join('');

    this.el.innerHTML = `
      <div class="bb-widget">
        <div class="bb-widget__header">
          <span class="bb-widget__icon" aria-hidden="true">🎁</span>
          <h2 class="bb-widget__title">Blind Box</h2>
        </div>
        <p class="bb-widget__subtitle">You'll receive one of these items:</p>
        <div class="bb-widget__teaser">
          ${teaserHtml || '<p class="bb-no-items">Items to be revealed on purchase!</p>'}
        </div>
        <button
          class="bb-add-to-cart-btn"
          type="button"
          data-variant-id="${escapeHtml(this.productId)}"
        >
          Add to Cart — ${formatPrice(box.price)}
        </button>
      </div>
    `;

    const btn = this.el.querySelector<HTMLButtonElement>('.bb-add-to-cart-btn');
    btn?.addEventListener('click', () => this.handleAddToCart());
  }

  private async handleAddToCart(): Promise<void> {
    const btn = this.el.querySelector<HTMLButtonElement>('.bb-add-to-cart-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Adding...';
    }

    try {
      // POST to Shopline Ajax Cart API
      const res = await fetch('/api/cart/add.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: this.productId, quantity: 1 }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Cart add failed: ${res.status}`);
      }

      const data = (await res.json()) as { order_id?: string; id?: string };
      const orderId = data.order_id ?? data.id;

      if (!orderId) {
        this.showMessage('Item added to cart! Check your order confirmation for your item.');
        return;
      }

      this.showSpinner('Assigning your item...');
      await this.pollReveal(String(orderId));
    } catch {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Add to Cart';
      }
      this.showMessage('Could not add to cart. Please try again.');
    }
  }

  private showSpinner(message: string): void {
    const widget = this.el.querySelector('.bb-widget');
    if (!widget) return;

    const existing = widget.querySelector('.bb-spinner-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'bb-spinner-overlay';
    overlay.innerHTML = `
      <div class="bb-spinner" role="status" aria-label="${escapeHtml(message)}"></div>
      <p class="bb-spinner-text">${escapeHtml(message)}</p>
    `;
    widget.appendChild(overlay);
  }

  private showMessage(message: string): void {
    const overlay = this.el.querySelector('.bb-spinner-overlay');
    if (overlay) {
      overlay.innerHTML = `<p class="bb-status-message">${escapeHtml(message)}</p>`;
    } else {
      const msg = document.createElement('p');
      msg.className = 'bb-status-message';
      msg.textContent = message;
      this.el.appendChild(msg);
    }
  }

  private async pollReveal(orderId: string): Promise<void> {
    const startTime = Date.now();

    const poll = async (): Promise<void> => {
      if (Date.now() - startTime > POLL_TIMEOUT_MS) {
        this.showMessage('Check your order confirmation for your item.');
        return;
      }

      const result = await fetchJson<RevealResponse>(
        `${this.apiBase}/api/reveal/${encodeURIComponent(orderId)}`
      );

      if (!result) {
        setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      if (result.status === 'pending') {
        setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      if ((result.status === 'assigned' || result.status === 'fulfilled') && result.item) {
        this.animation.play(result.item);
        return;
      }

      if (result.status === 'failed') {
        this.showMessage('There was an issue with your order. Please contact support.');
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    await poll();
  }
}

// ── Bootstrap: find and initialize all blind box widget containers ──────────
(function initBlindBoxWidgets() {
  const containers = document.querySelectorAll<HTMLElement>(
    '[id="shopline-blind-box-widget"][data-product-id]'
  );

  containers.forEach((el) => {
    new BlindBoxWidget(el).init();
  });
})();
