export const LOCALES = ['ru', 'uk', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ru';

const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Русский',
  uk: 'Українська',
  en: 'English',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getLocale(): Locale {
  const m = location.pathname.match(/^\/(ru|uk|en)(\/|$)/);
  return m && isLocale(m[1]) ? m[1] : DEFAULT_LOCALE;
}

export function getLocaleLabel(locale: Locale = getLocale()): string {
  return LOCALE_LABELS[locale];
}

export function stripLocalePrefix(pathname = location.pathname): {
  locale: Locale;
  path: string;
} {
  const normalized = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const [first, ...rest] = normalized.split('/').filter(Boolean);

  if (first && isLocale(first)) {
    return { locale: first, path: rest.join('/') };
  }

  return { locale: DEFAULT_LOCALE, path: normalized };
}

export function localePath(route: string, locale: Locale = getLocale()): string {
  const clean = route.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) return `/${locale}/`;
  return `/${locale}/${clean}`;
}

export function sitePath(path = '', locale: Locale = getLocale()): string {
  const clean = path.replace(/^\/+/, '');
  return `https://cyblight.org/${locale}/${clean}`.replace(/\/$/, '') + (clean ? '/' : '/');
}

export function detectPreferredLocale(): Locale {
  try {
    const saved = localStorage.getItem('cyblight-lang');
    if (saved && isLocale(saved)) return saved;
  } catch {
    /* ignore */
  }

  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('uk') || nav.includes('ua')) return 'uk';
  if (nav.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem('cyblight-lang', locale);
  } catch {
    /* ignore */
  }
}

export function localeTag(locale: Locale = getLocale()): string {
  if (locale === 'uk') return 'uk-UA';
  if (locale === 'en') return 'en-US';
  return 'ru-RU';
}
