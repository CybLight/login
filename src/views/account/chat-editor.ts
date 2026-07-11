import { t } from '@/i18n';
import { showAppPrompt } from '@/ui';
import { stripNoPreviewTokens } from './chat-format';

function notifyChatInputChange(input: HTMLTextAreaElement): void {
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function insertChatFormatting(
  startToken: string,
  endToken: string,
  input: HTMLTextAreaElement,
): void {
  input.focus();
  let selectionStart = input.selectionStart;
  let selectionEnd = input.selectionEnd;
  const text = input.value;

  const tokenLen = startToken.length;
  let leftOffset = 0;
  let rightOffset = 0;

  // 1. Check if the target format is already wrapping this selection (either directly or separated by other formatting tags)
  // Scan left for startToken
  for (let i = selectionStart - tokenLen; i >= 0; i--) {
    const isFormatChar = ['*', '_', '~', '|'].includes(text[i]);
    if (!isFormatChar && i < selectionStart - tokenLen) break;
    if (text.substring(i, i + tokenLen) === startToken) {
      leftOffset = selectionStart - i;
      break;
    }
  }

  // Scan right for endToken
  for (let i = selectionEnd; i <= text.length - tokenLen; i++) {
    const isFormatChar = ['*', '_', '~', '|'].includes(text[i]);
    if (!isFormatChar && i > selectionEnd) break;
    if (text.substring(i, i + tokenLen) === endToken) {
      rightOffset = i + tokenLen - selectionEnd;
      break;
    }
  }

  // If both left and right tokens match, toggle formatting OFF
  if (leftOffset > 0 && rightOffset > 0) {
    const beforeText = text.substring(0, selectionStart - leftOffset);
    const selectedText = text.substring(selectionStart, selectionEnd);
    const afterText = text.substring(selectionEnd + rightOffset);

    input.value = beforeText + selectedText + afterText;

    const newStart = selectionStart - leftOffset;
    input.setSelectionRange(newStart, newStart + selectedText.length);
    notifyChatInputChange(input);
    return;
  }

  // 2. TOGGLE ON: Apply the format
  // Implement mutual exclusivity: MONO (code) cannot be combined with other inline formatting.
  if (startToken === '`' || startToken === '```') {
    // If applying MONO: Expand selection to consume any wrapping formatting markers (**, __, _, ~~, ||)
    while (selectionStart > 0 && ['*', '_', '~', '|'].includes(text[selectionStart - 1])) {
      selectionStart--;
    }
    while (selectionEnd < text.length && ['*', '_', '~', '|'].includes(text[selectionEnd])) {
      selectionEnd++;
    }
  } else {
    // If applying other formats: Expand selection to consume any wrapping MONO markers (`)
    while (selectionStart > 0 && text[selectionStart - 1] === '`') {
      selectionStart--;
    }
    while (selectionEnd < text.length && text[selectionEnd] === '`') {
      selectionEnd++;
    }
  }

  let selectedText = text.substring(selectionStart, selectionEnd);

  // Strip conflicting markers from within selection
  if (startToken === '`' || startToken === '```') {
    selectedText = selectedText.replace(/[\*_~\|]+/g, '');
  } else {
    selectedText = selectedText.replace(/`/g, '');
  }

  input.value =
    text.substring(0, selectionStart) +
    startToken +
    selectedText +
    endToken +
    text.substring(selectionEnd);

  if (selectedText) {
    input.setSelectionRange(
      selectionStart + startToken.length,
      selectionStart + startToken.length + selectedText.length
    );
  } else {
    input.setSelectionRange(
      selectionStart + startToken.length,
      selectionStart + startToken.length
    );
  }

  notifyChatInputChange(input);
}

export async function insertChatLink(input: HTMLTextAreaElement): Promise<void> {
  input.focus();
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const selectedText = input.value.substring(selectionStart, selectionEnd);

  const url = await showAppPrompt(t('Введите URL:'), 'https://');
  if (!url) return;

  const fallbackText =
    (await showAppPrompt(t('Текст ссылки:'), selectedText || url)) || selectedText || url;
  const markdown = `[${fallbackText}](${url})`;

  input.value =
    input.value.substring(0, selectionStart) + markdown + input.value.substring(selectionEnd);
  input.setSelectionRange(selectionStart + markdown.length, selectionStart + markdown.length);
  notifyChatInputChange(input);
}

export function insertChatBlockquote(input: HTMLTextAreaElement): void {
  input.focus();
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const text = input.value;

  // Find the start of the line containing selectionStart
  const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
  
  // Find the end of the line containing selectionEnd
  let lineEnd = text.indexOf('\n', selectionEnd);
  if (lineEnd === -1) lineEnd = text.length;

  const selectedLines = text.substring(lineStart, lineEnd);
  const isQuoted = selectedLines.split('\n').every(line => line.startsWith('> '));

  if (isQuoted) {
    // Toggle OFF: Remove '> ' from the start of each line
    const unquoted = selectedLines
      .split('\n')
      .map(line => line.startsWith('> ') ? line.slice(2) : line)
      .join('\n');

    input.value = text.substring(0, lineStart) + unquoted + text.substring(lineEnd);
    
    const diff = selectedLines.length - unquoted.length;
    input.setSelectionRange(
      Math.max(lineStart, selectionStart - diff),
      Math.max(lineStart, selectionEnd - diff)
    );
  } else {
    // Toggle ON: Add '> ' to the start of each line
    const quoted = selectedLines
      .split('\n')
      .map(line => line.startsWith('> ') ? line : `> ${line}`)
      .join('\n');

    input.value = text.substring(0, lineStart) + quoted + text.substring(lineEnd);
    
    const diff = quoted.length - selectedLines.length;
    input.setSelectionRange(selectionStart + diff, selectionEnd + diff);
  }

  notifyChatInputChange(input);
}

export async function insertChatCode(input: HTMLTextAreaElement): Promise<void> {
  input.focus();
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const selectedText = input.value.substring(selectionStart, selectionEnd);
  const language = (await showAppPrompt(t('Язык программирования (необязательно):'), '')) || '';
  const formatted = `\`\`\`${language}\n${selectedText || 'код здесь'}\n\`\`\``;

  input.value =
    input.value.substring(0, selectionStart) + formatted + input.value.substring(selectionEnd);
  notifyChatInputChange(input);
}

export function stripChatFormatting(input: HTMLTextAreaElement): void {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  if (selectionStart === selectionEnd) return;

  const text = input.value;
  const selected = text.substring(selectionStart, selectionEnd);

  // Remove common markdown markers globally within selection
  const plain = selected
    .replace(/\*\*|__|~~|\|\||`/g, '')
    .replace(/\[([^]]+)]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/_/g, '');

  input.value = text.substring(0, selectionStart) + plain + text.substring(selectionEnd);
  input.setSelectionRange(selectionStart, selectionStart + plain.length);
  notifyChatInputChange(input);
}

export function startEditMessageInAccount(
  messageId: string,
  currentContent: string,
  input: HTMLTextAreaElement,
  sendBtn: HTMLButtonElement | null,
  editIndicator: HTMLElement | null,
  editingIdInput: HTMLInputElement | null,
  composeDraftHolder?: { draft: string },
): void {
  if (composeDraftHolder && !editingIdInput?.value) {
    composeDraftHolder.draft = input.value;
  }

  if (editingIdInput) editingIdInput.value = messageId;

  input.value = stripNoPreviewTokens(currentContent);
  input.focus();
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  notifyChatInputChange(input);

  if (sendBtn) {
    sendBtn.textContent = '💾 Сохранить';
    sendBtn.classList.add('is-save-mode');
    sendBtn.setAttribute('aria-label', 'Сохранить');
  }

  if (editIndicator) editIndicator.style.display = 'flex';
}

export function resetChatEditingState(
  input: HTMLTextAreaElement | null,
  sendBtn: HTMLButtonElement | null,
  editIndicator: HTMLElement | null,
  editingIdInput: HTMLInputElement | null,
  composeDraftHolder?: { draft: string },
): void {
  if (editingIdInput) editingIdInput.value = '';

  if (input) {
    input.value = composeDraftHolder?.draft ?? '';
    input.style.height = 'auto';
    if (input.value) {
      input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
    }
    notifyChatInputChange(input);
  }

  if (sendBtn) {
    sendBtn.textContent = 'Отправить';
    sendBtn.classList.remove('is-save-mode');
    sendBtn.setAttribute('aria-label', 'Отправить');
  }

  if (editIndicator) editIndicator.style.display = 'none';
}
