import { collectBackupPayload } from './collect';
import { decryptBackupPayload, encryptBackupPayload, parseBackupFile, serializeBackupFile } from './crypto';
import { restoreBackupPayload } from './restore';

import { BACKUP_FILE_EXTENSION, BACKUP_VERSION, type CyblightBackupFileV1, type CyblightBackupPayloadV1 } from './format';

export {
  BACKUP_FILE_EXTENSION,
  BACKUP_VERSION,
  type CyblightBackupFileV1,
  type CyblightBackupPayloadV1,
};

export async function createBackupFile(userId: string, password: string): Promise<string> {
  const payload = await collectBackupPayload(userId);
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
): Promise<void> {
  const file = parseBackupFile(rawFile);
  const payload = await decryptBackupPayload(file, password);
  await restoreBackupPayload(userId, payload);
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
      return 'Нет локальных ключей шифрования для резервной копии.';
    case 'backup_password_invalid':
      return 'Неверный пароль резервной копии.';
    case 'backup_user_mismatch':
      return 'Эта копия создана для другого аккаунта.';
    case 'backup_file_invalid':
    case 'backup_payload_invalid':
    case 'backup_format_unsupported':
      return 'Некорректный файл резервной копии.';
    default:
      return 'Не удалось обработать резервную копию.';
  }
}
