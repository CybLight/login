/**
 * Messages tab - управление вкладкой Сообщения с чатом
 */

import { apiCall, escapeHtml, formatPresenceLabel, hasPresenceData, isUserOnline } from '@/utils';
import { setupAccessibleModal } from '@/utils/keyboard';
import type { ApiOkResponse, FriendListItem } from '@/types';
import { createChatCore } from './chat-core';
import { extractFirstUrl } from './chat-format';
import { loadMessagesTab as loadMessagesListTab } from './messages-list';
import type { UnreadSummary } from './unread';
import { updateNavBadges } from './unread';
import {
  resetChatEditingState,
  insertChatFormatting,
  insertChatLink,
  insertChatCode,
} from './chat-editor';
import { showAccountConfirmModal } from './modals';
import { CYBLIGHT_EMOJI_CATEGORIES } from './emoji-categories';
import '@/styles/messages-tab.css';

type ReplyMessageState = {
  messageId: string;
  author: string;
  text: string;
};

type PinnedMessageState = {
  messageId: string;
  text: string;
};

type ChatMessageRecord = Record<string, unknown> & {
  senderId?: string;
  sender_id?: string;
  sender?: { id?: string };
};

type LoadChatMessagesInAccount = ReturnType<typeof createChatCore>;

function setAccountChatViewActive(active: boolean): void {
  document.querySelector('.account-main')?.classList.toggle('is-chat-view', active);
}

type MessageTabDeps = {
  api: { showMsg: (type: string, text: string, persist?: boolean) => void; clearMsg: () => void };
  state: {
    accountChatFriendId: string | null;
    accountChatIntervalId?: number;
    accountChatDocClickHandler: ((event: MouseEvent) => void) | null;
    accountChatMessageMap: Map<string, Record<string, unknown>>;
    accountPinnedMessageByChat: Map<string, PinnedMessageState>;
  };
  callbacks: {
    stopAccountChatAutoRefresh: () => void;
    setAccountChatFriendId: (id: string | null) => void;
    setAccountChatIntervalId: (id?: number) => void;
    setAccountChatDocClickHandler: (handler: ((event: MouseEvent) => void) | null) => void;
    updateChatUnreadBadges: () => Promise<void>;
    loadMessagesListTab: typeof loadMessagesListTab;
    loadChatMessagesInAccount: LoadChatMessagesInAccount;
    fetchUnreadSummaryData: () => Promise<UnreadSummary | null>;
    setNavBadge: (type: 'pending-requests' | 'unread-messages', count: number) => void;
  };
};

