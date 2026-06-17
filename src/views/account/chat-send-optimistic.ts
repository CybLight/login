import { t } from '@/i18n';
import { getLocale, localeTag } from '@/i18n/locale';
import { escapeHtml } from '@/utils';
import {
  buildChatLinkPreview,
  extractReplyMeta,
  parseFormattedChatText,
} from './chat-format';
import { renderChatDateSeparatorHtml } from './chat-date';
import { hydrateChatLinkPreviews } from './link-preview';

function renderPendingReadStatus(): string {
  const label = t('Отправка...');
  return `<span class="chat-read-status chat-read-status--pending" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">…</span>`;
}

function renderSentReadStatus(): string {
  const label = t('Отправлено');
  return `<span class="chat-read-status chat-read-status--sent" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  </span>`;
}

function buildSentMessageHtml(rawContent: string, messageId: string, createdAt: number, pending: boolean): string {
  const replyMeta = extractReplyMeta(rawContent);
  const parsedContent = parseFormattedChatText(rawContent);
  const linkPreview = buildChatLinkPreview(rawContent);
  const timeLabel = new Date(createdAt).toLocaleTimeString(localeTag(getLocale()), {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <div class="chat-message sent${pending ? ' chat-message--pending' : ''}" data-message-id="${escapeHtml(messageId)}">
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
      </div>
      <div class="chat-message-meta">
        <span class="chat-message-time">${escapeHtml(timeLabel)}</span>
        ${pending ? renderPendingReadStatus() : renderSentReadStatus()}
      </div>
    </div>
  `;
}

function ensureDateSeparator(container: HTMLElement, createdAt: number): void {
  const empty = container.querySelector('.chat-empty');
  if (empty) {
    empty.remove();
    container.insertAdjacentHTML('beforeend', renderChatDateSeparatorHtml(createdAt));
    return;
  }
  if (!container.querySelector('.chat-message')) {
    container.insertAdjacentHTML('beforeend', renderChatDateSeparatorHtml(createdAt));
  }
}

export function appendOptimisticSentMessage(
  container: HTMLElement,
  rawContent: string,
  tempId: string,
): void {
  const createdAt = Date.now();
  ensureDateSeparator(container, createdAt);
  container.insertAdjacentHTML('beforeend', buildSentMessageHtml(rawContent, tempId, createdAt, true));
  container.scrollTop = container.scrollHeight;

  container.querySelectorAll('.spoiler').forEach((spoilerEl) => {
    if (!spoilerEl.hasAttribute('data-spoiler-bound')) {
      spoilerEl.setAttribute('data-spoiler-bound', '1');
      spoilerEl.addEventListener('click', () => {
        spoilerEl.classList.toggle('revealed');
      });
    }
  });
}

export function finalizeOptimisticSentMessage(
  container: HTMLElement,
  tempId: string,
  savedId: string,
  rawContent: string,
  userId: string,
  messageMap: Map<string, Record<string, unknown>>,
): void {
  const pendingEl = container.querySelector(
    `[data-message-id="${CSS.escape(tempId)}"]`,
  ) as HTMLElement | null;

  const createdAt = Date.now();
  const record: Record<string, unknown> = {
    id: savedId,
    content: rawContent,
    senderId: userId,
    createdAt,
    encryption: 'signal_v1',
  };
  messageMap.set(savedId, record);

  if (pendingEl) {
    pendingEl.outerHTML = buildSentMessageHtml(rawContent, savedId, createdAt, false);
    const nextEl = container.querySelector(
      `[data-message-id="${CSS.escape(savedId)}"]`,
    ) as HTMLElement | null;
    nextEl?.querySelectorAll('.spoiler').forEach((spoilerEl) => {
      spoilerEl.addEventListener('click', () => {
        spoilerEl.classList.toggle('revealed');
      });
    });
    void hydrateChatLinkPreviews(container);
    container.scrollTop = container.scrollHeight;
    return;
  }

  appendOptimisticSentMessage(container, rawContent, savedId);
  const el = container.querySelector(`[data-message-id="${CSS.escape(savedId)}"]`);
  el?.classList.remove('chat-message--pending');
  messageMap.set(savedId, record);
}

export function revertOptimisticSentMessage(container: HTMLElement, tempId: string): void {
  container.querySelector(`[data-message-id="${CSS.escape(tempId)}"]`)?.remove();
}
