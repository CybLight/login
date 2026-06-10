import { NotificationManager } from '@/components/notification/NotificationManager';
import { t } from '@/i18n';
import { apiCall } from './api';
import { getRoleDisplayName } from './roles';

export async function showPendingRoleNotice(roleNotice?: string | null): Promise<void> {
  if (!roleNotice) return;

  const roleLabel = getRoleDisplayName(roleNotice);
  NotificationManager.success(t('Вам назначена роль: {role}', { role: roleLabel }), 8000);

  try {
    await apiCall('/auth/role-notice/dismiss', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('[ROLE] Failed to dismiss role notice:', error);
  }
}
