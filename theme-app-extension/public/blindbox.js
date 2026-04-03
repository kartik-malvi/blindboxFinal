(function () {
  'use strict';

  const ANIMATION_CSS = `
  @keyframes bb-spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes bb-lid-open {
    0%   { transform: rotateX(0deg); }
    100% { transform: rotateX(-120deg); }
  }
  @keyframes bb-item-rise {
    0%   { transform: scale(0.2) translateY(40px); opacity: 0; }
    60%  { transform: scale(1.1) translateY(-8px); opacity: 1; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes bb-fade-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
  class RevealAnimation {
      constructor(container) {
          this.styleInjected = false;
          this.container = container;
      }
      injectStyles() {
          if (this.styleInjected)
              return;
          const style = document.createElement('style');
          style.textContent = ANIMATION_CSS;
          document.head.appendChild(style);
          this.styleInjected = true;
      }
      play(item) {
          // Respect prefers-reduced-motion
          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (prefersReduced) {
              this.showResult(item);
              return;
          }
          this.injectStyles();
          this.showUnboxAnimation(item);
      }
      showUnboxAnimation(item) {
          // Phase 1: spinning mystery box
          this.container.innerHTML = `
      <div class="bb-reveal-stage">
        <div class="bb-mystery-box" aria-label="Opening your blind box...">
          <div class="bb-box-body">
            <div class="bb-box-question">?</div>
          </div>
          <div class="bb-box-lid"></div>
        </div>
        <p class="bb-reveal-hint">Opening your blind box...</p>
      </div>
    `;
          // Phase 2: after 1.2s, open lid + rise item
          setTimeout(() => {
              const lid = this.container.querySelector('.bb-box-lid');
              if (lid) {
                  lid.style.animation = 'bb-lid-open 0.6s ease-in-out forwards';
              }
              // Phase 3: after lid opens, show item
              setTimeout(() => {
                  this.showResult(item);
              }, 700);
          }, 1200);
      }
      showResult(item) {
          const imageHtml = item.imageUrl
              ? `<img class="bb-reveal-item-img" src="${this.escapeHtml(item.imageUrl)}" alt="${this.escapeHtml(item.name)}" />`
              : `<div class="bb-reveal-item-placeholder" aria-hidden="true">🎁</div>`;
          const shareButton = 'share' in navigator || 'clipboard' in navigator
              ? `<button class="bb-share-btn" type="button">Share</button>`
              : '';
          this.container.innerHTML = `
      <div class="bb-reveal-result" style="animation: bb-fade-in 0.5s ease-out forwards;">
        <h2 class="bb-reveal-heading">You got: ${this.escapeHtml(item.name)}!</h2>
        <div class="bb-reveal-item-card">
          ${imageHtml}
          <span class="bb-reveal-item-name">${this.escapeHtml(item.name)}</span>
          <span class="bb-reveal-item-sku">SKU: ${this.escapeHtml(item.sku)}</span>
        </div>
        ${shareButton}
      </div>
    `;
          const shareBtn = this.container.querySelector('.bb-share-btn');
          if (shareBtn) {
              shareBtn.addEventListener('click', () => {
                  navigator.clipboard
                      .writeText(window.location.href)
                      .then(() => {
                      shareBtn.textContent = 'Link copied!';
                      setTimeout(() => {
                          shareBtn.textContent = 'Share';
                      }, 2000);
                  })
                      .catch(() => {
                      shareBtn.textContent = 'Share';
                  });
              });
          }
      }
      escapeHtml(text) {
          const div = document.createElement('div');
          div.appendChild(document.createTextNode(text));
          return div.innerHTML;
      }
  }

  // CSS import — extracted by rollup-plugin-postcss into blindbox.css
  const POLL_INTERVAL_MS = 3000;
  const POLL_TIMEOUT_MS = 60000;
  function escapeHtml(text) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(text));
      return div.innerHTML;
  }
  function formatPrice(price) {
      const num = typeof price === 'string' ? parseFloat(price) : price;
      return isNaN(num) ? String(price) : `¥${num.toFixed(2)}`;
  }
  async function fetchJson(url) {
      try {
          const res = await fetch(url);
          if (!res.ok)
              return null;
          return (await res.json());
      }
      catch {
          return null;
      }
  }
  class BlindBoxWidget {
      constructor(el) {
          this.el = el;
          this.productId = el.dataset.productId;
          this.apiBase = (el.dataset.apiBase || '').replace(/\/$/, '');
          this.animation = new RevealAnimation(el);
      }
      async init() {
          var _a;
          // Fetch blind box summary
          const box = await fetchJson(`${this.apiBase}/api/public/blind-boxes/${encodeURIComponent(this.productId)}`);
          // Not a blind box product — do nothing, log nothing
          if (!box)
              return;
          // Fetch teaser items
          const teaserItems = (_a = await fetchJson(`${this.apiBase}/api/public/blind-boxes/${encodeURIComponent(this.productId)}/teaser`)) !== null && _a !== void 0 ? _a : [];
          this.render(box, teaserItems);
      }
      render(box, items) {
          const teaserHtml = items
              .map((item) => `
          <div class="bb-item-card">
            ${item.imageUrl
            ? `<img class="bb-item-card__img" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
            : `<div class="bb-item-card__placeholder" aria-hidden="true">🎁</div>`}
            <span class="bb-item-card__name">${escapeHtml(item.name)}</span>
          </div>
        `)
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
          const btn = this.el.querySelector('.bb-add-to-cart-btn');
          btn === null || btn === void 0 ? void 0 : btn.addEventListener('click', () => this.handleAddToCart());
      }
      async handleAddToCart() {
          var _a;
          const btn = this.el.querySelector('.bb-add-to-cart-btn');
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
              const data = (await res.json());
              const orderId = (_a = data.order_id) !== null && _a !== void 0 ? _a : data.id;
              if (!orderId) {
                  this.showMessage('Item added to cart! Check your order confirmation for your item.');
                  return;
              }
              this.showSpinner('Assigning your item...');
              await this.pollReveal(String(orderId));
          }
          catch {
              if (btn) {
                  btn.disabled = false;
                  btn.textContent = btn.dataset.originalText || 'Add to Cart';
              }
              this.showMessage('Could not add to cart. Please try again.');
          }
      }
      showSpinner(message) {
          const widget = this.el.querySelector('.bb-widget');
          if (!widget)
              return;
          const existing = widget.querySelector('.bb-spinner-overlay');
          if (existing)
              existing.remove();
          const overlay = document.createElement('div');
          overlay.className = 'bb-spinner-overlay';
          overlay.innerHTML = `
      <div class="bb-spinner" role="status" aria-label="${escapeHtml(message)}"></div>
      <p class="bb-spinner-text">${escapeHtml(message)}</p>
    `;
          widget.appendChild(overlay);
      }
      showMessage(message) {
          const overlay = this.el.querySelector('.bb-spinner-overlay');
          if (overlay) {
              overlay.innerHTML = `<p class="bb-status-message">${escapeHtml(message)}</p>`;
          }
          else {
              const msg = document.createElement('p');
              msg.className = 'bb-status-message';
              msg.textContent = message;
              this.el.appendChild(msg);
          }
      }
      async pollReveal(orderId) {
          const startTime = Date.now();
          const poll = async () => {
              if (Date.now() - startTime > POLL_TIMEOUT_MS) {
                  this.showMessage('Check your order confirmation for your item.');
                  return;
              }
              const result = await fetchJson(`${this.apiBase}/api/reveal/${encodeURIComponent(orderId)}`);
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
      const containers = document.querySelectorAll('[id="shopline-blind-box-widget"][data-product-id]');
      containers.forEach((el) => {
          new BlindBoxWidget(el).init();
      });
  })();

})();
