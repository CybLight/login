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
  notifyChatInputChange(input);
}

export async function insertChatLink(input: HTMLTextAreaElement): Promise<void> {
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
  input.focus();
  notifyChatInputChange(input);
}

export function insertChatBlockquote(input: HTMLTextAreaElement): void {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const text = input.value;
  const selectedText = text.substring(selectionStart, selectionEnd);

  if (selectedText) {
    const quoted = selectedText
      .split('\n')
      .map((line) => (line ? `> ${line}` : '>'))
      .join('\n');

    input.value = text.substring(0, selectionStart) + quoted + text.substring(selectionEnd);
    input.setSelectionRange(selectionStart, selectionStart + quoted.length);
    input.focus();
    notifyChatInputChange(input);
    return;
  }

  const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
  input.value = `${text.substring(0, lineStart)}> ${text.substring(lineStart)}`;
  input.setSelectionRange(selectionStart + 2, selectionStart + 2);
  input.focus();
  notifyChatInputChange(input);
}

export async function insertChatCode(input: HTMLTextAreaElement): Promise<void> {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const selectedText = input.value.substring(selectionStart, selectionEnd);
  const language = (await showAppPrompt(t('Язык программирования (необязательно):'), '')) || '';
  const formatted = `\`\`\`${language}\n${selectedText || 'код здесь'}\n\`\`\``;

  input.value =
    input.value.substring(0, selectionStart) + formatted + input.value.substring(selectionEnd);
  input.focus();
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
