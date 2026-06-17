import { t } from '@/i18n';

export function enhanceFileBackupImportSuccess(result: {
  chatsImported: number;
  chatsSkipped: number;
}): string {
  const parts = [t('Ключи шифрования восстановлены. Обновите страницу сообщений.')];
  if (result.chatsImported + result.chatsSkipped > 0) {
    parts.push(
      t('Чаты: добавлено {imported}, пропущено {skipped}.', {
        imported: result.chatsImported,
        skipped: result.chatsSkipped,
      }),
    );
  }
  return parts.join(' ');
}
