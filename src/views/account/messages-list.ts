import type { FriendListItem } from '@/types';
import { apiCall, escapeHtml } from '@/utils';
import { getAvatarListHtml } from './avatar';

type ApiMessage = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
};

type UnreadSummary = {
  totalPending: number;
  totalUnread: number;
  unreadByUser: Record<string, number>;
};

type MessagesDeps = {
  stopAccountChatAutoRefresh: () => void;
  setAccountChatFriendId: (friendId: string | null) => void;
  openChatInMessagesTab: (friendId: string, friendUsername: string, api: ApiMessage) => void;
  updateChatUnreadBadges: () => Promise<void>;
  fetchUnreadSummaryData: () => Promise<UnreadSummary | null>;
  setNavBadge: (type: 'pending-requests' | 'unread-messages', count: number) => void;
};

export function bindMessagesHandlers(api: ApiMessage, deps: MessagesDeps): void {
  void loadMessagesTab(api, deps);
}

export async function loadMessagesTab(api: ApiMessage, deps: MessagesDeps): Promise<void> {
  const container = document.getElementById('messagesContent');
  if (!container) return;

  deps.stopAccountChatAutoRefresh();
  deps.setAccountChatFriendId(null);

  try {
    const friendsRes = await apiCall('/friends/list', { credentials: 'include' });
    const friendsData = await friendsRes.json().catch(() => ({}));

    if (!friendsData?.ok) {
      container.innerHTML = '<div class="sec-error-text">Не удалось загрузить сообщения</div>';
      return;
    }

    const friends = Array.isArray(friendsData.friends) ? friendsData.friends : [];

    const avatarHtml = (avatarRaw: string | undefined, usernameRaw: string | undefined) =>
      getAvatarListHtml(avatarRaw, String(usernameRaw || ''));

    container.innerHTML = `
      <div class="messages-info">
        <strong>💬 Сообщения</strong>
        <p class="messages-info-hint">Выберите друга, чтобы начать переписку</p>
      </div>

      ${
        friends.length > 0
          ? `<div class="chat-list">${friends
              .map(
                (friend: FriendListItem) => `
              <button class="chat-card" data-action="open-chat" data-id="${escapeHtml(String(friend.id || ''))}" data-username="${escapeHtml(String(friend.username || ''))}" type="button" aria-label="${avatarHtml( friend.avatar || friend.avatarUrl || friend.avatar_url || friend.avatarId || friend.avatar_id, friend.username )} ${escapeHtml(String(friend.username || 'Unknown'))} Нажмите, чтобы открыть чат">
                <div class="chat-avatar">${avatarHtml(
                  friend.avatar ||
                    friend.avatarUrl ||
                    friend.avatar_url ||
                    friend.avatarId ||
                    friend.avatar_id,
                  friend.username
                )}</div>
                <div class="chat-info">
                  <div class="chat-username">${escapeHtml(String(friend.username || 'Unknown'))}</div>
                  <div class="chat-preview">Нажмите, чтобы открыть чат</div>
                </div>
                <div class="chat-unread-badge is-hidden" data-unread-badge="${escapeHtml(String(friend.id || ''))}"></div>
              </button>
            `
              )
              .join('')}</div>`
          : `<div class="messages-empty"><div class="messages-empty-icon">💬</div><p>Нет доступных чатов</p><p class="messages-empty-sub">Добавьте друзей, чтобы начать общение</p></div>`
      }
    `;

    container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const chatButton = target?.closest('[data-action="open-chat"]') as HTMLElement | null;
      if (!chatButton) return;

      const friendId = chatButton.getAttribute('data-id') || '';
      const username = chatButton.getAttribute('data-username') || 'Unknown';
      if (!friendId) return;

      sessionStorage.setItem('openChatWith', JSON.stringify({ friendId, username }));
      deps.openChatInMessagesTab(friendId, username, api);
    });

    const openChatData = sessionStorage.getItem('openChatWith');
    if (openChatData) {
      try {
        const parsed = JSON.parse(openChatData) as { friendId?: string; username?: string };
        if (parsed?.friendId && parsed?.username) {
          sessionStorage.removeItem('openChatWith');
          setTimeout(
            () =>
              deps.openChatInMessagesTab(parsed.friendId as string, parsed.username as string, api),
            100
          );
        }
      } catch (error) {
        console.error('Error auto-opening chat:', error);
      }
    }

    void deps.updateChatUnreadBadges();
    console.log('[loadMessagesTab] Fetching unread summary...');
    const summary = await deps.fetchUnreadSummaryData();
    console.log('[loadMessagesTab] Summary received:', summary);
    if (summary) {
      console.log(
        '[loadMessagesTab] Setting badges - unread:',
        summary.totalUnread,
        'pending:',
        summary.totalPending
      );
      deps.setNavBadge('unread-messages', summary.totalUnread);
      deps.setNavBadge('pending-requests', summary.totalPending);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    container.innerHTML =
      '<div class="sec-error-text">Ошибка загрузки. Попробуйте обновить страницу.</div>';
  }
}
