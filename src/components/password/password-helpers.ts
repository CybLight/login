/**
 * Password utilities - функции для работы с полями паро ля
 */

/**
 * Инициализировать кнопки показа/скрытия пароля
 */
export function initPasswordEyes(root: Document | HTMLElement = document): void {
  root.querySelectorAll('.pass-eye').forEach((btn) => {
    (btn as HTMLButtonElement).onclick = () => {
      const id = btn.getAttribute('data-target');
      if (!id) return;

      const input = document.getElementById(id) as HTMLInputElement;
      if (!input) return;

      const open = input.type === 'password';
      input.type = open ? 'text' : 'password';
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-label', open ? 'Скрыть пароль' : 'Показать пароль');
    };
  });
}

/**
 * Анимация shake для элемента
 */
export function shakeElement(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove('shake');
  // Trigger reflow
  void el.offsetWidth;
  el.classList.add('shake');
}
