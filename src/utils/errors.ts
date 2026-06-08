/**
 * Error handling and global error tracking
 */

import { apiCall } from './api';

const errorCache = new Set<string>();
const MAX_ERRORS_PER_MINUTE = 10;
let errorCount = 0;

export function initErrorHandlers(): void {
  // Global sync error handler
  window.onerror = (message, source, lineno, colno, error) => {
    const errorKey = `${message}:${source}:${lineno}`;
    if (errorCache.has(errorKey)) return false;
    errorCache.add(errorKey);
    setTimeout(() => errorCache.delete(errorKey), 60000);

    // Rate limiting
    errorCount++;
    if (errorCount > MAX_ERRORS_PER_MINUTE) return false;
    setTimeout(() => errorCount--, 60000);

    const stack = error?.stack || '';
    const ua = parseUA(navigator.userAgent);

    reportError({
      type: 'sync-error',
      message: String(message || 'Unknown error'),
      stack,
      url: String(source || window.location.href),
      line: lineno,
      column: colno,
      userAgent: navigator.userAgent,
      browser: ua.browser,
      os: ua.os,
      timestamp: new Date().toISOString(),
    });

    return false;
  };

  // Global unhandled rejection handler
  window.onunhandledrejection = (event) => {
    const error = event.reason || {};
    const errorKey = `${error?.message}:promise`;
    if (errorCache.has(errorKey)) return;
    errorCache.add(errorKey);
    setTimeout(() => errorCache.delete(errorKey), 60000);

    errorCount++;
    if (errorCount > MAX_ERRORS_PER_MINUTE) return;

    const ua = parseUA(navigator.userAgent);

    reportError({
      type: 'promise-rejection',
      message: String(error?.message || 'Unhandled Promise rejection'),
      stack: error?.stack || '',
      url: window.location.href,
      isPromiseRejection: true,
      userAgent: navigator.userAgent,
      browser: ua.browser,
      os: ua.os,
      timestamp: new Date().toISOString(),
    });
  };
}

export function reportError(errorData: Record<string, unknown>): void {
  apiCall('/error/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData),
  }).catch(() => {});
}

function parseUA(ua: string): { browser: string; os: string } {
  const browser = ua.includes('Firefox')
    ? 'Firefox'
    : ua.includes('Edg')
      ? 'Edge'
      : ua.includes('Chrome')
        ? 'Chrome'
        : ua.includes('Safari')
          ? 'Safari'
          : 'Unknown';

  const os = ua.includes('Windows')
    ? 'Windows'
    : ua.includes('Mac')
      ? 'macOS'
      : ua.includes('Linux')
        ? 'Linux'
        : ua.includes('Android')
          ? 'Android'
          : ua.includes('iPhone') || ua.includes('iPad')
            ? 'iOS'
            : 'Unknown';

  return { browser, os };
}
