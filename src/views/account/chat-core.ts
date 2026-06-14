import { t } from '@/i18n';
import { getLocale, localeTag } from '@/i18n/locale';
import { apiCall, escapeHtml } from '@/utils';
import {
  decryptIncomingMessage,
  decryptMessageList,
  getSignalUserId,
} from '@/crypto/signal';
import { copyText } from '@/utils/clipboard';
import {
  buildChatLinkPreview,
  extractReplyMeta,
  parseFormattedChatText,
  stripNoPreviewTokens,
} from './chat-format';
import { cacheConversationPreview } from './conversation-preview';
import {
  getLocalDayKey,
  normalizeMessageTimestamp,
  renderChatDateSeparatorHtml,
} from './chat-date';
import { hydrateChatLinkPreviews, renderCachedChatLinkPreview } from './link-preview';
import { addReactionToMessageInAccount, deleteMessageInAccount } from './chat-actions';
import { showAccountConfirmModal, showAccountPinScopeModal } from './modals';

type ApiMessage = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
};

type PinnedMessageState = {
  messageId: string;
  text: string;
};

function isMessageRead(readAt: unknown): boolean {
  if (readAt == null || readAt === '') return false;
  const value = Number(readAt);
  return Number.isFinite(value) && value > 0;
}

function renderMessageReadStatus(readAt: unknown): string {
  const isRead = isMessageRead(readAt);
  const label = isRead ? t('Прочитано') : t('Отправлено');
  const statusClass = isRead ? 'chat-read-status--read' : 'chat-read-status--sent';

  if (isRead) {
    return `<span class="chat-read-status ${statusClass}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.05 11.56l-1.41 1.41 6.24 6.24 11.66-11.66-1.42-1.41zM.41 13.41 6 19l1.41-1.41L1.83 12 .41 13.41z"/>
      </svg>
    </span>`;
  }

  return `<span class="chat-read-status ${statusClass}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  </span>`;
}

export type ChatLoadOptions = {
  hydrateLinkPreviews?: boolean;
  preserveScrollPosition?: boolean;
  forceScrollToBottom?: boolean;
  onReplySelect?: (messageId: string, text: string, author?: string) => void;
  onPinStateChanged?: () => void;
  onForwardRequest?: (text: string) => Promise<void> | void;
  peerUsername?: string;
  composeDraftHolder?: { draft: string };
};

type ChatCoreDeps = {
  accountPinnedMessageByChat: Map<string, PinnedMessageState>;
  accountChatMessageMap: Map<string, Record<string, unknown>>;
  quickReactions: string[];
  editTimeLimit: number;
  startEditMessageInAccount: (
    messageId: string,
    currentContent: string,
    input: HTMLTextAreaElement,
    sendBtn: HTMLButtonElement | null,
    editIndicator: HTMLElement | null,
    editingIdInput: HTMLInputElement | null,
    composeDraftHolder?: { draft: string },
  ) => void;
};

