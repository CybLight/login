/**
 * Modal components
 */

import type { ModalOptions } from '@/types';
import { trapFocus } from '@/utils/focus';

export class ModalsManager {
  /**
   * Show info modal
   */
  static async showInfo(options: ModalOptions): Promise<void> {
    const modal = document.getElementById('info-modal');
    if (!modal) {
      this.createInfoModal();
      return this.showInfo(options);
    }

    const title = modal.querySelector('.modal__title') as HTMLElement;
    const text = modal.querySelector('.modal__text') as HTMLElement;
    const okBtn = modal.querySelector('.modal__btn-ok') as HTMLButtonElement;

    if (title) title.textContent = options.title;
    if (text) text.textContent = options.text;

    (modal as HTMLElement).style.display = 'flex';

    // Trap focus while modal open
    const cleanupFocus = trapFocus(modal as HTMLElement);

    return new Promise((resolve) => {
      function onEsc(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          (modal as HTMLElement).style.display = 'none';
          cleanupFocus();
          window.removeEventListener('keydown', onEsc);
          resolve();
        }
      }

      window.addEventListener('keydown', onEsc);

      okBtn.onclick = async () => {
        if (options.onOk) {
          await options.onOk();
        }
        (modal as HTMLElement).style.display = 'none';
        try { cleanupFocus(); } catch { /* ignore cleanup errors */ }
        window.removeEventListener('keydown', onEsc);
        resolve();
      };
    });
  }

  /**
   * Show report modal
   */
  static async showReport(): Promise<void> {
    const modal = document.getElementById('report-modal');
    if (!modal) {
      this.createReportModal();
      return this.showReport();
    }

    (modal as HTMLElement).style.display = 'flex';
    const cleanupFocus = trapFocus(modal as HTMLElement);

    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        (modal as HTMLElement).style.display = 'none';
        try { cleanupFocus(); } catch { /* ignore cleanup errors */ }
        window.removeEventListener('keydown', onEsc);
      }
    }

    window.addEventListener('keydown', onEsc);
  }

  /**
   * Close all modals
   */
  static closeAll(): void {
    const modals = document.querySelectorAll('.modal');
    modals.forEach((m) => {
      (m as HTMLElement).style.display = 'none';
    });
  }

  private static createInfoModal(): void {
    const modal = document.createElement('div');
    modal.id = 'info-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal__content" role="dialog" aria-modal="true" aria-labelledby="info-modal-title" aria-describedby="info-modal-desc">
        <h2 id="info-modal-title" class="modal__title">Info</h2>
        <p id="info-modal-desc" class="modal__text"></p>
        <button class="modal__btn-ok btn btn-primary" aria-label="Ок">OK</button>
      </div>
    `;

    const close = () => {
      modal.style.display = 'none';
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    document.body.appendChild(modal);
  }

  private static createReportModal(): void {
    const modal = document.createElement('div');
    modal.id = 'report-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal__content modal__content--large" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" aria-describedby="report-modal-desc">
        <h2 id="report-modal-title" class="modal__title">Сообщить об ошибке</h2>
        <div id="report-modal-desc" class="sr-only">Форма отправки отчёта об ошибке</div>
        <form id="report-form">
          <textarea name="message" placeholder="Опишите проблему..." rows="5"></textarea>
          <button type="submit" class="btn btn-primary" aria-label="Отправить">Отправить</button>
        </form>
      </div>
    `;

    const close = () => {
      modal.style.display = 'none';
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    document.body.appendChild(modal);
  }
}
