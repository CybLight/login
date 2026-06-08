/**
 * Account handlers - обработчики событий для вкладок аккаунта
 */

import { Router } from '@/router/Router';
import { apiCall } from '@/utils';
import type { User as AppUser } from '@/types';
import { copyText } from '@/utils/clipboard';
import { bindSecurityHandlers } from './security-tab';
import { bindSessionsHandlers } from './sessions';
import { bindFriendsHandlers } from './friends';
import { bindMessagesHandlers, loadMessagesTab as loadMessagesListTab } from './messages-list';
import type { ChatLoadOptions } from './chat-core';
import { openChatInMessagesTab } from './messages-tab';
import { showAccountConfirmModal, showAccountNoticeModal } from './modals';
import { updateNavBadges, setNavBadge, updateChatUnreadBadges, fetchUnreadSummaryData } from './unread';
import { isEmailVerified } from './account-utils';

interface ApiMessage {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
}

// Use application `User` type where appropriate

/**
 * Bind copy buttons (data-copybtn)
 */
function bindCopyButtons(api: ApiMessage): void {
  document.querySelectorAll('[data-copybtn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const v = btn.getAttribute('data-copybtn') || '';
      if (!v) return;

      const oldHtml = btn.innerHTML;
      const oldLabel = btn.getAttribute('aria-label') || '';

      const ok = await copyText(v);

      if (ok) {
        api.showMsg('ok', 'Скопировано ✅');

        btn.classList.add('is-copied');
        btn.setAttribute('aria-label', 'Скопировано');

        // ✓ icon
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
          </svg>
        `;

        setTimeout(() => {
          btn.classList.remove('is-copied');
          btn.innerHTML = oldHtml;
          if (oldLabel) btn.setAttribute('aria-label', oldLabel);
          else btn.setAttribute('aria-label', 'Скопировать');
        }, 900);
      } else {
        api.showMsg('error', 'Не удалось скопировать');
      }

      setTimeout(api.clearMsg, 1100);
    });
  });
}

/**
 * Привязать обработчики событий
 */
export function bindAccountHandlers(
  _tab: string,
  user: AppUser,
  state: {
    twoFAEnabled: boolean;
    passkeyCount: number;
    emailVerified: boolean;
    accountChatFriendId: string | null;
    accountChatIntervalId?: number;
    accountChatDocClickHandler: ((event: MouseEvent) => void) | null;
    accountChatMessageMap: Map<string, Record<string, unknown>>;
    accountPinnedMessageByChat: Map<string, { messageId: string; text: string }>;
  },
  callbacks: {
    setTwoFAEnabled: (value: boolean) => void;
    setPasskeyCount: (value: number) => void;
    setEmailVerified: (value: boolean) => void;
    setAccountChatFriendId: (id: string | null) => void;
    setAccountChatIntervalId: (id?: number) => void;
    setAccountChatDocClickHandler: (handler: ((event: MouseEvent) => void) | null) => void;
    stopAccountChatAutoRefresh: () => void;
    loadChatMessagesInAccount: (
      friendId: string,
      container: HTMLElement | null,
      api: ApiMessage,
      chatInput: HTMLTextAreaElement | null,
      chatSendBtn: HTMLButtonElement | null,
      chatEditIndicator: HTMLElement | null,
      chatEditingIdInput: HTMLInputElement | null,
      options?: ChatLoadOptions
    ) => Promise<void>;
  }
): void {
  // Setup message API
  const msgEl = document.getElementById('msg');
  let msgTimeout: number | undefined;

  const showMsg = (type: string, text: string, persist: boolean = false) => {
    if (!msgEl) return;

    // Очищаем предыдущий таймаут если был
    if (msgTimeout) {
      window.clearTimeout(msgTimeout);
      msgTimeout = undefined;
    }

    msgEl.style.display = 'block';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;

    // Автоматически скрываем через 3 секунды (если не persist)
    if (!persist) {
      msgTimeout = window.setTimeout(() => {
        if (msgEl) {
          msgEl.style.display = 'none';
          msgEl.className = 'msg';
          msgEl.textContent = '';
        }
        msgTimeout = undefined;
      }, 3000);
    }

    if (type === 'error' || type === 'warn') {
      showAccountNoticeModal(type, text);
    }
  };
  const clearMsg = () => {
    if (!msgEl) return;

    // Очищаем таймаут если был
    if (msgTimeout) {
      window.clearTimeout(msgTimeout);
      msgTimeout = undefined;
    }

    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  };

  const api: ApiMessage = { showMsg, clearMsg };

  // Bind copy buttons (copy to clipboard)
  bindCopyButtons(api);

  // Tab navigation
  document.querySelectorAll('.account-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        // Map tab names to routes
        const tabToRoute: Record<string, string> = {
          easter: 'account-easter-eggs',
        };
        const route = tabToRoute[targetTab] || `account-${targetTab}`;
        Router.navigate(route);
      }
    });
  });

  // Logout handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiCall('/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e: unknown) {
        console.error('Logout error:', e);
      }

      document.body.classList.remove('no-strawberries');
      Router.navigate('username');
    });
  }

  // Security tab handlers
  if (_tab === 'security') {
    bindSecurityHandlers({
      user,
      api,
      state: {
        twoFAEnabled: state.twoFAEnabled,
        passkeyCount: state.passkeyCount,
        emailVerified: state.emailVerified,
      },
      onTwoFAChanged: callbacks.setTwoFAEnabled,
      onPasskeyCountChanged: callbacks.setPasskeyCount,
      onEmailVerifiedChanged: callbacks.setEmailVerified,
      onUserUpdated: (data: Record<string, unknown>) => {
        Object.assign(user, data as Record<string, unknown>);
      },
      isEmailVerified,
    });
  }

  // Sessions tab handlers
  if (_tab === 'sessions') {
    bindSessionsHandlers(api);
  }

  // Friends tab handlers
  if (_tab === 'friends') {
    bindFriendsHandlers(api, {
      confirmModal: showAccountConfirmModal,
      setPendingRequestsBadge: (count) => setNavBadge('pending-requests', count),
    });
  }

  // Messages tab handlers
  if (_tab === 'messages') {
    // Wrapper function to provide dependency injection for messages tab
    const openChatWrapper = (friendId: string, friendUsername: string, api: ApiMessage) => {
      openChatInMessagesTab(friendId, friendUsername, {
        api,
        state: {
          accountChatFriendId: state.accountChatFriendId,
          accountChatIntervalId: state.accountChatIntervalId,
          accountChatDocClickHandler: state.accountChatDocClickHandler,
          accountChatMessageMap: state.accountChatMessageMap,
          accountPinnedMessageByChat: state.accountPinnedMessageByChat,
        },
        callbacks: {
          stopAccountChatAutoRefresh: callbacks.stopAccountChatAutoRefresh,
          setAccountChatFriendId: callbacks.setAccountChatFriendId,
          setAccountChatIntervalId: callbacks.setAccountChatIntervalId,
          setAccountChatDocClickHandler: callbacks.setAccountChatDocClickHandler,
          updateChatUnreadBadges,
          loadMessagesListTab: (api, loadOpts) => {
            return loadMessagesListTab(api, loadOpts);
          },
          loadChatMessagesInAccount: callbacks.loadChatMessagesInAccount,
          fetchUnreadSummaryData,
          setNavBadge,
        },
      });
    };

    bindMessagesHandlers(api, {
      stopAccountChatAutoRefresh: callbacks.stopAccountChatAutoRefresh,
      setAccountChatFriendId: callbacks.setAccountChatFriendId,
      openChatInMessagesTab: openChatWrapper,
      updateChatUnreadBadges,
      fetchUnreadSummaryData,
      setNavBadge,
    });
  }

  // Easter tab handlers
  if (_tab === 'easter') {
    bindEasterHandlers();
  }

  // Load badge counts for all tabs so counters stay visible in sidebar
  void updateNavBadges();
}

/**
 * Привязать обработчики для вкладки Пасхалки
 */
function bindEasterHandlers(): void {
  console.log('[EASTER] Tab loaded');

  // Кнопка "Открыть стенографию" для Strawberry Hunt
  const toHistoryBtn = document.getElementById('toHistoryBtn') as HTMLButtonElement;
  if (toHistoryBtn && !toHistoryBtn.disabled) {
    toHistoryBtn.onclick = () => {
      // Сохраняем откуда пришли для навигации обратно
      sessionStorage.setItem('cyb_history_from', 'account-easter-eggs');
      Router.navigate('strawberry-history');
    };
  }
}