export function createChatCore(deps: ChatCoreDeps) {
  return async function loadChatMessagesInAccount(
    friendId: string,
    container: HTMLElement | null,
    api: ApiMessage,
    chatInput: HTMLTextAreaElement | null,
    chatSendBtn: HTMLButtonElement | null,
    chatEditIndicator: HTMLElement | null,
    chatEditingIdInput: HTMLInputElement | null,
    options?: ChatLoadOptions
  ): Promise<void> {
    if (!container) return;

    const shouldHydrateLinkPreviews = options?.hydrateLinkPreviews ?? true;
    const preserveScrollPosition = options?.preserveScrollPosition ?? false;
    const forceScrollToBottom = options?.forceScrollToBottom ?? false;

    const previousScrollTop = container.scrollTop;
    const previousScrollHeight = container.scrollHeight;
    const previousClientHeight = container.clientHeight;
    const previousBottomOffset = previousScrollHeight - (previousScrollTop + previousClientHeight);
    const wasNearBottom = previousBottomOffset <= 80;

    try {
      const response = await apiCall(`/messages/${encodeURIComponent(friendId)}`, {
        credentials: 'include',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        const hasExistingMessages = container.querySelector('.chat-message') !== null;
        if (!hasExistingMessages) {
          container.innerHTML =
            '<div class="chat-error-text">Не удалось загрузить сообщения</div>';
        }
        return;
      }

      const list = Array.isArray(data.messages)
        ? data.messages
        : Array.isArray(data?.data?.messages)
          ? data.data.messages
          : [];

      const pinnedPayload = data?.pinned || data?.data?.pinned || null;
      const userId = getSignalUserId();
      const decryptedList = await decryptMessageList(
        userId,
        list.map((message: Record<string, unknown>) => ({
          ...message,
          id: String(message.id || ''),
          content: String(message.content || ''),
          senderId: String(message.senderId || message.sender_id || ''),
          encryption: (message.encryption as string | null | undefined) ?? 'plaintext',
          signalType: (message.signalType as number | null | undefined) ?? null,
          registrationId: (message.registrationId as number | null | undefined) ?? null,
          createdAt:
            Number(message.createdAt ?? message.created_at ?? 0) || null,
        })),
      );

      let pinnedText = '';
      if (pinnedPayload?.messageId) {
        try {
          pinnedText = await decryptIncomingMessage(userId, {
            id: String(pinnedPayload.messageId || pinnedPayload.message_id || ''),
            content: String(pinnedPayload.content || ''),
            senderId: String(pinnedPayload.senderId || pinnedPayload.sender_id || ''),
            encryption: String(pinnedPayload.encryption || 'plaintext'),
            signalType: Number(pinnedPayload.signalType ?? pinnedPayload.signal_type ?? 0) || null,
            registrationId:
              Number(pinnedPayload.registrationId ?? pinnedPayload.signal_registration_id ?? 0) ||
              null,
            createdAt:
              Number(pinnedPayload.createdAt ?? pinnedPayload.created_at ?? 0) || null,
          });
        } catch {
          pinnedText = '🔒 Закреплённое сообщение';
        }
      }

      if (pinnedPayload?.messageId) {
        deps.accountPinnedMessageByChat.set(friendId, {
          messageId: String(pinnedPayload.messageId),
          text: stripNoPreviewTokens(pinnedText).replace(/\s+/g, ' ').trim(),
        });
      } else {
        deps.accountPinnedMessageByChat.delete(friendId);
      }
      options?.onPinStateChanged?.();

      if (decryptedList.length === 0) {
        container.innerHTML = '<div class="chat-empty">Сообщений пока нет</div>';
        return;
      }

      deps.accountChatMessageMap.clear();
      decryptedList.forEach((message: Record<string, unknown>) => {
        deps.accountChatMessageMap.set(String(message.id || ''), message);
      });

      const latestMessage = decryptedList.reduce<Record<string, unknown> | null>((latest, message) => {
        const msg = message as Record<string, unknown>;
        const createdAt = normalizeMessageTimestamp(msg.createdAt ?? msg.created_at);
        if (!latest) return msg;
        const latestAt = normalizeMessageTimestamp(latest.createdAt ?? latest.created_at);
        return createdAt >= latestAt ? msg : latest;
      }, null);

      if (latestMessage) {
        cacheConversationPreview(
          friendId,
          String(latestMessage.senderId ?? latestMessage.sender_id ?? ''),
          String(latestMessage.content ?? ''),
          normalizeMessageTimestamp(latestMessage.createdAt ?? latestMessage.created_at),
        );
      }

      const normalizeReactions = (input: unknown): Array<{ emoji: string; count: number }> => {
        if (!input) return [];
        if (Array.isArray(input)) {
          return (input as unknown[])
            .map((reaction) => {
              const r = reaction as Record<string, unknown>;
              return {
                emoji: String(r.emoji ?? ''),
                count: Number((r.count as number | undefined) ?? (r.users as unknown[] | undefined)?.length ?? 0),
              };
            })
            .filter((reaction) => !!reaction.emoji);
        }
        if (typeof input === 'object' && input !== null) {
          return Object.entries(input as Record<string, unknown>).map(([emoji, users]) => ({
            emoji,
            count: Array.isArray(users) ? users.length : Number(users as number | undefined || 0),
          }));
        }
        return [];
      };

      const messageHtmlParts: string[] = [];
      let lastDayKey = '';

      for (const message of decryptedList) {
        const msg = message as Record<string, unknown>;
        const messageId = String(msg.id ?? '');
        const senderId = String(
          msg.senderId ?? msg.sender_id ?? (msg.sender as Record<string, unknown> | undefined)?.id ?? ''
        );
        const isSent = senderId !== String(friendId);
        const normalizedCreatedAt = normalizeMessageTimestamp(msg.createdAt ?? msg.created_at);
        const dayKey = getLocalDayKey(normalizedCreatedAt);

        if (dayKey !== lastDayKey) {
          messageHtmlParts.push(renderChatDateSeparatorHtml(normalizedCreatedAt));
          lastDayKey = dayKey;
        }

        const rawContent = String(msg.content ?? '');
        const replyMeta = extractReplyMeta(rawContent);
        const parsedContent = parseFormattedChatText(rawContent);
        const linkPreview = buildChatLinkPreview(rawContent);
        const reactions = normalizeReactions(msg.reactions);
        const edited = Boolean(msg.editedAt ?? msg.edited_at);
        const readAt = msg.readAt ?? msg.read_at;
        const timeLabel = new Date(normalizedCreatedAt).toLocaleTimeString(localeTag(getLocale()), {
          hour: '2-digit',
          minute: '2-digit',
        });

        const emojiPopupButtons = deps.quickReactions
          .slice(0, 6)
          .map((emoji) =>
            `<button class="chat-emoji-popup-btn" data-action="quick-react" data-message-id="${escapeHtml(
              messageId
            )}" data-emoji="${escapeHtml(emoji)}" type="button" title="${escapeHtml(
              emoji
            )}" aria-label="${escapeHtml(emoji)}">${emoji}</button>`
          )
          .join('');

        messageHtmlParts.push(`
          <div class="chat-message ${isSent ? 'sent' : 'received'} ${deps.accountPinnedMessageByChat.get(friendId)?.messageId === messageId ? 'is-pinned' : ''}" data-message-id="${escapeHtml(messageId)}">
            <div class="chat-message-content">
              ${
                replyMeta
                  ? `<button type="button" data-reply-target-id="${escapeHtml(replyMeta.messageId)}" class="chat-reply-snippet" aria-label="${escapeHtml(replyMeta.author || 'Ответ')} ${escapeHtml(replyMeta.text || 'Сообщение')}">
                      <div class="chat-reply-author">${escapeHtml(replyMeta.author || 'Ответ')}</div>
                      <div class="chat-reply-text">${escapeHtml(replyMeta.text || 'Сообщение')}</div>
                    </button>`
                  : ''
              }
              ${parsedContent}
              ${linkPreview}
              ${edited ? '<span class="chat-edited">(отредактировано)</span>' : ''}
            </div>

            ${
              reactions.length > 0
                ? `<div class="chat-reactions">
                  ${reactions
                    .map((reaction) =>
                      `<button class="chat-reaction" data-action="quick-react" data-message-id="${escapeHtml(
                        messageId
                      )}" data-emoji="${escapeHtml(reaction.emoji)}" type="button" title="${escapeHtml(
                        `${reaction.count} реакций`
                      )}" aria-label="${escapeHtml(
                        `${reaction.emoji}${reaction.count > 1 ? ` ${reaction.count} реакций` : ''}`
                      )}">${escapeHtml(reaction.emoji)}${reaction.count > 1 ? ` ${reaction.count}` : ''}</button>`
                    )
                    .join('')}
                </div>`
                : ''
            }

            <div class="chat-message-meta">
              <span class="chat-message-time">${escapeHtml(timeLabel)}</span>
              ${isSent ? renderMessageReadStatus(readAt) : ''}
            </div>

            <div class="chat-quick-reactions">
              <div class="chat-emoji-popup" data-emoji-popup-for="${escapeHtml(messageId)}">
                <button class="chat-emoji-popup-btn chat-emoji-trigger" data-action="quick-react" data-message-id="${escapeHtml(
                  messageId
                )}" data-emoji="😊" type="button" title="😊" aria-label="😊">😊</button>
                ${emojiPopupButtons}
              </div>
            </div>
          </div>
        `);
      }

      container.innerHTML = messageHtmlParts.join('');

      container.querySelectorAll('.spoiler').forEach((spoilerEl) => {
        spoilerEl.addEventListener('click', () => {
          spoilerEl.classList.toggle('revealed');
        });
      });

      container.querySelectorAll<HTMLElement>('[data-reply-target-id]').forEach((jumpEl) => {
        jumpEl.addEventListener('click', () => {
          const targetId = String(jumpEl.dataset.replyTargetId || '');
          if (!targetId) return;

          const target = container.querySelector(
            `[data-message-id="${CSS.escape(targetId)}"]`
          ) as HTMLElement | null;

          if (!target) {
            api.showMsg('warn', 'Исходное сообщение вне текущего диапазона чата');
            return;
          }

          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.animate(
            [
              { boxShadow: '0 0 0 0 rgba(96, 165, 250, 0)' },
              { boxShadow: '0 0 0 4px rgba(96, 165, 250, .45)' },
              { boxShadow: '0 0 0 0 rgba(96, 165, 250, 0)' },
            ],
            { duration: 780, easing: 'ease-out' }
          );
        });
      });

      if (shouldHydrateLinkPreviews) {
        void hydrateChatLinkPreviews(container);
      } else {
        container
          .querySelectorAll<HTMLElement>('[data-link-preview-url]')
          .forEach((placeholder) => {
            const url = String(placeholder.dataset.linkPreviewUrl || '').trim();
            if (!url) return;

            placeholder.outerHTML = renderCachedChatLinkPreview(url);
          });
      }

      const hoverTimers = new Map<string, ReturnType<typeof setTimeout>>();
      const hideTimers = new Map<string, ReturnType<typeof setTimeout>>();
      const reactionsShown = new Set<string>();

      container.querySelectorAll<HTMLElement>('.chat-message').forEach((msgEl) => {
        msgEl.addEventListener('mouseenter', () => {
          const msgId = msgEl.getAttribute('data-message-id') || '';
          if (!msgId) return;

          if (reactionsShown.has(msgId)) {
            return;
          }

          const timer = setTimeout(() => {
            const reactionsEl = msgEl.querySelector('.chat-quick-reactions') as HTMLElement | null;
            if (reactionsEl) {
              reactionsEl.classList.add('visible');
              reactionsShown.add(msgId);
            }
            hoverTimers.delete(msgId);
          }, 1000);

          hoverTimers.set(msgId, timer);
        });

        const scheduleHideReactions = (msgId: string) => {
          if (hideTimers.has(msgId)) {
            clearTimeout(hideTimers.get(msgId)!);
            hideTimers.delete(msgId);
          }
          const timer = setTimeout(() => {
            const reactionsEl = msgEl.querySelector('.chat-quick-reactions') as HTMLElement | null;
            if (reactionsEl) {
              reactionsEl.classList.remove('visible');
              reactionsShown.delete(msgId);
              const popupEl = reactionsEl.querySelector('.chat-emoji-popup') as HTMLElement | null;
              if (popupEl) {
                popupEl.classList.remove('visible');
              }
            }
            hideTimers.delete(msgId);
          }, 700);
          hideTimers.set(msgId, timer);
        };

        msgEl.addEventListener('mouseleave', (event) => {
          const msgId = msgEl.getAttribute('data-message-id') || '';
          if (!msgId) return;

          const reactionsEl = msgEl.querySelector('.chat-quick-reactions') as HTMLElement | null;
          const related = event.relatedTarget as Node | null;
          if (reactionsEl && related && reactionsEl.contains(related)) {
            return;
          }

          if (hoverTimers.has(msgId)) {
            clearTimeout(hoverTimers.get(msgId)!);
            hoverTimers.delete(msgId);
          }

          scheduleHideReactions(msgId);
        });

        const reactionsEl = msgEl.querySelector('.chat-quick-reactions') as HTMLElement | null;
        if (reactionsEl) {
          reactionsEl.addEventListener('mouseenter', () => {
            const msgId = msgEl.getAttribute('data-message-id') || '';
            if (!msgId) return;
            if (hideTimers.has(msgId)) {
              clearTimeout(hideTimers.get(msgId)!);
              hideTimers.delete(msgId);
            }
          });

          reactionsEl.addEventListener('mouseleave', () => {
            const msgId = msgEl.getAttribute('data-message-id') || '';
            if (!msgId) return;
            scheduleHideReactions(msgId);
          });
        }
      });

      container.querySelectorAll<HTMLElement>('.chat-emoji-trigger').forEach((triggerEl) => {
        const reactionsEl = triggerEl.closest('.chat-quick-reactions') as HTMLElement | null;
        if (!reactionsEl) return;

        const popupEl = reactionsEl.querySelector('.chat-emoji-popup') as HTMLElement | null;
        if (!popupEl) return;

        triggerEl.addEventListener('mouseenter', () => {
          container.querySelectorAll('.chat-emoji-popup.visible').forEach((otherPopup) => {
            if (otherPopup !== popupEl) {
              otherPopup.classList.remove('visible');
            }
          });
          popupEl.classList.add('visible');
        });

        popupEl.querySelectorAll('.chat-emoji-popup-btn').forEach((emojiBtn) => {
          emojiBtn.addEventListener('click', async (e) => {
            e.stopPropagation();

            const messageId = emojiBtn.getAttribute('data-message-id') || '';
            const emoji = emojiBtn.getAttribute('data-emoji') || '';
            if (!messageId || !emoji) return;

            await addReactionToMessageInAccount(messageId, emoji, async () => {
              await loadChatMessagesInAccount(
                friendId,
                container,
                api,
                chatInput,
                chatSendBtn,
                chatEditIndicator,
                chatEditingIdInput
              );
            });

            popupEl.classList.remove('visible');
          });
        });
      });

      container.querySelectorAll('[data-action]').forEach((actionEl) => {
        actionEl.addEventListener('click', () => {
          const element = actionEl as HTMLElement;
          const action = element.getAttribute('data-action') || '';
          const messageId = element.getAttribute('data-message-id') || '';
          const emoji = element.getAttribute('data-emoji') || '';
          if (!messageId) return;

          const run = async () => {
            if (action === 'quick-react') {
              await addReactionToMessageInAccount(messageId, emoji, async () => {
                await loadChatMessagesInAccount(
                  friendId,
                  container,
                  api,
                  chatInput,
                  chatSendBtn,
                  chatEditIndicator,
                  chatEditingIdInput
                );
              });
              return;
            }

            if (action === 'delete-message') {
              await deleteMessageInAccount(messageId, api, showAccountConfirmModal, async () => {
                await loadChatMessagesInAccount(
                  friendId,
                  container,
                  api,
                  chatInput,
                  chatSendBtn,
                  chatEditIndicator,
                  chatEditingIdInput,
                  {
                    hydrateLinkPreviews: false,
                    preserveScrollPosition: true,
                  }
                );
              });
              return;
            }
          };

          void run();
        });
      });

      const closeChatContextMenu = () => {
        document.getElementById('chatMessageContextMenu')?.remove();
      };

      const isTouchDevice = () => {
        return (
          typeof window !== 'undefined' &&
          ('ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            ((navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints ?? 0) > 0)
        );
      };

      const isTouch = isTouchDevice();

      if (isTouch) {
        container
          .querySelectorAll<HTMLElement>('[data-action="show-emoji-popup"]')
          .forEach((triggerEl) => {
            triggerEl.style.display = 'none';
          });
      }

      container.querySelectorAll<HTMLElement>('.chat-message').forEach((messageEl) => {
        messageEl.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();

          closeChatContextMenu();

          const messageId = String(messageEl.dataset.messageId || '');
          const message = deps.accountChatMessageMap.get(messageId);
          if (!message) return;

          const isSent = messageEl.classList.contains('sent');
          const rawContent = String(message.content || '');
          const cleanContent = stripNoPreviewTokens(rawContent);
          const contextReplyAuthor = isSent ? 'Вы' : options?.peerUsername || 'Собеседник';
          const messageTimeRaw = message.createdAt || message.created_at || Date.now();
          const normalizedCreatedAt = normalizeMessageTimestamp(messageTimeRaw);
          const canEditMessage = isSent && Date.now() - normalizedCreatedAt < deps.editTimeLimit;
          const editTimeLeft = canEditMessage
            ? Math.max(
                1,
                Math.ceil((deps.editTimeLimit - (Date.now() - normalizedCreatedAt)) / 60000)
              )
            : 0;

          const menu = document.createElement('div');
          menu.id = 'chatMessageContextMenu';
          menu.className = 'chat-context-menu';

          menu.innerHTML = `
          <div class="chat-context-reactions">
            ${deps.quickReactions
              .slice(0, 6)
              .map((emoji) =>
                `<button class="chat-context-reaction-btn" type="button" data-menu-action="quick-react" data-menu-emoji="${escapeHtml(
                  emoji
                )}" title="Реакция ${escapeHtml(emoji)}" aria-label="Реакция ${escapeHtml(emoji)}">${emoji}</button>`
              )
              .join('')}
          </div>
          <div class="chat-context-actions">
            <button class="chat-context-action" type="button" data-menu-action="reply" aria-label="↩️Ответить"><span class="chat-context-action-icon">↩️</span>Ответить</button>
            <button class="chat-context-action" type="button" data-menu-action="pin" aria-label="📌${ deps.accountPinnedMessageByChat.get(friendId)?.messageId === messageId ? 'Открепить' : 'Закрепить' }"><span class="chat-context-action-icon">📌</span>${
              deps.accountPinnedMessageByChat.get(friendId)?.messageId === messageId
                ? 'Открепить'
                : 'Закрепить'
            }</button>
            ${
              isSent
                ? `<button class="chat-context-action" type="button" data-menu-action="edit" ${canEditMessage ? '' : 'disabled'} title="${canEditMessage ? `Осталось ${editTimeLeft} мин` : 'Время редактирования истекло'}" aria-label="${canEditMessage ? `Осталось ${editTimeLeft} мин` : 'Время редактирования истекло'}"><span class="chat-context-action-icon">✏️</span>Изменить</button>`
                : ''
            }
            <button class="chat-context-action" type="button" data-menu-action="copy" aria-label="📋Копировать текст"><span class="chat-context-action-icon">📋</span>Копировать текст</button>
            <button class="chat-context-action" type="button" data-menu-action="forward" aria-label="↪️Переслать"><span class="chat-context-action-icon">↪️</span>Переслать</button>
            ${
              isSent
                ? '<button class="chat-context-action" type="button" data-menu-action="delete" aria-label="🗑️Удалить"><span class="chat-context-action-icon">🗑️</span>Удалить</button>'
                : ''
            }
            <button class="chat-context-action" type="button" data-menu-action="select" aria-label="⭕Выделить"><span class="chat-context-action-icon">⭕</span>Выделить</button>
          </div>
        `;

          document.body.appendChild(menu);

          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const rect = menu.getBoundingClientRect();
          const nextLeft = Math.min(event.clientX, Math.max(8, viewportWidth - rect.width - 8));
          const nextTop = Math.min(event.clientY, Math.max(8, viewportHeight - rect.height - 8));

          menu.style.left = `${Math.max(8, nextLeft)}px`;
          menu.style.top = `${Math.max(8, nextTop)}px`;

          const handleMenuAction = async (target: HTMLElement) => {
            const action = String(target.getAttribute('data-menu-action') || '');
            if (!action) return;

            if (action === 'quick-react') {
              const emoji = String(target.getAttribute('data-menu-emoji') || '');
              if (emoji) {
                await addReactionToMessageInAccount(messageId, emoji, async () => {
                  await loadChatMessagesInAccount(
                    friendId,
                    container,
                    api,
                    chatInput,
                    chatSendBtn,
                    chatEditIndicator,
                    chatEditingIdInput
                  );
                });
              }
              closeChatContextMenu();
              return;
            }

            if (action === 'reply') {
              options?.onReplySelect?.(
                messageId,
                cleanContent.replace(/\s+/g, ' ').trim().slice(0, 220),
                contextReplyAuthor
              );
              chatInput?.focus();
              closeChatContextMenu();
              return;
            }

            if (action === 'pin') {
              const pinned = deps.accountPinnedMessageByChat.get(friendId);
              const isUnpinAction = pinned?.messageId === messageId;

              if (isUnpinAction) {
                const confirmed = await showAccountConfirmModal({
                  title: 'Открепить сообщение',
                  text: 'Убрать закреп из этого чата?',
                  confirmText: 'Открепить',
                  cancelText: 'Отмена',
                });
                if (!confirmed) {
                  closeChatContextMenu();
                  return;
                }

                const response = await apiCall(`/messages/${encodeURIComponent(messageId)}/pin`, {
                  method: 'DELETE',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ forBoth: false }),
                });

                if (!response.ok) {
                  const payload = await response.json().catch(() => ({}));
                  api.showMsg('error', payload?.error || 'Не удалось открепить сообщение');
                  closeChatContextMenu();
                  return;
                }

                api.showMsg('info', 'Сообщение откреплено');
              } else {
                const decision = await showAccountPinScopeModal({
                  title: 'Закрепить сообщение',
                  text: 'Закрепить это сообщение?',
                  checkboxText: 'Также закрепить для собеседника',
                  confirmText: 'Закрепить',
                  cancelText: 'Отмена',
                  defaultChecked: false,
                });
                if (!decision.confirmed) {
                  closeChatContextMenu();
                  return;
                }

                const response = await apiCall(`/messages/${encodeURIComponent(messageId)}/pin`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ forBoth: decision.forBoth }),
                });

                if (!response.ok) {
                  const payload = await response.json().catch(() => ({}));
                  api.showMsg('error', payload?.error || 'Не удалось закрепить сообщение');
                  closeChatContextMenu();
                  return;
                }

                api.showMsg(
                  'success',
                  decision.forBoth
                    ? 'Сообщение закреплено для вас и собеседника'
                    : 'Сообщение закреплено'
                );
              }

              await loadChatMessagesInAccount(
                friendId,
                container,
                api,
                chatInput,
                chatSendBtn,
                chatEditIndicator,
                chatEditingIdInput,
                {
                  hydrateLinkPreviews: false,
                  preserveScrollPosition: true,
                  onReplySelect: options?.onReplySelect,
                  onPinStateChanged: options?.onPinStateChanged,
                  onForwardRequest: options?.onForwardRequest,
                  peerUsername: options?.peerUsername,
                }
              );
              closeChatContextMenu();
              return;
            }

            if (action === 'copy') {
              const ok = await copyText(cleanContent);
              api.showMsg(
                ok ? 'success' : 'warn',
                ok ? 'Текст сообщения скопирован' : 'Не удалось скопировать'
              );
              closeChatContextMenu();
              return;
            }

            if (action === 'edit') {
              if (!chatInput || !isSent) {
                closeChatContextMenu();
                return;
              }

              if (!canEditMessage) {
                api.showMsg('warn', 'Время редактирования этого сообщения истекло');
                closeChatContextMenu();
                return;
              }

              deps.startEditMessageInAccount(
                messageId,
                String(message.content || ''),
                chatInput,
                chatSendBtn,
                chatEditIndicator,
                chatEditingIdInput,
                options?.composeDraftHolder,
              );
              closeChatContextMenu();
              return;
            }

            if (action === 'forward') {
              if (options?.onForwardRequest) {
                await options.onForwardRequest(cleanContent);
              } else if (chatInput) {
                chatInput.value = cleanContent;
                chatInput.focus();
                chatInput.dispatchEvent(new Event('input'));
                api.showMsg('info', 'Текст сообщения подставлен в поле ввода');
              }
              closeChatContextMenu();
              return;
            }

            if (action === 'delete') {
              await deleteMessageInAccount(messageId, api, showAccountConfirmModal, async () => {
                await loadChatMessagesInAccount(
                  friendId,
                  container,
                  api,
                  chatInput,
                  chatSendBtn,
                  chatEditIndicator,
                  chatEditingIdInput,
                  {
                    hydrateLinkPreviews: false,
                    preserveScrollPosition: true,
                  }
                );
              });
              closeChatContextMenu();
              return;
            }

            if (action === 'select') {
              if (window.__chatSelectionHandlers) {
                window.__chatSelectionHandlers.enter();
                const localMessageId = messageEl.getAttribute('data-message-id') || '';
                if (localMessageId) {
                  window.__chatSelectionHandlers.toggle(localMessageId, messageEl);
                }
              }
              closeChatContextMenu();
            }
          };

          menu.addEventListener('click', (menuEvent) => {
            const target = (menuEvent.target as HTMLElement | null)?.closest(
              '[data-menu-action]'
            ) as HTMLElement | null;
            if (!target) return;
            void handleMenuAction(target);
          });

          const onDocClick = (docEvent: MouseEvent) => {
            const target = docEvent.target as Node | null;
            if (target && menu.contains(target)) return;
            closeChatContextMenu();
            document.removeEventListener('click', onDocClick, true);
          };

          const onScroll = () => {
            closeChatContextMenu();
            container.removeEventListener('scroll', onScroll);
          };

          document.addEventListener('click', onDocClick, true);
          container.addEventListener('scroll', onScroll, { passive: true });
        });
      });

      if (forceScrollToBottom) {
        container.scrollTop = container.scrollHeight;
      } else if (preserveScrollPosition) {
        if (wasNearBottom) {
          container.scrollTop = container.scrollHeight;
        } else {
          const heightDiff = container.scrollHeight - previousScrollHeight;
          container.scrollTop = Math.max(0, previousScrollTop + heightDiff);
        }
      } else {
        container.scrollTop = container.scrollHeight;
      }

      container.querySelectorAll<HTMLElement>('.chat-message').forEach((messageEl) => {
        if (!messageEl.hasAttribute('data-selection-listener-attached')) {
          messageEl.setAttribute('data-selection-listener-attached', 'true');
          messageEl.classList.add('chat-message--selectable');
          messageEl.addEventListener('click', (e) => {
            if (window.__chatSelectionMode) {
              e.stopPropagation();
              const messageId = messageEl.getAttribute('data-message-id') || '';
              if (messageId && window.__chatSelectionHandlers) {
                window.__chatSelectionHandlers.toggle(messageId, messageEl);
              }
            }
          });
        }
      });

      if (window.__chatSelectionHandlers?.sync) {
        window.__chatSelectionHandlers.sync();
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
      const hasExistingMessages = container.querySelector('.chat-message') !== null;
      if (!hasExistingMessages) {
        container.innerHTML = '<div class="chat-error-text">Ошибка сети</div>';
      }
    }
  };
}
