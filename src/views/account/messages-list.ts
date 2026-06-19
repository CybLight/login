import { t } from '@/i18n';
import { Router } from '@/router/Router';
import type { FriendListItem } from '@/types';
import { apiCall, escapeHtml, formatPresenceLabel, isUserOnline } from '@/utils';
import { getAvatarListHtml } from './avatar';
import type { UnreadSummary } from './unread';
import {
  bindEncryptionReminderHandlers,
  renderMessagesEncryptionReminder,
} from './encryption-reminder';
import { formatChatListTime } from './chat-date';
import {
  bindMessagesSettingsHandlers,
  renderMessagesSettingsHtml,
} from './chat-formatting-settings';
import { enrichConversationPreviews } from './conversation-preview';
import { renderChatListPreviewHtml } from './chat-format';
import { renderChatDraftPreviewHtml } from './chat-drafts';
import { tryGetSignalUserId } from '@/crypto/signal';
import { promptGoogleDriveRestoreIfNeeded } from './drive-restore-prompt';
import { onChatWebSocket } from '@/services/chat-ws';
import { updateNavBadges } from './unread';

type ApiMessage = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
};


type MessagesDeps = {
  stopAccountChatAutoRefresh: () => void;
  setAccountChatFriendId: (friendId: string | null) => void;
  openChatInMessagesTab: (friendId: string, friendUsername: string, api: ApiMessage) => void;
  updateChatUnreadBadges: () => Promise<void>;
  fetchUnreadSummaryData: () => Promise<UnreadSummary | null>;
  setNavBadge: (type: 'pending-requests' | 'unread-messages', count: number) => void;
};

let messagesListWsUnsub: (() => void) | null = null;
let messagesListRefreshTimer: number | null = null;

export function unsubscribeMessagesListWebSocket(): void {
  messagesListWsUnsub?.();
  messagesListWsUnsub = null;
  if (messagesListRefreshTimer) {
    window.clearTimeout(messagesListRefreshTimer);
    messagesListRefreshTimer = null;
  }
}

function scheduleMessagesListRefresh(api: ApiMessage, deps: MessagesDeps): void {
  if (!document.getElementById('messagesContent')) return;
  if (document.querySelector('.account-main')?.classList.contains('is-chat-view')) return;
  if (messagesListRefreshTimer) {
    window.clearTimeout(messagesListRefreshTimer);
  }
  messagesListRefreshTimer = window.setTimeout(() => {
    messagesListRefreshTimer = null;
    void loadMessagesTab(api, deps);
  }, 400);
}

export function bindMessagesHandlers(api: ApiMessage, deps: MessagesDeps): void {
  void loadMessagesTab(api, deps);
}

