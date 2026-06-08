import { escapeHtml } from './string';

export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export type PresenceInput = {
  isOnline?: boolean;
  lastSeenAt?: string | number | null;
  last_seen_at?: string | number | null;
};

export function normalizeLastSeenAt(item: PresenceInput | null | undefined): number | null {
  if (!item) return null;
  const raw = item.lastSeenAt ?? item.last_seen_at;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function hasPresenceData(item: PresenceInput | null | undefined): boolean {
  if (!item) return false;
  if (item.isOnline === true) return true;
  return normalizeLastSeenAt(item) != null;
}

export function isUserOnline(
  item: PresenceInput | null | undefined,
  now = Date.now()
): boolean {
  if (!item) return false;
  if (item.isOnline === true) return true;

  const lastSeenAt = normalizeLastSeenAt(item);
  if (lastSeenAt == null) return false;

  return now - lastSeenAt <= ONLINE_THRESHOLD_MS;
}

export function formatPresenceLabel(
  item: PresenceInput | null | undefined,
  now = Date.now()
): string {
  if (!item) return 'Не в сети';
  if (isUserOnline(item, now)) return 'В сети';

  const lastSeenAt = normalizeLastSeenAt(item);
  if (lastSeenAt == null) return 'Не в сети';

  const diff = now - lastSeenAt;
  if (diff < 60_000) return 'Был(а) только что';

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `Был(а) ${minutes} мин назад`;

  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `Был(а) ${hours} ч назад`;

  const days = Math.floor(diff / 86_400_000);
  return `Был(а) ${days} дн назад`;
}

export function renderPresenceDot(
  item: PresenceInput | null | undefined,
  now = Date.now()
): string {
  if (!hasPresenceData(item)) return '';

  const online = isUserOnline(item, now);
  const label = formatPresenceLabel(item, now);

  return `<span class="presence-dot ${online ? 'presence-dot--online' : 'presence-dot--offline'}" title="${escapeHtml(label)}" aria-hidden="true"></span>`;
}

export function renderPresenceChip(
  item: PresenceInput | null | undefined,
  now = Date.now()
): string {
  if (!hasPresenceData(item)) return '';

  const online = isUserOnline(item, now);
  const label = formatPresenceLabel(item, now);
  const statusClass = online ? 'status--online' : 'status--offline';

  return `<span class="chip status ${statusClass}"><span class="dot"></span> ${escapeHtml(label)}</span>`;
}

export function renderPresenceMeta(
  item: PresenceInput | null | undefined,
  now = Date.now()
): string {
  if (!hasPresenceData(item)) return '';

  const online = isUserOnline(item, now);
  const label = formatPresenceLabel(item, now);
  const metaClass = online ? 'presence-meta presence-meta--online' : 'presence-meta';

  return `<div class="${metaClass}">${escapeHtml(label)}</div>`;
}
