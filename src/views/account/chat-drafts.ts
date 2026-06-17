import { CHAT_DRAFT_PREFIX } from '@/config/constants';
import { allowsFunctionalConsent } from '@/utils/privacy-guard';
import { escapeHtml } from '@/utils';
import { t } from '@/i18n';
import { renderChatListPreviewHtml, truncatePreviewText } from './chat-format';

function draftKey(friendId: string): string {
  return `${CHAT_DRAFT_PREFIX}${friendId}`;
}

export function loadChatDraft(friendId: string): string {
  if (!allowsFunctionalConsent()) return '';
  try {
    return localStorage.getItem(draftKey(friendId)) ?? '';
  } catch {
    return '';
  }
}

export function saveChatDraft(friendId: string, text: string): void {
  if (!allowsFunctionalConsent()) return;
  try {
    const key = draftKey(friendId);
    if (!text) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, text);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearChatDraft(friendId: string): void {
  saveChatDraft(friendId, '');
}

export function renderChatDraftPreviewHtml(friendId: string): string | null {
  const draft = loadChatDraft(friendId).trim();
  if (!draft) return null;

  const previewText = truncatePreviewText(draft);
  return `<div class="chat-preview chat-preview--draft"><span class="chat-preview-draft-label">${escapeHtml(t('Черновик'))}:</span> ${renderChatListPreviewHtml(previewText)}</div>`;
}
