/**
 * Account utilities - вспомогательные функции
 */

import { getLocale, localeTag, t } from '@/i18n';
import { apiCall } from '@/utils';
import { getAvatarInnerHtml } from './avatar';
import type { User as AppUser } from '@/types';

export type PendingEmailInfo = {
  pendingEmail: string;
  pendingVerifiedAt: number;
  pendingCompletesAt: number;
};

export function getPendingEmailInfo(user: Record<string, unknown>): PendingEmailInfo | null {
  const pendingEmail = String(user.pendingEmail || user.pending_email || '').trim();
  if (!pendingEmail) return null;

  return {
    pendingEmail,
    pendingVerifiedAt: Number(user.pendingEmailVerifiedAt || user.pending_email_verified_at || 0),
    pendingCompletesAt: Number(user.pendingEmailCompletesAt || user.pending_email_completes_at || 0),
  };
}

export function formatPendingDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  const ts = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString(localeTag(getLocale()), {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRemainingUntil(completesAt: number): string {
  if (!Number.isFinite(completesAt) || completesAt <= 0) return '';
  const ms = completesAt - Date.now();
  if (ms <= 0) return t('скоро');

  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  if (hours >= 48) return formatPendingDate(completesAt);
  if (hours > 0) {
    return t('через {hours} ч {minutes} мин', {
      hours: String(hours),
      minutes: String(minutes),
    });
  }
  return t('через {minutes} мин', { minutes: String(minutes) });
}

/** Короткий формат для «Осталось: …» без слова «через». */
export function formatRemainingShort(completesAt: number): string {
  if (!Number.isFinite(completesAt) || completesAt <= 0) return '';
  const ms = completesAt - Date.now();
  if (ms <= 0) return t('скоро');

  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  if (hours >= 48) return formatPendingDate(completesAt);
  if (hours > 0) {
    return t('{hours} ч {minutes} мин', {
      hours: String(hours),
      minutes: String(minutes),
    });
  }
  return t('{minutes} мин', { minutes: String(minutes) });
}

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
  const headerAvatarEl = document.getElementById('accountAvatarBtn');
  if (!avatarEl && !headerAvatarEl) return;
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
    const avatarHtml = getAvatarInnerHtml(String(profileAvatar), String(login));
    if (avatarEl) avatarEl.innerHTML = avatarHtml;
    if (headerAvatarEl) headerAvatarEl.innerHTML = avatarHtml;
  } catch (error) {
    console.warn('[ACCOUNT] Avatar hydrate skipped:', error);
  }
}
