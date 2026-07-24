import { t } from '@/i18n';
import { localeTag, getLocale } from '@/i18n/locale';
import { backupErrorMessage } from '@/crypto/backup';
import { resetActiveSignalContext } from '@/crypto/signal/manager';
import {
  clearGoogleDriveToken,
  deleteGoogleDriveBackup,
  fetchDriveBackupMetadata,
  fetchDriveStorageQuota,
  getGoogleDriveAccessToken,
  hasGoogleDriveSession,
  isGoogleDriveConfigured,
  resolveGoogleDriveAccountLabel,
  restoreBackupFromGoogleDrive,
  uploadBackupToGoogleDrive,
  type GoogleDriveStorageQuota,
} from '@/integrations/google-drive';
import { showAccountConfirmModal, showAccountNoticeModal } from './modals';
import { driveBackupProgress } from './backup-progress';

type DriveBackupDeps = {
  userId: string;
  login: string;
  api: { showMsg: (type: string, text: string, persist?: boolean) => void; clearMsg: () => void };
  readPassword: (id: string) => string;
  setBackupBusy: (busy: boolean) => void;
};

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

function formatFileSize(bytesNumOrStr?: number | string): string {
  if (bytesNumOrStr === undefined || bytesNumOrStr === null) return '';
  const bytes = Number(bytesNumOrStr);
  if (isNaN(bytes) || bytes < 0) return '';
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 0.05) {
    const rounded = gib >= 10 && Math.abs(gib - Math.round(gib)) < 0.05 ? Math.round(gib).toString() : gib.toFixed(1);
    return t('{amount} ГБ', { amount: rounded });
  }
  const mib = bytes / (1024 * 1024);
  if (mib >= 0.1) {
    return t('{amount} МБ', { amount: mib.toFixed(0) });
  }
  const kib = Math.max(0, Math.round(bytes / 1024));
  return t('{amount} КБ', { amount: kib.toString() });
}

function formatStorageQuotaText(quota: GoogleDriveStorageQuota): string {
  const used = formatFileSize(quota.usageBytes);
  if (quota.limitBytes) {
    const limit = formatFileSize(quota.limitBytes);
    return t('Использовано: {used} из {limit}', { used, limit });
  }
  return t('Использовано: {used}', { used });
}

function googleDriveErrorMessage(code: string): string {
  switch (code) {
    case 'google_drive_not_configured':
      return t('Google Drive не настроен на этом сервере.');
    case 'google_drive_auth_denied':
      return t('Доступ к Google Drive не был предоставлен.');
    case 'google_drive_auth_failed':
    case 'google_drive_auth_required':
      return t('Не удалось авторизоваться в Google.');
    case 'google_script_load_failed':
      return t('Не удалось войти через Google.');
    case 'google_drive_no_backup':
      return t('В Google Drive нет резервной копии для этого аккаунта.');
    case 'google_drive_upload_failed':
      return t('Не удалось сохранить резервную копию в Google Drive.');
    case 'google_drive_download_failed':
      return t('Не удалось скачать резервную копию из Google Drive.');
    case 'google_drive_delete_failed':
      return t('Не удалось удалить резервную копию из Google Drive.');
    default:
      return backupErrorMessage(code);
  }
}

function showDriveUploadProgress(percent: number): void {
  driveBackupProgress.show(t('Сохранение в Google Drive…'), percent);
}

function showDriveRestoreProgress(percent: number): void {
  driveBackupProgress.show(t('Восстановление из Google Drive…'), percent);
}

export async function refreshDriveBackupAccountLabel(): Promise<void> {
  const accountEl = document.getElementById('secDriveBackupAccount');
  if (!accountEl) return;

  if (!isGoogleDriveConfigured() || !hasGoogleDriveSession()) {
    accountEl.textContent = '';
    accountEl.classList.add('is-hidden');
    return;
  }

  const label = await resolveGoogleDriveAccountLabel();
  if (!label) {
    accountEl.textContent = t('Вход через Google выполнен');
    accountEl.classList.remove('is-hidden');
    return;
  }

  accountEl.textContent = t('Аккаунт Google: {account}', { account: label });
  accountEl.classList.remove('is-hidden');
}

