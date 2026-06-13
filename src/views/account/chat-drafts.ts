import { CHAT_DRAFT_PREFIX } from '@/config/constants';
import { allowsFunctionalConsent } from '@/utils/privacy-guard';

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
