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

export function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    user: t(
      'Стандартный доступ к сайту: профиль, сообщения и участие в проектах CybLight.'
    ),
    tester: t(
      'Ранний доступ к новым функциям и возможность сообщать об ошибках до публичного релиза.'
    ),
    support: t(
      'Доступ к инструментам поддержки: помощь пользователям и обработка обращений.'
    ),
    registrar: t(
      'Помощь с регистрацией и верификацией новых участников сообщества.'
    ),
    moderator: t('Модерация контента и соблюдение правил на платформе.'),
    admin: t('Расширенные права управления платформой и её настройками.'),
    owner: t('Высший уровень доступа: полное управление проектом CybLight.'),
  };

  return descriptions[role.toLowerCase()] || '';
}

export function getRoleNoticeIcon(role: string): string {
  const icons: Record<string, string> = {
    owner: '👑',
    admin: '🛡️',
    moderator: '⚖️',
    support: '💬',
    registrar: '📋',
    tester: '🧪',
    user: '👤',
  };

  return icons[role.toLowerCase()] || '🎖️';
}