function toggleElementVisible(el: HTMLElement | null, visible: boolean): void {
  if (!el) return;
  if (visible) {
    el.classList.remove('is-hidden');
    el.removeAttribute('hidden');
    el.style.display = '';
  } else {
    el.classList.add('is-hidden');
    el.setAttribute('hidden', '');
    el.style.display = 'none';
  }
}

export async function refreshDriveBackupStatusLabel(): Promise<void> {
  await refreshDriveBackupAccountLabel();

  const label = document.getElementById('secDriveBackupStatus');
  const storageEl = document.getElementById('secDriveBackupStorage');
  const storageWrapEl = document.getElementById('secDriveBackupStorageWrap');
  const signInBtn = document.getElementById('secDriveBackupSignInBtn');
  const uploadBtn = document.getElementById('secDriveBackupUploadBtn');
  const restoreBtn = document.getElementById('secDriveBackupRestoreBtn');
  const deleteBtn = document.getElementById('secDriveBackupDeleteBtn');
  const disconnectBtn = document.getElementById('secDriveBackupDisconnectBtn');

  if (!isGoogleDriveConfigured()) {
    if (label) label.textContent = t('Google Drive не настроен на этом сервере.');
    toggleElementVisible(signInBtn, false);
    toggleElementVisible(uploadBtn, false);
    toggleElementVisible(restoreBtn, false);
    toggleElementVisible(deleteBtn, false);
    toggleElementVisible(disconnectBtn, false);
    toggleElementVisible(storageEl, false);
    toggleElementVisible(storageWrapEl, false);
    return;
  }

  if (!hasGoogleDriveSession()) {
    if (label) label.textContent = t('Войдите через Google, чтобы сохранить или восстановить копию.');
    toggleElementVisible(signInBtn, true);
    toggleElementVisible(uploadBtn, false);
    toggleElementVisible(restoreBtn, false);
    toggleElementVisible(deleteBtn, false);
    toggleElementVisible(disconnectBtn, false);
    toggleElementVisible(storageEl, false);
    toggleElementVisible(storageWrapEl, false);
    return;
  }

  toggleElementVisible(signInBtn, false);
  toggleElementVisible(uploadBtn, true);
  toggleElementVisible(restoreBtn, true);
  toggleElementVisible(deleteBtn, true);
  toggleElementVisible(disconnectBtn, true);
  toggleElementVisible(storageWrapEl, true);

  void fetchDriveStorageQuota().then((quota) => {
    if (quota && storageEl) {
      storageEl.textContent = formatStorageQuotaText(quota);
      toggleElementVisible(storageEl, true);
    } else {
      toggleElementVisible(storageEl, false);
    }
  });

  if (!label) return;

  try {
    const metadata = await fetchDriveBackupMetadata(label.dataset.userId || '');
    if (!metadata) {
      label.textContent = t('В Google Drive пока нет резервной копии.');
      return;
    }
    const dateStr = formatDriveBackupTime(metadata.file.modifiedTime);
    const sizeStr = formatFileSize(metadata.file.size);
    if (sizeStr) {
      label.textContent = t('Последнее сохранение в Drive: {date} · {size}', {
        date: dateStr,
        size: sizeStr,
      });
    } else {
      label.textContent = t('Последнее сохранение в Drive: {date}', {
        date: dateStr,
      });
    }
  } catch {
    label.textContent = t('Не удалось получить статус Google Drive.');
  }
}

