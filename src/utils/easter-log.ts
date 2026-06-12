import { Router } from '@/router/Router';

const LOG_URL = 'https://cyblight.org/e-log';

export interface EasterLogPayload {
  type: string;
  userName: string;
  source?: string;
  route?: string;
  page?: string;
  alex?: number;
  [key: string]: unknown;
}

export function sendEasterLog(payload: EasterLogPayload): void {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  fetch(LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: window.location.href,
      timezone: tz,
      route: Router.getRoute(),
      ua: navigator.userAgent,
      referrer: document.referrer || null,
      ...payload,
    }),
  }).catch(() => {});
}

export function maybeLogBridgeEaster(
  userName: string,
  hadBridge: boolean,
  hasBridge: boolean
): void {
  if (!hadBridge && hasBridge) {
    sendEasterLog({
      type: 'bridge',
      userName,
      source: 'web_app_same_day',
      alex: 9,
    });
  }
}
