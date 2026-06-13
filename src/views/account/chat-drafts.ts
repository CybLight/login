import { CHAT_DRAFT_PREFIX } from '@/config/constants';

function draftKey(friendId: string): string {
  return `${CHAT_DRAFT_PREFIX}${friendId}`;
}

export function loadChatDraft(friendId: string): string {
  try {
    return localStorage.getItem(draftKey(friendId)) ?? '';
  } catch {
    return '';
  }
}

export function saveChatDraft(friendId: string, text: string): void {
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