export async function loadMessagesTab(api: ApiMessage, deps: MessagesDeps): Promise<void> {
  const container = document.getElementById('messagesContent');
  if (!container) return;

  deps.stopAccountChatAutoRefresh();
  deps.setAccountChatFriendId(null);
  document.querySelector('.account-main')?.classList.remove('is-chat-view');

  try {
    const [friendsRes, summaryRaw] = await Promise.all([
      apiCall('/friends/list', { credentials: 'include' }),
      deps.fetchUnreadSummaryData(),
    ]);
    const friendsData = await friendsRes.json().catch(() => ({}));

    const userId = tryGetSignalUserId();
    let conversationPreviews = summaryRaw?.conversationPreviews ?? {};
    if (summaryRaw && userId) {
      try {
        conversationPreviews = await enrichConversationPreviews(conversationPreviews, userId);
      } catch (error) {
        console.warn('[loadMessagesTab] Preview decrypt failed:', error);
      }
    }

    const summary = summaryRaw
      ? {
          ...summaryRaw,
          conversationPreviews,
        }
      : summaryRaw;

    if (!friendsData?.ok) {
      container.innerHTML = `<div class="sec-error-text">${t('Не удалось загрузить сообщения')}</div>`;
      return;
    }

    const friends = Array.isArray(friendsData.friends) ? friendsData.friends : [];

    const sortedFriends = [...friends].sort((left: FriendListItem, right: FriendListItem) => {
      const leftId = String(left.id || '');
      const rightId = String(right.id || '');
      const leftLatest = Number(conversationPreviews[leftId]?.latestAt || 0);
      const rightLatest = Number(conversationPreviews[rightId]?.latestAt || 0);
      if (rightLatest !== leftLatest) return rightLatest - leftLatest;

      const leftUnread = Number(summary?.unreadByUser?.[leftId] || 0);
      const rightUnread = Number(summary?.unreadByUser?.[rightId] || 0);
      if (rightUnread !== leftUnread) return rightUnread - leftUnread;

      return String(left.username || '').localeCompare(String(right.username || ''), 'ru', {
        sensitivity: 'base',
      });
    });

    const avatarHtml = (friend: FriendListItem) =>
      getAvatarListHtml(
        friend.avatar ||
          friend.avatarUrl ||
          friend.avatar_url ||
          friend.avatarId ||
          friend.avatar_id,
        String(friend.username || ''),
        { presence: friend }
      );

    const chatPreviewHtml = (friend: FriendListItem) => {
      const friendId = String(friend.id || '');
      const draftPreview = renderChatDraftPreviewHtml(friendId);
      if (draftPreview) return draftPreview;

      const preview = conversationPreviews[friendId]?.preview?.trim();
      if (preview) {
        return `<div class="chat-preview">${renderChatListPreviewHtml(preview)}</div>`;
      }
      if (friend.isOnline || friend.lastSeenAt != null || friend.last_seen_at != null) {
        const online = isUserOnline(friend);
        const label = formatPresenceLabel(friend);
        const previewClass = online ? 'chat-preview chat-preview--online' : 'chat-preview';
        return `<div class="${previewClass}">${escapeHtml(label)}</div>`;
      }
      return `<div class="chat-preview">${t('Нажмите, чтобы открыть чат')}</div>`;
    };

    container.innerHTML = `
      <div class="messages-info">
        ${renderMessagesSettingsHtml()}
      </div>

      ${renderMessagesEncryptionReminder()}

      ${
        friends.length > 0
          ? `<div class="chat-list">${sortedFriends
              .map(
                (friend: FriendListItem) => {
                  const friendId = String(friend.id || '');
                  const latestAt = Number(conversationPreviews[friendId]?.latestAt || 0);
                  const chatTimeLabel = latestAt ? formatChatListTime(latestAt) : '';

                  return `
              <button class="chat-card" data-action="open-chat" data-id="${escapeHtml(friendId)}" data-username="${escapeHtml(String(friend.username || ''))}" data-presence-user-id="${escapeHtml(friendId)}" type="button" aria-label="${escapeHtml(String(friend.username || 'Unknown'))} ${escapeHtml(formatPresenceLabel(friend))}">
                <div class="chat-avatar">${avatarHtml(friend)}</div>
                <div class="chat-info">
                  <div class="chat-info-head">
                    <span
                      class="chat-username chat-username-link"
                      data-action="profile"
                      data-username="${escapeHtml(String(friend.username || ''))}"
                      role="link"
                      tabindex="0"
                    >${escapeHtml(String(friend.username || 'Unknown'))}</span>
                    ${
                      chatTimeLabel
                        ? `<span class="chat-card-time">${escapeHtml(chatTimeLabel)}</span>`
                        : ''
                    }
                  </div>
                  ${chatPreviewHtml(friend)}
                </div>
                <div class="chat-unread-badge is-hidden" data-unread-badge="${escapeHtml(friendId)}"></div>
              </button>
            `;
                }
              )
              .join('')}</div>`
          : `<div class="messages-empty"><div class="messages-empty-icon">💬</div><p>${t('Нет доступных чатов')}</p><p class="messages-empty-sub">${t('Добавьте друзей, чтобы начать общение')}</p></div>`
      }
    `;

    bindEncryptionReminderHandlers(container);
    bindMessagesSettingsHandlers(container, api);

    messagesListWsUnsub?.();
    try {
      messagesListWsUnsub = onChatWebSocket((event) => {
        if (event.type === 'message.new' || event.type === 'message.deleted' || event.type === 'message.edited') {
          scheduleMessagesListRefresh(api, deps);
          void deps.updateChatUnreadBadges();
          void updateNavBadges();
        }
      });
    } catch (error) {
      console.warn('[loadMessagesTab] Chat WebSocket unavailable:', error);
    }

    const openProfileFromTarget = (target: HTMLElement | null): void => {
      const profileEl = target?.closest('[data-action="profile"]') as HTMLElement | null;
      if (!profileEl) return;
      const username = profileEl.getAttribute('data-username') || '';
      if (username) Router.navigate(username);
    };

    container.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-action="profile"]')) return;
      event.preventDefault();
      event.stopPropagation();
      openProfileFromTarget(target);
    });

    container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-action="profile"]')) {
        event.preventDefault();
        event.stopPropagation();
        openProfileFromTarget(target);
        return;
      }

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

    if (userId && summaryRaw?.conversationPreviews) {
      void promptGoogleDriveRestoreIfNeeded(userId, {
        conversationPreviews: summaryRaw.conversationPreviews,
        onRestored: () => loadMessagesTab(api, deps),
      });
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    container.innerHTML =
      `<div class="sec-error-text">${t('Ошибка загрузки. Попробуйте обновить страницу.')}</div>`;
  }
}
