import { getLocale, localeTag } from '../../i18n/locale';

export interface ParsedUA {
  os: string;
  browser: string;
  version: string;
  type: 'tablet' | 'phone' | 'pc';
  device: string;
  model: string;
  isApp: boolean;
}

export function parseUA(ua: string = ''): ParsedUA {
  ua = String(ua);

  const isAndroid = /Android/i.test(ua);
  const isIphone = /iPhone/i.test(ua);
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  const isMac = /Mac OS X/i.test(ua);
  const isWindows = /Windows NT/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

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

  let os = 'Unknown';
  if (isAndroid) {
    os = 'Android';
  } else if (isWindows) {
    const ntMatch = ua.match(/Windows NT ([\d.]+)/i);
    if (ntMatch) {
      const ntVersion = ntMatch[1];
      if (ntVersion === '5.1') os = 'Windows XP';
      else if (ntVersion === '6.0') os = 'Windows Vista';
      else if (ntVersion === '6.1') os = 'Windows 7';
      else if (ntVersion === '6.2') os = 'Windows 8';
      else if (ntVersion === '6.3') os = 'Windows 8.1';
      else if (ntVersion === '10.0') os = 'Windows 10/11';
      else os = 'Windows';
    } else {
      os = 'Windows';
    }
  } else if (isIphone) {
    os = 'iOS';
  } else if (isIpad) {
    os = 'iPadOS';
  } else if (isMac) {
    os = 'macOS';
  } else if (isLinux) {
    os = 'Linux';
  }

  const isTablet = isIpad || /\bTablet\b/i.test(ua) || (isAndroid && !/\bMobile\b/i.test(ua));
  const isPhone = isIphone || (isAndroid && /\bMobile\b/i.test(ua));
  const type = isTablet ? 'tablet' : isPhone ? 'phone' : 'pc';

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

  const isApp = /CybLightApp|Electron|Tauri|QtWebEngine/i.test(ua);

  return { os, browser, version, type, device, model, isApp };
}

