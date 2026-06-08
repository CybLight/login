import { trapFocus } from './focus';

export type AccessibleModalOptions = {
  onClose: () => void;
  trapFocusRoot?: HTMLElement;
};

/**
 * Trap focus and close modal on Escape.
 */
export function setupAccessibleModal(
  element: HTMLElement,
  options: AccessibleModalOptions
): () => void {
  const focusRoot = options.trapFocusRoot ?? element;
  const cleanupFocus = trapFocus(focusRoot);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onClose();
    }
  };

  window.addEventListener('keydown', onKeyDown);

  return () => {
    cleanupFocus();
    window.removeEventListener('keydown', onKeyDown);
  };
}

export type KeyboardNavigationOptions = {
  onEscape?: () => void;
  trapFocus?: boolean;
};

/**
 * Attach keyboard handlers (Escape, optional focus trap) to an element.
 */
export function handleKeyboardNavigation(
  element: HTMLElement,
  options: KeyboardNavigationOptions = {}
): () => void {
  const cleanups: Array<() => void> = [];

  if (options.trapFocus) {
    cleanups.push(trapFocus(element));
  }

  if (options.onEscape) {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        options.onEscape?.();
      }
    };
    element.addEventListener('keydown', onKeyDown);
    cleanups.push(() => element.removeEventListener('keydown', onKeyDown));
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
