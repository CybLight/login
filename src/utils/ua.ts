/**
 * User Agent parsing and device detection
 */

import type { ParsedUA } from '@/types';

export function parseUA(ua: string = ''): ParsedUA {
  ua = String(ua);

  // OS detection
  const isAndroid = /Android/i.test(ua);
  const isIphone = /iPhone/i.test(ua);
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  const isMac = /Mac OS X/i.test(ua);
  const isWindows = /Windows NT/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  // Browser detection
  let browser = 'Browser';
  let version = '';
  let m: RegExpMatchArray | null = null;

  if ((m = ua.match(/Firefox\/([\d.]+)/i))) {
    browser = 'Firefox';
    version = m[1];
  } else if ((m = ua.match(/Edg\/([\d.]+)/i))) {
    browser = 'Edge';
    version = m[1];
  } else if ((m = ua.match(/Chrome\/([\d.]+)/i)) && !/Edg\//i.test(ua)) {
    browser = 'Chrome';
    version = m[1];
  } else if (/Safari/i.test(ua) && !/Chrome|Edg\//i.test(ua)) {
    browser = 'Safari';
    m = ua.match(/Version\/([\d.]+)/i);
    version = m ? m[1] : '';
  }

  // OS string
  const os = isAndroid
    ? 'Android'
    : isWindows
      ? 'Windows'
      : isIphone
        ? 'iOS'
        : isIpad
          ? 'iPadOS'
          : isMac
            ? 'macOS'
            : isLinux
              ? 'Linux'
              : 'Unknown';

  // Device type
  const isTablet = isIpad || /\bTablet\b/i.test(ua) || (isAndroid && !/\bMobile\b/i.test(ua));
  const isPhone = isIphone || (isAndroid && /\bMobile\b/i.test(ua));
  const type = (isTablet ? 'tablet' : isPhone ? 'phone' : 'pc') as 'phone' | 'tablet' | 'pc';

  // Device model
  let device = '';
  let model = '';

  if (isAndroid) {
    const dm = ua.match(/Android\s[\d.]+;\s([^;]+?)\sBuild/i);
    model = dm?.[1]?.trim() || '';
    device = 'Android';
  } else if (isIphone) {
    device = 'iPhone';
    model = 'iPhone';
  } else if (isIpad) {
    device = 'iPad';
    model = 'iPad';
  } else if (isWindows) {
    device = 'PC';
  } else if (isMac) {
    device = 'Mac';
  } else if (isLinux) {
    device = 'Linux PC';
  } else {
    device = 'Device';
  }

  // App marker
  const isApp = /CybLightApp|Electron|Tauri|QtWebEngine/i.test(ua);

  return { os, browser, version, type, device, model, isApp };
}

/**
 * Get device icon SVG
 */
export function getDeviceIconSvg(uaStr: string = '', parsedUA: ParsedUA | null = null): string {
  const ua = String(uaStr || '');
  const p = parsedUA || parseUA(ua);

  const SVG_BROWSER = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16ZM1.28988 10C1.10128 9.36629 1 8.69497 1 8C1 7.30503 1.10128 6.63371 1.28988 6H4.61581C4.54025 6.64637 4.5 7.32091 4.5 8.01083C4.5 8.69356 4.53942 9.36069 4.61346 10H1.28988Z"></path></svg>`;
  const SVG_PHONE = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 0C4.17157 0 3.5 0.671573 3.5 1.5V14.5C3.5 15.3284 4.17157 16 5 16H11C11.8284 16 12.5 15.3284 12.5 14.5V1.5C12.5 0.671573 11.8284 0 11 0H5Z"></path></svg>`;
  const SVG_TABLET = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.8 2H3.2C2.62345 2 2.25117 2.00078 1.96784 2.02393C1.69617 2.04612 1.59545 2.0838 1.54601 2.10899C1.35785 2.20487 1.20487 2.35785 1.10899 2.54601Z"></path></svg>`;
  const SVG_PC = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 1C0.895431 1 0 1.89543 0 3V10C0 11.1046 0.895431 12 2 12H7V14H3.5C3.22386 14 3 14.2239 3 14.5C3 14.7761 3.22386 15 3.5 15H12.5Z"></path></svg>`;

  if (p.type === 'tablet') return SVG_TABLET;
  if (p.type === 'phone') return SVG_PHONE;
  if (p.isApp) return SVG_PC;

  return SVG_BROWSER;
}

/**
 * Get country name from ISO code
 */
const countryDN =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['ru'], { type: 'region' })
    : null;

export function getCountryName(code: string): string {
  const c = String(code || '')
    .trim()
    .toUpperCase();
  if (!c) return '';
  if (!countryDN) return c;
  try {
    return countryDN.of(c) || c;
  } catch {
    return c;
  }
}
