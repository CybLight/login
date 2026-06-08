import { stripNoPreviewTokens } from './chat-format';

export function insertChatFormatting(
  startToken: string,
  endToken: string,
  input: HTMLTextAreaElement
): void {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const text = input.value;
  const selectedText = text.substring(selectionStart, selectionEnd);

  input.value =
    text.substring(0, selectionStart) +
    startToken +
    selectedText +
    endToken +
    text.substring(selectionEnd);

  if (selectedText) {
    input.setSelectionRange(selectionStart + startToken.length, selectionEnd + startToken.length);
  } else {
    input.setSelectionRange(selectionStart + startToken.length, selectionStart + startToken.length);
  }

  input.focus();
}

export function insertChatLink(input: HTMLTextAreaElement): void {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const selectedText = input.value.substring(selectionStart, selectionEnd);

  const url = window.prompt('Введите URL:', 'https://');
  if (!url) return;

  const fallbackText = window.prompt('Текст ссылки:', selectedText || url) || selectedText || url;
  const markdown = `[${fallbackText}](${url})`;

  input.value =
    input.value.substring(0, selectionStart) + markdown + input.value.substring(selectionEnd);
  input.setSelectionRange(selectionStart + markdown.length, selectionStart + markdown.length);
  input.focus();
}

export function insertChatCode(input: HTMLTextAreaElement): void {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const selectedText = input.value.substring(selectionStart, selectionEnd);
  const language = window.prompt('Язык программирования (необязательно):', '') || '';
  const formatted = `\`\`\`${language}\n${selectedText || 'код здесь'}\n\`\`\``;

  input.value =
    input.value.substring(0, selectionStart) + formatted + input.value.substring(selectionEnd);
  input.focus();
}

export function startEditMessageInAccount(
  messageId: string,
  currentContent: string,
  input: HTMLTextAreaElement,
  sendBtn: HTMLButtonElement | null,
  editIndicator: HTMLElement | null,
  editingIdInput: HTMLInputElement | null
): void {
  if (editingIdInput) editingIdInput.value = messageId;

  input.value = stripNoPreviewTokens(currentContent);
  input.focus();
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;

  if (sendBtn) {
    sendBtn.textContent = '💾 Сохранить';
    sendBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  }

  if (editIndicator) editIndicator.style.display = 'flex';
}

export function resetChatEditingState(
  input: HTMLTextAreaElement | null,
  sendBtn: HTMLButtonElement | null,
  editIndicator: HTMLElement | null,
  editingIdInput: HTMLInputElement | null
): void {
  if (editingIdInput) editingIdInput.value = '';

  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }

  if (sendBtn) {
    sendBtn.textContent = 'Отправить';
    sendBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }

  if (editIndicator) editIndicator.style.display = 'none';
}
