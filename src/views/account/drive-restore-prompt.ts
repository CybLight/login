import { t } from '@/i18n';
import { localeTag, getLocale } from '@/i18n/locale';
import { escapeHtml } from '@/utils';
import { backupErrorMessage, hasLocalBackupKeys } from '@/crypto/backup';
import {
  fetchDriveBackupMetadata,
  hasGoogleDriveSession,
  isGoogleDriveConfigured,
  restoreBackupFromGoogleDrive,
} from '@/integrations/google-drive';
import { resetActiveSignalContext } from '@/crypto/signal/manager';
import { initPasswordEyes } from '@/components/password/password-helpers';
import { showAccountConfirmModal, showAccountNoticeModal } from './modals';
import type { ConversationPreviewEntry } from './unread';

const PROMPT_DISMISSED_KEY = 'cyb_drive_restore_prompt_dismissed';

let promptInFlight = false;

export type DriveRestorePromptOptions = {
  conversationPreviews?: Record<string, ConversationPreviewEntry>;
  onRestored?: () => void | Promise<void>;
};

type DriveRestoreProgressModal = {
  update: (label: string, percent: number) => void;
  close: () => void;
};

function showDriveRestoreProgressModal(): DriveRestoreProgressModal {
  const wrap = document.createElement('div');
  wrap.className = 'account-notice-modal';
  wrap.innerHTML = `
    <div class="account-notice-backdrop"></div>
    <div class="account-notice-card" role="dialog" aria-modal="true" aria-busy="true">
      <div class="account-notice-head">${escapeHtml(t('Восстановление из Google Drive'))}</div>
      <div class="sec-backup-progress sec-backup-progress--drive" aria-live="polite">
        <div class="sec-backup-progress__head">
          <span class="sec-backup-progress__label" id="driveRestorePromptProgressLabel">${escapeHtml(t('Подготовка…'))}</span>
          <span class="sec-backup-progress__percent" id="driveRestorePromptProgressPercent">0%</span>
        </div>
        <div class="sec-backup-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="driveRestorePromptProgressTrack">
          <div class="sec-backup-progress__bar" id="driveRestorePromptProgressBar" style="width: 0%"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const labelEl = wrap.querySelector('#driveRestorePromptProgressLabel') as HTMLElement;
  const percentEl = wrap.querySelector('#driveRestorePromptProgressPercent') as HTMLElement;
  const track = wrap.querySelector('#driveRestorePromptProgressTrack') as HTMLElement;
  const bar = wrap.querySelector('#driveRestorePromptProgressBar') as HTMLElement;

  return {
    update(label: string, percent: number) {
      const value = Math.min(100, Math.max(0, Math.round(percent)));
      labelEl.textContent = label;
      bar.style.width = `${value}%`;
      percentEl.textContent = `${value}%`;
      track.setAttribute('aria-valuenow', String(value));
    },
    close() {
      wrap.remove();
    },
  };
}

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
          <button type="button" class="pass-eye" data-target="driveRestorePasswordInput" aria-label="${escapeHtml(t('Показать пароль'))}"></button>
        </div>
        <div class="account-notice-actions">
          <button type="button" class="btn btn-outline" id="driveRestoreCancelBtn">${escapeHtml(t('Отмена'))}</button>
          <button type="button" class="btn btn-primary" id="driveRestoreOkBtn">${escapeHtml(t('Восстановить'))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    initPasswordEyes(wrap);

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

export function hasEncryptedConversationMessages(
  previews: Record<string, ConversationPreviewEntry>,
): boolean {
  return Object.values(previews).some((entry) => entry.lastMessage?.encryption === 'signal_v1');
}

export async function promptGoogleDriveRestoreIfNeeded(
  userId: string,
  options: DriveRestorePromptOptions = {},
): Promise<void> {
  if (promptInFlight) return;
  if (!isGoogleDriveConfigured() || isRestorePromptDismissed()) return;

  const hasLocal = await hasLocalBackupKeys(userId);
  if (hasLocal) return;

  const previews = options.conversationPreviews;
  if (previews && !hasEncryptedConversationMessages(previews)) return;

  promptInFlight = true;
  try {
    let metadata = null;
    if (hasGoogleDriveSession()) {
      try {
        metadata = await fetchDriveBackupMetadata(userId, { interactive: false });
      } catch {
        metadata = null;
      }
    }

    const when = metadata ? formatDriveBackupTime(metadata.file.modifiedTime) : '';
    const shouldRestore = await showAccountConfirmModal({
      title: t('Резервная копия в Google Drive'),
      text: when
        ? t('Найдена копия ключей и сообщений в Google Drive ({date}). Восстановить на этом устройстве?', {
            date: when,
          })
        : t('Ключи шифрования не найдены в этом браузере. Восстановить резервную копию из Google Drive?'),
      confirmText: t('Восстановить'),
      cancelText: t('Пропустить'),
    });

    if (!shouldRestore) {
      dismissRestorePrompt();
      return;
    }

    if (!metadata) {
      try {
        metadata = await fetchDriveBackupMetadata(userId, { interactive: true });
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'google_drive_auth_denied' || code === 'google_drive_auth_failed') {
          showAccountNoticeModal('warn', t('Отменено восстановление резервной копии.'));
        }
        dismissRestorePrompt();
        return;
      }
    }

    if (!metadata) {
      showAccountNoticeModal('warn', t('В Google Drive нет резервной копии для этого аккаунта.'));
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

    const restoreLabel = t('Восстановление из Google Drive…');
    const progress = showDriveRestoreProgressModal();
    progress.update(t('Подготовка…'), 0);

    try {
      const result = await restoreBackupFromGoogleDrive(userId, password, (percent) => {
        progress.update(restoreLabel, percent);
      });
      progress.update(restoreLabel, 100);
      resetActiveSignalContext();
      dismissRestorePrompt();
      progress.close();

      const parts = [t('Ключи шифрования восстановлены. Обновите страницу сообщений.')];
      if (result.chatsImported + result.chatsSkipped + result.chatsErrors > 0) {
        parts.push(
          t('Импорт завершён: добавлено {imported}, пропущено {skipped}, ошибок {errors}', {
            imported: result.chatsImported,
            skipped: result.chatsSkipped,
            errors: result.chatsErrors,
          }),
        );
      }
      showAccountNoticeModal('success', parts.join(' '));
      await options.onRestored?.();
    } catch (error) {
      progress.close();
      const code = error instanceof Error ? error.message : 'backup_failed';
      showAccountNoticeModal('error', backupErrorMessage(code));
    }
  } finally {
    promptInFlight = false;
  }
}