export function bindDriveBackupHandlers(deps: DriveBackupDeps): void {
  const { userId, login, api, readPassword, setBackupBusy } = deps;

  const status = document.getElementById('secDriveBackupStatus');
  if (status) {
    status.dataset.userId = userId;
  }

  const signInBtn = document.getElementById('secDriveBackupSignInBtn');
  const uploadBtn = document.getElementById('secDriveBackupUploadBtn');
  const restoreBtn = document.getElementById('secDriveBackupRestoreBtn');
  const deleteBtn = document.getElementById('secDriveBackupDeleteBtn');
  const disconnectBtn = document.getElementById('secDriveBackupDisconnectBtn');
  const configured = isGoogleDriveConfigured();

  if (!configured) {
    signInBtn?.setAttribute('disabled', 'true');
    uploadBtn?.setAttribute('disabled', 'true');
    restoreBtn?.setAttribute('disabled', 'true');
    deleteBtn?.setAttribute('disabled', 'true');
    disconnectBtn?.setAttribute('disabled', 'true');
  }

  void refreshDriveBackupStatusLabel();

  signInBtn?.addEventListener('click', async () => {
    setBackupBusy(true);
    api.clearMsg();
    try {
      await getGoogleDriveAccessToken({ interactive: true });
      await refreshDriveBackupStatusLabel();
      api.showMsg('success', t('Вход в Google выполнен успешно.'));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'auth_failed';
      if (code !== 'google_drive_auth_denied') {
        api.showMsg('error', googleDriveErrorMessage(code));
      }
    } finally {
      setBackupBusy(false);
    }
  });

  uploadBtn?.addEventListener('click', async () => {
    const password = readPassword('secDriveBackupPassword');
    if (password.length < 8) {
      api.showMsg('error', t('Пароль резервной копии должен быть не короче 8 символов.'));
      return;
    }

    setBackupBusy(true);
    api.clearMsg();
    showDriveUploadProgress(0);
    try {
      await uploadBackupToGoogleDrive(userId, login, password, showDriveUploadProgress);
      showDriveUploadProgress(100);
      await refreshDriveBackupStatusLabel();
      api.showMsg('success', t('Резервная копия сохранена в Google Drive.'));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'backup_failed';
      api.showMsg('error', googleDriveErrorMessage(code));
    } finally {
      driveBackupProgress.hide();
      setBackupBusy(false);
    }
  });

  restoreBtn?.addEventListener('click', async () => {
    const password = readPassword('secDriveBackupPassword');
    if (!password) {
      api.showMsg('error', t('Введите пароль резервной копии.'));
      return;
    }

    setBackupBusy(true);
    api.clearMsg();
    showDriveRestoreProgress(0);
    try {
      await restoreBackupFromGoogleDrive(userId, password, showDriveRestoreProgress, { skipChats: true });
      resetActiveSignalContext();
      showDriveRestoreProgress(100);
      showAccountNoticeModal('success', t('Ключи шифрования успешно восстановлены из Google Drive.'));
      await refreshDriveBackupStatusLabel();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'backup_failed';
      api.showMsg('error', googleDriveErrorMessage(code));
    } finally {
      driveBackupProgress.hide();
      setBackupBusy(false);
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    const confirmed = await showAccountConfirmModal({
      title: t('Удалить копию из Google Drive?'),
      text: t('Файл будет удалён из вашего Google Drive. Локальные ключи и сообщения не пострадают.'),
      confirmText: t('Удалить'),
      cancelText: t('Отмена'),
    });
    if (!confirmed) return;

    setBackupBusy(true);
    api.clearMsg();
    try {
      const deleted = await deleteGoogleDriveBackup(userId);
      await refreshDriveBackupStatusLabel();
      if (deleted) {
        showAccountNoticeModal('success', t('Резервная копия удалена из Google Drive.'));
      } else {
        api.showMsg('info', t('В Google Drive нет резервной копии для удаления.'));
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'backup_failed';
      api.showMsg('error', googleDriveErrorMessage(code));
    } finally {
      setBackupBusy(false);
    }
  });

  disconnectBtn?.addEventListener('click', () => {
    clearGoogleDriveToken();
    void refreshDriveBackupStatusLabel();
    api.showMsg('success', t('Сессия Google Drive завершена.'));
  });
}
