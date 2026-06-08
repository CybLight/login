/**
 * Trap focus inside an element. Returns a cleanup function.
 * Зафиксировать фокус внутри элемента. Возвращает функцию очистки.
 */
export function trapFocus(container: HTMLElement): () => void {
  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );

  if (focusable.length === 0) return () => {};

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', onKey);

  // Ensure first focus
  setTimeout(() => first.focus(), 0);

  return () => {
    container.removeEventListener('keydown', onKey);
  };
}
