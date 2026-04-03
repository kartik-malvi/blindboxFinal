export interface RevealItem {
  name: string;
  sku: string;
  imageUrl?: string | null;
}

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

export class RevealAnimation {
  private container: HTMLElement;
  private styleInjected = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  private injectStyles(): void {
    if (this.styleInjected) return;
    const style = document.createElement('style');
    style.textContent = ANIMATION_CSS;
    document.head.appendChild(style);
    this.styleInjected = true;
  }

  play(item: RevealItem): void {
    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      this.showResult(item);
      return;
    }

    this.injectStyles();
    this.showUnboxAnimation(item);
  }

  private showUnboxAnimation(item: RevealItem): void {
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
      const lid = this.container.querySelector<HTMLElement>('.bb-box-lid');
      if (lid) {
        lid.style.animation = 'bb-lid-open 0.6s ease-in-out forwards';
      }

      // Phase 3: after lid opens, show item
      setTimeout(() => {
        this.showResult(item);
      }, 700);
    }, 1200);
  }

  private showResult(item: RevealItem): void {
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

    const shareBtn = this.container.querySelector<HTMLButtonElement>('.bb-share-btn');
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
}
