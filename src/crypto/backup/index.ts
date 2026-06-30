import { t } from '@/i18n';
import { fetchChatsForBackup, importChatsPayload } from './chats';
import { collectBackupPayload } from './collect';
import { decryptBackupPayload, encryptBackupPayload, parseBackupFile, serializeBackupFile } from './crypto';
import { restoreBackupPayload } from './restore';

import {
  BACKUP_FILE_EXTENSION,
  BACKUP_PAYLOAD_VERSION_V2,
  BACKUP_VERSION,
  isBackupPayloadV2,
  type CyblightBackupFileV1,
  type CyblightBackupPayload,
} from './format';

export {
  BACKUP_FILE_EXTENSION,
  BACKUP_VERSION,
  BACKUP_PAYLOAD_VERSION_V2,
  type CyblightBackupFileV1,
  type CyblightBackupPayload,
};
export { hasLocalBackupKeys } from './collect';

export type BackupRestoreResult = {
  chatsImported: number;
  chatsSkipped: number;
  chatsErrors: number;
};

export async function createBackupFile(
  userId: string,
  password: string,
  options?: { includeChats?: boolean },
): Promise<string> {
  const includeChats = options?.includeChats !== false;
  const chats = includeChats ? await fetchChatsForBackup() : null;
  const payload = await collectBackupPayload(userId, chats);
  if (!payload) {
    throw new Error('backup_no_local_keys');
  }
  const file = await encryptBackupPayload(payload, password);
  return serializeBackupFile(file);
}

export async function importBackupFile(
  userId: string,
  rawFile: string,
  password: string,
  onProgress?: (percent: number) => void,
  options?: { skipChats?: boolean },
): Promise<BackupRestoreResult> {
  const report = (percent: number): void => {
    onProgress?.(Math.min(100, Math.max(0, Math.round(percent))));
  };

  report(5);
  const file = parseBackupFile(rawFile);
  report(12);
  const payload = await decryptBackupPayload(file, password);
  report(20);
  await restoreBackupPayload(
    userId,
    payload,
    (restorePercent) => {
      // If skipping chats, the keys restore is the final step
      const base = options?.skipChats ? 20 : 20;
      const range = options?.skipChats ? 80 : 55;
      report(base + (restorePercent * range) / 100);
    },
    { skipDecryptCache: options?.skipChats },
  );

  let chatsImported = 0;
  let chatsSkipped = 0;
  let chatsErrors = 0;

  if (!options?.skipChats && isBackupPayloadV2(payload) && payload.chats) {
    report(80);
    const result = await importChatsPayload(payload.chats);
    chatsImported = result.imported;
    chatsSkipped = result.skipped;
    chatsErrors = result.errors;
  }

  report(100);

  return { chatsImported, chatsSkipped, chatsErrors };
}

export function downloadBackupFile(content: string, login: string): void {
  const safeLogin = login.replace(/[^\w.-]+/g, '_') || 'user';
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cyblight-${safeLogin}-${stamp}${BACKUP_FILE_EXTENSION}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function backupErrorMessage(code: string): string {
  switch (code) {
    case 'backup_no_local_keys':
      return t('Нет локальных ключей шифрования для резервной копии.');
    case 'backup_password_invalid':
      return t('Неверный пароль резервной копии.');
    case 'backup_user_mismatch':
      return t('Эта копия создана для другого аккаунта.');
    case 'backup_kdf_unsupported':
      return t('Неподдерживаемый формат шифрования резервной копии.');
    case 'backup_file_invalid':
    case 'backup_payload_invalid':
    case 'backup_format_unsupported':
      return t('Некорректный файл резервной копии.');
    case 'indexeddb_delete_failed':
    case 'indexeddb_read_failed':
    case 'indexeddb_write_failed':
      return t('Ошибка доступа к локальной базе данных браузера.');
    case 'sync_key_invalid':
      return t('Некорректный ключ синхронизации в резервной копии.');
    case 'chats_import_failed':
      return t('Не удалось импортировать чаты из резервной копии.');
    case 'backup_keys_only_success':
      return t('Ключи шифрования успешно восстановлены. Сообщения пропущены.');
    default:
      console.error('[Backup] Unhandled error code:', code);
      return t('Не удалось обработать резервную копию.');
  }
}
