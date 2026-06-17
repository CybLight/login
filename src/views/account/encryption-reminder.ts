import { t } from '@/i18n';
import { Router } from '@/router/Router';

export const OPEN_SECURITY_SECTION_KEY = 'cyb_open_security_section';
export const OPEN_SECURITY_BACKUP_SECTION = 'backup';
export const ENCRYPTION_REMINDER_HIDDEN_KEY = 'cyb_encryption_reminder_hidden';
/** @deprecated use {@link ENCRYPTION_REMINDER_HIDDEN_KEY} */
export const ENCRYPTION_REMINDER_CHAT_DISMISSED_KEY = 'cyb_encryption_reminder_chat_dismissed';

export function isEncryptionReminderHidden(): boolean {
  try {
    return (
      localStorage.getItem(ENCRYPTION_REMINDER_HIDDEN_KEY) === '1' ||
      localStorage.getItem(ENCRYPTION_REMINDER_CHAT_DISMISSED_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function setEncryptionReminderHidden(hidden: boolean): void {
  try {
    if (hidden) {
      localStorage.setItem(ENCRYPTION_REMINDER_HIDDEN_KEY, '1');
    } else {
      localStorage.removeItem(ENCRYPTION_REMINDER_HIDDEN_KEY);
      localStorage.removeItem(ENCRYPTION_REMINDER_CHAT_DISMISSED_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function dismissEncryptionReminder(): void {
  setEncryptionReminderHidden(true);
}

export function hideEncryptionReminderElements(root: ParentNode = document): void {
  root.querySelectorAll('.messages-encryption-reminder').forEach((el) => el.remove());
}

export function renderMessagesEncryptionReminder(compact = false): string {
  if (isEncryptionReminderHidden()) return '';

  const className = compact
    ? 'messages-encryption-reminder messages-encryption-reminder--compact'
    : 'messages-encryption-reminder';

  const closeBtn = compact
    ? `<button type="button" class="messages-encryption-reminder__close" data-action="dismiss-encryption-reminder" aria-label="${t('Закрыть')}">✕</button>`
    : '';

  return `
    <div class="${className}" role="note">
      ${closeBtn}
      <div class="messages-encryption-reminder__icon" aria-hidden="true">🔐</div>
      <div class="messages-encryption-reminder__body">
        <strong>${t('Сообщения защищены шифрованием')}</strong>
        ${
          compact
            ? `<p>${t('Сохраните резервную копию ключей в разделе «Безопасность».')}</p>`
            : `<p>${t('Сохраните резервную копию ключей, чтобы не потерять доступ к переписке при смене устройства или браузера.')}</p>`
        }
        <button type="button" class="messages-encryption-reminder__link" data-action="open-security-backup">
          ${t('Перейти в раздел «Безопасность» →')}
        </button>
      </div>
    </div>
  `;
}

export function navigateToSecurityBackup(): void {
  sessionStorage.setItem(OPEN_SECURITY_SECTION_KEY, OPEN_SECURITY_BACKUP_SECTION);
  Router.navigate('account-security');
}

export function bindEncryptionReminderHandlers(root: ParentNode): void {
  root.querySelectorAll('[data-action="open-security-backup"]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      navigateToSecurityBackup();
    });
  });

  root.querySelectorAll('[data-action="dismiss-encryption-reminder"]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      dismissEncryptionReminder();
      hideEncryptionReminderElements(root);
      const checkbox = root.querySelector('#encryptionReminderHiddenSetting') as HTMLInputElement | null;
      if (checkbox) checkbox.checked = true;
    });
  });
}

export function openPendingSecuritySection(): void {
  const section = sessionStorage.getItem(OPEN_SECURITY_SECTION_KEY);
  if (!section) return;

  sessionStorage.removeItem(OPEN_SECURITY_SECTION_KEY);

  if (section !== OPEN_SECURITY_BACKUP_SECTION) return;

  const item = document.getElementById('secBackupItem');
  const panel = document.getElementById('secBackupPanel');
  if (!item || !panel) return;

  panel.style.display = 'block';
  item.classList.add('is-open');

  requestAnimationFrame(() => {
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
