import { uk } from './locales/uk';
import { en } from './locales/en';
import {
  DEFAULT_LOCALE,
  detectPreferredLocale,
  getLocale,
  getLocaleLabel,
  isLocale,
  localePath,
  localeTag,
  persistLocale,
  sitePath,
  siteRootPath,
  stripLocalePrefix,
  type Locale,
  LOCALES,
} from './locale';

const MAPS: Record<Exclude<Locale, 'ru'>, Record<string, string>> = { uk, en };

export type TParams = Record<string, string | number>;

export function t(text: string, params?: TParams): string {
  const locale = getLocale();
  let out = text;

  if (locale !== 'ru') {
    out = MAPS[locale][text] ?? text;
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      out = out.split(`{${key}}`).join(String(value));
    }
  }

  return out;
}

export function initLocaleRouting(): void {
  const pathname = location.pathname;
  const suffixQuery = `${location.search}${location.hash}`;

  if (pathname === '/' || pathname === '') {
    location.replace(`/${detectPreferredLocale()}/${suffixQuery}`);
    return;
  }

  if (!/^\/(ru|uk|en)(\/|$)/.test(pathname)) {
    const suffix = pathname.startsWith('/') ? pathname : `/${pathname}`;
    location.replace(`/${detectPreferredLocale()}${suffix}${suffixQuery}`);
    return;
  }

  const locale = getLocale();
  document.documentElement.lang = locale === 'uk' ? 'uk' : locale;
  persistLocale(locale);
}

export {
  DEFAULT_LOCALE,
  LOCALES,
  detectPreferredLocale,
  getLocale,
  getLocaleLabel,
  isLocale,
  localePath,
  localeTag,
  persistLocale,
  sitePath,
  siteRootPath,
  stripLocalePrefix,
  type Locale,
};