export function openChatInMessagesTab(
  friendId: string,
  friendUsername: string,
  deps: MessageTabDeps
): void {
  const { api, state, callbacks } = deps;
  const { loadChatMessagesInAccount } = callbacks;
  const container = document.getElementById('messagesContent');
  if (!container) return;

  sessionStorage.removeItem('openChatWith');

  callbacks.setAccountChatFriendId(friendId);
  callbacks.stopAccountChatAutoRefresh();
  setAccountChatViewActive(true);

  // Mark messages as read
  void (async () => {
    try {
      await apiCall(`/messages/${friendId}/mark-read`, {
        method: 'POST',
        credentials: 'include',
      });
      // Refresh badges after marking as read
      void updateNavBadges();
      void callbacks.updateChatUnreadBadges();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  })();

  container.innerHTML = `
    <div class="chat-container">
      <div class="chat-back-row" id="chatBackRow">
        <button id="chatBackBtn" class="chat-close-btn" type="button" aria-label="← Назад">← Назад</button>
      </div>
      <div class="chat-selection-bar" id="chatSelectionBar">
        <div class="chat-selection-info" id="chatSelectionInfo">Выбрано: 0</div>
        <div class="chat-selection-actions">
          <button class="chat-selection-btn" id="chatSelectionForward" type="button" aria-label="↪️ Переслать">↪️ Переслать</button>
          <button class="chat-selection-btn" id="chatSelectionDelete" type="button" aria-label="🗑️ Удалить">🗑️ Удалить</button>
          <button class="chat-selection-btn chat-selection-btn-cancel" id="chatSelectionCancel" type="button" aria-label="✕ Отменить">✕ Отменить</button>
        </div>
      </div>
      <div class="chat-header">
        <div class="chat-header-main">
          <div class="chat-header-title">💬 ${escapeHtml(friendUsername)}</div>
          <div class="chat-header-presence" id="chatHeaderPresence" data-presence-user-id="${escapeHtml(friendId)}"></div>
        </div>
        <div id="chatPinnedBar" class="chat-pinned-bar is-hidden"></div>
      </div>

      <div id="chatMessages"><div class="chat-loading">Загрузка сообщений...</div></div>
      <input id="chatEditingMessageId" type="hidden" value="" />

      <div class="chat-footer">
        <div id="chatEditIndicator" class="chat-edit-indicator">
          <span>✏️ Редактирование сообщения... <small class="chat-edit-hint">(ESC для отмены)</small></span>
          <button id="chatCancelEditBtn" type="button" class="chat-msg-btn" aria-label="❌ Отмена">❌ Отмена</button>
        </div>

        <div id="chatReplyCompose" class="chat-reply-compose"></div>

        <div id="chatInputPreviewWrap" class="chat-input-preview-wrap"></div>

        <div class="chat-formatting-toolbar">
          <button class="chat-format-btn" data-format="bold" type="button" title="Жирный (Ctrl+B)" aria-label="Жирный (Ctrl+B)"><b>B</b></button>
          <button class="chat-format-btn" data-format="italic" type="button" title="Курсив (Ctrl+I)" aria-label="Курсив (Ctrl+I)"><i>I</i></button>
          <button class="chat-format-btn" data-format="mono" type="button" title="Моноширинный" aria-label="Моноширинный"><code>M</code></button>
          <button class="chat-format-btn" data-format="strike" type="button" title="Зачёркнутый" aria-label="Зачёркнутый"><s>S</s></button>
          <button class="chat-format-btn" data-format="link" type="button" title="Вставить ссылку" aria-label="Вставить ссылку">🔗</button>
          <button class="chat-format-btn" data-format="spoiler" type="button" title="Спойлер" aria-label="Спойлер">||</button>
          <button class="chat-format-btn" data-format="code" type="button" title="Блок кода" aria-label="Блок кода">{ }</button>
        </div>

        <div class="chat-input-wrapper">
          <textarea id="chatInput" placeholder="Напишите сообщение..." rows="1" maxlength="2000"></textarea>
          <div class="chat-input-emoji-wrap">
            <button id="chatEmojiBtn" type="button" title="Смайлики" aria-label="Смайлики">😊</button>
            <div id="chatInputEmojiPicker" class="chat-input-emoji-picker"></div>
          </div>
          <button id="chatSendBtn" type="button" aria-label="Отправить">Отправить</button>
        </div>
      </div>
    </div>
  `;

  const chatBackBtn = document.getElementById('chatBackBtn') as HTMLButtonElement | null;
  const chatBackRow = document.getElementById('chatBackRow') as HTMLElement | null;
  const chatSendBtn = document.getElementById('chatSendBtn') as HTMLButtonElement | null;
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement | null;
  const chatEmojiBtn = document.getElementById('chatEmojiBtn') as HTMLButtonElement | null;
  const chatInputEmojiPicker = document.getElementById(
    'chatInputEmojiPicker'
  ) as HTMLElement | null;
  const messagesEl = document.getElementById('chatMessages') as HTMLElement | null;
  const chatEditIndicator = document.getElementById('chatEditIndicator') as HTMLElement | null;
  const chatReplyCompose = document.getElementById('chatReplyCompose') as HTMLElement | null;
  const chatPinnedBar = document.getElementById('chatPinnedBar') as HTMLElement | null;
  const chatCancelEditBtn = document.getElementById(
    'chatCancelEditBtn'
  ) as HTMLButtonElement | null;
  const chatInputPreviewWrap = document.getElementById(
    'chatInputPreviewWrap'
  ) as HTMLElement | null;
  const chatEditingIdInput = document.getElementById(
    'chatEditingMessageId'
  ) as HTMLInputElement | null;
  let currentInputEmojiCategory = CYBLIGHT_EMOJI_CATEGORIES[0].key;
  let currentInputEmojiSearch = '';
  let suppressedInputPreviewUrl: string | null = null;
  let currentReplyState: ReplyMessageState | null = null;

  const forwardMessageFromPicker = async (messageText: string): Promise<void> => {
    const friendsRes = await apiCall('/friends/list', { credentials: 'include' });
    const friendsData = await friendsRes.json().catch(() => ({}));
    if (!friendsData?.ok) {
      api.showMsg('error', 'Не удалось загрузить список друзей для пересылки');
      return;
    }

    const friends = (Array.isArray(friendsData.friends) ? friendsData.friends : [])
      .filter(
        (item: FriendListItem) =>
          String(item.id || '') && String(item.id || '') !== String(friendId)
      )
      .slice(0, 50);

    if (friends.length === 0) {
      api.showMsg('warn', 'Нет друзей для пересылки');
      return;
    }

    const oldModal = document.getElementById('chatForwardModal');
    oldModal?.remove();

    const modal = document.createElement('div');
    modal.id = 'chatForwardModal';
    modal.className = 'chat-forward-modal';
    modal.innerHTML = `
      <div
        class="chat-forward-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatForwardTitle"
        aria-describedby="chatForwardPreview"
      >
        <div id="chatForwardTitle" class="chat-forward-title">Переслать сообщение</div>
        <div id="chatForwardPreview" class="chat-forward-preview">${escapeHtml(
          messageText.replace(/\s+/g, ' ').trim().slice(0, 180)
        )}</div>
        <div id="chatForwardList" class="chat-forward-list">
          ${friends
            .map(
              (item: FriendListItem) =>
                `<button type="button" data-forward-id="${escapeHtml(String(item.id || ''))}" class="chat-forward-item" aria-label="${escapeHtml(String(item.username || 'Пользователь'))}">${escapeHtml(String(item.username || 'Пользователь'))}</button>`
            )
            .join('')}
        </div>
        <div class="chat-forward-footer">
          <button id="chatForwardCancel" type="button" class="chat-forward-cancel" aria-label="Отмена">Отмена</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const dialogEl = modal.querySelector('.chat-forward-card') as HTMLElement;
    let cleanedUp = false;
    let close = () => {};
    const cleanupModal = setupAccessibleModal(modal, {
      trapFocusRoot: dialogEl,
      onClose: () => close(),
    });
    close = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      cleanupModal();
      modal.remove();
    };

    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    (document.getElementById('chatForwardCancel') as HTMLButtonElement | null)?.addEventListener(
      'click',
      close
    );

    document.querySelectorAll('[data-forward-id]').forEach((buttonEl) => {
      buttonEl.addEventListener('click', async () => {
        const targetId = (buttonEl as HTMLElement).getAttribute('data-forward-id') || '';
        if (!targetId) return;

        const response = await apiCall('/messages/send', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId: targetId, content: messageText }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload?.ok) {
          api.showMsg('error', payload?.error || 'Не удалось переслать сообщение');
          return;
        }

        api.showMsg('success', 'Сообщение переслано');
        close();

        if (targetId === friendId && messagesEl) {
          await loadChatMessagesInAccount(
            friendId,
            messagesEl,
            api,
            chatInput,
            chatSendBtn,
            chatEditIndicator,
            chatEditingIdInput,
            {
              hydrateLinkPreviews: true,
              forceScrollToBottom: true,
              onReplySelect: setReplyState,
              onPinStateChanged: renderPinnedBar,
              onForwardRequest: forwardMessageFromPicker,
              peerUsername: friendUsername,
            }
          );
        }
      });
    });
  };

  const clearReplyState = () => {
    currentReplyState = null;
    if (chatReplyCompose) {
      chatReplyCompose.classList.remove('active');
      chatReplyCompose.innerHTML = '';
    }
  };

  const renderReplyCompose = () => {
    if (!chatReplyCompose) return;
    if (!currentReplyState) {
      chatReplyCompose.classList.remove('active');
      chatReplyCompose.innerHTML = '';
      return;
    }

    const snippet = currentReplyState.text.replace(/\s+/g, ' ').trim();
    chatReplyCompose.classList.add('active');
    chatReplyCompose.innerHTML = `
      <div class="chat-reply-compose-text">
        <div class="chat-reply-compose-title">Ответ на ${escapeHtml(currentReplyState.author || 'сообщение')}</div>
        <div class="chat-reply-compose-snippet">${escapeHtml(snippet || 'Сообщение')}</div>
      </div>
      <button id="chatReplyComposeClose" class="chat-reply-compose-close" type="button" title="Отменить ответ" aria-label="Отменить ответ">✕</button>
    `;

    const closeBtn = document.getElementById('chatReplyComposeClose') as HTMLButtonElement | null;
    closeBtn?.addEventListener('click', () => {
      clearReplyState();
      chatInput?.focus();
    });
  };

  const setReplyState = (messageId: string, text: string, author = 'Собеседник') => {
    currentReplyState = {
      messageId,
      author,
      text,
    };
    renderReplyCompose();
  };

  const renderPinnedBar = () => {
    if (!chatPinnedBar) return;
    const pinned = state.accountPinnedMessageByChat.get(friendId) || null;
    if (!pinned) {
      chatPinnedBar.style.display = 'none';
      chatPinnedBar.innerHTML = '';
      return;
    }

    chatPinnedBar.style.display = 'flex';
    chatPinnedBar.innerHTML = `
      <div id="chatPinnedMain" class="chat-pinned-main" title="Перейти к сообщению">
        <div class="chat-pinned-label">📌 Закреплённое сообщение</div>
        <div class="chat-pinned-text">${escapeHtml(pinned.text || 'Сообщение')}</div>
      </div>
      <div class="chat-pinned-actions">
        <button id="chatPinnedCloseBtn" class="chat-pinned-btn" type="button" title="Открепить" aria-label="Открепить">✕</button>
      </div>
    `;

    const pinnedMain = document.getElementById('chatPinnedMain') as HTMLElement | null;
    pinnedMain?.addEventListener('click', () => {
      const target = messagesEl?.querySelector(
        `[data-message-id="${CSS.escape(pinned.messageId)}"]`
      ) as HTMLElement | null;
      if (!target || !messagesEl) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.animate(
        [
          { boxShadow: '0 0 0 0 rgba(250, 204, 21, 0)' },
          { boxShadow: '0 0 0 4px rgba(250, 204, 21, .35)' },
          { boxShadow: '0 0 0 0 rgba(250, 204, 21, 0)' },
        ],
        { duration: 700, easing: 'ease-out' }
      );
    });

    const closeBtn = document.getElementById('chatPinnedCloseBtn') as HTMLButtonElement | null;
    closeBtn?.addEventListener('click', async () => {
      const confirmed = await showAccountConfirmModal({
        title: 'Открепить сообщение',
        text: 'Убрать закреп из этого чата?',
        confirmText: 'Открепить',
        cancelText: 'Отмена',
      });
      if (!confirmed) return;

      const response = await apiCall(`/messages/${encodeURIComponent(pinned.messageId)}/pin`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forBoth: false }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        api.showMsg('error', payload?.error || 'Не удалось открепить сообщение');
        return;
      }

      api.showMsg('info', 'Сообщение откреплено');

      if (messagesEl) {
        await loadChatMessagesInAccount(
          friendId,
          messagesEl,
          api,
          chatInput,
          chatSendBtn,
          chatEditIndicator,
          chatEditingIdInput,
          {
            hydrateLinkPreviews: false,
            preserveScrollPosition: true,
            onReplySelect: setReplyState,
            onPinStateChanged: renderPinnedBar,
            onForwardRequest: forwardMessageFromPicker,
            peerUsername: friendUsername,
          }
        );
      }
    });
  };

  chatInputEmojiPicker?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  let backNavigationInProgress = false;
  const handleChatBack = (event?: Event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (backNavigationInProgress) return;
    backNavigationInProgress = true;

    callbacks.stopAccountChatAutoRefresh();
    setAccountChatViewActive(false);
    if (state.accountChatDocClickHandler) {
      document.removeEventListener('click', state.accountChatDocClickHandler);
      callbacks.setAccountChatDocClickHandler(null);
    }
    void callbacks
      .loadMessagesListTab(api, {
        stopAccountChatAutoRefresh: callbacks.stopAccountChatAutoRefresh,
        setAccountChatFriendId: callbacks.setAccountChatFriendId,
        openChatInMessagesTab: (fId: string, fUn: string) => {
          openChatInMessagesTab(fId, fUn, deps);
        },
        updateChatUnreadBadges: callbacks.updateChatUnreadBadges,
        fetchUnreadSummaryData: callbacks.fetchUnreadSummaryData,
        setNavBadge: callbacks.setNavBadge,
      })
      .finally(() => {
        backNavigationInProgress = false;
      });
  };

  chatBackBtn?.addEventListener('pointerdown', handleChatBack);
  chatBackBtn?.addEventListener('click', handleChatBack);

  const insertEmojiToInput = (emoji: string) => {
    if (!chatInput || !emoji) return;
    const start = chatInput.selectionStart;
    const end = chatInput.selectionEnd;
    const value = chatInput.value;
    chatInput.value = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    chatInput.setSelectionRange(start + emoji.length, start + emoji.length);
    chatInput.focus();
    chatInput.dispatchEvent(new Event('input'));
  };

  const allCategoryEmojis = Array.from(
    new Set(CYBLIGHT_EMOJI_CATEGORIES.flatMap((category) => category.emojis))
  );

  const quickSearchEmojis = [
    '😀',
    '😍',
    '😂',
    '😭',
    '😎',
    '🥰',
    '😮',
    '👍',
    '🔥',
    '🎉',
    '❤️',
    '💯',
  ];

  const normalizeEmojiSearch = (value: string) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[\s._-]+/g, '')
      .trim();

  const normalizePreviewUrlValue = (url: string): string => {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return url.trim();
    }
  };

  const renderInputLinkPreview = () => {
    if (!chatInputPreviewWrap || !chatInput) return;

    const firstUrl = extractFirstUrl(chatInput.value);
    if (!firstUrl) {
      chatInputPreviewWrap.classList.remove('active');
      chatInputPreviewWrap.innerHTML = '';
      suppressedInputPreviewUrl = null;
      return;
    }

    const normalizedFirstUrl = normalizePreviewUrlValue(firstUrl);
    if (
      suppressedInputPreviewUrl &&
      normalizePreviewUrlValue(suppressedInputPreviewUrl) === normalizedFirstUrl
    ) {
      chatInputPreviewWrap.classList.remove('active');
      chatInputPreviewWrap.innerHTML = '';
      return;
    }

    let host = firstUrl;
    let display = firstUrl;
    try {
      const parsed = new URL(firstUrl);
      host = parsed.hostname;
      display = `${parsed.hostname}${parsed.pathname}${parsed.search}`;
    } catch {
      // fallback to raw URL
    }

    chatInputPreviewWrap.classList.add('active');
    chatInputPreviewWrap.innerHTML = `
      <div class="chat-input-preview-box">
        <div class="chat-input-preview-text">
          <div class="chat-input-preview-title">Предпросмотр ссылки</div>
          <div class="chat-input-preview-url">${escapeHtml(display || host)}</div>
        </div>
        <button id="chatInputPreviewRemove" class="chat-input-preview-remove" type="button" title="Удалить предпросмотр" aria-label="Удалить предпросмотр">✕</button>
      </div>
    `;

    const removeBtn = document.getElementById('chatInputPreviewRemove') as HTMLButtonElement | null;
    removeBtn?.addEventListener('click', () => {
      suppressedInputPreviewUrl = firstUrl;
      renderInputLinkPreview();
      chatInput.focus();
    });
  };

  const renderInputEmojiPicker = () => {
    if (!chatInputEmojiPicker) return;

    const activeElement = document.activeElement as HTMLElement | null;
    const shouldRestoreSearchFocus =
      activeElement instanceof HTMLInputElement && activeElement.id === 'chatInputEmojiSearch';
    const caretPos = shouldRestoreSearchFocus ? activeElement.selectionStart : null;

    const query = normalizeEmojiSearch(currentInputEmojiSearch);
    const activeCategory = CYBLIGHT_EMOJI_CATEGORIES.find(
      (category) => category.key === currentInputEmojiCategory
    );

    const sourceEmojis = query
      ? allCategoryEmojis
      : activeCategory
        ? [...activeCategory.emojis]
        : [...allCategoryEmojis];

    const filteredEmojis = sourceEmojis.filter((emoji) => {
      if (!query) return true;
      if (normalizeEmojiSearch(emoji).includes(query)) return true;

      const ownerCategory = CYBLIGHT_EMOJI_CATEGORIES.find((category) =>
        category.emojis.includes(emoji)
      );
      if (!ownerCategory) return false;

      const keywordBase = normalizeEmojiSearch(
        `${ownerCategory.title} ${ownerCategory.titleEn || ''} ${ownerCategory.tags.join(' ')} ${
          ownerCategory.tagsEn ? ownerCategory.tagsEn.join(' ') : ''
        }`
      );
      return keywordBase.includes(query);
    });

    chatInputEmojiPicker.innerHTML = `
      <div class="chat-input-emoji-search-row">
        <input
          id="chatInputEmojiSearch"
          class="chat-input-emoji-search"
          type="text"
          placeholder="Поиск эмодзи..."
          value="${escapeHtml(currentInputEmojiSearch)}"
        />
      </div>

      <div class="chat-input-emoji-divider"></div>

      <div class="chat-input-emoji-cats">
        ${CYBLIGHT_EMOJI_CATEGORIES.map(
          (category) =>
            `<button
              class="chat-input-emoji-cat-btn ${category.key === currentInputEmojiCategory ? 'active' : ''}"
              data-emoji-cat="${escapeHtml(category.key)}"
              type="button"
              title="${escapeHtml(category.title)}"
             aria-label="${escapeHtml(category.title)}">${category.icon}</button>`
        ).join('')}
      </div>

      <div class="chat-input-emoji-divider"></div>

      <div class="chat-input-emoji-quick">
        <div class="chat-input-emoji-quick-label">Быстрые</div>
        <div class="chat-input-emoji-quick-grid">
          ${quickSearchEmojis
            .map(
              (emoji) =>
                `<button class="chat-input-emoji-quick-btn" data-emoji="${escapeHtml(emoji)}" type="button" aria-label="${emoji}">${emoji}</button>`
            )
            .join('')}
        </div>
      </div>

      <div class="chat-input-emoji-divider"></div>

      <div class="chat-input-emoji-grid">
        ${
          filteredEmojis.length > 0
            ? filteredEmojis
                .map(
                  (emoji) =>
                    `<button class="chat-input-emoji-btn" data-emoji="${escapeHtml(emoji)}" type="button" aria-label="${emoji}">${emoji}</button>`
                )
                .join('')
            : '<div class="chat-input-emoji-empty">Ничего не найдено</div>'
        }
      </div>
    `;

    const searchInput = document.getElementById('chatInputEmojiSearch') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.value = currentInputEmojiSearch;
    }

    if (shouldRestoreSearchFocus && searchInput) {
      const pos = caretPos ?? searchInput.value.length;
      searchInput.focus();
      searchInput.setSelectionRange(pos, pos);
    }
    searchInput?.addEventListener('input', () => {
      currentInputEmojiSearch = searchInput.value;
      renderInputEmojiPicker();
    });

    chatInputEmojiPicker.querySelectorAll('[data-emoji-cat]').forEach((categoryButton) => {
      categoryButton.addEventListener('click', () => {
        const nextCategory = (categoryButton as HTMLElement).getAttribute('data-emoji-cat') || '';
        if (!nextCategory) return;
        currentInputEmojiCategory = nextCategory;
        currentInputEmojiSearch = '';
        renderInputEmojiPicker();
      });
    });

    chatInputEmojiPicker.querySelectorAll('[data-emoji]').forEach((emojiButton) => {
      emojiButton.addEventListener('click', () => {
        const emoji = (emojiButton as HTMLElement).getAttribute('data-emoji') || '';
        insertEmojiToInput(emoji);
      });
    });
  };

  chatEmojiBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!chatInputEmojiPicker) return;
    const opening = !chatInputEmojiPicker.classList.contains('active');
    chatInputEmojiPicker.classList.toggle('active');
    if (opening) {
      renderInputEmojiPicker();
    }
  });

  if (state.accountChatDocClickHandler) {
    document.removeEventListener('click', state.accountChatDocClickHandler);
  }
  const newDocClickHandler = (event: MouseEvent) => {
    if (!chatInputEmojiPicker || !chatEmojiBtn) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (chatEmojiBtn.contains(target as Node)) return;
    if (chatInputEmojiPicker.classList.contains('active')) return;
  };
  callbacks.setAccountChatDocClickHandler(newDocClickHandler);
  document.addEventListener('click', newDocClickHandler);

  const sendMessage = async () => {
    if (!chatInput) return;
    let content = chatInput.value.trim();
    if (!content) return;
    const editingId = chatEditingIdInput?.value || '';

    if (!editingId && currentReplyState) {
      const safeReplyAuthor = encodeURIComponent(currentReplyState.author.slice(0, 80));
      const safeReplyText = encodeURIComponent(currentReplyState.text.slice(0, 220));
      content = `${content}\n[[CYBLIGHT_REPLY:${currentReplyState.messageId}:${safeReplyAuthor}:${safeReplyText}]]`;
    }

    const firstUrl = extractFirstUrl(content);
    if (
      firstUrl &&
      suppressedInputPreviewUrl &&
      normalizePreviewUrlValue(firstUrl) === normalizePreviewUrlValue(suppressedInputPreviewUrl)
    ) {
      content = `${content}\n[[CYBLIGHT_NO_PREVIEW:${encodeURIComponent(firstUrl)}]]`;
    }

    if (chatSendBtn) chatSendBtn.disabled = true;
    try {
      let response: Response;
      let data: ApiOkResponse;

      if (editingId) {
        response = await apiCall(`/messages/${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        data = await response.json().catch(() => ({}));
      } else {
        response = await apiCall('/messages/send', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId: friendId, content }),
        });
        data = await response.json().catch(() => ({}));
      }

      if (response.ok && data?.ok) {
        chatInput.value = '';
        chatInput.style.height = 'auto';
        suppressedInputPreviewUrl = null;
        renderInputLinkPreview();
        clearReplyState();
        resetChatEditingState(chatInput, chatSendBtn, chatEditIndicator, chatEditingIdInput);
        await loadChatMessagesInAccount(
          friendId,
          messagesEl,
          api,
          chatInput,
          chatSendBtn,
          chatEditIndicator,
          chatEditingIdInput,
          {
            hydrateLinkPreviews: true,
            forceScrollToBottom: true,
            onReplySelect: setReplyState,
            onPinStateChanged: renderPinnedBar,
            onForwardRequest: forwardMessageFromPicker,
            peerUsername: friendUsername,
          }
        );
        // Update badge counters after sending message
        void updateNavBadges();
        void callbacks.updateChatUnreadBadges();
      } else {
        api.showMsg(
          'error',
          data?.error ||
            (editingId ? 'Не удалось отредактировать сообщение' : 'Не удалось отправить сообщение')
        );
      }
    } catch {
      api.showMsg('error', 'Ошибка при отправке');
    } finally {
      if (chatSendBtn) chatSendBtn.disabled = false;
    }
  };

  chatSendBtn?.addEventListener('click', () => {
    void sendMessage();
  });

  chatInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  });

  chatInput?.addEventListener('input', () => {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 150)}px`;
    renderInputLinkPreview();
  });

  chatInput?.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      insertChatFormatting('**', '**', chatInput);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      insertChatFormatting('_', '_', chatInput);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      insertChatLink(chatInput);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      resetChatEditingState(chatInput, chatSendBtn, chatEditIndicator, chatEditingIdInput);
    }
  });

  chatCancelEditBtn?.addEventListener('click', () => {
    resetChatEditingState(chatInput, chatSendBtn, chatEditIndicator, chatEditingIdInput);
    suppressedInputPreviewUrl = null;
    renderInputLinkPreview();
  });

  container.querySelectorAll('[data-format]').forEach((buttonEl) => {
    const btn = buttonEl as HTMLButtonElement;
    btn.addEventListener('click', () => {
      if (!chatInput) return;
      const format = btn.getAttribute('data-format');
      if (format === 'bold') insertChatFormatting('**', '**', chatInput);
      else if (format === 'italic') insertChatFormatting('_', '_', chatInput);
      else if (format === 'mono') insertChatFormatting('`', '`', chatInput);
      else if (format === 'strike') insertChatFormatting('~~', '~~', chatInput);
      else if (format === 'spoiler') insertChatFormatting('||', '||', chatInput);
      else if (format === 'link') insertChatLink(chatInput);
      else if (format === 'code') insertChatCode(chatInput);
    });
  });

  void loadChatMessagesInAccount(
    friendId,
    messagesEl,
    api,
    chatInput,
    chatSendBtn,
    chatEditIndicator,
    chatEditingIdInput,
    {
      onReplySelect: setReplyState,
      onPinStateChanged: renderPinnedBar,
      onForwardRequest: forwardMessageFromPicker,
      peerUsername: friendUsername,
    }
  );

  renderPinnedBar();

  renderInputLinkPreview();

  const updateChatHeaderPresence = async () => {
    const presenceEl = document.getElementById('chatHeaderPresence');
    if (!presenceEl || state.accountChatFriendId !== friendId) return;

    try {
      const res = await apiCall(`/friends/presence/${encodeURIComponent(friendId)}`, {
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        isOnline?: boolean;
        lastSeenAt?: number | null;
      };

      if (!data?.ok) {
        presenceEl.textContent = '';
        presenceEl.className = 'chat-header-presence';
        return;
      }

      const presence = { isOnline: data.isOnline, lastSeenAt: data.lastSeenAt };
      if (!hasPresenceData(presence)) {
        presenceEl.textContent = '';
        presenceEl.className = 'chat-header-presence';
        return;
      }

      const online = isUserOnline(presence);
      presenceEl.textContent = formatPresenceLabel(presence);
      presenceEl.className = online
        ? 'chat-header-presence chat-header-presence--online'
        : 'chat-header-presence';
    } catch (error) {
      console.error('Error updating chat presence:', error);
    }
  };

  void updateChatHeaderPresence();

  callbacks.setAccountChatIntervalId(
    window.setInterval(() => {
      const chatExists = document.getElementById('chatMessages');
      if (!chatExists || state.accountChatFriendId !== friendId) {
        callbacks.stopAccountChatAutoRefresh();
        return;
      }
      void updateChatHeaderPresence();
      void loadChatMessagesInAccount(
        friendId,
        messagesEl,
        api,
        chatInput,
        chatSendBtn,
        chatEditIndicator,
        chatEditingIdInput,
        {
          hydrateLinkPreviews: false,
          preserveScrollPosition: true,
          onReplySelect: setReplyState,
          onPinStateChanged: renderPinnedBar,
          onForwardRequest: forwardMessageFromPicker,
          peerUsername: friendUsername,
        }
      );
    }, 5000)
  );

  // ==================== MESSAGE SELECTION ====================
  const selectedMessages = new Set<string>();
  let selectionModeActive = false;

  const selectionBar = document.getElementById('chatSelectionBar') as HTMLElement | null;
  const selectionInfo = document.getElementById('chatSelectionInfo') as HTMLElement | null;
  const messagesContainer = document.getElementById('chatMessages') as HTMLElement | null;

  const updateSelectionBar = () => {
    if (!selectionBar || !selectionInfo) return;
    if (!selectionModeActive) {
      selectionBar.classList.remove('active');
      chatBackRow?.classList.remove('hidden');
      messagesContainer?.classList.remove('selection-mode');
    } else {
      selectionBar.classList.add('active');
      chatBackRow?.classList.add('hidden');
      selectionInfo.textContent = `Выбрано: ${selectedMessages.size}`;
      messagesContainer?.classList.add('selection-mode');
    }

    messagesContainer?.querySelectorAll<HTMLElement>('.chat-message').forEach((messageEl) => {
      if (selectionModeActive) {
        messageEl.classList.add('selection-enabled');
      } else {
        messageEl.classList.remove('selection-enabled');
      }

      const messageId = String(messageEl.dataset.messageId || '');
      if (messageId && selectedMessages.has(messageId)) {
        messageEl.classList.add('selected');
      } else {
        messageEl.classList.remove('selected');
      }
    });
  };

  const enterSelectionMode = () => {
    selectionModeActive = true;
    window.__chatSelectionMode = true;
    updateSelectionBar();
  };

  const toggleMessageSelection = (messageId: string, messageEl: HTMLElement) => {
    if (!selectionModeActive) return;

    if (selectedMessages.has(messageId)) {
      selectedMessages.delete(messageId);
      messageEl.classList.remove('selected');
    } else {
      selectedMessages.add(messageId);
      messageEl.classList.add('selected');
    }

    updateSelectionBar();
  };

  const cancelSelection = () => {
    selectionModeActive = false;
    window.__chatSelectionMode = false;
    selectedMessages.clear();
    messagesContainer
      ?.querySelectorAll('.chat-message')
      .forEach((msg) => msg.classList.remove('selected', 'selection-enabled'));
    messagesContainer?.classList.remove('selection-mode');
    updateSelectionBar();
  };

  // Expose selection handlers to window for use in loadChatMessagesInAccount
  window.__chatSelectionHandlers = {
    enter: enterSelectionMode,
    toggle: toggleMessageSelection,
    cancel: cancelSelection,
    sync: updateSelectionBar,
    isActive: () => selectionModeActive,
  };
  window.__chatSelectionMode = false;

  document.getElementById('chatSelectionCancel')?.addEventListener('click', cancelSelection);

  document.getElementById('chatSelectionForward')?.addEventListener('click', async () => {
    if (selectedMessages.size === 0) return;
    const selectedIds = Array.from(selectedMessages.keys());
    api.showMsg('info', `Переслано ${selectedIds.length} сообщений`);
    cancelSelection();
  });

  document.getElementById('chatSelectionDelete')?.addEventListener('click', async () => {
    if (selectedMessages.size === 0) return;

    const selectedIds = Array.from(selectedMessages);
    const foreignSelectedIds = selectedIds.filter((messageId) => {
      const message = state.accountChatMessageMap.get(messageId) as ChatMessageRecord | undefined;
      const senderId = String(message?.senderId || message?.sender_id || message?.sender?.id || '');
      return senderId === String(friendId);
    });

    if (foreignSelectedIds.length > 0) {
      api.showMsg('error', 'Нельзя удалять чужие сообщения');
      return;
    }

    const confirmed = await showAccountConfirmModal({
      title: 'Удалить сообщения',
      text: `Удалить ${selectedMessages.size} выбранных сообщений?`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });
    if (!confirmed) return;

    for (const messageId of selectedMessages) {
      try {
        await apiCall(`/messages/${encodeURIComponent(messageId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (err) {
        console.error('Error deleting message:', err);
      }
    }

    api.showMsg('ok', `Удалено ${selectedMessages.size} сообщений`);
    cancelSelection();
    if (messagesEl) {
      await loadChatMessagesInAccount(
        friendId,
        messagesEl,
        api,
        chatInput,
        chatSendBtn,
        chatEditIndicator,
        chatEditingIdInput,
        {
          hydrateLinkPreviews: false,
          preserveScrollPosition: true,
          onReplySelect: setReplyState,
          onPinStateChanged: renderPinnedBar,
          onForwardRequest: forwardMessageFromPicker,
          peerUsername: friendUsername,
        }
      );
    }
  });
}
