import { t } from '@/i18n';
import { localeTag, getLocale } from '@/i18n/locale';
import { escapeHtml } from '@/utils';
import { backupErrorMessage, hasLocalBackupKeys } from '@/crypto/backup';
import {
  fetchDriveBackupMetadata,
  isGoogleDriveConfigured,
  restoreBackupFromGoogleDrive,
} from '@/integrations/google-drive';
import { resetActiveSignalContext } from '@/crypto/signal/manager';
import { showAccountConfirmModal, showAccountNoticeModal } from './modals';

const PROMPT_DISMISSED_KEY = 'cyb_drive_restore_prompt_dismissed';

function showBackupPasswordModal(title: string, hint: string): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'account-notice-modal';
    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" role="dialog" aria-modal="true">
        <div class="account-notice-head">${escapeHtml(title)}</div>
        <p class="account-notice-text">${escapeHtml(hint)}</p>
        <div class="pass-wrap">
          <input class="input" id="driveRestorePasswordInput" type="password" autocomplete="current-password" />
        </div>
        <div class="account-notice-actions">
          <button type="button" class="btn btn-outline" id="driveRestoreCancelBtn">${escapeHtml(t('Отмена'))}</button>
          <button type="button" class="btn btn-primary" id="driveRestoreOkBtn">${escapeHtml(t('Восстановить'))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const input = wrap.querySelector('#driveRestorePasswordInput') as HTMLInputElement;
    const close = (value: string | null) => {
      wrap.remove();
      resolve(value);
    };

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close(null));
    wrap.querySelector('#driveRestoreCancelBtn')?.addEventListener('click', () => close(null));
    wrap.querySelector('#driveRestoreOkBtn')?.addEventListener('click', () => {
      close(input?.value?.trim() || null);
    });
    input?.focus();
  });
}

function formatDriveBackupTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString(localeTag(getLocale()), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isRestorePromptDismissed(): boolean {
  try {
    return sessionStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissRestorePrompt(): void {
  try {
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
}

export async function promptGoogleDriveRestoreIfNeeded(userId: string): Promise<void> {
  if (!isGoogleDriveConfigured() || isRestorePromptDismissed()) return;

  const hasLocal = await hasLocalBackupKeys(userId);
  if (hasLocal) return;

  let metadata;
  try {
    metadata = await fetchDriveBackupMetadata(userId);
  } catch {
    return;
  }

  if (!metadata) return;

  const when = formatDriveBackupTime(metadata.file.modifiedTime);
  const shouldRestore = await showAccountConfirmModal({
    title: t('Резервная копия в Google Drive'),
    text: t('Найдена копия ключей и сообщений в Google Drive ({date}). Восстановить на этом устройстве?', {
      date: when,
    }),
    confirmText: t('Восстановить'),
    cancelText: t('Пропустить'),
  });

  if (!shouldRestore) {
    dismissRestorePrompt();
    return;
  }

  const password = await showBackupPasswordModal(
    t('Введите пароль резервной копии'),
    t('Пароль, заданный при сохранении копии в Google Drive.'),
  );
  if (!password) {
    dismissRestorePrompt();
    return;
  }

  try {
    const result = await restoreBackupFromGoogleDrive(userId, password);
    resetActiveSignalContext();
    dismissRestorePrompt();

    const parts = [t('Ключи шифрования восстановлены.')];
    if (result.chatsImported + result.chatsSkipped + result.chatsErrors > 0) {
      parts.push(
        t('Чаты: добавлено {imported}, пропущено {skipped}.', {
          imported: result.chatsImported,
          skipped: result.chatsSkipped,
        }),
      );
    }
    showAccountNoticeModal('success', parts.join(' '));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'backup_failed';
    showAccountNoticeModal('error', backupErrorMessage(code));
  }
}
