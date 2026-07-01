import { t } from '@/i18n';
import {
  BACKUP_FILE_EXTENSION,
  backupErrorMessage,
  createBackupFile,
  downloadBackupFile,
  importBackupFile,
} from '@/crypto/backup';
import { resetActiveSignalContext } from '@/crypto/signal/manager';
import { showAccountNoticeModal } from './modals';
import { enhanceFileBackupImportSuccess } from './backup-ui-utils';
import { bindDriveBackupHandlers } from './security-drive-backup';
import { bindQrSyncHandlers } from './security-qr-sync';

type BackupDeps = {
  userId: string;
  login: string;
  api: {
    showMsg: (type: string, text: string, persist?: boolean) => void;
    clearMsg: () => void;
    fetch: (url: string, init?: RequestInit) => Promise<Response>;
  };
};

function readPasswordInput(id: string): string {
  const input = document.getElementById(id) as HTMLInputElement | null;
  return input?.value?.trim() || '';
}

function setBackupBusy(busy: boolean): void {
  const exportBtn = document.getElementById('secBackupExportBtn') as HTMLButtonElement | null;
  const importBtn = document.getElementById('secBackupImportBtn') as HTMLButtonElement | null;
  const importPassword = document.getElementById('secBackupImportPassword') as HTMLInputElement | null;
  const driveUploadBtn = document.getElementById('secDriveBackupUploadBtn') as HTMLButtonElement | null;
  const driveRestoreBtn = document.getElementById('secDriveBackupRestoreBtn') as HTMLButtonElement | null;
  const driveDeleteBtn = document.getElementById('secDriveBackupDeleteBtn') as HTMLButtonElement | null;
  const driveDisconnectBtn = document.getElementById('secDriveBackupDisconnectBtn') as HTMLButtonElement | null;
  if (exportBtn) exportBtn.disabled = busy;
  if (importBtn) importBtn.disabled = busy;
  if (importPassword) importPassword.disabled = busy;
  if (driveUploadBtn) driveUploadBtn.disabled = busy;
  if (driveRestoreBtn) driveRestoreBtn.disabled = busy;
  if (driveDeleteBtn) driveDeleteBtn.disabled = busy;
  if (driveDisconnectBtn) driveDisconnectBtn.disabled = busy;
}

function setBackupRestoreProgress(percent: number): void {
  const wrap = document.getElementById('secBackupImportProgress');
  const bar = document.getElementById('secBackupImportProgressBar');
  const percentEl = document.getElementById('secBackupImportProgressPercent');
  const track = document.getElementById('secBackupImportProgressTrack');
  if (!wrap || !bar || !percentEl || !track) return;

  const value = Math.min(100, Math.max(0, Math.round(percent)));
  wrap.classList.remove('is-hidden');
  wrap.setAttribute('aria-busy', 'true');
  bar.style.width = `${value}%`;
  percentEl.textContent = `${value}%`;
  track.setAttribute('aria-valuenow', String(value));
}

function hideBackupRestoreProgress(): void {
  const wrap = document.getElementById('secBackupImportProgress');
  const bar = document.getElementById('secBackupImportProgressBar');
  const percentEl = document.getElementById('secBackupImportProgressPercent');
  const track = document.getElementById('secBackupImportProgressTrack');
  if (!wrap || !bar || !percentEl || !track) return;

  wrap.classList.add('is-hidden');
  wrap.setAttribute('aria-busy', 'false');
  bar.style.width = '0%';
  percentEl.textContent = '0%';
  track.setAttribute('aria-valuenow', '0');
}

export function bindBackupHandlers(deps: BackupDeps): void {
  const { userId, login, api } = deps;
  const exportBtn = document.getElementById('secBackupExportBtn');
  const importBtn = document.getElementById('secBackupImportBtn');
  const fileInput = document.getElementById('secBackupFileInput') as HTMLInputElement | null;

  const backupHelpers = {
    readPassword: readPasswordInput,
    setBackupBusy,
  };

  bindDriveBackupHandlers({ userId, login, api, ...backupHelpers });
  bindQrSyncHandlers({ userId, api });

  exportBtn?.addEventListener('click', async () => {
    const password = readPasswordInput('secBackupExportPassword');
    const confirm = readPasswordInput('secBackupExportPasswordConfirm');
    if (password.length < 8) {
      api.showMsg('error', t('Пароль резервной копии должен быть не короче 8 символов.'));
      return;
    }
    if (password !== confirm) {
      api.showMsg('error', t('Пароли не совпадают.'));
      return;
    }

    setBackupBusy(true);
    api.clearMsg();
    try {
      const content = await createBackupFile(userId, password, { includeChats: true });
      downloadBackupFile(content, login);
      api.showMsg('success', t('Резервная копия сохранена (ключи и сообщения).'));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'backup_failed';
      api.showMsg('error', backupErrorMessage(code));
    } finally {
      setBackupBusy(false);
    }
  });

  importBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;

    const password = readPasswordInput('secBackupImportPassword');
    if (!password) {
      api.showMsg('error', t('Введите пароль резервной копии.'));
      return;
    }

    setBackupBusy(true);
    api.clearMsg();
    setBackupRestoreProgress(0);
    try {
      const raw = await file.text();
      // Read skipChats from checkbox
      const skipChats = (document.getElementById('secBackupImportSkipChats') as HTMLInputElement | null)?.checked ?? true;

      const result = await importBackupFile(userId, raw, password, setBackupRestoreProgress, { skipChats });
      resetActiveSignalContext();
      setBackupRestoreProgress(100);

      if (skipChats) {
        showAccountNoticeModal('success', t('Ключи шифрования успешно восстановлены. Сообщения пропущены.'));
      } else {
        showAccountNoticeModal('success', enhanceFileBackupImportSuccess(result));
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'backup_failed';
      api.showMsg('error', backupErrorMessage(code));
    } finally {
      hideBackupRestoreProgress();
      setBackupBusy(false);
    }
  });
}

export function backupFileAccept(): string {
  return BACKUP_FILE_EXTENSION;
}
