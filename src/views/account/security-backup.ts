import { t } from '@/i18n';
import {
  BACKUP_FILE_EXTENSION,
  backupErrorMessage,
  createBackupFile,
  downloadBackupFile,
  importBackupFile,
} from '@/crypto/backup';
import { resetActiveSignalContext } from '@/crypto/signal/manager';

type BackupDeps = {
  userId: string;
  login: string;
  api: { showMsg: (type: string, text: string, persist?: boolean) => void; clearMsg: () => void };
};

function readPasswordInput(id: string): string {
  const input = document.getElementById(id) as HTMLInputElement | null;
  return input?.value?.trim() || '';
}

function setBackupBusy(busy: boolean): void {
  const exportBtn = document.getElementById('secBackupExportBtn') as HTMLButtonElement | null;
  const importBtn = document.getElementById('secBackupImportBtn') as HTMLButtonElement | null;
  if (exportBtn) exportBtn.disabled = busy;
  if (importBtn) importBtn.disabled = busy;
}

export function bindBackupHandlers(deps: BackupDeps): void {
  const { userId, login, api } = deps;
  const exportBtn = document.getElementById('secBackupExportBtn');
  const importBtn = document.getElementById('secBackupImportBtn');
  const fileInput = document.getElementById('secBackupFileInput') as HTMLInputElement | null;

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
      const content = await createBackupFile(userId, password);
      downloadBackupFile(content, login);
      api.showMsg('success', t('Резервная копия сохранена.'));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'backup_failed';
      api.showMsg('error', t(backupErrorMessage(code)));
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
    try {
      const raw = await file.text();
      await importBackupFile(userId, raw, password);
      resetActiveSignalContext();
      api.showMsg('success', t('Ключи шифрования восстановлены. Обновите страницу сообщений.'));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'backup_failed';
      api.showMsg('error', t(backupErrorMessage(code)));
    } finally {
      setBackupBusy(false);
    }
  });
}

export function backupFileAccept(): string {
  return BACKUP_FILE_EXTENSION;
}
