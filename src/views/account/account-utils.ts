/**
 * Account utilities - вспомогательные функции
 */

import { apiCall } from '@/utils';
import { getAvatarInnerHtml } from './avatar';
import type { User as AppUser } from '@/types';

/**
 * Проверить, верифицирован ли email
 */
export function isEmailVerified(user: AppUser): boolean {
  const maybe = user as unknown as Record<string, unknown>;
  return !!(
    user.emailVerified === true ||
    maybe.email_verified === true ||
    String(maybe.email_verified) === '1' ||
    Boolean(maybe.email_verified_at)
  );
}

/**
 * Остановить автообновление чата
 */
export function stopAccountChatAutoRefresh(
  accountChatIntervalId: number | undefined,
  setAccountChatIntervalId: (id?: number) => void
): void {
  if (accountChatIntervalId) {
    window.clearInterval(accountChatIntervalId);
    setAccountChatIntervalId(undefined);
  }
}

/**
 * Гидрировать аватар пользователя
 */
export async function hydrateAccountAvatar(user: AppUser): Promise<void> {
  const avatarEl = document.getElementById('accountProfileAvatar');
  if (!avatarEl) return;
  const maybe = user as unknown as Record<string, unknown>;
  const existingAvatar = user.avatar || (maybe.avatarUrl as string | undefined) || (maybe.avatar_url as string | undefined);
  if (existingAvatar) return;

  try {
    let response = await apiCall('/profile/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const username = (maybe.login as string | undefined) || user.username;
      if (!username) return;
      response = await apiCall(`/profile/${encodeURIComponent(String(username))}`, {
        method: 'GET',
      });
    }

    if (!response.ok) return;

    const data = await response.json();
    const profile = data?.profile || data?.data?.profile || null;
    if (!profile) return;

    const profileAvatar = profile.avatar || (profile.avatarUrl as string | undefined) || (profile.avatar_url as string | undefined);
    if (!profileAvatar) return;
    const login = (maybe.login as string | undefined) || user.username || 'User';
    avatarEl.innerHTML = getAvatarInnerHtml(String(profileAvatar), String(login));
  } catch (error) {
    console.warn('[ACCOUNT] Avatar hydrate skipped:', error);
  }
}
