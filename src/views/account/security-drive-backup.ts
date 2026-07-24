import { t } from '@/i18n';
import { localeTag, getLocale } from '@/i18n/locale';
import { backupErrorMessage } from '@/crypto/backup';
import { resetActiveSignalContext } from '@/crypto/signal/manager';
import {
  clearGoogleDriveToken,
  deleteGoogleDriveBackup,
  fetchDriveBackupMetadata,
  getGoogleDriveAccessToken,
  hasGoogleDriveSession,
  isGoogleDriveConfigured,
  resolveGoogleDriveAccountLabel,
  restoreBackupFromGoogleDrive,
  uploadBackupToGoogleDrive,
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

export async function refreshDriveBackupStatusLabel(): Promise<void> {
  await refreshDriveBackupAccountLabel();

  const label = document.getElementById('secDriveBackupStatus');
  const signInBtn = document.getElementById('secDriveBackupSignInBtn');
  const uploadBtn = document.getElementById('secDriveBackupUploadBtn');
  const restoreBtn = document.getElementById('secDriveBackupRestoreBtn');
  const deleteBtn = document.getElementById('secDriveBackupDeleteBtn');
  const disconnectBtn = document.getElementById('secDriveBackupDisconnectBtn');

  if (!isGoogleDriveConfigured()) {
    if (label) label.textContent = t('Google Drive не настроен на этом сервере.');
    signInBtn?.classList.add('is-hidden');
    uploadBtn?.classList.add('is-hidden');
    restoreBtn?.classList.add('is-hidden');
    deleteBtn?.classList.add('is-hidden');
    disconnectBtn?.classList.add('is-hidden');
    return;
  }

  if (!hasGoogleDriveSession()) {
    if (label) label.textContent = t('Войдите через Google, чтобы сохранить или восстановить копию.');
    signInBtn?.classList.remove('is-hidden');
    uploadBtn?.classList.add('is-hidden');
    restoreBtn?.classList.add('is-hidden');
    deleteBtn?.classList.add('is-hidden');
    disconnectBtn?.classList.add('is-hidden');
    return;
  }

  signInBtn?.classList.add('is-hidden');
  uploadBtn?.classList.remove('is-hidden');
  restoreBtn?.classList.remove('is-hidden');
  deleteBtn?.classList.remove('is-hidden');
  disconnectBtn?.classList.remove('is-hidden');

  if (!label) return;

  try {
    const metadata = await fetchDriveBackupMetadata(label.dataset.userId || '');
    if (!metadata) {
      label.textContent = t('В Google Drive пока нет резервной копии.');
      return;
    }
    label.textContent = t('Последнее сохранение в Drive: {date}', {
      date: formatDriveBackupTime(metadata.file.modifiedTime),
    });
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
