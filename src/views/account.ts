/**
 * Account view - полная страница аккаунта с вкладками
 * Включает: Профиль, Безопасность, Сессии, Пасхалки
 */

import { Router } from '@/router/Router';
import { setAppContent } from '@/ui';
import { authService, extractEasterFlags, pushLocalEasterFlagsToServer } from '@/services';
import { ensureSignalKeysRegistered, getSignalKeyIssueMessage, setSignalUserId } from '@/crypto/signal';
import '@/styles/account.css';
import '@/styles/account-render.css';
import { renderAccountPage } from './account/account-render';
import { getTabTitle } from './account/tabs-render';
import { bindAccountHandlers } from './account/account-handlers';
import { hydrateAccountAvatar, isEmailVerified, stopAccountChatAutoRefresh } from './account/account-utils';
import { createChatCore } from './account/chat-core';
import { startEditMessageInAccount } from './account/chat-editor';
import { showPendingRoleNotice } from '@/utils/roleNotice';
import { promptGoogleDriveRestoreIfNeeded } from './account/drive-restore-prompt';

// Global state variables
let twoFAEnabled = false;
let passkeyCount = 0;
let emailVerified = false;
let accountChatIntervalId: number | undefined;
let accountChatFriendId: string | null = null;
let accountChatDocClickHandler: ((event: MouseEvent) => void) | null = null;
const accountChatMessageMap = new Map<string, Record<string, unknown>>();
const accountPinnedMessageByChat = new Map<string, { messageId: string; text: string }>();

// Chat core initialization
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏'];
const EDIT_TIME_LIMIT = 15 * 60 * 1000;

const loadChatMessagesInAccount = createChatCore({
  accountPinnedMessageByChat,
  accountChatMessageMap,
  quickReactions: QUICK_REACTIONS,
  editTimeLimit: EDIT_TIME_LIMIT,
  startEditMessageInAccount,
});

/**
 * Main render function for account page
 */
export async function renderAccount(tab: string = 'profile'): Promise<void> {
  // Show no-strawberries background
  document.body.classList.add('no-strawberries');

  // Check authorization and get user data
  const user = await authService.checkSession();
  if (!user) {
    Router.navigate('username');
    return;
  }

  setSignalUserId(user.id);
  void ensureSignalKeysRegistered(user.id).catch((error) => {
    const issueMessage = getSignalKeyIssueMessage();
    if (issueMessage) {
      console.warn('[Signal] keys unavailable in this browser:', issueMessage);
    } else {
      console.error('[Signal] key registration failed:', error);
    }
  });

  void pushLocalEasterFlagsToServer(extractEasterFlags({ user }));

  // Initialize emailVerified from user data
  emailVerified = isEmailVerified(user);

  void showPendingRoleNotice(user.roleNotice);

  // Заголовок вкладки браузера по текущей вкладке аккаунта
  document.title = `${getTabTitle(tab)} — CybLight`;

  // Render account page
  const html = renderAccountPage(tab, user);
  setAppContent(html);

  // Setup state and callbacks
  const state = {
    twoFAEnabled,
    passkeyCount,
    emailVerified,
    accountChatFriendId,
    accountChatIntervalId,
    accountChatDocClickHandler,
    accountChatMessageMap,
    accountPinnedMessageByChat,
  };

  const callbacks = {
    setTwoFAEnabled: (value: boolean) => {
      twoFAEnabled = value;
    },
    setPasskeyCount: (value: number) => {
      passkeyCount = value;
    },
    setEmailVerified: (value: boolean) => {
      emailVerified = value;
    },
    setAccountChatFriendId: (id: string | null) => {
      accountChatFriendId = id;
    },
    setAccountChatIntervalId: (id?: number) => {
      accountChatIntervalId = id;
    },
    setAccountChatDocClickHandler: (handler: ((event: MouseEvent) => void) | null) => {
      accountChatDocClickHandler = handler;
    },
    stopAccountChatAutoRefresh: () => {
      stopAccountChatAutoRefresh(accountChatIntervalId, callbacks.setAccountChatIntervalId);
    },
    loadChatMessagesInAccount,
  };

  // Bind all event handlers
  bindAccountHandlers(tab, user, state, callbacks);

  // Hydrate avatar (профиль + аватарка в шапке на всех вкладках)
  void hydrateAccountAvatar(user);

  void promptGoogleDriveRestoreIfNeeded(String(user.id));
}
