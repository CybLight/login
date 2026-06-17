import { t } from '@/i18n';
import { Router } from '@/router/Router';
import {
  OPEN_SECURITY_BACKUP_SECTION,
  OPEN_SECURITY_SECTION_KEY,
  hideEncryptionReminderElements,
  isEncryptionReminderHidden,
  setEncryptionReminderHidden,
} from './encryption-reminder';
import { renderChatFormattingToolbarHtml } from './chat-formatting-toolbar';

type MessagesSettingsApi = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg?: () => void;
};

export const CHAT_FORMAT_TOOLBAR_HIDDEN_KEY = 'cyb_chat_format_toolbar_hidden';

export function isChatFormatToolbarHidden(): boolean {
  try {
    return localStorage.getItem(CHAT_FORMAT_TOOLBAR_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setChatFormatToolbarHidden(hidden: boolean): void {
  try {
    localStorage.setItem(CHAT_FORMAT_TOOLBAR_HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

export function renderChatFormatToolbarRowHtml(): string {
  const hidden = isChatFormatToolbarHidden();

  return `
        <div class="chat-format-row">
          <button
            id="chatFormatToggleBtn"
            class="chat-format-toggle-btn${hidden ? '' : ' is-active'}"
            type="button"
            title="${hidden ? t('Показать панель форматирования') : t('Скрыть панель форматирования')}"
            aria-label="${hidden ? t('Показать панель форматирования') : t('Скрыть панель форматирования')}"
            aria-expanded="${hidden ? 'false' : 'true'}"
          ><span class="chat-format-toggle-icon" aria-hidden="true">Aa</span></button>
          <div id="chatFormattingToolbarWrap" class="chat-formatting-toolbar-wrap${hidden ? ' is-hidden' : ''}">
            ${renderChatFormattingToolbarHtml()}
          </div>
        </div>`;
}

export function applyChatFormatToolbarVisibility(root: ParentNode = document): void {
  const hidden = isChatFormatToolbarHidden();
  const wrap = root.querySelector('#chatFormattingToolbarWrap');
  const toggle = root.querySelector('#chatFormatToggleBtn') as HTMLButtonElement | null;

  wrap?.classList.toggle('is-hidden', hidden);
  toggle?.classList.toggle('is-active', !hidden);
  toggle?.setAttribute('aria-expanded', hidden ? 'false' : 'true');
  if (toggle) {
    const label = hidden ? t('Показать панель форматирования') : t('Скрыть панель форматирования');
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
  }
}

export function bindChatFormatToolbarToggle(root: ParentNode): void {
  const toggle = root.querySelector('#chatFormatToggleBtn') as HTMLButtonElement | null;
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const nextHidden = !isChatFormatToolbarHidden();
    setChatFormatToolbarHidden(nextHidden);
    applyChatFormatToolbarVisibility(root);
  });
}

export function renderMessagesSettingsHtml(): string {
  return `
      <div class="messages-info-head">
        <div class="messages-info-title">
          <strong>💬 ${t('Сообщения')}</strong>
          <p class="messages-info-hint">${t('Выберите друга, чтобы начать переписку')}</p>
        </div>
        <button
          id="messagesSettingsBtn"
          class="messages-settings-btn"
          type="button"
          title="${t('Настройки сообщений')}"
          aria-label="${t('Настройки сообщений')}"
          aria-expanded="false"
          aria-controls="messagesSettingsPanel"
        >
          <img src="/assets/img/msg/comGear.png" alt="" aria-hidden="true">
        </button>
      </div>
      <div id="messagesSettingsOverlay" class="messages-settings-overlay is-hidden" aria-hidden="true">
        <div class="messages-settings-backdrop" id="messagesSettingsBackdrop" aria-hidden="true"></div>
        <div id="messagesSettingsPanel" class="messages-settings-panel" role="dialog" aria-label="${t('Настройки сообщений')}">
          <div class="messages-settings-panel__head">
            <div class="messages-settings-panel__title">${t('Настройки сообщений')}</div>
            <button
              type="button"
              class="messages-settings-panel__close"
              id="messagesSettingsCloseBtn"
              aria-label="${t('Закрыть')}"
            >✕</button>
          </div>
          ${renderMessagesFormatToolbarSettingHtml()}
          ${renderMessagesCloudBackupHintHtml()}
        </div>
      </div>`;
}

function bindMessagesBackupShortcutHandlers(root: ParentNode): void {
  const btn = root.querySelector('#messagesOpenBackupSettingsBtn') as HTMLButtonElement | null;
  btn?.addEventListener('click', () => {
    try {
      sessionStorage.setItem(OPEN_SECURITY_SECTION_KEY, OPEN_SECURITY_BACKUP_SECTION);
    } catch {
      // ignore
    }
    Router.navigate('account-security');
  });
}

function renderMessagesFormatToolbarSettingHtml(): string {
  const checked = isChatFormatToolbarHidden();

  return `
        <label class="messages-setting-row">
          <input
            id="chatFormatToolbarHiddenSetting"
            type="checkbox"
            ${checked ? 'checked' : ''}
          />
          <span>${t('Скрывать панель форматирования по умолчанию')}</span>
        </label>`;
}

function renderMessagesCloudBackupHintHtml(): string {
  const reminderHidden = isEncryptionReminderHidden();

  return `
        <div class="messages-settings-section">
          <div class="messages-settings-section__title">${t('Резервная копия чатов')}</div>
          <p class="messages-settings-section__hint">${t('Резервная копия ключей и сообщений — в разделе «Безопасность → Резервная копия» (Google Drive или файл).')}</p>
          <label class="messages-setting-row messages-setting-row--section">
            <input
              id="encryptionReminderHiddenSetting"
              type="checkbox"
              ${reminderHidden ? 'checked' : ''}
            />
            <span>${t('Скрывать напоминание о резервной копии')}</span>
          </label>
          <div class="messages-settings-actions">
            <button id="messagesOpenBackupSettingsBtn" class="messages-settings-action-btn" type="button">
              ${t('Открыть настройки резервной копии')}
            </button>
          </div>
        </div>`;
}

export function bindMessagesSettingsHandlers(root: ParentNode, _api: MessagesSettingsApi): void {
  const btn = root.querySelector('#messagesSettingsBtn') as HTMLButtonElement | null;
  const overlay = root.querySelector('#messagesSettingsOverlay') as HTMLElement | null;
  const backdrop = root.querySelector('#messagesSettingsBackdrop') as HTMLElement | null;
  const closeBtn = root.querySelector('#messagesSettingsCloseBtn') as HTMLButtonElement | null;
  const panel = root.querySelector('#messagesSettingsPanel') as HTMLElement | null;
  const checkbox = root.querySelector('#chatFormatToolbarHiddenSetting') as HTMLInputElement | null;
  const reminderCheckbox = root.querySelector('#encryptionReminderHiddenSetting') as HTMLInputElement | null;

  let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

  const closePanel = () => {
    overlay?.classList.add('is-hidden');
    overlay?.setAttribute('aria-hidden', 'true');
    btn?.setAttribute('aria-expanded', 'false');
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
  };

  const openPanel = () => {
    overlay?.classList.remove('is-hidden');
    overlay?.setAttribute('aria-hidden', 'false');
    btn?.setAttribute('aria-expanded', 'true');

    escapeHandler = (event) => {
      if (event.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', escapeHandler);
  };

  btn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (overlay?.classList.contains('is-hidden')) {
      openPanel();
    } else {
      closePanel();
    }
  });

  backdrop?.addEventListener('click', () => {
    closePanel();
  });

  closeBtn?.addEventListener('click', () => {
    closePanel();
  });

  panel?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  checkbox?.addEventListener('change', () => {
    setChatFormatToolbarHidden(checkbox.checked);
  });

  reminderCheckbox?.addEventListener('change', () => {
    setEncryptionReminderHidden(reminderCheckbox.checked);
    if (reminderCheckbox.checked) {
      hideEncryptionReminderElements(document);
    }
  });

  bindMessagesBackupShortcutHandlers(root);
}