export function getDeviceIconSvg(uaStr: string = '', parsedUA: ParsedUA | null = null): string {
  const ua = String(uaStr || '');
  const p = parsedUA || parseUA(ua);

  const SVG_BROWSER = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16ZM1.28988 10C1.10128 9.36629 1 8.69497 1 8C1 7.30503 1.10128 6.63371 1.28988 6H4.61581C4.54025 6.64637 4.5 7.32091 4.5 8.01083C4.5 8.69356 4.53942 9.36069 4.61346 10H1.28988ZM1.67363 11C2.53757 12.8186 4.16259 14.2056 6.1371 14.7494C5.52427 13.8539 5.03958 12.5375 4.76124 11H1.67363ZM5.77869 11C5.94208 11.84 6.16995 12.5937 6.44244 13.2215C6.72732 13.8778 7.04109 14.3506 7.33958 14.6448C7.63459 14.9355 7.85672 15 8 15C8.14328 15 8.36541 14.9355 8.66042 14.6448C8.95891 14.3506 9.27268 13.8778 9.55756 13.2215C9.83005 12.5937 10.0579 11.84 10.2213 11H5.77869ZM11.2388 11C10.9604 12.5375 10.4757 13.8539 9.8629 14.7494C11.8374 14.2056 13.4624 12.8186 14.3264 11H11.2388ZM14.7101 10H11.3865C11.4606 9.36069 11.5 8.69356 11.5 8.01083C11.5 7.32091 11.4597 6.64637 11.3842 6H14.7101C14.8987 6.63371 15 7.30503 15 8C15 8.69497 14.8987 9.36629 14.7101 10ZM10.3794 10H5.62057C5.54249 9.36746 5.5 8.69981 5.5 8.01083C5.5 7.31464 5.54338 6.63956 5.62305 6H10.377C10.4566 6.63956 10.5 7.31464 10.5 8.01083C10.5 8.69981 10.4575 9.36746 10.3794 10ZM4.76458 5H1.67363C2.53833 3.17977 4.16546 1.79192 6.14233 1.24917C5.52948 2.14527 5.04424 3.46279 4.76458 5ZM6.44298 2.78808C6.17214 3.41438 5.94541 4.16484 5.7822 5H10.2178C10.0546 4.16484 9.82786 3.41438 9.55702 2.78808C9.27186 2.12866 8.95768 1.65299 8.65867 1.35686C8.36292 1.06395 8.14128 1 8 1C7.85872 1 7.63708 1.06395 7.34133 1.35686C7.04232 1.65299 6.72814 2.12866 6.44298 2.78808ZM11.2354 5H14.3264C13.4617 3.17977 11.8345 1.79192 9.85767 1.24917C10.4705 2.14527 10.9558 3.46279 11.2354 5Z"></path></svg>`;

  const SVG_PHONE = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 0C4.17157 0 3.5 0.671573 3.5 1.5V14.5C3.5 15.3284 4.17157 16 5 16H11C11.8284 16 12.5 15.3284 12.5 14.5V1.5C12.5 0.671573 11.8284 0 11 0H5ZM4.5 1.5C4.5 1.22386 4.72386 1 5 1H6C6 1.27614 6.22386 1.5 6.5 1.5H9.5C9.77614 1.5 10 1.27614 10 1H11C11.2761 1 11.5 1.22386 11.5 1.5V14.5C11.5 14.7761 11.2761 15 11 15H5C4.72386 15 4.5 14.7761 4.5 14.5V1.5Z"></path></svg>`;

  const SVG_TABLET = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.8 2H3.2C2.62345 2 2.25117 2.00078 1.96784 2.02393C1.69617 2.04612 1.59545 2.0838 1.54601 2.10899C1.35785 2.20487 1.20487 2.35785 1.10899 2.54601C1.0838 2.59545 1.04612 2.69617 1.02393 2.96784C1.00078 3.25117 1 3.62345 1 4.2V10.8C1 11.3766 1.00078 11.7488 1.02393 12.0322C1.04612 12.3038 1.0838 12.4045 1.10899 12.454C1.20487 12.6422 1.35785 12.7951 1.54601 12.891C1.59545 12.9162 1.69617 12.9539 1.96784 12.9761C2.25117 12.9992 2.62345 13 3.2 13H5.77192C6.04806 13 6.27192 13.2239 6.27192 13.5C6.27192 13.7761 6.04806 14 5.77192 14H3.2C2.0799 14 1.51984 14 1.09202 13.782C0.715695 13.5903 0.409734 13.2843 0.217987 12.908C0 12.4802 0 11.9201 0 10.8V4.2C0 3.0799 0 2.51984 0.217987 2.09202C0.409734 1.71569 0.715695 1.40973 1.09202 1.21799C1.51984 1 2.0799 1 3.2 1H12.8C13.9201 1 14.4802 1 14.908 1.21799C15.2843 1.40973 15.5903 1.71569 15.782 2.09202C16 2.51984 16 3.0799 16 4.2V10.5C16 10.7761 15.7761 11 15.5 11C15.2239 11 15 10.7761 15 10.5V4.2C15 3.62345 14.9992 3.25117 14.9761 2.96784C14.9539 2.69617 14.9162 2.59545 14.891 2.54601C14.7951 2.35785 14.6422 2.20487 14.454 2.10899C14.4045 2.0838 14.3038 2.04612 14.0322 2.02393C13.7488 2.00078 13.3766 2 12.8 2Z"></path><path d="M9.97256 12C9.66207 12 9.35584 12.0723 9.07813 12.2111L7.50042 13C7.0884 13.206 7.0884 13.794 7.50042 14L9.07813 14.7889C9.35584 14.9277 9.66207 15 9.97256 15H15.0004C15.5527 15 16.0004 14.5523 16.0004 14V13C16.0004 12.4477 15.5527 12 15.0004 12H9.97256Z"></path></svg>`;

  const SVG_PC = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 1C0.895431 1 0 1.89543 0 3V10C0 11.1046 0.895431 12 2 12H7V14H3.5C3.22386 14 3 14.2239 3 14.5C3 14.7761 3.22386 15 3.5 15H12.5C12.7761 15 13 14.7761 13 14.5C13 14.2239 12.7761 14 12.5 14H9V12H14C15.1046 12 16 11.1046 16 10V3C16 1.89543 15.1046 1 14 1H2ZM14 2H2C1.44772 2 1 2.44772 1 3V10C1 10.5523 1.44772 11 2 11H14C14.5523 11 15 10.5523 15 10V3C15 2.44772 14.5523 2 14 2Z"></path></svg>`;

  const isDesktopApp = /Electron|CybLightApp|CybLightDesktop/i.test(ua) || p.isApp;

  if (p.type === 'tablet') return SVG_TABLET;
  if (p.type === 'phone') return SVG_PHONE;
  if (isDesktopApp) return SVG_PC;

  return SVG_BROWSER;
}

const countryDN =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['ru'], { type: 'region' })
    : null;

export function countryFull(code: string | null | undefined): string | null {
  const c = String(code || '')
    .trim()
    .toUpperCase();
  if (!c) return null;
  if (!countryDN) return c;
  try {
    return countryDN.of(c) || c;
  } catch {
    return c;
  }
}

export function fmtTs(ms: number | string | null | undefined): string {
  if (!ms) return '—';
  const n = typeof ms === 'string' ? parseInt(ms) : Number(ms);
  if (!Number.isFinite(n)) return '—';

  const timestamp = n > 10000000000 ? n : n * 1000;

  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString(localeTag(getLocale()), {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
