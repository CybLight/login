import { parseFormattedChatText } from './chat-format';
import {
  insertChatBlockquote,
  insertChatCode,
  insertChatFormatting,
  insertChatLink,
} from './chat-editor';

export function syncChatRichInputMirror(input: HTMLTextAreaElement): void {
  const field = input.closest('.chat-input-field');
  const mirror = field?.querySelector('.chat-input-mirror') as HTMLElement | null;
  if (!mirror) return;

  const value = input.value;
  field?.classList.toggle('is-empty', !value);

  if (!value) {
    mirror.innerHTML = '';
    return;
  }

  mirror.innerHTML = parseFormattedChatText(value);
}

export function adjustChatInputHeight(input: HTMLTextAreaElement, maxHeight = 150): void {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
}

export function bindChatRichInput(input: HTMLTextAreaElement): void {
  if (input.dataset.richInputBound === '1') return;
  input.dataset.richInputBound = '1';
  input.classList.add('chat-input--rich');

  const sync = (): void => {
    syncChatRichInputMirror(input);
    adjustChatInputHeight(input);
  };

  input.addEventListener('input', sync);
  input.addEventListener('scroll', () => {
    const mirror = input.parentElement?.querySelector('.chat-input-mirror') as HTMLElement | null;
    if (mirror) mirror.scrollTop = input.scrollTop;
  });

  sync();
}

export function handleChatInputFormatShortcut(
  event: KeyboardEvent,
  input: HTMLTextAreaElement,
): boolean {
  if (!(event.ctrlKey || event.metaKey)) return false;

  const key = event.key.toLowerCase();
  const shifted = event.shiftKey;

  if (!shifted && key === 'b') {
    event.preventDefault();
    insertChatFormatting('**', '**', input);
    return true;
  }
  if (!shifted && key === 'i') {
    event.preventDefault();
    insertChatFormatting('_', '_', input);
    return true;
  }
  if (!shifted && key === 'u') {
    event.preventDefault();
    insertChatFormatting('__', '__', input);
    return true;
  }
  if (!shifted && key === 'k') {
    event.preventDefault();
    void insertChatLink(input);
    return true;
  }
  if (shifted && key === 'x') {
    event.preventDefault();
    insertChatFormatting('~~', '~~', input);
    return true;
  }
  if (shifted && key === 'm') {
    event.preventDefault();
    insertChatFormatting('`', '`', input);
    return true;
  }
  if (shifted && key === 'p') {
    event.preventDefault();
    insertChatFormatting('||', '||', input);
    return true;
  }
  if (shifted && key === 'q') {
    event.preventDefault();
    insertChatBlockquote(input);
    return true;
  }
  if (shifted && key === 'c') {
    event.preventDefault();
    void insertChatCode(input);
    return true;
  }

  return false;
}
