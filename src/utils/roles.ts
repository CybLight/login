import { t } from '@/i18n';

export function getRoleDisplayName(role: string): string {
  const labels: Record<string, string> = {
    owner: t('Владелец'),
    admin: t('Администратор'),
    moderator: t('Модератор'),
    support: t('Поддержка'),
    registrar: t('Регистратор'),
    tester: t('Тестер'),
    user: t('Пользователь'),
  };

  return labels[role.toLowerCase()] || role.toUpperCase();
}
