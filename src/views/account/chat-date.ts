import { t } from '@/i18n';
import { getLocale, localeTag } from '@/i18n/locale';
import { escapeHtml } from '@/utils';

const DAY_MS = 86_400_000;

export function normalizeMessageTimestamp(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  return value > 10_000_000_000 ? value : value * 1000;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiffFromToday(timestampMs: number): number {
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(new Date(timestampMs));
  return Math.round((today.getTime() - target.getTime()) / DAY_MS);
}

export function getLocalDayKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatChatDateSeparator(timestampMs: number): string {
  const locale = localeTag(getLocale());
  const date = new Date(timestampMs);
  const diffDays = dayDiffFromToday(timestampMs);

  if (diffDays === 0) return t('Сегодня');
  if (diffDays === 1) return t('Вчера');
  if (diffDays >= 2 && diffDays <= 6) {
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    return getLocale() === 'en' ? weekday : weekday.toLowerCase();
  }

  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatChatListTime(timestampMs: number): string {
  if (!timestampMs) return '';

  const locale = localeTag(getLocale());
  const date = new Date(timestampMs);
  const diffDays = dayDiffFromToday(timestampMs);

  if (diffDays === 0) {
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return formatChatDateSeparator(timestampMs);
}

export function renderChatDateSeparatorHtml(timestampMs: number): string {
  const label = formatChatDateSeparator(timestampMs);
  return `<div class="chat-date-separator" role="separator" aria-label="${escapeHtml(label)}"><span class="chat-date-separator__label">${escapeHtml(label)}</span></div>`;
}
