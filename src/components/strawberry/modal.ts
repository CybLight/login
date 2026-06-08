/**
 * Strawberry modal - модальное окно для пасхалки
 */

import { escapeHtml } from '@/utils';
import { trapFocus } from '@/utils/focus';

const MODAL_ID = 'customPrompt';

/**
 * Создать/получить модальное окно
 */
function ensureModal(): HTMLElement {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description">
      <div class="convariant">
        <div class="circle"></div>
        <div class="emoji">🍓</div>
      </div>

      <h2 id="modal-title" class="title"></h2>
      <p id="modal-description" class="subtitle"></p>

      <input type="text" id="promptInput" placeholder="Ваш Nickname" autocomplete="nickname" />

      <div class="buttons">
        <button id="confirmBtn" type="button" aria-label="OK">OK</button>
        <button id="cancelBtn" class="cancel" type="button" aria-label="Отмена">Отмена</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Закрытие по клику на фон
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      const cancel = modal.querySelector('#cancelBtn') as HTMLButtonElement;
      if (cancel) cancel.click();
    }
  });

  // Закрытие по Escape
  window.addEventListener('keydown', (e) => {
    const modalEl = document.getElementById(MODAL_ID) as HTMLDivElement;
    if (e.key === 'Escape' && modalEl && modalEl.style.display === 'flex') {
      const cancel = modalEl.querySelector('#cancelBtn') as HTMLButtonElement;
      if (cancel) cancel.click();
    }
  });

  return modal;
}

/**
 * Запрос имени пользователя
 */
export function customPrompt(title: string, subtitle: string): Promise<string> {
  return new Promise((resolve) => {
    const modal = ensureModal();

    const input = modal.querySelector('#promptInput') as HTMLInputElement;
    const ok = modal.querySelector('#confirmBtn') as HTMLButtonElement;
    const cancel = modal.querySelector('#cancelBtn') as HTMLButtonElement;
    const titleEl = modal.querySelector('.title') as HTMLHeadingElement;
    const textEl = modal.querySelector('.subtitle') as HTMLParagraphElement;
    const emojiEl = modal.querySelector('.emoji') as HTMLDivElement;

    // Режим запроса ника
    modal.classList.remove('modal--congrats');
    modal.classList.add('modal--strawberry');
    if (emojiEl) emojiEl.textContent = '🍓';

    if (titleEl) titleEl.textContent = title || '';
    if (textEl) textEl.textContent = subtitle || '';

    // Показываем input/cancel
    input.style.display = '';
    cancel.style.display = '';
    ok.textContent = 'OK';

    modal.style.display = 'flex';
    input.value = '';

    // Trap focus inside modal
    const cleanupFocus = trapFocus(modal as HTMLElement);

    setTimeout(() => input.focus(), 0);

    // Функция проверки
    function submit() {
      const val = input.value.trim();

      if (!val) {
        // Показываем ошибку
        input.classList.add('input-error');
        input.style.animation = 'shake .25s';

        setTimeout(() => {
          input.style.animation = '';
        }, 300);

        return; // Не закрывать!
      }

      input.classList.remove('input-error');
      cleanup();
      resolve(val);
    }

    // Enter только внутри модалки
    function onKey(e: KeyboardEvent) {
      if (modal.style.display !== 'flex') return;
      if (modal.classList.contains('modal--congrats')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    }

    window.addEventListener('keydown', onKey, true);

    // Кнопки
    ok.onclick = submit;

    cancel.onclick = () => {
      cleanup();
      resolve('');
    };

    // Очистка
    function cleanup() {
      modal.style.display = 'none';
      ok.onclick = null;
      cancel.onclick = null;

      window.removeEventListener('keydown', onKey, true);

      // remove focus trap
      // удалить фокусную ловушку
      try {
        cleanupFocus();
      } catch {
        /* ignore cleanup errors */
      }

      input.value = '';
      input.style.display = '';
      cancel.style.display = '';
      ok.textContent = 'OK';
    }
  });
}

/**
 * Модальное окно с поздравлением
 */
export function showCongratsModal(userName: string, onConfirm: () => void): Promise<string> {
  return new Promise((resolve) => {
    const modal = ensureModal();

    const input = modal.querySelector('#promptInput') as HTMLInputElement;
    const ok = modal.querySelector('#confirmBtn') as HTMLButtonElement;
    const cancel = modal.querySelector('#cancelBtn') as HTMLButtonElement;
    const titleEl = modal.querySelector('.title') as HTMLHeadingElement;
    const textEl = modal.querySelector('.subtitle') as HTMLParagraphElement;
    const emojiEl = modal.querySelector('.emoji') as HTMLDivElement;
    const convex = modal.querySelector('.convariant') as HTMLDivElement;

    // Очищаем старые обработчики
    (window as unknown as { __customPromptEnter?: unknown }).__customPromptEnter = undefined;

    function baseCleanup() {
      modal.style.display = 'none';
      modal.classList.remove('modal--congrats', 'modal--strawberry');

      if (input) {
        input.style.display = '';
        input.value = '';
      }
      if (cancel) cancel.style.display = '';
      if (ok) ok.textContent = 'OK';

      ok.onclick = null;
      cancel.onclick = null;

      emojiEl?.classList.remove('float');

      window.removeEventListener('keydown', onEnterCongrats, true);
      try {
        cleanupFocus();
      } catch {
        /* ignore cleanup errors */
      }
    }

    let cleanup = baseCleanup;

    if (emojiEl) emojiEl.classList.add('float');

    // 3D эффект движения клубнички
    function tilt(e: MouseEvent) {
      const rect = convex.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const rotateX = (y / 18).toFixed(2);
      const rotateY = (-x / 18).toFixed(2);

      emojiEl.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }

    function resetTilt() {
      emojiEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }

    convex.addEventListener('mousemove', tilt);
    convex.addEventListener('mouseleave', resetTilt);

    const oldCleanup = cleanup;
    cleanup = () => {
      convex.removeEventListener('mousemove', tilt);
      convex.removeEventListener('mouseleave', resetTilt);
      oldCleanup();
    };

    // Режим поздравления
    modal.classList.add('modal--congrats', 'modal--strawberry');
    if (emojiEl) emojiEl.textContent = '🎉';

    if (titleEl) titleEl.textContent = 'Поздравляю!';
    if (textEl) {
      const text1 = 'эта клубничка была особенная';
      const text2 = 'ты поймал её вовремя, <br> пока она не разбилась об футер сайта.';
      textEl.innerHTML = `<b>${escapeHtml(userName)}</b>,🍓 ${text1} 😉<br> ${text2}`;
    }

    // Скрываем input и cancel
    if (input) input.style.display = 'none';
    if (cancel) cancel.style.display = 'none';
    if (ok) ok.textContent = 'Круто!';

    modal.style.display = 'flex';
    const cleanupFocus = trapFocus(modal as HTMLElement);

    function onEnterCongrats(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        ok.click();
      }
    }

    window.addEventListener('keydown', onEnterCongrats, true);

    // Кнопки
    ok.onclick = () => {
      ok.classList.add('btn-okay-animate');

      if (emojiEl) {
        emojiEl.classList.add('flash');
        setTimeout(() => emojiEl.classList.remove('flash'), 350);
      }

      if (navigator.vibrate) {
        navigator.vibrate([15, 35, 15]);
      }

      setTimeout(() => {
        cleanup();
        onConfirm();
        resolve('ok');
      }, 300);
    };

    cancel.onclick = () => {
      cleanup();
      resolve('cancel');
    };
  });
}
