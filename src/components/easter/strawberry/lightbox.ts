/**
 * Strawberry Lightbox - просмотр изображений в полноэкранном режиме
 * Поддерживает: swipe, pinch-zoom, pan
 */

import '@/styles/lightbox.css';
import { trapFocus } from '@/utils/focus';

export interface LightboxItems {
  sources: string[];
  captions?: string[];
}

class StrawberryLightboxClass {
  private lb: HTMLElement | null = null;
  private imgEl: HTMLImageElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private prevBtn: HTMLButtonElement | null = null;
  private nextBtn: HTMLButtonElement | null = null;
  private counterEl: HTMLElement | null = null;
  private captionEl: HTMLElement | null = null;

  private sources: string[] = [];
  private captions: string[] = [];
  private index = 0;

  // Swipe
  private touchStartX = 0;
  private touchStartY = 0;
  private touchActive = false;

  // Pinch-zoom / pan
  private baseScale = 1;
  private scale = 1;
  private baseTx = 0;
  private baseTy = 0;
  private tx = 0;
  private ty = 0;

  private isPinching = false;
  private pinchStartDist = 0;
  private pinchStartScale = 1;

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartTx = 0;
  private panStartTy = 0;
  private cleanupFocus: (() => void) | null = null;

  private ensure(): HTMLElement {
    this.lb = document.querySelector('.strawberry-lightbox');
    if (this.lb) {
      this.imgEl = this.lb.querySelector('.strawberry-lightbox__img');
      this.closeBtn = this.lb.querySelector('.strawberry-lightbox__close');
      this.prevBtn = this.lb.querySelector('.strawberry-lightbox__nav.prev');
      this.nextBtn = this.lb.querySelector('.strawberry-lightbox__nav.next');
      this.counterEl = this.lb.querySelector('.strawberry-lightbox__counter');
      this.captionEl = this.lb.querySelector('.strawberry-lightbox__caption');
      return this.lb;
    }

    this.lb = document.createElement('div');
    this.lb.className = 'strawberry-lightbox';
    this.lb.setAttribute('role', 'dialog');
    this.lb.setAttribute('aria-modal', 'true');
    this.lb.setAttribute('aria-label', 'Просмотр изображения');
    this.lb.setAttribute('tabindex', '-1');
    this.lb.innerHTML = `
      <div class="strawberry-lightbox__hud">
        <div class="strawberry-lightbox__counter">1 / 1</div>
      </div>

      <button class="strawberry-lightbox__close" type="button" aria-label="Закрыть">✕</button>
      <button class="strawberry-lightbox__nav prev" type="button" aria-label="Предыдущее">←</button>
      
      <div class="strawberry-lightbox__stage">
        <img class="strawberry-lightbox__img" alt="strawberry photo" draggable="false" />
      </div>

      <button class="strawberry-lightbox__nav next" type="button" aria-label="Следующее">→</button>
      <div class="strawberry-lightbox__caption"></div>
    `;
    document.body.appendChild(this.lb);

    this.imgEl = this.lb.querySelector('.strawberry-lightbox__img');
    this.closeBtn = this.lb.querySelector('.strawberry-lightbox__close');
    this.prevBtn = this.lb.querySelector('.strawberry-lightbox__nav.prev');
    this.nextBtn = this.lb.querySelector('.strawberry-lightbox__nav.next');
    this.counterEl = this.lb.querySelector('.strawberry-lightbox__counter');
    this.captionEl = this.lb.querySelector('.strawberry-lightbox__caption');

    // Events
    this.closeBtn?.addEventListener('click', () => this.close());
    this.prevBtn?.addEventListener('click', () => this.prev());
    this.nextBtn?.addEventListener('click', () => this.next());

    // Закрытие по клику на фон
    this.lb.addEventListener('click', (e) => {
      if (e.target === this.lb) this.close();
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (!this.lb?.classList.contains('is-open')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    // Touch gestures
    this.imgEl?.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.imgEl?.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.imgEl?.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

    // Mouse pan
    this.imgEl?.addEventListener('mousedown', (e) => this.onMouseDown(e));

    return this.lb;
  }

  private setItems(list: LightboxItems, startIndex = 0): void {
    this.sources = Array.isArray(list?.sources) ? list.sources : [];
    this.captions = Array.isArray(list?.captions) ? list.captions : [];
    this.index = Math.max(0, Math.min(startIndex, this.sources.length - 1));
  }

  private preloadOne(src?: string): void {
    if (!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;
  }

  private preloadNeighbors(): void {
    this.preloadOne(this.sources[this.index - 1]);
    this.preloadOne(this.sources[this.index + 1]);
  }

  private updateHud(): void {
    if (this.counterEl)
      this.counterEl.textContent = `${this.index + 1} / ${this.sources.length || 1}`;
    if (this.captionEl) this.captionEl.textContent = this.captions[this.index] || '';
  }

  private resetTransform(): void {
    this.baseScale = this.scale = 1;
    this.baseTx = this.tx = 0;
    this.baseTy = this.ty = 0;
    this.applyTransform();
    this.lb?.classList.remove('is-zoomed');
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  private applyTransform(): void {
    if (!this.imgEl) return;

    // Ограничим масштаб
    this.scale = this.clamp(this.scale, 1, 3.2);

    // Если scale == 1 — сбрасываем сдвиги
    if (this.scale <= 1.001) {
      this.scale = this.baseScale = 1;
      this.tx = this.baseTx = 0;
      this.ty = this.baseTy = 0;
      this.lb?.classList.remove('is-zoomed');
    } else {
      this.lb?.classList.add('is-zoomed');
    }

    this.imgEl.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  private showAt(i: number): void {
    if (!this.sources.length) return;
    this.index = (i + this.sources.length) % this.sources.length;

    this.ensure();
    this.imgEl?.classList.remove('is-ready');
    this.resetTransform();

    const src = this.sources[this.index];
    this.updateHud();

    const tmp = new Image();
    tmp.decoding = 'async';
    tmp.src = src;

    const apply = () => {
      if (this.imgEl) {
        this.imgEl.src = src;
        requestAnimationFrame(() => this.imgEl?.classList.add('is-ready'));
      }
      this.preloadNeighbors();
    };

    if (tmp.decode) tmp.decode().then(apply).catch(apply);
    else {
      tmp.onload = apply;
      tmp.onerror = apply;
    }
  }

  public open(items: LightboxItems, startIndex = 0): void {
    this.ensure();
    this.setItems(items, startIndex);
    this.lb?.classList.add('is-open');
    if (this.lb) {
      this.cleanupFocus?.();
      this.cleanupFocus = trapFocus(this.lb);
    }
    this.showAt(this.index);
  }

  public close(): void {
    if (!this.lb) return;
    this.cleanupFocus?.();
    this.cleanupFocus = null;
    this.lb.classList.remove('is-open');
    if (this.imgEl) {
      this.imgEl.classList.remove('is-ready');
      setTimeout(() => {
        if (this.imgEl) this.imgEl.src = '';
      }, 80);
    }
    this.resetTransform();
  }

  public prev(): void {
    if (!this.lb || !this.lb.classList.contains('is-open')) return;
    this.showAt(this.index - 1);
  }

  public next(): void {
    if (!this.lb || !this.lb.classList.contains('is-open')) return;
    this.showAt(this.index + 1);
  }

  // Touch: swipe + pinch
  private dist2(t1: Touch, t2: Touch): number {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }

  private onTouchStart(e: TouchEvent): void {
    if (!this.lb?.classList.contains('is-open')) return;

    if (e.touches.length === 2) {
      // Pinch start
      this.isPinching = true;
      this.isPanning = false;
      this.pinchStartDist = this.dist2(e.touches[0], e.touches[1]);
      this.pinchStartScale = this.baseScale;
      this.panStartTx = this.baseTx;
      this.panStartTy = this.baseTy;
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
      this.touchActive = true;

      // Если уже зумнули — начинаем pan
      if (this.baseScale > 1.01) {
        this.isPanning = true;
        this.panStartX = t.clientX;
        this.panStartY = t.clientY;
        this.panStartTx = this.baseTx;
        this.panStartTy = this.baseTy;
        e.preventDefault();
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.lb?.classList.contains('is-open')) return;

    if (this.isPinching && e.touches.length === 2) {
      const d = this.dist2(e.touches[0], e.touches[1]);
      const ratio = d / (this.pinchStartDist || d);
      this.scale = this.pinchStartScale * ratio;
      this.applyTransform();
      e.preventDefault();
      return;
    }

    if (this.isPanning && e.touches.length === 1 && this.baseScale > 1.01) {
      const t = e.touches[0];
      this.tx = this.panStartTx + (t.clientX - this.panStartX);
      this.ty = this.panStartTy + (t.clientY - this.panStartY);
      this.applyTransform();
      e.preventDefault();
      return;
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (!this.lb?.classList.contains('is-open')) return;

    // Pinch end
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false;
      this.baseScale = this.scale;
      this.baseTx = this.tx;
      this.baseTy = this.ty;
      this.applyTransform();

      // Если остался 1 палец — сразу начинаем pan
      if (e.touches.length === 1 && this.baseScale > 1.01) {
        const t = e.touches[0];
        this.isPanning = true;
        this.panStartX = t.clientX;
        this.panStartY = t.clientY;
        this.panStartTx = this.baseTx;
        this.panStartTy = this.baseTy;
      }

      return;
    }

    // Pan end
    if (this.isPanning && e.touches.length === 0) {
      this.isPanning = false;
      this.baseTx = this.tx;
      this.baseTy = this.ty;
      this.applyTransform();
      return;
    }

    // Swipe logic (только если не зумим)
    if (this.touchActive && this.scale <= 1.01) {
      this.touchActive = false;

      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;

      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > 55 && absX > absY) {
        if (dx < 0) this.next();
        else this.prev();
        return;
      }

      if (dy > 70 && absY > absX) {
        this.close();
      }
    }
  }

  // Mouse pan (desktop)
  private onMouseDown(e: MouseEvent): void {
    if (!this.lb?.classList.contains('is-open')) return;
    if (this.scale <= 1.01) return;

    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panStartTx = this.baseTx;
    this.panStartTy = this.baseTy;

    const onMove = (ev: MouseEvent) => {
      if (!this.isPanning) return;
      this.tx = this.panStartTx + (ev.clientX - this.panStartX);
      this.ty = this.panStartTy + (ev.clientY - this.panStartY);
      this.applyTransform();
    };

    const onUp = () => {
      this.isPanning = false;
      this.baseTx = this.tx;
      this.baseTy = this.ty;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
}

// Singleton instance
export const StrawberryLightbox = new StrawberryLightboxClass();
