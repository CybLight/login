// @ts-nocheck
const app = document.getElementById('app');
const API_BASE = 'https://api.cyblight.org';

const EASTER_KEY = 'cyb_strawberry_unlocked';
const DARK_TRIGGER_KEY = 'cyb_dark_trigger_unlocked';
const HISTORY_FROM_KEY = 'cyb_history_from'; // откуда открыли стенографию

// Глобальный обработчик синхронных ошибок
const errorCache = new Set();
const MAX_ERRORS_PER_MINUTE = 10;
let errorCount = 0;

window.onerror = (message, source, lineno, colno, error) => {
  // защита от дублей
  const errorKey = `${message}:${source}:${lineno}`;
  if (errorCache.has(errorKey)) return false;
  errorCache.add(errorKey);
  setTimeout(() => errorCache.delete(errorKey), 60000);

  // рейт-лимит
  errorCount++;
  if (errorCount > MAX_ERRORS_PER_MINUTE) return false;
  setTimeout(() => errorCount--, 60000);

  const stack = error?.stack || '';
  const ua = parseUA(navigator.userAgent);

  apiCall('/error/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'sync-error',
      message: String(message || 'Unknown error'),
      stack: stack,
      url: String(source || window.location.href),
      line: lineno,
      column: colno,
      userAgent: navigator.userAgent,
      browser: ua.browser,
      os: ua.os,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {});

  return false;
};

// Глобальный обработчик для незахваченных Promise
window.onunhandledrejection = (event) => {
  const error = event.reason || {};
  const errorKey = `${error?.message}:promise`;
  if (errorCache.has(errorKey)) return;
  errorCache.add(errorKey);
  setTimeout(() => errorCache.delete(errorKey), 60000);

  errorCount++;
  if (errorCount > MAX_ERRORS_PER_MINUTE) return;

  const ua = parseUA(navigator.userAgent);

  apiCall('/error/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'promise-rejection',
      message: String(error?.message || 'Unhandled Promise rejection'),
      stack: error?.stack || '',
      url: window.location.href,
      isPromiseRejection: true,
      userAgent: navigator.userAgent,
      browser: ua.browser,
      os: ua.os,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {});
};

// Простой логгер
const logger = {
  log: (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      url: window.location.href,
      ...data,
    };

    // в продакшене отправляй на сервер
    if (level === 'error' || level === 'warn') {
      // Отправить на endpoint логирования
      apiCall('/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
      }).catch(() => {});
    }

    console[level](`[${level.toUpperCase()}] ${message}`, data);
  },
};

// Использование:
// logger.log('error', 'Failed to fetch user', { endpoint: '/auth/me' });
// logger.log('info', 'User logged in', { username: 'john' });

// Безопасное сохранение с проверкой
function setStorage(key, value, storage = localStorage) {
  try {
    storage.setItem(key, String(value));
    return true;
  } catch (error) {
    // localStorage может быть заполнена или отключена
    console.warn(`Storage error [${key}]:`, error);
    return false;
  }
}

function getStorage(key, defaultValue = null, storage = localStorage) {
  try {
    return storage.getItem(key) ?? defaultValue;
  } catch (error) {
    console.warn(`Storage error [${key}]:`, error);
    return defaultValue;
  }
}

// Простой кэш для API ответов
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

async function cachedApiCall(endpoint, options = {}, cacheKey = endpoint) {
  // проверка кэша
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const response = await apiCall(endpoint, options);

  // сохранение в кэш
  if (response.ok) {
    apiCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });
  }

  return response;
}

// Использование:
// const user = await cachedApiCall('/auth/me');

function hasStrawberryAccess() {
  return getStorage(EASTER_KEY) === '1';
}

function hasDarkTriggerAccess() {
  return getStorage(DARK_TRIGGER_KEY) === '1';
}

function setStrawberryAccess() {
  setStorage(EASTER_KEY, '1');
}

function setDarkTriggerAccess() {
  setStorage(DARK_TRIGGER_KEY, '1');
}

/**
 * Очистка auth cookie (для logout или перед новым логином)
 */
function clearAuthCookie() {
  // Получаем домен из текущего URL
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // Для cyblight.org и поддоменов
  const domain = parts.length >= 2 ? `.${parts.slice(-2).join('.')}` : hostname;

  // Очищаем cookie для текущего домена и родительского
  const cookiesToClear = [
    `cyb_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `cyb_auth=; Path=/; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `cyb_auth=; Path=/; Domain=${hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];

  cookiesToClear.forEach((cookie) => {
    document.cookie = cookie;
  });

  console.log('Auth cookie cleared');
}

function setNoStrawberries(on) {
  document.body.classList.toggle('no-strawberries', !!on);
}

/**
 * Показать уведомление в верхней части страницы
 * @param {string} type - Тип уведомления: 'success', 'error', 'warn', 'info'
 * @param {string} message - Текст сообщения
 * @param {number} duration - Длительность показа в мс (по умолчанию 5000)
 */
function showTopNotification(type = 'info', message = '', duration = 5000) {
  // Удаляем предыдущие уведомления
  const existing = document.querySelectorAll('.top-notification');
  existing.forEach((el) => el.remove());

  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `top-notification top-notification--${type}`;
  notification.innerHTML = `
    <div class="top-notification__content">
      <span class="top-notification__icon">${getNotificationIcon(type)}</span>
      <span class="top-notification__message">${message}</span>
    </div>
  `;

  // Добавляем на страницу
  document.body.appendChild(notification);

  // Автоматически удаляем через указанное время
  setTimeout(() => {
    notification.style.animation = 'slideDown 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

/**
 * Получить иконку для типа уведомления
 */
function getNotificationIcon(type) {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warn':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
}

function parseUA(ua = '') {
  ua = String(ua);

  const isAndroid = /Android/i.test(ua);
  const isIphone = /iPhone/i.test(ua);
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  const isMac = /Mac OS X/i.test(ua);
  const isWindows = /Windows NT/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  // browser
  let browser = 'Browser';
  let version = '';
  let m = null;

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

  // os
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

  // device type
  const isTablet = isIpad || /\bTablet\b/i.test(ua) || (isAndroid && !/\bMobile\b/i.test(ua));
  const isPhone = isIphone || (isAndroid && /\bMobile\b/i.test(ua));
  const type = isTablet ? 'tablet' : isPhone ? 'phone' : 'pc';

  // device/model
  let device = '';
  let model = '';

  if (isAndroid) {
    // Android 14; Pixel 7 Build/...
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

  // app marker (если появится)
  const isApp = /CybLightApp|Electron|Tauri|QtWebEngine/i.test(ua);

  return { os, browser, version, type, device, model, isApp };
}

function getDeviceIconSvg(uaStr = '', parsedUA = null) {
  const ua = String(uaStr || '');
  const p = parsedUA || parseUA(ua);

  // ==== SVGs ====
  const SVG_BROWSER = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16ZM1.28988 10C1.10128 9.36629 1 8.69497 1 8C1 7.30503 1.10128 6.63371 1.28988 6H4.61581C4.54025 6.64637 4.5 7.32091 4.5 8.01083C4.5 8.69356 4.53942 9.36069 4.61346 10H1.28988ZM1.67363 11C2.53757 12.8186 4.16259 14.2056 6.1371 14.7494C5.52427 13.8539 5.03958 12.5375 4.76124 11H1.67363ZM5.77869 11C5.94208 11.84 6.16995 12.5937 6.44244 13.2215C6.72732 13.8778 7.04109 14.3506 7.33958 14.6448C7.63459 14.9355 7.85672 15 8 15C8.14328 15 8.36541 14.9355 8.66042 14.6448C8.95891 14.3506 9.27268 13.8778 9.55756 13.2215C9.83005 12.5937 10.0579 11.84 10.2213 11H5.77869ZM11.2388 11C10.9604 12.5375 10.4757 13.8539 9.8629 14.7494C11.8374 14.2056 13.4624 12.8186 14.3264 11H11.2388ZM14.7101 10H11.3865C11.4606 9.36069 11.5 8.69356 11.5 8.01083C11.5 7.32091 11.4597 6.64637 11.3842 6H14.7101C14.8987 6.63371 15 7.30503 15 8C15 8.69497 14.8987 9.36629 14.7101 10ZM10.3794 10H5.62057C5.54249 9.36746 5.5 8.69981 5.5 8.01083C5.5 7.31464 5.54338 6.63956 5.62305 6H10.377C10.4566 6.63956 10.5 7.31464 10.5 8.01083C10.5 8.69981 10.4575 9.36746 10.3794 10ZM4.76458 5H1.67363C2.53833 3.17977 4.16546 1.79192 6.14233 1.24917C5.52948 2.14527 5.04424 3.46279 4.76458 5ZM6.44298 2.78808C6.17214 3.41438 5.94541 4.16484 5.7822 5H10.2178C10.0546 4.16484 9.82786 3.41438 9.55702 2.78808C9.27186 2.12866 8.95768 1.65299 8.65867 1.35686C8.36292 1.06395 8.14128 1 8 1C7.85872 1 7.63708 1.06395 7.34133 1.35686C7.04232 1.65299 6.72814 2.12866 6.44298 2.78808ZM11.2354 5H14.3264C13.4617 3.17977 11.8345 1.79192 9.85767 1.24917C10.4705 2.14527 10.9558 3.46279 11.2354 5Z"></path></svg>`;

  const SVG_PHONE = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 0C4.17157 0 3.5 0.671573 3.5 1.5V14.5C3.5 15.3284 4.17157 16 5 16H11C11.8284 16 12.5 15.3284 12.5 14.5V1.5C12.5 0.671573 11.8284 0 11 0H5ZM4.5 1.5C4.5 1.22386 4.72386 1 5 1H6C6 1.27614 6.22386 1.5 6.5 1.5H9.5C9.77614 1.5 10 1.27614 10 1H11C11.2761 1 11.5 1.22386 11.5 1.5V14.5C11.5 14.7761 11.2761 15 11 15H5C4.72386 15 4.5 14.7761 4.5 14.5V1.5Z"></path></svg>`;

  const SVG_TABLET = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.8 2H3.2C2.62345 2 2.25117 2.00078 1.96784 2.02393C1.69617 2.04612 1.59545 2.0838 1.54601 2.10899C1.35785 2.20487 1.20487 2.35785 1.10899 2.54601C1.0838 2.59545 1.04612 2.69617 1.02393 2.96784C1.00078 3.25117 1 3.62345 1 4.2V10.8C1 11.3766 1.00078 11.7488 1.02393 12.0322C1.04612 12.3038 1.0838 12.4045 1.10899 12.454C1.20487 12.6422 1.35785 12.7951 1.54601 12.891C1.59545 12.9162 1.69617 12.9539 1.96784 12.9761C2.25117 12.9992 2.62345 13 3.2 13H5.77192C6.04806 13 6.27192 13.2239 6.27192 13.5C6.27192 13.7761 6.04806 14 5.77192 14H3.2C2.0799 14 1.51984 14 1.09202 13.782C0.715695 13.5903 0.409734 13.2843 0.217987 12.908C0 12.4802 0 11.9201 0 10.8V4.2C0 3.0799 0 2.51984 0.217987 2.09202C0.409734 1.71569 0.715695 1.40973 1.09202 1.21799C1.51984 1 2.0799 1 3.2 1H12.8C13.9201 1 14.4802 1 14.908 1.21799C15.2843 1.40973 15.5903 1.71569 15.782 2.09202C16 2.51984 16 3.0799 16 4.2V10.5C16 10.7761 15.7761 11 15.5 11C15.2239 11 15 10.7761 15 10.5V4.2C15 3.62345 14.9992 3.25117 14.9761 2.96784C14.9539 2.69617 14.9162 2.59545 14.891 2.54601C14.7951 2.35785 14.6422 2.20487 14.454 2.10899C14.4045 2.0838 14.3038 2.04612 14.0322 2.02393C13.7488 2.00078 13.3766 2 12.8 2Z"></path><path d="M9.97256 12C9.66207 12 9.35584 12.0723 9.07813 12.2111L7.50042 13C7.0884 13.206 7.0884 13.794 7.50042 14L9.07813 14.7889C9.35584 14.9277 9.66207 15 9.97256 15H15.0004C15.5527 15 16.0004 14.5523 16.0004 14V13C16.0004 12.4477 15.5527 12 15.0004 12H9.97256Z"></path></svg>`;

  const SVG_PC = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 1C0.895431 1 0 1.89543 0 3V10C0 11.1046 0.895431 12 2 12H7V14H3.5C3.22386 14 3 14.2239 3 14.5C3 14.7761 3.22386 15 3.5 15H12.5C12.7761 15 13 14.7761 13 14.5C13 14.2239 12.7761 14 12.5 14H9V12H14C15.1046 12 16 11.1046 16 10V3C16 1.89543 15.1046 1 14 1H2ZM14 2H2C1.44772 2 1 2.44772 1 3V10C1 10.5523 1.44772 11 2 11H14C14.5523 11 15 10.5523 15 10V3C15 2.44772 14.5523 2 14 2Z"></path></svg>`;

  // ==== detection ====
  const isTablet =
    /iPad/i.test(ua) ||
    /\bTablet\b/i.test(ua) ||
    (/\bAndroid\b/i.test(ua) && !/\bMobile\b/i.test(ua)); // грубо, но работает

  const isPhone = /\biPhone\b/i.test(ua) || (/\bAndroid\b/i.test(ua) && /\bMobile\b/i.test(ua));

  // "ПК из приложения" — если когда-то добавишь свой UA для приложения, сюда добавишь маркер
  const isDesktopApp = /Electron|CybLightApp|CybLightDesktop/i.test(ua) || p.isApp;

  if (p.type === 'tablet') return SVG_TABLET;
  if (p.type === 'phone') return SVG_PHONE;
  if (isDesktopApp) return SVG_PC;

  // по умолчанию — браузер (глобус)
  return SVG_BROWSER;
}

const countryDN =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['ru'], { type: 'region' })
    : null;

function countryFull(code) {
  const c = String(code || '')
    .trim()
    .toUpperCase();
  if (!c) return null;
  if (!countryDN) return c; // fallback: оставляем "UA"
  try {
    return countryDN.of(c) || c;
  } catch {
    return c;
  }
}

// ===== Turnstile =====
let turnstileToken = '';
let turnstileWidgetId = null;

window.onTurnstileOk = (token) => {
  turnstileToken = token;
};

window.onTurnstileExpired = () => {
  turnstileToken = '';
  alert('Turnstile истёк. Пожалуйста, обновите страницу.');
};

window.onTurnstileError = () => {
  turnstileToken = '';
  alert(
    'Ошибка Turnstile. Возможно, открыта панель разработчика или включён режим приватности. Попробуйте закрыть DevTools или использовать другой браузер.'
  );
};

let tsTry = 0;

function initTurnstile() {
  const el = document.querySelector('.cf-turnstile');
  if (!el) {
    tsTry = 0;
    return;
  }

  // ждём загрузки turnstile (с лимитом попыток)
  if (!window.turnstile) {
    if (++tsTry > 80) {
      console.warn('Turnstile not loaded');
      return;
    }
    setTimeout(initTurnstile, 150);
    return;
  }

  tsTry = 0;

  // если уже был виджет — убираем
  if (turnstileWidgetId !== null) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch {}
    turnstileWidgetId = null;
  }

  // чистим контейнер (убирает следы прошлого iframe)
  el.innerHTML = '';

  turnstileWidgetId = window.turnstile.render(el, {
    sitekey: '0x4AAAAAACIMk1fcGPcs3NLf',
    theme: document.body.classList.contains('light') ? 'light' : 'dark',
    callback: window.onTurnstileOk,
    'expired-callback': window.onTurnstileExpired,
    'error-callback': window.onTurnstileError,
  });

  turnstileToken = '';
}

async function checkSession() {
  try {
    console.log('checkSession: checking cookies before request:', document.cookie);
    const res = await apiCall('/auth/me', {
      method: 'GET',
      credentials: 'include', // ✅ обязательно
    });
    console.log('checkSession response:', { ok: res.ok, status: res.status });
    const data = await res.json().catch(() => null);
    console.log('checkSession data:', data);
    return !!(res.ok && data?.ok);
  } catch (e) {
    console.error('checkSession error:', e);
    return false;
  }
}

// Обновленный apiCall с timeout
async function apiCall(endpoint, options = {}, timeoutMs = 10000) {
  // Проверка интернет-соединения
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.warn('apiCall: Navigator is offline');
    const errorResponse = {
      ok: false,
      status: 0,
      statusText: 'No internet connection',
      json: async () => ({ error: 'Нет подключения к интернету. Проверьте соединение.' }),
      text: async () => '',
      headers: new Headers(),
    };
    return errorResponse;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    console.log('apiCall:', options.method || 'GET', url);

    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('apiCall response:', { url, ok: response.ok, status: response.status });

    // Проверяем Set-Cookie header (только для логирования, браузер сам обрабатывает)
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      console.log('Set-Cookie header:', setCookie);
    } else {
      console.log('No Set-Cookie header in response');
    }

    // Выводим все заголовки ответа для диагностики
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Автоматический редирект на 401 только для защищенных страниц
    // НЕ редиректим если это checkSession или сам login/register
    // Также не редиректим для истории и устройств - они сами обрабатывают ошибки
    if (
      response.status === 401 &&
      !endpoint.includes('/auth/me') &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/register') &&
      !endpoint.includes('/auth/login-history') &&
      !endpoint.includes('/auth/trusted-devices')
    ) {
      console.log('401 detected, redirecting to username');
      CybRouter.navigate('username');
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Определяем тип ошибки и создаём понятное сообщение
    let errorMessage = 'Ошибка сети';

    if (error.name === 'AbortError') {
      errorMessage = 'Превышено время ожидания. Сервер не отвечает.';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Не удалось подключиться к серверу. Проверьте интернет.';
    } else if (error.message.includes('NetworkError')) {
      errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
    } else {
      errorMessage = error.message || 'Неизвестная ошибка сети';
    }

    // Создаём mock Response для ошибок сети
    const errorResponse = {
      ok: false,
      status: 0,
      statusText: error.name === 'AbortError' ? 'Request timeout' : error.message,
      json: async () => ({ error: errorMessage }),
      text: async () => '',
      headers: new Headers(),
    };

    return errorResponse;
  }
}

// 🍓 Lightbox

const StrawberryLightbox = (() => {
  let lb, imgEl, closeBtn, prevBtn, nextBtn, counterEl, captionEl, hudEl, stageEl;
  let sources = [];
  let captions = [];
  let index = 0;

  // swipe
  let touchStartX = 0,
    touchStartY = 0;
  let touchActive = false;

  // pinch-zoom / pan
  let baseScale = 1; // сохранённый scale после жеста
  let scale = 1; // текущий

  let baseTx = 0;
  let baseTy = 0;

  let tx = 0;
  let ty = 0;

  let isPinching = false;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  let isPanning = false;
  let panStartX = 0,
    panStartY = 0;
  let panStartTx = 0,
    panStartTy = 0;

  function ensure() {
    lb = document.querySelector('.strawberry-lightbox');
    if (lb) {
      imgEl = lb.querySelector('.strawberry-lightbox__img');
      closeBtn = lb.querySelector('.strawberry-lightbox__close');
      prevBtn = lb.querySelector('.strawberry-lightbox__nav.prev');
      nextBtn = lb.querySelector('.strawberry-lightbox__nav.next');
      counterEl = lb.querySelector('.strawberry-lightbox__counter');
      captionEl = lb.querySelector('.strawberry-lightbox__caption');
      hudEl = lb.querySelector('.strawberry-lightbox__hud');
      stageEl = lb.querySelector('.strawberry-lightbox__stage');
      return lb;
    }
    lb = document.createElement('div');
    lb.className = 'strawberry-lightbox';
    lb.innerHTML = `
      <div class="strawberry-lightbox__hud">
        <div class="strawberry-lightbox__counter">1 / 1</div>
      </div>

      <button class="strawberry-lightbox__close" type="button" aria-label="Закрыть">✕</button>
      <button class="strawberry-lightbox__nav prev" type="button" aria-label="Предыдущее">←</button>
      
      <div class="strawberry-lightbox__stage">
      <img class="strawberry-lightbox__img" alt="strawberry photo" draggable="false" />
      </div>

      <button class="strawberry-lightbox__nav next" type="button" aria-label="Следующее">→</button>
      <div class="strawberry-lightbox__caption"></div>
    `;
    document.body.appendChild(lb);

    imgEl = lb.querySelector('.strawberry-lightbox__img');
    closeBtn = lb.querySelector('.strawberry-lightbox__close');
    prevBtn = lb.querySelector('.strawberry-lightbox__nav.prev');
    nextBtn = lb.querySelector('.strawberry-lightbox__nav.next');
    counterEl = lb.querySelector('.strawberry-lightbox__counter');
    captionEl = lb.querySelector('.strawberry-lightbox__caption');
    hudEl = lb.querySelector('.strawberry-lightbox__hud');
    stageEl = lb.querySelector('.strawberry-lightbox__stage');

    // закрытие по крестику
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    // закрытие по клику на фон
    lb.addEventListener('click', (e) => {
      if (e.target === lb) close();
    });

    // keyboard
    window.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    // --- touch gestures (swipe + pinch) ---
    // используем imgEl, чтобы не ломать прокрутку страницы
    imgEl.addEventListener('touchstart', onTouchStart, { passive: false });
    imgEl.addEventListener('touchmove', onTouchMove, { passive: false });
    imgEl.addEventListener('touchend', onTouchEnd, { passive: false });

    // mouse pan (for PC)
    imgEl.addEventListener('mousedown', onMouseDown);

    return lb;
  }

  function setItems(list, startIndex = 0) {
    sources = Array.isArray(list?.sources) ? list.sources : [];
    captions = Array.isArray(list?.captions) ? list.captions : [];
    index = Math.max(0, Math.min(startIndex, sources.length - 1));
  }

  function preloadOne(src) {
    if (!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;
  }
  function preloadNeighbors() {
    preloadOne(sources[index - 1]);
    preloadOne(sources[index + 1]);
  }

  function updateHud() {
    if (counterEl) counterEl.textContent = `${index + 1} / ${sources.length || 1}`;
    if (captionEl) captionEl.textContent = captions[index] || '';
  }

  function resetTransform() {
    baseScale = scale = 1;
    baseTx = tx = 0;
    baseTy = ty = 0;
    applyTransform();
    lb?.classList.remove('is-zoomed');
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function applyTransform() {
    if (!imgEl) return;
    // ограничим масштаб
    scale = clamp(scale, 1, 3.2);

    // если scale == 1 — сбрасываем сдвиги
    if (scale <= 1.001) {
      scale = baseScale = 1;
      tx = baseTx = 0;
      ty = baseTy = 0;
      lb?.classList.remove('is-zoomed');
    } else {
      lb?.classList.add('is-zoomed');
    }

    imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function showAt(i) {
    if (!sources.length) return;
    index = (i + sources.length) % sources.length;

    ensure();
    imgEl.classList.remove('is-ready');
    resetTransform(); // при смене фото сбрасываем zoom/pan

    const src = sources[index];
    updateHud();

    const tmp = new Image();
    tmp.decoding = 'async';
    tmp.src = src;

    const apply = () => {
      imgEl.src = src;
      requestAnimationFrame(() => imgEl.classList.add('is-ready'));
      preloadNeighbors();
    };

    if (tmp.decode) tmp.decode().then(apply).catch(apply);
    else {
      tmp.onload = apply;
      tmp.onerror = apply;
    }
  }

  function open(items, startIndex) {
    ensure();
    setItems(items, startIndex);
    lb.classList.add('is-open');
    showAt(index);
  }

  function close() {
    if (!lb) return;
    lb.classList.remove('is-open');
    if (imgEl) {
      imgEl.classList.remove('is-ready');
      setTimeout(() => {
        imgEl.src = '';
      }, 80);
    }
    resetTransform();
  }

  function prev() {
    if (!lb || !lb.classList.contains('is-open')) return;
    showAt(index - 1);
  }
  function next() {
    if (!lb || !lb.classList.contains('is-open')) return;
    showAt(index + 1);
  }

  // ---- Touch: swipe + pinch ----
  function dist2(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }

  function onTouchStart(e) {
    if (!lb?.classList.contains('is-open')) return;

    if (e.touches.length === 2) {
      // pinch start
      isPinching = true;
      isPanning = false;
      pinchStartDist = dist2(e.touches[0], e.touches[1]);
      pinchStartScale = baseScale; // ✅ стартуем от сохранённого масштаба
      panStartTx = baseTx;
      panStartTy = baseTy;
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchActive = true;

      // если уже зумнули — начинаем pan
      if (baseScale > 1.01) {
        isPanning = true;
        panStartX = t.clientX;
        panStartY = t.clientY;
        panStartTx = baseTx;
        panStartTy = baseTy;
        e.preventDefault();
      }
    }
  }

  function onTouchMove(e) {
    if (!lb?.classList.contains('is-open')) return;

    if (isPinching && e.touches.length === 2) {
      const d = dist2(e.touches[0], e.touches[1]);
      const ratio = d / (pinchStartDist || d);
      scale = pinchStartScale * ratio;
      applyTransform();
      e.preventDefault();
      return;
    }

    if (isPanning && e.touches.length === 1 && baseScale > 1.01) {
      const t = e.touches[0];
      tx = panStartTx + (t.clientX - panStartX);
      ty = panStartTy + (t.clientY - panStartY);
      applyTransform();
      e.preventDefault();
      return;
    }
  }

  function onTouchEnd(e) {
    if (!lb?.classList.contains('is-open')) return;

    // pinch end
    if (isPinching && e.touches.length < 2) {
      isPinching = false;
      baseScale = scale;
      baseTx = tx;
      baseTy = ty;
      applyTransform();

      // ✅ если остался 1 палец — сразу начинаем pan
      if (e.touches.length === 1 && baseScale > 1.01) {
        const t = e.touches[0];
        isPanning = true;
        panStartX = t.clientX;
        panStartY = t.clientY;
        panStartTx = baseTx;
        panStartTy = baseTy;
      }

      return;
    }

    // pan end
    if (isPanning && e.touches.length === 0) {
      isPanning = false;
      baseTx = tx;
      baseTy = ty;
      applyTransform();
      return;
    }

    // swipe logic (только если не зумим)
    if (touchActive && scale <= 1.01) {
      touchActive = false;

      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;

      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > 55 && absX > absY) {
        if (dx < 0) next();
        else prev();
        return;
      }

      if (dy > 70 && absY > absX) {
        close();
      }
    }
  }

  // ---- Mouse pan (desktop) ----
  function onMouseDown(e) {
    if (!lb?.classList.contains('is-open')) return;
    if (scale <= 1.01) return;

    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartTx = baseTx;
    panStartTy = baseTy;

    const onMove = (ev) => {
      if (!isPanning) return;
      tx = panStartTx + (ev.clientX - panStartX);
      ty = panStartTy + (ev.clientY - panStartY);
      applyTransform();
    };

    const onUp = () => {
      isPanning = false;
      baseTx = tx;
      baseTy = ty;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return { open };
})();

// Debounce хелпер
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Пример: поиск пользователя с debounce
const searchUser = debounce(async (query) => {
  const result = await apiCall(`/search/users?q=${query}`);
  // обновить результаты
}, 300);

// Использование в input:
// searchInput.addEventListener('input', (e) => searchUser(e.target.value));

// Валидаторы
const validators = {
  email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  password: (pass) => pass && pass.length >= 8,

  username: (user) => /^[a-zA-Z0-9_]{3,20}$/.test(user),

  url: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
};

// Использование в формах:
// if (!validators.email(emailInput.value)) {
//   showError('Неверный формат email');
//   return;
// }

// Стандартные аватары
const AVAILABLE_AVATARS = [
  { id: 'avatar-cat', emoji: '🐱', name: 'Кот' },
  { id: 'avatar-dog', emoji: '🐶', name: 'Собака' },
  { id: 'avatar-fox', emoji: '🦊', name: 'Лиса' },
  { id: 'avatar-bear', emoji: '🐻', name: 'Медведь' },
  { id: 'avatar-panda', emoji: '🐼', name: 'Панда' },
  { id: 'avatar-rabbit', emoji: '🐰', name: 'Кролик' },
  { id: 'avatar-owl', emoji: '🦉', name: 'Сова' },
  { id: 'avatar-penguin', emoji: '🐧', name: 'Пингвин' },
  { id: 'avatar-koala', emoji: '🐨', name: 'Коала' },
  { id: 'avatar-tiger', emoji: '🐯', name: 'Тигр' },
];

// Эксклюзивные аватары для специальных ролей
const EXCLUSIVE_AVATARS = [
  { id: 'avatar-crown', emoji: '👑', name: 'Корона', roles: ['admin'] },
  { id: 'avatar-shield', emoji: '🛡️', name: 'Щит', roles: ['moderator'] },
  { id: 'avatar-code', emoji: '💻', name: 'Код', roles: ['developer'] },
  { id: 'avatar-verified', emoji: '✔️', name: 'Галочка', roles: ['verified', 'admin', 'moderator'] },
  { id: 'avatar-fire', emoji: '🔥', name: 'Огонь', roles: ['vip', 'admin'] },
  { id: 'avatar-star', emoji: '⭐', name: 'Звезда', roles: ['vip', 'verified'] },
  { id: 'avatar-robot', emoji: '🤖', name: 'Робот', roles: ['bot', 'developer'] },
  { id: 'avatar-diamond', emoji: '💎', name: 'Алмаз', roles: ['premium', 'vip'] },
];

// Получить emoji аватара по ID
function getAvatarEmoji(avatarId) {
  const avatar = AVAILABLE_AVATARS.find(a => a.id === avatarId);
  if (avatar) return avatar.emoji;
  
  const exclusive = EXCLUSIVE_AVATARS.find(a => a.id === avatarId);
  return exclusive ? exclusive.emoji : '👤';
}

// Проверить доступ к эксклюзивному аватару
function canUseAvatar(avatarId, userRole) {
  const avatar = AVAILABLE_AVATARS.find(a => a.id === avatarId);
  if (avatar) return true; // Стандартные аватары доступны всем
  
  const exclusive = EXCLUSIVE_AVATARS.find(a => a.id === avatarId);
  if (exclusive) {
    return exclusive.roles.includes(userRole);
  }
  
  return false;
}

// Функция редактирования профиля
async function viewEditProfile() {
  setNoStrawberries(true);
  
  const app = document.getElementById('app');
  
  // Показываем загрузку
  app.innerHTML = `
    <div class="profile-loading">
      <div class="spinner"></div>
      <p>Загрузка...</p>
    </div>
  `;
  
  try {
    // Загружаем текущий профиль
    console.log('[EDIT-PROFILE] Fetching profile data from:', `${API_BASE}/api/profile/me`);
    const response = await fetch(`${API_BASE}/api/profile/me`, { credentials: 'include' });
    console.log('[EDIT-PROFILE] Response status:', response.status, response.ok);
    
    const data = await response.json();
    console.log('[EDIT-PROFILE] Response data:', data);
    
    if (!response.ok || !data.ok) {
      console.error('[EDIT-PROFILE] Failed to load profile:', { status: response.status, data });
      app.innerHTML = `
        <div class="profile-notfound">
          <h1>Ошибка загрузки</h1>
          <p>Не удалось загрузить профиль для редактирования</p>
          <p style="color: #999; font-size: 14px;">
            ${data.error || 'Статус: ' + response.status}
          </p>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
            <button class="btn btn-primary" onclick="location.reload()">Обновить страницу</button>
            <button class="btn btn-secondary" onclick="CybRouter.navigate('account-profile')">Вернуться в профиль</button>
          </div>
        </div>
      `;
      return;
    }
    
    const profile = data.profile;
    
    app.innerHTML = `
      <div class="edit-profile-container">
        <div class="edit-profile-header">
          <button class="btn-back" onclick="history.back()">← Назад</button>
          <h1>Редактирование профиля</h1>
        </div>
        
        <div class="edit-profile-content">
          <div id="editProfileMsg" class="msg" style="display:none;"></div>
          
          <!-- Username -->
          <section class="edit-section">
            <h2>Имя пользователя</h2>
            <div class="edit-field">
              <input type="text" id="usernameInput" class="input" value="${escapeHtml(profile.username)}" ${profile.canChangeUsername ? '' : 'disabled'}>
              <button id="checkUsernameBtn" class="btn btn-secondary" ${profile.canChangeUsername ? '' : 'disabled'}>
                Проверить доступность
              </button>
            </div>
            <div id="usernameHint" class="field-hint">
              ${profile.canChangeUsername ? '3-20 символов: буквы, цифры, _ или -' : `Можно изменить через ${Math.ceil((30 * 24 * 60 * 60 * 1000 - (Date.now() - profile.usernameChangedAt)) / (24 * 60 * 60 * 1000))} дней`}
            </div>
          </section>
          
          <!-- Avatar -->
          <section class="edit-section">
            <h2>Аватар</h2>
            <div class="avatar-grid">
              ${AVAILABLE_AVATARS.map(av => `
                <div class="avatar-option ${profile.avatar === av.id ? 'selected' : ''}" data-avatar="${av.id}">
                  <div class="avatar-emoji">${av.emoji}</div>
                  <div class="avatar-name">${av.name}</div>
                </div>
              `).join('')}
              ${EXCLUSIVE_AVATARS.filter(av => canUseAvatar(av.id, profile.role)).map(av => `
                <div class="avatar-option exclusive ${profile.avatar === av.id ? 'selected' : ''}" data-avatar="${av.id}">
                  <div class="avatar-emoji">${av.emoji}</div>
                  <div class="avatar-name">${av.name}</div>
                  <div class="avatar-badge">🌟</div>
                </div>
              `).join('')}
            </div>
            <div class="privacy-setting">
              <label>Кому видно:</label>
              <select id="privacyAvatar" class="input">
                <option value="everyone" ${profile.privacy.avatar === 'everyone' ? 'selected' : ''}>Всем</option>
                <option value="friends" ${profile.privacy.avatar === 'friends' ? 'selected' : ''}>Только друзьям</option>
                <option value="nobody" ${profile.privacy.avatar === 'nobody' ? 'selected' : ''}>Никому</option>
              </select>
            </div>
          </section>
          
          <!-- Bio -->
          <section class="edit-section">
            <h2>О себе (кратко)</h2>
            <textarea id="bioInput" class="input" maxlength="500" rows="3" placeholder="Расскажите о себе кратко...">${profile.bio || ''}</textarea>
            <div class="field-hint">До 500 символов</div>
            <div class="privacy-setting">
              <label>Кому видно:</label>
              <select id="privacyBio" class="input">
                <option value="everyone" ${profile.privacy.bio === 'everyone' ? 'selected' : ''}>Всем</option>
                <option value="friends" ${profile.privacy.bio === 'friends' ? 'selected' : ''}>Только друзьям</option>
                <option value="nobody" ${profile.privacy.bio === 'nobody' ? 'selected' : ''}>Никому</option>
              </select>
            </div>
          </section>
          
          <!-- About Me -->
          <section class="edit-section">
            <h2>О себе (подробно)</h2>
            <textarea id="aboutMeInput" class="input" maxlength="1000" rows="5" placeholder="Расскажите о себе подробнее...">${profile.aboutMe || ''}</textarea>
            <div class="field-hint">До 1000 символов</div>
            <div class="privacy-setting">
              <label>Кому видно:</label>
              <select id="privacyAbout" class="input">
                <option value="everyone" ${profile.privacy.about === 'everyone' ? 'selected' : ''}>Всем</option>
                <option value="friends" ${profile.privacy.about === 'friends' ? 'selected' : ''}>Только друзьям</option>
                <option value="nobody" ${profile.privacy.about === 'nobody' ? 'selected' : ''}>Никому</option>
              </select>
            </div>
          </section>
          
          <!-- Gender -->
          <section class="edit-section">
            <h2>Пол</h2>
            <select id="genderInput" class="input">
              <option value="not_specified" ${profile.gender === 'not_specified' ? 'selected' : ''}>Не указано</option>
              <option value="male" ${profile.gender === 'male' ? 'selected' : ''}>Мужской</option>
              <option value="female" ${profile.gender === 'female' ? 'selected' : ''}>Женский</option>
            </select>
            <div class="privacy-setting">
              <label>Кому видно:</label>
              <select id="privacyGender" class="input">
                <option value="everyone" ${profile.privacy.gender === 'everyone' ? 'selected' : ''}>Всем</option>
                <option value="friends" ${profile.privacy.gender === 'friends' ? 'selected' : ''}>Только друзьям</option>
                <option value="nobody" ${profile.privacy.gender === 'nobody' ? 'selected' : ''}>Никому</option>
              </select>
            </div>
          </section>
          
          <!-- Date of Birth -->
          <section class="edit-section">
            <h2>Дата рождения</h2>
            <input type="date" id="dobInput" class="input" value="${profile.dateOfBirth || ''}">
            <div class="privacy-setting">
              <label>Кому видно:</label>
              <select id="privacyDob" class="input">
                <option value="everyone" ${profile.privacy.dob === 'everyone' ? 'selected' : ''}>Всем</option>
                <option value="friends" ${profile.privacy.dob === 'friends' ? 'selected' : ''}>Только друзьям</option>
                <option value="nobody" ${profile.privacy.dob === 'nobody' ? 'selected' : ''}>Никому</option>
              </select>
            </div>
          </section>
          
          <div class="edit-actions">
            <button id="saveProfileBtn" class="btn btn-primary">Сохранить изменения</button>
            <button class="btn btn-secondary" onclick="history.back()">Отмена</button>
          </div>
        </div>
      </div>
      
      <style>
        .edit-profile-container {
          max-width: 800px;
          margin: 30px auto;
          padding: 20px;
        }
        
        .edit-profile-header {
          margin-bottom: 30px;
        }
        
        .btn-back {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 0;
          margin-bottom: 10px;
        }
        
        .edit-profile-header h1 {
          margin: 0;
          font-size: 28px;
        }
        
        .edit-section {
          background: rgba(255, 255, 255, 0.05);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .edit-section h2 {
          margin: 0 0 15px 0;
          font-size: 18px;
        }
        
        .edit-field {
          display: flex;
          gap: 10px;
          margin-bottom: 8px;
        }
        
        .edit-field .input {
          flex: 1;
        }
        
        .field-hint {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 5px;
        }
        
        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .avatar-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px;
          background: rgba(255, 255, 255, 0.03);
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .avatar-option:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(59, 130, 246, 0.5);
        }
        
        .avatar-option.selected {
          background: rgba(59, 130, 246, 0.2);
          border-color: #3b82f6;
        }
        
        .avatar-option.exclusive {
          position: relative;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
          border-color: rgba(139, 92, 246, 0.3);
        }
        
        .avatar-option.exclusive:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2));
          border-color: rgba(139, 92, 246, 0.6);
        }
        
        .avatar-option.exclusive.selected {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3));
          border-color: #8b5cf6;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
        }
        
        .avatar-badge {
          position: absolute;
          top: 5px;
          right: 5px;
          font-size: 12px;
        }
        
        .avatar-emoji {
          font-size: 40px;
          margin-bottom: 8px;
        }
        
        .avatar-name {
          font-size: 12px;
          text-align: center;
        }
        
        .privacy-setting {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }
        
        .privacy-setting label {
          font-size: 14px;
          min-width: 100px;
        }
        
        .privacy-setting select {
          flex: 1;
          max-width: 200px;
        }
        
        .edit-actions {
          display: flex;
          gap: 15px;
          margin-top: 30px;
        }
        
        .msg {
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .msg-success {
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid #22c55e;
          color: #86efac;
        }
        
        .msg-error {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #ef4444;
          color: #fca5a5;
        }
        
        .msg-info {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid #3b82f6;
          color: #93c5fd;
        }
      </style>
    `;
    
    // Avatar selection
    let selectedAvatar = profile.avatar;
    document.querySelectorAll('.avatar-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedAvatar = option.dataset.avatar;
      });
    });
    
    // Check username availability
    const usernameInput = document.getElementById('usernameInput');
    const checkUsernameBtn = document.getElementById('checkUsernameBtn');
    const usernameHint = document.getElementById('usernameHint');
    
    if (checkUsernameBtn && profile.canChangeUsername) {
      checkUsernameBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        
        if (!username || username === profile.username) {
          usernameHint.textContent = '3-20 символов: буквы, цифры, _ или -';
          usernameHint.style.color = '';
          return;
        }
        
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
          usernameHint.textContent = '❌ Неверный формат. Используйте 3-20 символов: буквы, цифры, _ или -';
          usernameHint.style.color = '#ef4444';
          return;
        }
        
        try {
          const response = await fetch(`${API_BASE}/api/profile/check-username/${encodeURIComponent(username)}`, {
            credentials: 'include'
          });
          const data = await response.json();
          
          if (data.ok && data.available) {
            usernameHint.textContent = '✅ Имя доступно!';
            usernameHint.style.color = '#22c55e';
          } else {
            usernameHint.textContent = `❌ ${data.reason || 'Имя недоступно'}`;
            usernameHint.style.color = '#ef4444';
          }
        } catch (error) {
          usernameHint.textContent = '❌ Ошибка проверки';
          usernameHint.style.color = '#ef4444';
        }
      });
    }
    
    // Save profile
    const saveBtn = document.getElementById('saveProfileBtn');
    const msgEl = document.getElementById('editProfileMsg');
    
    saveBtn.addEventListener('click', async () => {
      const showMsg = (type, text) => {
        msgEl.className = `msg msg-${type}`;
        msgEl.textContent = text;
        msgEl.style.display = 'block';
      };
      
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
        
        const username = usernameInput.value.trim();
        const bio = document.getElementById('bioInput').value.trim();
        const aboutMe = document.getElementById('aboutMeInput').value.trim();
        const gender = document.getElementById('genderInput').value;
        const dateOfBirth = document.getElementById('dobInput').value;
        
        const privacy = {
          avatar: document.getElementById('privacyAvatar').value,
          bio: document.getElementById('privacyBio').value,
          about: document.getElementById('privacyAbout').value,
          gender: document.getElementById('privacyGender').value,
          dob: document.getElementById('privacyDob').value,
        };
        
        const updateData = {
          avatar: selectedAvatar,
          bio: bio || null,
          aboutMe: aboutMe || null,
          gender,
          dateOfBirth: dateOfBirth || null,
          privacy,
        };
        
        // Добавляем username только если он изменился и можно менять
        if (profile.canChangeUsername && username !== profile.username) {
          updateData.username = username;
        }
        
        const response = await fetch(`${API_BASE}/api/profile/update`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
          showMsg('success', '✅ Профиль успешно обновлен!');
          setTimeout(() => {
            CybRouter.navigate(updateData.username || profile.username);
          }, 1500);
        } else {
          showMsg('error', data.error || 'Ошибка при сохранении профиля');
        }
      } catch (error) {
        showMsg('error', 'Ошибка сети. Попробуйте еще раз.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить изменения';
      }
    });
    
  } catch (error) {
    app.innerHTML = `
      <div class="profile-notfound">
        <h1>Ошибка</h1>
        <p>Не удалось загрузить профиль</p>
        <button onclick="CybRouter.navigate('username')">Вернуться</button>
      </div>
    `;
  }
}

// Функция рендера по маршруту
function renderRoute(r) {
  console.log('renderRoute called with:', r);
  // перед рендером нового роута — снимаем старые listeners
  if (window.__cyb_cleanup?.length) {
    try {
      window.__cyb_cleanup.forEach((fn) => fn());
    } catch {}
    window.__cyb_cleanup = [];
  }

  // account pages
  if (r === 'account-profile') return viewAccount('profile');
  if (r === 'account-security') return viewAccount('security');
  if (r === 'account-sessions') return viewAccount('sessions');
  if (r === 'account-easter-eggs') return viewAccount('easter');
  if (r === 'account-friends') return viewAccount('friends');
  if (r === 'account-messages') return viewAccount('messages');

  // EDIT PROFILE
  if (r === 'edit-profile') return viewEditProfile();

  // EMAIL VERIFY
  if (r === 'verify-email') return viewVerifyEmail();

  // 2FA VERIFY
  if (r === '2fa-verify') return view2FAVerify();

  // PROFILE
  if (r === 'profile') {
    console.log('[ROUTER] Profile route detected');
    const username = window.CybRouter.getRouteParam('username');
    console.log('[ROUTER] Profile username:', username);
    if (username) {
      console.log('[ROUTER] Calling profileModule.renderProfile with:', username);
      profileModule.renderProfile(username);
    } else {
      console.log('[ROUTER] No username, falling back to viewUsername');
      viewUsername();
    }
    return;
  }

  // LOGIN
  if (r === 'signup') return viewSignup();
  if (r === 'username') return viewUsername();
  if (r === 'password') return viewPassword();
  if (r === 'reset') return viewReset();

  if (r === 'done') return viewDone();
  if (r === 'strawberry-history') return viewStrawberryHistory();
  return viewUsername();
}

// Слушаем роут-события
window.addEventListener('cyb:route', (e) => {
  renderRoute(e.detail.route);
});

// Обработчики событий online/offline для индикации состояния сети
let offlineNotification = null;

window.addEventListener('offline', () => {
  console.warn('Network connection lost');

  // Показываем уведомление о потере соединения
  if (!offlineNotification) {
    offlineNotification = document.createElement('div');
    offlineNotification.className = 'network-notification offline';
    offlineNotification.innerHTML = `
      <div class="notification-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Нет подключения к интернету</span>
      </div>
    `;
    document.body.appendChild(offlineNotification);
  }
});

window.addEventListener('online', () => {
  console.log('Network connection restored');

  // Убираем уведомление и показываем что соединение восстановлено
  if (offlineNotification) {
    offlineNotification.classList.remove('offline');
    offlineNotification.classList.add('online');
    offlineNotification.innerHTML = `
      <div class="notification-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Соединение восстановлено</span>
      </div>
    `;

    // Убираем уведомление через 3 секунды
    setTimeout(() => {
      if (offlineNotification) {
        offlineNotification.remove();
        offlineNotification = null;
      }
    }, 3000);
  }
});

// Начальный рендер

(async function boot() {
  const r = window.CybRouter?.getRoute?.() || 'username';

  // если пользователь уже вошёл — сразу в учётку
  const ok = await checkSession();

  // ✅ какие роуты разрешены при активной сессии
  const allowedWhenLoggedIn = new Set([
    'profile', // ✅ разрешаем смотреть профили других пользователей
    'strawberry-history', // ✅ разрешаем стенографию
    'verify-email',
    '2fa-verify', // ✅ разрешаем 2FA верификацию без сессии
    // (можно добавишь ещё)
  ]);

  if (ok && !String(r).startsWith('account-') && !allowedWhenLoggedIn.has(String(r))) {
    CybRouter.navigate('account-profile');
    return;
  }

  renderRoute(r);
})();

function shell(contentHtml) {
  return `
    <div class="auth-shell">
      <main class="auth-center">
        <div style="width:100%;max-width:520px;">
          ${contentHtml}
        </div>
      </main>

      <footer class="auth-footer">
        <div class="footer-row">
          <div class="footer-copy">
          <p class="footer-text" dir="ltr" lang="en">
         © ${new Date().getFullYear()} CybLight
         </p>
          </div>
          <div class="footer-links">
            <a class="footer-brand" href="https://cyblight.org/" aria-label="Главная страница" target="_blank" rel="noopener">
            <img src="/assets/img/logo.svg" class="footer-logo" alt="CybLight" /><span>CybLight.org</span></a>

            <a class="report-btn" href="#" onclick="showReportModal(); return false;">
              <img src="/assets/img/report.svg" alt="Report" class="report-icon" />
              Сообщить о проблеме
            </a>

            <a href="#" onclick="return false;">Условия использования</a>
            <a href="https://cyblight.org/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a>
            <a href="#" onclick="return false;">Настройки конфиденциальности</a>
          </div>
        </div>
      </footer>
    </div>
  `;
}

// Централизованный менеджер модалей
const ModalsManager = {
  openModals: new Set(),

  open(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('is-open');
    this.openModals.add(modalId);
  },

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('is-open');
    this.openModals.delete(modalId);
  },

  closeAll() {
    this.openModals.forEach((id) => this.close(id));
  },
};

// Глобальный обработчик Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ModalsManager.closeAll();
  }
});

function ensureInfoModal() {
  let m = document.getElementById('cybInfoModal');
  if (m) return m;

  m = document.createElement('div');
  m.id = 'cybInfoModal';
  m.className = 'cyb-info-modal';
  m.innerHTML = `
    <div class="cyb-info-modal__backdrop"></div>
    <div class="cyb-info-modal__card" role="dialog" aria-modal="true">
      <div class="cyb-info-modal__title" id="cybInfoModalTitle"></div>
      <div class="cyb-info-modal__text" id="cybInfoModalText"></div>
      <div class="cyb-info-modal__actions">
        <button class="btn btn-primary" id="cybInfoModalOk" type="button">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);

  // закрытие по фону
  m.querySelector('.cyb-info-modal__backdrop')?.addEventListener('click', () => {
    m.classList.remove('is-open');
  });

  // закрытие по Esc
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && m.classList.contains('is-open')) {
      m.classList.remove('is-open');
    }
  });

  return m;
}

function showInfoModal({ title = '', text = '', onOk = null } = {}) {
  const m = ensureInfoModal();
  const t = m.querySelector('#cybInfoModalTitle');
  const c = m.querySelector('#cybInfoModalText');
  const ok = m.querySelector('#cybInfoModalOk');

  if (t) t.textContent = title;
  if (c) c.textContent = text;

  ok.onclick = () => {
    m.classList.remove('is-open');
    try {
      onOk && onOk();
    } catch {}
  };

  m.classList.add('is-open');
}

function ensureReportModal() {
  let m = document.getElementById('cybReportModal');
  if (m) return m;

  m = document.createElement('div');
  m.id = 'cybReportModal';
  m.className = 'cyb-report-modal';
  m.innerHTML = `
    <div class="cyb-report-modal__backdrop"></div>
    <div class="cyb-report-modal__card" role="dialog" aria-modal="true">
      <div class="cyb-report-modal__title">Сообщить о проблеме</div>
      <form id="reportForm" class="cyb-report-modal__form">
        <div class="field">
          <label class="label" for="reportEmail">Email (опционально)</label>
          <input class="input" id="reportEmail" type="email" placeholder="your@email.com" />
        </div>
        <div class="field">
          <label class="label" for="reportCategory">Категория</label>
          <select class="input" id="reportCategory" required>
            <option value="">-- Выберите категорию --</option>
            <option value="bug">Ошибка/Баг</option>
            <option value="performance">Проблема с производительностью</option>
            <option value="security">Проблема безопасности</option>
            <option value="feature">Предложение функции</option>
            <option value="other">Прочее</option>
          </select>
        </div>
        <div class="field">
          <label class="label" for="reportMessage">Описание проблемы</label>
          <textarea class="input" id="reportMessage" rows="5" placeholder="Подробно опишите проблему..." required style="resize: vertical; font-family: inherit;"></textarea>
        </div>
        <div class="msg msg--warn" id="reportWarning" style="display: none;"></div>
        <div class="msg msg--ok" id="reportSuccess" style="display: none;"></div>
        <div class="cyb-report-modal__actions">
          <button class="btn btn-outline" type="button" id="reportCancel">Отмена</button>
          <button class="btn btn-primary" type="submit" id="reportSubmit">Отправить</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(m);

  // закрытие по фону
  m.querySelector('.cyb-report-modal__backdrop')?.addEventListener('click', () => {
    m.classList.remove('is-open');
  });

  // закрытие по Esc
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && m.classList.contains('is-open')) {
      m.classList.remove('is-open');
    }
  });

  // обработка отмены
  m.querySelector('#reportCancel')?.addEventListener('click', () => {
    m.classList.remove('is-open');
  });

  // обработка отправки
  m.querySelector('#reportForm')?.addEventListener('submit', handleReportSubmit);

  return m;
}

function showReportModal() {
  const m = ensureReportModal();
  const form = m.querySelector('#reportForm');
  const warning = m.querySelector('#reportWarning');
  const success = m.querySelector('#reportSuccess');

  // очистка формы и сообщений
  form.reset();
  warning.style.display = 'none';
  success.style.display = 'none';

  m.classList.add('is-open');
}

async function handleReportSubmit(e) {
  e.preventDefault();

  const m = document.getElementById('cybReportModal');
  const form = m.querySelector('#reportForm');
  const email = form.querySelector('#reportEmail').value.trim();
  const category = form.querySelector('#reportCategory').value;
  const message = form.querySelector('#reportMessage').value.trim();
  const submitBtn = m.querySelector('#reportSubmit');
  const warning = m.querySelector('#reportWarning');
  const success = m.querySelector('#reportSuccess');

  // валидация
  if (!message) {
    warning.textContent = 'Пожалуйста, опишите проблему';
    warning.style.display = 'block';
    return;
  }

  if (!category) {
    warning.textContent = 'Пожалуйста, выберите категорию';
    warning.style.display = 'block';
    return;
  }

  // блокируем кнопку
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправляю...';
  warning.style.display = 'none';
  success.style.display = 'none';

  try {
    const ua = parseUA(navigator.userAgent);

    const response = await apiCall('/error/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: category || 'unknown',
        email: email || null,
        category: category,
        message: message,
        userAgent: navigator.userAgent,
        browser: ua.browser,
        os: ua.os,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }),
      credentials: 'include',
    });

    if (response.ok) {
      success.textContent = '✓ Спасибо! Ваш отчёт отправлен администраторам.';
      success.style.display = 'block';
      form.reset();

      // закрытие через 2 секунды
      setTimeout(() => {
        m.classList.remove('is-open');
      }, 2000);
    } else {
      const errorData = await response.json().catch(() => ({}));
      warning.textContent = errorData.message || 'Ошибка при отправке. Попробуйте позже.';
      warning.style.display = 'block';
    }
  } catch (error) {
    console.error('Report submission error:', error);
    warning.textContent = 'Ошибка сети. Проверьте подключение и попробуйте ещё раз.';
    warning.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Отправить';
  }
}

function viewUsername() {
  setNoStrawberries(false);

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
        <a href="https://cyblight.org/" aria-label="Главная страница" title="Открыть главную страницу">
          <img src="/assets/img/logo.svg" alt="CybLight" />
          </a>
        </div>
        <div class="auth-title">
          <h1>Войти</h1>
        </div>
      </div>

      <form id="f">
        <div class="field">
          <label class="label" for="login">Пользователь</label>
          <input class="input" id="login" autocomplete="username" required />
        </div>

        <div class="row">
          <a class="link" href="#" id="forgotUser">Забыли имя пользователя?</a>
        </div>

        <button class="btn btn-primary" type="submit">Далее</button>

        <div class="divider">ИЛИ</div>

        <button class="btn btn-outline" type="button" id="keyLogin">
          Войти с помощью ключа доступа
        </button>
      </form>
    </section>

    <div class="below">
      <p class="hint">Ты еще не с нами?</p>
      <button class="btn-create" type="button" id="createAcc">Регистрируйся!</button>
    </div>
  `);

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  document.getElementById('forgotUser').onclick = (e) => {
    e.preventDefault();
    setStorage('cyb_recovery_mode', 'username', sessionStorage);
    CybRouter.navigate('reset');
  };

  document.getElementById('keyLogin').onclick = async () => {
    // Проверка поддержки WebAuthn
    if (!window.PublicKeyCredential) {
      alert(
        '❌ Ваш браузер не поддерживает ключи доступа (passkeys).\n\nИспользуйте современный браузер: Chrome, Edge, Safari или Firefox.'
      );
      return;
    }

    const keyLoginBtn = document.getElementById('keyLogin');
    const originalText = keyLoginBtn.innerHTML;
    keyLoginBtn.disabled = true;
    keyLoginBtn.innerHTML = '🔐 Проверка...';

    try {
      // 1. Получаем challenge от сервера
      const optionsRes = await apiCall('/auth/passkey/login/options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Не удалось получить параметры аутентификации');
      }

      const optionsData = await optionsRes.json();
      if (!optionsData.ok || !optionsData.options || !optionsData.challengeId) {
        throw new Error('Некорректный ответ сервера');
      }

      const options = optionsData.options;
      const challengeId = optionsData.challengeId;

      // 2. Преобразуем challenge и allowCredentials из base64url в ArrayBuffer
      const challenge = Uint8Array.from(
        atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0)
      );

      const allowCredentials = (options.allowCredentials || []).map((cred) => ({
        ...cred,
        id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
          c.charCodeAt(0)
        ),
      }));

      const publicKeyOptions = {
        challenge: challenge,
        rpId: options.rpId,
        allowCredentials: allowCredentials,
        timeout: options.timeout || 60000,
        userVerification: options.userVerification || 'preferred',
      };

      keyLoginBtn.innerHTML = '🔑 Используйте ключ доступа...';

      // 3. Запрашиваем подпись у пользователя через WebAuthn API
      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error('Аутентификация отменена');
      }

      // 4. Преобразуем credential в формат для отправки на сервер
      const credentialData = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, ''),
        response: {
          clientDataJSON: btoa(
            String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))
          )
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, ''),
          authenticatorData: btoa(
            String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))
          )
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, ''),
          signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, ''),
          userHandle: credential.response.userHandle
            ? btoa(String.fromCharCode(...new Uint8Array(credential.response.userHandle)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
            : null,
        },
        type: credential.type,
      };

      keyLoginBtn.innerHTML = '✅ Вход...';

      // 5. Отправляем credential на сервер для верификации
      const loginRes = await apiCall('/auth/passkey/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, credential: credentialData }),
      });

      const loginData = await loginRes.json().catch(() => ({}));

      if (!loginRes.ok) {
        throw new Error(loginData.error || 'Ошибка входа');
      }

      // 6. Успешный вход!
      console.log('✅ Passkey login successful');

      // Переход в аккаунт (используем правильный роут)
      CybRouter.navigate('account-profile');
    } catch (err) {
      console.error('Passkey login error:', err);

      let errorMessage = 'Не удалось войти по ключу доступа';

      if (err.name === 'NotAllowedError') {
        errorMessage = '❌ Аутентификация отменена или время ожидания истекло';
      } else if (err.name === 'InvalidStateError') {
        errorMessage = '❌ Ключ доступа не найден на этом устройстве';
      } else if (err.message) {
        errorMessage = `❌ ${err.message}`;
      }

      alert(errorMessage);
    } finally {
      keyLoginBtn.disabled = false;
      keyLoginBtn.innerHTML = originalText;
    }
  };

  document.getElementById('createAcc').onclick = () => {
    CybRouter.navigate('signup');
  };

  document.getElementById('f').addEventListener('submit', (e) => {
    e.preventDefault();
    const login = document.getElementById('login').value.trim();
    if (!login) return alert('Введите имя пользователя');
    setStorage('cyb_login', login, sessionStorage);
    CybRouter.navigate('password');
  });
}

function viewSignup() {
  setNoStrawberries(false);

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Регистрация</h1>
        </div>
      </div>

      <form id="f">
        <div class="field">
          <label class="label" for="login">Логин</label>
          <input class="input" id="login" autocomplete="username" required />
        </div>

        <div class="field">
          <label class="label" for="pass1">Пароль</label>
          <div class="pass-wrap">
            <input class="input" id="pass1" type="password" autocomplete="new-password" required />
            <button type="button" class="pass-eye" data-target="pass1" aria-label="Показать пароль"></button>
          </div>
        </div>

        <div class="field">
          <label class="label" for="pass2">Повтори пароль</label>
          <div class="pass-wrap">
            <input class="input" id="pass2" type="password" autocomplete="new-password" required />
            <button type="button" class="pass-eye" data-target="pass2" aria-label="Показать пароль"></button>
          </div>

          <div id="passHintsSignup"></div>
        </div>

        <div class="field" style="margin-top:12px;">
          <div class="cf-turnstile"></div>
        </div>

        <div class="row">
          <a class="link" href="#" id="back">← Назад</a>
        </div>

        <button class="btn btn-primary" type="submit">Создать аккаунт</button>
      </form>
    </section>
  `);

  initPasswordEyes(app);

  const pass1El = document.getElementById('pass1');
  const pass2El = document.getElementById('pass2');
  const hintsEl = document.getElementById('passHintsSignup');

  // подсказки по правилам пароля — на первом поле
  attachPasswordHints(pass1El, hintsEl, {
    minLen: 8,
    requireUpper: true,
    requireLower: true,
  });

  document.getElementById('back').onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate('username');
  };

  // убрать дубликаты Turnstile
  if (window.turnstile && turnstileWidgetId !== null) {
    try {
      turnstile.remove(turnstileWidgetId);
    } catch {}
    turnstileWidgetId = null;
  }

  turnstileToken = '';
  initTurnstile();

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('login').value.trim();
    const pass1 = pass1El?.value ?? '';
    const pass2 = pass2El?.value ?? '';

    if (
      !/[A-Z]/.test(pass1) ||
      !/[a-z]/.test(pass1) ||
      !/\d/.test(pass1) ||
      !/[!@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]/.test(pass1)
    ) {
      alert('Пароль не соответствует требованиям.');
      return;
    }

    if (!/^[\x20-\x7E]*$/.test(pass1)) {
      alert('Пароль: нельзя использовать русские/украинские буквы и любые не-ASCII символы.');
      pass1El?.focus();
      return;
    }

    if (!login) return alert('🚫 Введите логин');
    if (!/^[A-Za-z0-9_]{3,24}$/.test(login)) {
      alert('Логин: только латиница (A–Z), цифры (0–9) и "_" . Длина 3–24.');
      return;
    }

    if (!pass1) return alert('🚫 Введите пароль');
    if (pass1 !== pass2) {
      alert('🚫 Пароли не совпадают');
      pass2El?.focus();
      pass2El?.select?.();
      return;
    }

    if (!turnstileToken) {
      alert(
        '🛡️ Не удалось получить токен Turnstile.\n\nВозможные причины:\n• Открыта панель разработчика (DevTools) в Firefox\n• Включён режим приватности или блокировщик\n\nПопробуйте закрыть DevTools или использовать другой браузер.'
      );
      return;
    }

    try {
      console.log('Attempting registration for:', login);
      const payload = {
        login,
        password: pass1,
        turnstileToken,
      };
      console.log('Registration payload:', {
        login: payload.login,
        passwordLength: payload.password.length,
        turnstileTokenPreview: payload.turnstileToken
          ? `${payload.turnstileToken.substring(0, 20)}...`
          : 'NO TOKEN',
      });

      const res = await apiCall('/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('Registration response:', { ok: res.ok, status: res.status });
      const data = await res.json().catch(() => ({}));
      console.log('Registration data:', data);
      console.log('Cookies after registration:', document.cookie);

      if (!res.ok) {
        console.error('Registration failed!', {
          status: res.status,
          statusText: res.statusText,
          error: data?.error,
          data: data,
        });
        // ❌ ошибка регистрации
        if (window.turnstile && turnstileWidgetId !== null) {
          turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = '';
        alert(data.error || 'Ошибка регистрации');
        return;
      }

      // ✅ регистрация успешна — проверяем, что cookie реально установилась
      const okSession = await checkSession();
      if (!okSession) {
        alert(
          'Регистрация прошла, но сессия не установилась (cookie заблокирована). Проверь CORS / credentials.'
        );
        return;
      }

      // ✅ Синхронизируем флаг strawberry с сервером
      try {
        const meRes = await apiCall('/auth/me', { method: 'GET', credentials: 'include' });
        const meData = await meRes.json().catch(() => null);

        const hasStrawberryOnServer = !!(
          meRes.ok &&
          meData?.ok &&
          (meData?.user?.easter?.strawberry || meData?.easter?.strawberry)
        );

        const hasStrawberryLocally = hasStrawberryAccess();

        // Если есть локально, но нет на сервере - отправляем
        if (hasStrawberryLocally && !hasStrawberryOnServer) {
          console.log('🍓 Registration: syncing local strawberry to server...');
          try {
            const syncRes = await apiCall('/auth/easter/strawberry', {
              method: 'POST',
              credentials: 'include',
            });
            if (syncRes.ok) {
              console.log('✅ Strawberry synced after registration!');
            }
          } catch (syncErr) {
            console.warn('⚠️ Failed to sync strawberry:', syncErr);
          }
        } else if (hasStrawberryOnServer) {
          setStrawberryAccess();
          console.log('✅ Флаг strawberry синхронизирован после регистрации');
        }
      } catch (e) {
        console.warn('Не удалось синхронизировать флаг strawberry:', e);
      }

      // ✅ Синхронизируем флаг dark_trigger с сервером
      try {
        const meRes = await apiCall('/auth/me', { method: 'GET', credentials: 'include' });
        const meData = await meRes.json().catch(() => null);

        const hasDarkTriggerOnServer = !!(
          meRes.ok &&
          meData?.ok &&
          (meData?.user?.easter?.darkTrigger || meData?.easter?.darkTrigger)
        );

        const hasDarkTriggerLocally = hasDarkTriggerAccess();

        // Если есть локально, но нет на сервере - отправляем
        if (hasDarkTriggerLocally && !hasDarkTriggerOnServer) {
          console.log('🌑 Registration: syncing local dark trigger to server...');
          try {
            const syncRes = await apiCall('/auth/easter/dark-trigger', {
              method: 'POST',
              credentials: 'include',
            });
            if (syncRes.ok) {
              console.log('✅ Dark trigger synced after registration!');
            }
          } catch (syncErr) {
            console.warn('⚠️ Failed to sync dark trigger:', syncErr);
          }
        } else if (hasDarkTriggerOnServer) {
          setDarkTriggerAccess();
          console.log('✅ Флаг dark trigger синхронизирован после регистрации');
        }
      } catch (e) {
        console.warn('Не удалось синхронизировать флаг dark trigger:', e);
      }

      // ✅ Регистрация успешна — показываем сообщение и ведём в профиль
      const form = document.getElementById('f');
      const btn = form.querySelector('button[type="submit"]');
      const backLink = document.getElementById('back');

      if (btn) {
        btn.disabled = true;
        btn.textContent = '✅ Регистрация успешна';
      }
      if (backLink) backLink.style.pointerEvents = 'none';

      // сохраним логин на всякий
      setStorage('cyb_login', login, sessionStorage);

      setTimeout(() => {
        CybRouter.navigate('account-profile');
      }, 1500);
    } catch (err) {
      // ❌ СЕТЕВАЯ ОШИБКА
      console.error('Signup failed:', err);

      if (window.turnstile && turnstileWidgetId !== null) {
        turnstile.reset(turnstileWidgetId);
      }
      turnstileToken = '';

      alert('Ошибка сети. Проверьте соединение и попробуйте ещё раз.');
    }
  });
}

function viewPassword() {
  const login = getStorage('cyb_login', '', sessionStorage) || '';
  if (!login) {
    CybRouter.navigate('username');
    return;
  }

  setNoStrawberries(false);

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Войти</h1>
        </div>
      </div>
      
      <form id="f">
        <div class="field">
          <label class="label">Пользователь</label>
          <input class="input" value="${escapeHtml(login)}" disabled />
        </div>

        <div class="field">
          <label class="label" for="pass">Пароль</label>
          <div class="pass-wrap">
            <input class="input" id="pass" type="password" autocomplete="current-password" required />
            <button type="button" class="pass-eye" data-target="pass" aria-label="Показать пароль"></button>
          </div>
        </div>


        <div class="field" style="margin-top:12px;">
          <div class="cf-turnstile"></div>
        </div>

        <div class="row">
          <a class="link" href="#" id="back">← Назад</a>
          <a class="link" href="#" id="forgotPass">Забыли пароль?</a>
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <button class="btn btn-primary" type="submit">Войти</button>
      </form>
    </section>
  `);

  initPasswordEyes(app);

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  document.getElementById('back').onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate('username');
  };
  document.getElementById('forgotPass').onclick = (e) => {
    e.preventDefault();
    setStorage('cyb_recovery_mode', 'password', sessionStorage);
    CybRouter.navigate('reset');
  };

  if (window.turnstile && turnstileWidgetId !== null) {
    try {
      turnstile.remove(turnstileWidgetId);
    } catch {}
    turnstileWidgetId = null;
  }

  turnstileToken = '';
  initTurnstile();

  const msgEl = document.getElementById('msg');
  const passEl = document.getElementById('pass');

  function clearMsg() {
    if (!msgEl) return;
    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  }

  function showMsg(type, text) {
    if (!msgEl) return;
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  passEl?.addEventListener('input', clearMsg);

  // TURNSTILE TOKEN
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldText = btn.textContent;

    clearMsg();

    const pass = document.getElementById('pass').value;
    if (!pass) {
      showMsg('error', 'Введите пароль.');
      shake(passEl);
      return;
    }

    if (!turnstileToken) {
      showMsg('warn', 'Подтверди, что ты не робот (Turnstile).');
      return;
    }

    // ✅ блокируем только когда точно пойдём в сеть
    btn.disabled = true;
    btn.textContent = 'Вхожу…';

    const login = getStorage('cyb_login', '', sessionStorage);

    try {
      console.log('Attempting login for:', login);
      console.log(
        'Turnstile token:',
        turnstileToken ? `${turnstileToken.substring(0, 20)}...` : 'NO TOKEN'
      );
      console.log('Password length:', pass.length);

      // Проверяем наличие сохраненного токена устройства
      const deviceToken = localStorage.getItem('cyb_device_token') || '';

      const res = await apiCall('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password: pass,
          turnstileToken,
          deviceToken,
        }),
      });

      console.log('Login response:', { ok: res.ok, status: res.status });
      const data = await res.json().catch(() => ({}));
      console.log('Login data:', data);
      console.log('Cookies after login:', document.cookie);

      // Если ошибка - показываем полный ответ сервера
      if (!res.ok) {
        console.error('Login failed! Server response:', {
          status: res.status,
          statusText: res.statusText,
          data: data,
          error: data?.error,
          message: data?.message,
          details: data,
        });
      }

      if (!res.ok) {
        // сброс капчи
        if (window.turnstile && turnstileWidgetId !== null) {
          turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = '';

        // красивые сообщения по коду ошибки
        const err = String(data?.error || '').toLowerCase();

        // Проверка на бан - показываем специальную страницу
        if (res.status === 403 || err.includes('account_banned') || err.includes('banned')) {
          const banReason =
            res.headers.get('X-Ban-Reason') || data?.reason || 'Нарушение правил сообщества';
          viewAccountBanned(banReason, login);
          return;
        }

        if (res.status === 401 || err.includes('invalid_credentials')) {
          showMsg('error', 'Неправильный пароль или логин. Попробуй ещё раз.');
          shake(passEl);
          passEl?.focus();
          passEl?.select?.();
          return;
        }

        if (res.status === 429 || err.includes('rate') || err.includes('too_many')) {
          showMsg('warn', 'Слишком много попыток. Подожди немного и попробуй снова.');
          return;
        }

        if (err.includes('turnstile')) {
          showMsg('warn', 'Проверка Turnstile не прошла. Обнови капчу и попробуй снова.');
          return;
        }

        showMsg(
          'error',
          data?.error ? `Ошибка: ${data.error}` : 'Не удалось войти. Попробуй позже.'
        );
        return;
      }

      // успех - проверяем требуется ли 2FA
      // Сервер может вернуть {ok: true, data: {requires2FA, userId}} или напрямую {requires2FA, userId}
      const loginData = data?.data || data;
      if (loginData.requires2FA && loginData.userId) {
        console.log('2FA required for user:', loginData.userId);
        showMsg('ok', 'Требуется код двухфакторной аутентификации');
        setStorage('cyb_2fa_userId', loginData.userId, sessionStorage);
        console.log('Calling CybRouter.navigate(2fa-verify)...');
        CybRouter.navigate('2fa-verify');
        console.log('Navigate call completed');
        return;
      }

      showMsg('ok', 'Успешный вход! Перенаправляю…');

      // ✅ Синхронизируем флаг strawberry с сервером используя данные из ответа логина
      try {
        console.log('Login sync - data from login response:', data);
        console.log('Login sync - strawberry paths:', {
          'data?.user?.easter?.strawberry': data?.user?.easter?.strawberry,
          'data?.data?.user?.easter?.strawberry': data?.data?.user?.easter?.strawberry,
        });

        // Проверяем обе возможные структуры ответа
        const userData = data?.data || data; // Извлекаем вложенный data, если есть
        const hasStrawberryOnServer = !!userData?.user?.easter?.strawberry;

        const hasStrawberryLocally = hasStrawberryAccess();

        // Если есть локально, но нет на сервере - отправляем
        if (hasStrawberryLocally && !hasStrawberryOnServer) {
          console.log('🍓 Local strawberry flag found, syncing to server...');
          try {
            // Ждём 200мс чтобы браузер успел установить cookie из предыдущего ответа
            await new Promise((resolve) => setTimeout(resolve, 200));

            const syncRes = await apiCall('/auth/easter/strawberry', {
              method: 'POST',
              credentials: 'include',
            });
            const syncData = await syncRes.json().catch(() => ({}));

            if (syncRes.ok) {
              console.log('✅ Strawberry flag synced to server successfully!');
            } else {
              console.warn('⚠️ Failed to sync strawberry to server:', syncData);
            }
          } catch (syncErr) {
            console.warn('⚠️ Error syncing strawberry to server:', syncErr);
          }
        } else if (hasStrawberryOnServer) {
          setStrawberryAccess();
          console.log('✅ Флаг strawberry синхронизирован с сервера');
        } else {
          console.log('❌ Пасхалка strawberry не найдена (ни локально, ни на сервере)');
        }
      } catch (e) {
        console.warn('Не удалось синхронизировать флаг strawberry:', e);
      }

      // ✅ Синхронизируем флаг dark_trigger с сервером используя данные из ответа логина
      try {
        console.log('Login sync - data from login response (dark trigger):', data);

        // Проверяем обе возможные структуры ответа
        const userData = data?.data || data;
        const hasDarkTriggerOnServer = !!userData?.user?.easter?.darkTrigger;

        const hasDarkTriggerLocally = hasDarkTriggerAccess();

        // Если есть локально, но нет на сервере - отправляем
        if (hasDarkTriggerLocally && !hasDarkTriggerOnServer) {
          console.log('🌑 Local dark trigger flag found, syncing to server...');
          try {
            // Ждём 200мс чтобы браузер успел установить cookie из предыдущего ответа
            await new Promise((resolve) => setTimeout(resolve, 200));

            const syncRes = await apiCall('/auth/easter/dark-trigger', {
              method: 'POST',
              credentials: 'include',
            });
            const syncData = await syncRes.json().catch(() => ({}));

            if (syncRes.ok) {
              console.log('✅ Dark trigger flag synced to server successfully!');
            } else {
              console.warn('⚠️ Failed to sync dark trigger to server:', syncData);
            }
          } catch (syncErr) {
            console.warn('⚠️ Error syncing dark trigger to server:', syncErr);
          }
        } else if (hasDarkTriggerOnServer) {
          setDarkTriggerAccess();
          console.log('✅ Флаг dark trigger синхронизирован с сервера');
        } else {
          console.log('❌ Пасхалка dark trigger не найдена (ни локально, ни на сервере)');
        }
      } catch (e) {
        console.warn('Не удалось синхронизировать флаг dark trigger:', e);
      }

      CybRouter.navigate('account-profile'); // ✅ или куда тебе надо
    } catch (err) {
      // Эта ошибка может возникнуть только если что-то серьезно сломано
      console.error('Unexpected error during login:', err);

      if (window.turnstile && turnstileWidgetId !== null) {
        try {
          turnstile.reset(turnstileWidgetId);
        } catch (e) {
          console.warn('Failed to reset turnstile:', e);
        }
      }
      turnstileToken = '';

      // Показываем полезное сообщение пользователю
      showMsg('error', 'Непредвиденная ошибка. Попробуйте обновить страницу.');
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
}

// ============================================
//            ACCOUNT BANNED PAGE
// ============================================
function viewAccountBanned(banReason, username) {
  setNoStrawberries(false);

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
          <img src="/assets/img/logo.svg" alt="CybLight" style="filter: grayscale(1) opacity(0.5);" />
        </div>
        <div class="auth-title">
          <h1 style="color: #ef4444;">Доступ заблокирован</h1>
        </div>
      </div>

      <div style="padding: 20px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 32px; line-height: 1; flex-shrink: 0;">🚫</div>
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #ef4444;">Ваш аккаунт заблокирован</div>
            <div style="font-size: 13px; line-height: 1.5; color: rgba(231, 236, 255, 0.85);">
              <strong>Причина:</strong> ${escapeHtml(banReason)}
            </div>
          </div>
        </div>
      </div>

      <div style="margin: 16px 0; padding: 14px; background: rgba(255, 255, 255, 0.04); border-radius: 6px; font-size: 13px; line-height: 1.5; color: var(--muted);">
        <p style="margin: 0 0 8px;">Если вы считаете, что это ошибка, вы можете связаться с администрацией.</p>
        <p style="margin: 0;">Пользователь: <strong>${escapeHtml(username)}</strong></p>
      </div>

      <button class="btn btn-primary" id="contactAdminBtn">
        ✉️ Написать администратору
      </button>

      <div class="row" style="margin-top: 12px;">
        <a class="link" href="#" id="back">← Вернуться к входу</a>
      </div>
    </section>
  `);

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  document.getElementById('back').onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate('username');
  };

  document.getElementById('contactAdminBtn').onclick = (e) => {
    e.preventDefault();
    viewContactAdmin(username, banReason);
  };
}

// ============================================
//         CONTACT ADMIN FORM
// ============================================
function viewContactAdmin(username, banContext) {
  setNoStrawberries(false);

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Обращение к администратору</h1>
        </div>
      </div>

      <form id="fContact">
        <div class="field">
          <label class="label" for="email">Ваш Email *</label>
          <input class="input" id="email" type="email" autocomplete="email" 
            placeholder="name@example.com" required />
        </div>

        <div class="field">
          <label class="label" for="name">Ваше имя</label>
          <input class="input" id="name" type="text" autocomplete="name"
            placeholder="Как к вам обращаться" value="${escapeHtml(username || '')}" />
        </div>

        <div class="field">
          <label class="label" for="subject">Тема обращения *</label>
          <input class="input" id="subject" type="text" 
            placeholder="Краткое описание проблемы" required 
            value="${banContext ? 'Вопрос по блокировке аккаунта' : ''}" />
        </div>

        <div class="field">
          <label class="label" for="message">Сообщение *</label>
          <textarea class="input" id="message" rows="6" required 
            placeholder="Опишите ситуацию подробно..." style="resize: vertical; min-height: 120px;"></textarea>
        </div>

        <div class="field" style="margin-top:12px;">
          <div class="cf-turnstile"></div>
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <div class="row" style="margin-top: 12px;">
          <a class="link" href="#" id="back">← Назад</a>
        </div>

        <button class="btn btn-primary" type="submit">Отправить сообщение</button>
      </form>

      <p style="margin: 12px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5;">
        Администрация рассмотрит ваше обращение и свяжется с вами по указанному email.
      </p>
    </section>
  `);

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const msgEl = document.getElementById('msg');
  const showMsg = (type, text) => {
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  };
  const clearMsg = () => {
    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  };

  document.getElementById('back').onclick = (e) => {
    e.preventDefault();
    if (banContext) {
      viewAccountBanned(banContext, username);
    } else {
      CybRouter.navigate('username');
    }
  };

  // Turnstile
  if (window.turnstile && turnstileWidgetId !== null) {
    try {
      turnstile.remove(turnstileWidgetId);
    } catch {}
    turnstileWidgetId = null;
  }
  turnstileToken = '';
  initTurnstile();

  document.getElementById('fContact').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldText = btn.textContent;

    btn.disabled = true;
    btn.textContent = 'Отправляю…';

    clearMsg();

    const email = document.getElementById('email').value.trim();
    const name = document.getElementById('name').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg('error', 'Введите корректный email.');
      btn.disabled = false;
      btn.textContent = oldText;
      return;
    }

    if (!subject || subject.length < 3) {
      showMsg('error', 'Тема должна быть не менее 3 символов.');
      btn.disabled = false;
      btn.textContent = oldText;
      return;
    }

    if (!message || message.length < 10) {
      showMsg('error', 'Сообщение должно быть не менее 10 символов.');
      btn.disabled = false;
      btn.textContent = oldText;
      return;
    }

    if (!turnstileToken) {
      showMsg('warn', 'Подтверди, что ты не робот (Turnstile).');
      btn.disabled = false;
      btn.textContent = oldText;
      return;
    }

    try {
      const res = await apiCall('/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || username || 'Anonymous',
          subject,
          message,
          turnstileToken,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data?.error || 'Не удалось отправить сообщение';
        showMsg('error', `Ошибка: ${errMsg}`);
        if (window.turnstile && turnstileWidgetId !== null) {
          turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = '';
        return;
      }

      showMsg('ok', '✅ Сообщение отправлено! Мы свяжемся с вами по email.');

      setTimeout(() => {
        CybRouter.navigate('username');
      }, 2000);
    } catch (err) {
      console.error('Contact form error:', err);
      showMsg('error', 'Ошибка сети. Проверьте соединение и попробуйте снова.');
      if (window.turnstile && turnstileWidgetId !== null) {
        try {
          turnstile.reset(turnstileWidgetId);
        } catch (e) {}
      }
      turnstileToken = '';
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
}

function viewReset() {
  setNoStrawberries(false);

  const q = getQuery();
  const token = q.get('token') || ''; // если пришли по ссылке из письма на сброс пароля
  const forcedMode = getStorage('cyb_recovery_mode', '', sessionStorage) || 'password';
  // password | username

  // 1) Режим: "установить новый пароль" (есть token)
  if (token) {
    app.innerHTML = shell(`
      <section class="auth-card">
        <div class="auth-head">
          <div class="brand-logo">
            <img src="/assets/img/logo.svg" alt="CybLight" />
          </div>
          <div class="auth-title">
            <h1>Новый пароль</h1>
          </div>
        </div>

        <form id="fReset">
          <div class="field">
            <label class="label" for="p1">Новый пароль</label>
            <input class="input" id="p1" type="password" autocomplete="new-password" required />
          </div>

          <div class="field">
            <label class="label" for="p2">Повтори пароль</label>
            <input class="input" id="p2" type="password" autocomplete="new-password" required />
          </div>

          <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

          <div class="row" style="margin-top:10px;">
            <a class="link" href="#" id="back">← Назад</a>
          </div>

          <button class="btn btn-primary" type="submit">Сохранить пароль</button>
        </form>
      </section>
    `);

    const oldBtn = document.getElementById('scrollTopBtn');
    if (oldBtn) oldBtn.remove();

    document.getElementById('back').onclick = (e) => {
      e.preventDefault();
      // убираем токен из адреса (чтобы не застревал)
      history.replaceState(null, '', '/reset');
      sessionStorage.removeItem('cyb_recovery_mode');
      CybRouter.navigate('username');
    };

    const msgEl = document.getElementById('msg');
    const showMsg = (type, text) => {
      msgEl.style.display = '';
      msgEl.className = `msg msg--${type}`;
      msgEl.textContent = text;
    };
    const clearMsg = () => {
      msgEl.style.display = 'none';
      msgEl.className = 'msg';
      msgEl.textContent = '';
    };

    document.getElementById('fReset').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const oldText = btn.textContent;

      btn.disabled = true;
      btn.textContent = 'Сохраняю…';

      clearMsg();

      const p1 = document.getElementById('p1').value;
      const p2 = document.getElementById('p2').value;

      if (
        !/[A-Z]/.test(p1) ||
        !/[a-z]/.test(p1) ||
        !/\d/.test(p1) ||
        !/[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/.test(p1)
      ) {
        showMsg('error', 'Пароль не соответствует требованиям.');
        return;
      }

      if (!/^[\x20-\x7E]*$/.test(p1))
        return showMsg('warn', 'Нельзя использовать рус/укр буквы и не-ASCII символы.');
      if (p1.length < 8) return showMsg('warn', 'Пароль должен быть минимум 8 символов.');
      if (p1 !== p2) return showMsg('error', 'Пароли не совпадают.');

      try {
        const res = await apiCall('/auth/recovery/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: p1 }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const err = data?.error || 'Не удалось сменить пароль.';
          showMsg('error', `Ошибка: ${err}`);
          return;
        }

        showMsg('ok', 'Пароль обновлён ✅ Теперь можно войти.');
        // чистим токен в URL
        setTimeout(() => {
          history.replaceState(null, '', '/reset');
          sessionStorage.removeItem('cyb_recovery_mode');
          CybRouter.navigate('username');
        }, 900);
      } catch {
        showMsg('error', 'Ошибка сети. Попробуй ещё раз.');
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });

    return;
  }
  // 2) Режим: "запросить письмо" (нет token) — сразу нужный режим (без вкладок)
  const mode = forcedMode === 'username' ? 'username' : 'password';

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${mode === 'password' ? 'Восстановление пароля' : 'Восстановление логина'}</h1>
        </div>
      </div>

      <form id="fStart">
        <div class="field">
          <label class="label" for="email">Email</label>
          <input class="input" id="email" type="email" autocomplete="email"
            placeholder="name@example.com" required />
        </div>

        <div class="field" style="margin-top:12px;">
          <div class="cf-turnstile"></div>
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <div class="row" style="margin-top:10px;">
          <a class="link" href="#" id="back">← Назад</a>
        </div>

        <button class="btn btn-primary" type="submit" id="sendBtn">
          ${mode === 'password' ? 'Отправить ссылку для сброса' : 'Отправить логин на email'}
        </button>
      </form>

      <p style="margin:12px 0 0;color:var(--muted);font-size:12px;line-height:1.5;">
        Для безопасности мы не уточняем, есть ли такой email. Если он зарегистрирован — письмо придёт.
      </p>
    </section>
  `);

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const msgEl = document.getElementById('msg');
  const showMsg = (type, text) => {
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  };
  const clearMsg = () => {
    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  };

  document.getElementById('back').onclick = (e) => {
    e.preventDefault();
    sessionStorage.removeItem('cyb_recovery_mode');
    CybRouter.navigate('username');
  };

  // Turnstile reset/init
  if (window.turnstile && turnstileWidgetId !== null) {
    try {
      turnstile.remove(turnstileWidgetId);
    } catch {}
    turnstileWidgetId = null;
  }
  turnstileToken = '';
  initTurnstile();

  document.getElementById('fStart').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sendBtn');
    if (btn.disabled) return;

    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Отправляю…';

    clearMsg();

    const email = document.getElementById('email').value.trim();
    if (!email) return showMsg('warn', 'Введите email.');
    if (!turnstileToken) return showMsg('warn', 'Подтверди, что ты не робот (Turnstile).');

    try {
      const res = await apiCall('/auth/recovery/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mode, turnstileToken }),
      });

      await res.json().catch(() => ({}));

      showMsg(
        'ok',
        mode === 'password'
          ? 'Если email существует — мы отправили ссылку для сброса ✅'
          : 'Если email существует — мы отправили логин ✅'
      );

      // сброс капчи
      if (window.turnstile && turnstileWidgetId !== null) {
        try {
          turnstile.reset(turnstileWidgetId);
        } catch {}
      }
      turnstileToken = '';
    } catch {
      showMsg('error', 'Ошибка сети. Попробуй ещё раз.');
      if (window.turnstile && turnstileWidgetId !== null) {
        try {
          turnstile.reset(turnstileWidgetId);
        } catch {}
      }
      turnstileToken = '';
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });

  return;
}

function viewVerifyEmail() {
  setNoStrawberries(false);

  const q = getQuery();
  const token = (q.get('token') || '').trim();

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Подтверждение email</h1>
        </div>
      </div>

      <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

      <div style="display:grid;gap:10px;margin-top:8px;">
        <button class="btn btn-primary" id="verifyBtn" type="button">
          Подтвердить
        </button>

        <button class="btn btn-outline" id="toLoginBtn" type="button">
          Вернуться
        </button>
      </div>

      <p style="margin:12px 0 0;color:var(--muted);font-size:12px;line-height:1.5;">
        Если ссылка просрочена — зайдите в профиль и нажмите “Отправить письмо ещё раз”.
      </p>
    </section>
  `);

  const msgEl = document.getElementById('msg');
  const showMsg = (type, text) => {
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  };

  document.getElementById('toLoginBtn').onclick = async () => {
    const ok = await checkSession();
    if (ok) CybRouter.navigate('account-profile');
    else CybRouter.navigate('username');
  };

  const btn = document.getElementById('verifyBtn');

  if (!token) {
    btn.disabled = true;
    showMsg('error', 'Токен не найден в ссылке.');
    return;
  }

  btn.onclick = async () => {
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Проверяю…';

    try {
      const res = await apiCall(
        `${API_BASE}/auth/email/verify?token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = String(data?.error || '');
        if (err === 'token_expired') showMsg('warn', 'Ссылка просрочена. Отправь письмо заново.');
        else if (err === 'token_used') showMsg('warn', 'Ссылка уже использована.');
        else if (err === 'email_changed')
          showMsg('warn', 'Email был изменён. Отправь подтверждение заново из профиля.');
        else
          showMsg('error', data?.error ? `Ошибка: ${data.error}` : 'Не удалось подтвердить email.');
        return;
      }

      showMsg(
        'ok',
        data?.alreadyVerified ? 'Email уже был подтверждён ✅' : 'Email подтверждён ✅'
      );

      // ✅ сигнал всем вкладкам, что email подтверждён
      setStorage('cyb_email_verified_ping', Date.now());

      // Использование getStorage для получения значения

      const Verified = getStorage('cyb_email_verified_ping');

      // ✅ если пользователь уже залогинен — показываем окошко и ведём в безопасность
      const logged = await checkSession();

      if (logged) {
        showInfoModal({
          title: 'Готово ✅',
          text: data?.alreadyVerified
            ? 'Email уже был подтверждён ранее. Статус аккаунта обновлён.'
            : 'Спасибо 🥹 Почта подтверждена.',
          onOk: () => CybRouter.navigate('account-security'),
        });
        // чистим токен из URL
        history.replaceState(null, '', '/verify-email');
        return;
      }

      // Если не залогинен, для “редиректа в этой же вкладке”
      setStorage('cyb_email_just_verified', '1', sessionStorage);
      // чистим токен из URL
      history.replaceState(null, '', '/verify-email');

      setTimeout(async () => {
        const ok = await checkSession();
        if (ok) CybRouter.navigate('account-security');
        else CybRouter.navigate('username');
      }, 650);
    } catch {
      showMsg('error', 'Ошибка сети.');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  };

  // авто-попытка (приятнее UX)
  btn.click();
}

function view2FAVerify() {
  const userId = getStorage('cyb_2fa_userId', '', sessionStorage);
  if (!userId) {
    CybRouter.navigate('username');
    return;
  }

  setNoStrawberries(false);

  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Двухфакторная аутентификация</h1>
        </div>
      </div>

      <p style="margin:0 0 16px;color:var(--muted);font-size:13px;text-align:center;">
        Введите код из приложения аутентификатора или резервный код.
      </p>

      <form id="f2fa">
        <div class="field">
          <label class="label" for="code2fa">Код подтверждения</label>
          <input class="input" id="code2fa" type="text" inputmode="numeric" 
                 autocomplete="one-time-code" required 
                 placeholder="000000" maxlength="20" 
                 style="text-align:center;font-size:20px;letter-spacing:4px;" />
        </div>

        <div style="margin:12px 0;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;">
            <input type="checkbox" id="rememberDevice" style="cursor:pointer;" />
            <span>Запомнить устройство на 30 дней</span>
          </label>
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <div class="row" style="margin-top:10px;">
          <a class="link" href="#" id="back">← Назад</a>
        </div>

        <button class="btn btn-primary" type="submit">Подтвердить</button>
      </form>
    </section>
  `);

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const msgEl = document.getElementById('msg');
  const codeEl = document.getElementById('code2fa');

  function showMsg(type, text) {
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  }

  function clearMsg() {
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }

  document.getElementById('back').onclick = (e) => {
    e.preventDefault();
    sessionStorage.removeItem('cyb_2fa_userId');
    CybRouter.navigate('username');
  };

  codeEl?.addEventListener('input', clearMsg);

  document.getElementById('f2fa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldText = btn.textContent;

    clearMsg();

    const code = codeEl.value.trim().replace(/[\\s-]/g, '');
    if (!code) {
      showMsg('error', 'Введите код.');
      codeEl?.focus();
      return;
    }

    const rememberDevice = document.getElementById('rememberDevice')?.checked || false;

    btn.disabled = true;
    btn.textContent = 'Проверяю…';

    try {
      const res = await apiCall('/auth/2fa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code,
          rememberDevice,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = String(data?.error || '');
        if (err === 'invalid_code') {
          showMsg('error', 'Неверный код. Проверьте и попробуйте снова.');
          codeEl?.select();
        } else if (err === '2fa_not_enabled') {
          showMsg('error', '2FA не активирована для этого аккаунта.');
        } else {
          showMsg('error', data?.error ? `Ошибка: ${data.error}` : 'Не удалось проверить код.');
        }
        return;
      }

      // Успех
      sessionStorage.removeItem('cyb_2fa_userId');

      // Сохраняем токен устройства, если он был возвращен
      if (data.deviceToken) {
        localStorage.setItem('cyb_device_token', data.deviceToken);
        console.log('Device token saved for 30 days');
      }

      if (data.usedBackupCode) {
        showMsg('ok', '✅ Вход выполнен с резервным кодом! Перенаправляю…');
      } else {
        showMsg('ok', '✅ Код подтверждён! Перенаправляю…');
      }

      const okSession = await checkSession();
      if (!okSession) {
        showMsg('warn', 'Вход успешный, но сессия не сохранилась.');
        return;
      }

      // ✅ Синхронизируем флаг strawberry с сервером
      try {
        const meRes = await apiCall('/auth/me', { method: 'GET', credentials: 'include' });
        const meData = await meRes.json().catch(() => null);

        // Проверяем обе возможные структуры ответа
        const hasStrawberry = !!(
          meRes.ok &&
          meData?.ok &&
          (meData?.user?.easter?.strawberry || meData?.easter?.strawberry)
        );

        const hasStrawberryLocally = hasStrawberryAccess();

        // Если есть локально, но нет на сервере - отправляем
        if (hasStrawberryLocally && !hasStrawberry) {
          console.log('🍓 2FA: syncing local strawberry to server...');
          try {
            const syncRes = await apiCall('/auth/easter/strawberry', {
              method: 'POST',
              credentials: 'include',
            });
            if (syncRes.ok) {
              console.log('✅ Strawberry synced to server after 2FA!');
            } else {
              console.warn('⚠️ Failed to sync strawberry to server');
            }
          } catch (syncErr) {
            console.warn('⚠️ Error syncing strawberry:', syncErr);
          }
        } else if (hasStrawberry) {
          setStrawberryAccess();
          console.log('✅ Флаг strawberry синхронизирован после 2FA');
        }
      } catch (e) {
        console.warn('Не удалось синхронизировать флаг strawberry:', e);
      }

      // ✅ Синхронизируем флаг dark_trigger с сервером
      try {
        const meRes = await apiCall('/auth/me', { method: 'GET', credentials: 'include' });
        const meData = await meRes.json().catch(() => null);

        const hasDarkTrigger = !!(
          meRes.ok &&
          meData?.ok &&
          (meData?.user?.easter?.darkTrigger || meData?.easter?.darkTrigger)
        );

        const hasDarkTriggerLocally = hasDarkTriggerAccess();

        // Если есть локально, но нет на сервере - отправляем
        if (hasDarkTriggerLocally && !hasDarkTrigger) {
          console.log('🌑 2FA: syncing local dark trigger to server...');
          try {
            const syncRes = await apiCall('/auth/easter/dark-trigger', {
              method: 'POST',
              credentials: 'include',
            });
            if (syncRes.ok) {
              console.log('✅ Dark trigger synced to server after 2FA!');
            } else {
              console.warn('⚠️ Failed to sync dark trigger to server');
            }
          } catch (syncErr) {
            console.warn('⚠️ Error syncing dark trigger:', syncErr);
          }
        } else if (hasDarkTrigger) {
          setDarkTriggerAccess();
          console.log('✅ Флаг dark trigger синхронизирован после 2FA');
        }
      } catch (e) {
        console.warn('Не удалось синхронизировать флаг dark trigger:', e);
      }

      setTimeout(() => {
        CybRouter.navigate('account-security');
      }, 500);
    } catch (err) {
      console.error('2FA verify error:', err);
      showMsg('error', 'Ошибка сети. Попробуйте снова.');
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });

  // Автофокус на поле кода
  setTimeout(() => codeEl?.focus(), 100);
}

async function viewDone() {
  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Вы вышли 👋</h1>
          
        </div>
      </div>

      <p style="margin:0;color:var(--muted);font-size:13px;">
        Сессия завершена. Вы успешно вышли из аккаунта.
      </p>

      <button class="btn btn-primary" id="toUser" style="margin-top:16px;">
        Вернуться к входу
      </button>
    </section>
  `);
  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  try {
    await apiCall('/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (e) {
    console.warn('Logout failed:', e);
  }

  document.getElementById('toUser').onclick = () => CybRouter.navigate('username');
}

// ACCOUNT PAGE

function shortId(s, left = 6, right = 6) {
  s = String(s || '');
  if (s.length <= left + right + 3) return s;
  return s.slice(0, left) + '…' + s.slice(-right);
}

function formatPublicId(publicId) {
  const n = Number(publicId);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `CYB - ${n}`;
}

function getUserStatus(user) {
  // 1) Жёсткие статусы (перебивают всё)
  if (user.isBlocked || user.flags?.includes('banned')) {
    return {
      main: { label: 'Заблокирован', cls: 'status--blocked' },
      badges: [],
    };
  }

  // 2) Роли (важные)
  if (user.role === 'admin' || user.flags?.includes('admin')) {
    return {
      main: { label: 'Администратор', cls: 'status--admin' },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }
  if (user.role === 'moderator' || user.flags?.includes('moderator')) {
    return {
      main: { label: 'Модератор', cls: 'status--mod' },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }

  // 3) Вычисляем “ранг” по дням и количеству сессий
  const days = user.createdAt ? Math.floor((Date.now() - user.createdAt) / 86400000) : 0;

  const sessionsCount = Number(user.sessionsCount || 0);

  // Примерная шкала (можешь подогнать):
  // - новичок: < 7 дней ИЛИ < 3 сессий
  // - активный: >= 7 дней И >= 5 сессий
  // - частый гость: >= 30 дней И >= 20 сессий
  // - ветеран: >= 180 дней И >= 80 сессий
  let main;

  if (days < 7 || sessionsCount < 3) {
    main = { label: 'Новичок', cls: 'status--newbie' };
  } else if (days < 30 || sessionsCount < 20) {
    main = { label: 'Активный', cls: 'status--active' };
  } else if (days < 180 || sessionsCount < 80) {
    main = { label: 'Постоянный', cls: 'status--regular' };
  } else {
    main = { label: 'Ветеран', cls: 'status--veteran' };
  }

  // 4) Бейджи-флаги (показываются рядом)
  const badges = buildBadges(user);

  return { main, badges };
}

function buildBadges(user, opts = {}) {
  const includeRoleBadges = opts.includeRoleBadges !== false;
  const flags = new Set(user.flags || []);

  const badges = [];

  // emailVerified
  if (user.emailVerified) {
    badges.push({ 
      label: '<svg class="verified-icon-inline" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#3b82f6"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', 
      cls: 'badge--verified',
      title: 'Verified'
    });
  } else {
    badges.push({ label: 'Not verified', cls: 'badge--warn' }); // опционально
  }

  // 2FA
  if (user.twoFactorEnabled || flags.has('2fa')) {
    badges.push({ label: '2FA', cls: 'badge--ok' });
  }

  // “Dev” / “Creator”
  if (flags.has('dev') || flags.has('developer')) {
    badges.push({ label: 'Dev', cls: 'badge--dev' });
  }

  // Premium / Sponsor
  if (flags.has('premium') || flags.has('sponsor')) {
    badges.push({ label: '★', cls: 'badge--premium', title: 'Premium' });
  }

  // Contributor / Helper
  if (flags.has('helper') || flags.has('contributor')) {
    badges.push({ label: 'Helper', cls: 'badge--info' });
  }

  // role badges (если хочешь дублировать роль бейджом)
  if (includeRoleBadges) {
    if (user.role === 'admin') badges.push({ label: 'ADMIN', cls: 'badge--admin' });
    if (user.role === 'moderator') badges.push({ label: 'MODERATOR', cls: 'badge--mod' });
  }

  // Custom flags — пример
  if (flags.has('trusted')) badges.push({ label: 'Trusted', cls: 'badge--ok' });
  if (flags.has('beta')) badges.push({ label: 'Beta', cls: 'badge--beta' });

  // Убираем “No Email” если тебе не нужно “негативное”
  // return badges.filter(b => b.label !== 'No Email');
  return badges;
}

function fmtTs(ms) {
  if (!ms) return '—';
  const n = Number(ms);
  if (!Number.isFinite(n)) return '—';

  // Автоматически определяем формат timestamp (секунды или миллисекунды)
  // Если timestamp больше 10 миллиардов, то это миллисекунды
  const timestamp = n > 10000000000 ? n : n * 1000;

  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';

  // красивый RU формат + без секунд
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

async function fetchMe() {
  const res = await apiCall('/auth/me');
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function syncUser(u) {
  try {
    const { res, data } = await fetchMe();
    if (!res.ok || !data?.ok) return false;
    Object.assign(u, data.user || {});
    return true;
  } catch {
    return false;
  }
}

// маленький helper, чтобы не забывать обновлять UI
function updateEmailUiFromUser(u, refs) {
  const { item, panel, inp, statusEl, hintEl, setStatusFromUser, setBadgeFromUser } = refs;

  // строка email в карточке
  const sub = item?.querySelector('.sec-sub');
  if (sub) sub.textContent = u.email || 'Не указан';

  // статус в панели
  setStatusFromUser?.(u);

  // бейдж справа
  setBadgeFromUser?.(u);

  // input если панель открыта
  if (panel && panel.style.display !== 'none' && inp) inp.value = u.email || '';
}

async function viewAccount(tab = 'profile') {
  // Общие переменные для отслеживания статуса безопасности
  let twoFAEnabled = false;
  let passkeyCount = 0;
  let emailVerified = false;

  // Функция обновления индикатора безопасности
  function updateSecurityIndicator() {
    console.log('[SECURITY-INDICATOR-v3] START');

    try {
      const progressBar = document.getElementById('securityProgressBar');
      const scoreText = document.getElementById('securityScoreText');
      const check2FA = document.getElementById('2fa-check');
      const checkPasskey = document.getElementById('passkey-check');
      const itemSecurityCheck = document.getElementById('secSecurityCheckItem');
      const panelSecurityCheck = document.getElementById('secSecurityCheckPanel');
      const securityStatusBadge = document.getElementById('securityStatusBadge');
      const securityRecommendations = document.getElementById('securityRecommendations');

      console.log('[SECURITY-INDICATOR-v3] Values:', {
        twoFAEnabled,
        passkeyCount,
        emailVerified,
        hasProgressBar: !!progressBar,
        hasScoreText: !!scoreText,
      });

      if (!progressBar || !scoreText) {
        console.log('[SECURITY-INDICATOR-v3] DOM elements not found, skipping update');
        return;
      }

      let score = emailVerified ? 30 : 0;

      if (twoFAEnabled) {
        score += 40;
        if (check2FA) {
          check2FA.innerHTML = `
          <div style="font-size:18px;">✅</div>
          <div style="flex:1;font-size:13px;">Двухфакторная аутентификация включена</div>
          <div style="font-size:12px;color:#4ade80;font-weight:600;">Выполнено</div>
        `;
          check2FA.style.opacity = '0.7';
        }
      }

      if (passkeyCount > 0) {
        score += 30;
        if (checkPasskey) {
          checkPasskey.innerHTML = `
          <div style="font-size:18px;">✅</div>
          <div style="flex:1;font-size:13px;">Ключ доступа (Passkey) добавлен</div>
          <div style="font-size:12px;color:#4ade80;font-weight:600;">Выполнено</div>
        `;
          checkPasskey.style.opacity = '0.7';
        }
      }

      const color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
      const shieldColor = score >= 100 ? '#22c55e' : score >= 50 ? '#fbbf24' : '#ef4444';
      const badgeText = score >= 100 ? '✓ Защищён' : score >= 50 ? '⚠ Средняя' : '⚠ Низкая';
      const itemTitle = score >= 100 ? 'Ваш аккаунт под защитой' : 'Проверка безопасности';
      const itemSubtitle =
        score >= 100
          ? 'Ваш аккаунт прошёл Проверку безопасности'
          : 'Обнаружены рекомендации по защите';

      // Обновляем прогресс-бар и процент
      progressBar.style.width = `${score}%`;
      progressBar.style.background = color;
      scoreText.textContent = `${score}%`;
      scoreText.style.color = color;

      // Обновляем заголовок и подзаголовок секции
      if (itemSecurityCheck) {
        const titleElem = itemSecurityCheck.querySelector('.sec-title');
        const subtitleElem = itemSecurityCheck.querySelector('.sec-sub');
        const iconContainer = itemSecurityCheck.querySelector('.sec-left > div > div');

        if (titleElem) titleElem.textContent = itemTitle;
        if (subtitleElem) subtitleElem.textContent = itemSubtitle;

        // Обновляем иконку (PNG при 100%, SVG щит при меньше)
        if (iconContainer) {
          if (score >= 100) {
            iconContainer.innerHTML = `<img src="/assets/img/security/okey_64.png" width="32" height="32" alt="Защищён" style="display:block;" />`;
          } else {
            const svgColor = score >= 50 ? '#fbbf24' : '#ef4444';
            iconContainer.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 6V11C4 16.55 7.84 21.74 13 23C18.16 21.74 22 16.55 22 11V6L12 2Z" fill="${svgColor}" opacity="0.9"/>
          </svg>`;
          }
        }
        securityStatusBadge.textContent = badgeText;
        securityStatusBadge.style.color = shieldColor;
      }

      // Обновляем блок рекомендаций
      if (securityRecommendations) {
        if (score >= 100) {
          securityRecommendations.innerHTML = `
          <div style="padding:10px;background:rgba(34,197,94,.15);border-radius:6px;border-left:3px solid #22c55e;">
            <div style="font-size:12px;font-weight:600;margin-bottom:4px;">🎉 Превосходно!</div>
            <div style="font-size:12px;opacity:0.9;">Ваш аккаунт под надёжной защитой. Рекомендуемых действий не найдено.</div>
          </div>
        `;
        } else {
          const recommendationText =
            score < 30
              ? 'Начните с подтверждения email и включения 2FA для базовой защиты аккаунта.'
              : score < 50
                ? 'Добавьте еще несколько методов защиты для повышения безопасности.'
                : 'Отлично! Осталось совсем немного для максимальной защиты.';
          securityRecommendations.innerHTML = `
          <div style="padding:10px;background:rgba(59,130,246,.15);border-radius:6px;border-left:3px solid #3b82f6;">
            <div style="font-size:12px;font-weight:600;margin-bottom:4px;">💡 Рекомендация</div>
            <div style="font-size:12px;opacity:0.9;">${recommendationText}</div>
          </div>
        `;
        }
      }

      // Автоматически управляем видимостью панели
      if (panelSecurityCheck) {
        // Открываем если score < 100, закрываем если score >= 100
        if (score < 100) {
          panelSecurityCheck.style.display = 'block';
        } else {
          panelSecurityCheck.style.display = 'none';
        }
      }

      console.log('[SECURITY-INDICATOR-v3] DONE - score:', score, 'color:', color);
    } catch (err) {
      console.error('[SECURITY-INDICATOR-v3] ERROR:', err);
    }
  }

  // ✅ убираем клубничный фон
  setNoStrawberries(true);

  // UI skeleton
  app.innerHTML = `
    <div class="account-page">
      <div class="account-wrap">
        <aside class="account-sidebar">
          <div class="account-brand">
            <a href="https://cyblight.org/"
             aria-label="Главная страница" title="Открыть главную страницу">
            <img src="/assets/img/logo.svg" alt="CybLight" />
            </a>
            <div>
              <div style="font-weight:800;font-size:16px;line-height:1;">Учётка</div>
              <div id="accLogin" style="opacity:.75;font-size:13px;margin-top:4px;">…</div>
            </div>
          </div>

          <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

          <nav class="account-nav">
            <button data-tab="profile"><span class="nav-icon">👤</span> Профиль</button>
            <button data-tab="friends"><span class="nav-icon">👥</span> Друзья</button>
            <button data-tab="messages"><span class="nav-icon">💬</span> Сообщения</button>
            <button data-tab="security"><span class="nav-icon">🛡️</span> Безопасность</button>
            <button data-tab="sessions"><span class="nav-icon">🧩</span> Сессии</button>
            <button data-tab="easter"><span class="nav-icon">🍓</span> Пасхалки</button>
          </nav>

          <div style="margin-top:14px;display:grid;gap:10px;" id="accountActions">
            <button class="btn btn-primary" id="logoutBtn" type="button">Выйти</button>
          </div>
        </aside>

        <main class="account-main">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-size:22px;font-weight:900;">${tabTitle(tab)}</div>
              ${
                tab === 'profile' || tab === 'easter'
                  ? ''
                  : `<div style="opacity:.75;font-size:13px;margin-top:4px;">Управление аккаунтом</div>`
              }
            </div>
            <div style="opacity:.65;font-size:12px;" id="metaLine"></div>
          </div>

          <div style="height:1px;background:rgba(255,255,255,.08);margin:14px 0;"></div>

          <div id="accBody" style="color:var(--muted);font-size:13px;">Загружаю…</div>
        </main>
      </div>

      <footer class="auth-footer">
        <div class="footer-row">
          <div class="footer-copy">
          <p class="footer-text" dir="ltr" lang="en">
         © ${new Date().getFullYear()} CybLight
         </p>
          </div>
          <div class="footer-links">
            <a class="footer-brand" href="https://cyblight.org/" aria-label="Главная страница" target="_blank" rel="noopener">
            <img src="/assets/img/logo.svg" class="footer-logo" alt="CybLight" /><span>CybLight.org</span></a>

            <a class="report-btn" href="#" onclick="showReportModal(); return false;">
              <img src="/assets/img/report.svg" alt="Report" class="report-icon" />
              Сообщить о проблеме
            </a>

            <a href="#" onclick="return false;">Условия использования</a>
            <a href="https://cyblight.org/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a>
            <a href="#" onclick="return false;">Настройки конфиденциальности</a>
          </div>
        </div>
      </footer>
    </div>
  `;

  // msg
  const msgEl = document.getElementById('msg');
  const showMsg = (type, text) => {
    if (!msgEl) return;
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  };
  const clearMsg = () => {
    if (!msgEl) return;
    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  };

  // sidebar active
  document.querySelectorAll('.account-nav button').forEach((b) => {
    if (b.dataset.tab === tab) b.classList.add('active');
    b.onclick = () => {
      const t = b.dataset.tab;
      if (!t) return;
      // отдельные роуты под вкладки
      const map = {
        profile: 'account-profile',
        security: 'account-security',
        sessions: 'account-sessions',
        easter: 'account-easter-eggs',
        friends: 'account-friends',
        messages: 'account-messages',
      };
      CybRouter.navigate(map[t] || 'account-profile');
    };
  });

  // logout
  document.getElementById('logoutBtn').onclick = async () => {
    clearMsg();
    try {
      await apiCall('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    // Очищаем cookie локально
    clearAuthCookie();
    // ✅ возвращаем “обычный” режим с клубникой
    setNoStrawberries(false);
    // Показываем уведомление об успешном выходе
    showTopNotification(
      'success',
      'Выход из системы завершен. Вы можете продолжить работу в общедоступных разделах сайта.'
    );
    CybRouter.navigate('username');
  };

  // load me
  let me = null;
  try {
    // Небольшая задержка чтобы дать браузеру время установить cookie после логина
    await new Promise((resolve) => setTimeout(resolve, 200));

    const { res, data } = await fetchMe();
    console.log('viewAccount fetchMe result:', { ok: res.ok, status: res.status, data });

    if (!res.ok || !data?.ok) {
      console.warn('viewAccount: Not authenticated, redirecting to username', {
        status: res.status,
        data,
      });
      setNoStrawberries(false);
      CybRouter.navigate('username');
      return;
    }
    me = data;

    // ✅ если сервер прислал флаг (будет после доработки API) — сохраняем локально
    console.log('viewAccount - me data:', me);
    console.log('viewAccount - strawberry check:', {
      hasUser: !!me?.user,
      hasEaster: !!me?.user?.easter,
      strawberry: me?.user?.easter?.strawberry,
      localStorageHas: hasStrawberryAccess(),
    });

    if (me?.user?.easter?.strawberry) {
      setStrawberryAccess();
      console.log('✅ Флаг strawberry синхронизирован из viewAccount');
    } else {
      console.log('❌ Флаг strawberry не найден в ответе /auth/me');
    }

    if (me?.user?.easter?.darkTrigger) {
      setDarkTriggerAccess();
      console.log('✅ Флаг dark trigger синхронизирован из viewAccount');
    } else {
      console.log('❌ Флаг dark trigger не найден в ответе /auth/me');
    }

    // header
    const login = me?.user?.login || getStorage('cyb_login', '', sessionStorage) || 'Пользователь';
    const acc = document.getElementById('accLogin');
    if (acc) acc.textContent = login;

    // ⚠️ Проверка на неверифицированный аккаунт и отображение предупреждения
    const daysUntilDeletion = me?.user?.daysUntilDeletion;
    if (daysUntilDeletion !== null && daysUntilDeletion !== undefined) {
      const msgDiv = document.getElementById('msg');
      if (msgDiv) {
        let warningClass = 'msg-warn';
        let warningText = '';

        if (daysUntilDeletion === 0) {
          warningClass = 'msg-error';
          warningText = `<strong>⚠️ Внимание!</strong> Ваш аккаунт будет удалён сегодня. Добавьте email в разделе "Профиль" чтобы сохранить доступ!`;
        } else if (daysUntilDeletion <= 7) {
          warningClass = 'msg-error';
          warningText = `<strong>⚠️ Внимание!</strong> До удаления аккаунта осталось <b>${daysUntilDeletion} ${daysUntilDeletion === 1 ? 'день' : daysUntilDeletion <= 4 ? 'дня' : 'дней'}</b>. Добавьте email в разделе "Профиль"!`;
        } else {
          warningText = `<strong>ℹ️ Важно:</strong> Добавьте email для подтверждения аккаунта. До удаления: <b>${daysUntilDeletion} ${daysUntilDeletion === 1 ? 'день' : daysUntilDeletion <= 4 ? 'дня' : 'дней'}</b>.`;
        }

        msgDiv.className = `msg ${warningClass}`;
        msgDiv.innerHTML = warningText;
        msgDiv.style.display = 'block';
      }
    }

    // Кнопка администратора (только для админа)
    const isAdmin = me?.user?.role === 'admin' || me?.user?.flags?.includes('admin');
    if (isAdmin) {
      const actionsDiv = document.getElementById('accountActions');
      if (actionsDiv) {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'btn btn-outline';
        adminBtn.textContent = '⚙️ Панель администратора';
        adminBtn.type = 'button';
        adminBtn.onclick = () => {
          window.open('https://admin.cyblight.org', '_blank', 'noopener,noreferrer');
        };
        // Вставляем кнопку перед кнопкой "Выйти"
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
          actionsDiv.insertBefore(adminBtn, logoutBtn);
        }
      }
    }

    if (tab === 'sessions') {
      const body = document.getElementById('accBody');
      body.innerHTML = `<div style="opacity:.75">Загружаю список устройств…</div>`;

      try {
        const r = await apiCall('/auth/sessions', { credentials: 'include' });
        const d = await r.json().catch(() => null);
        if (r.ok && d?.ok) {
          // Сервер возвращает { ok: true, data: { current: ..., sessions: [...] } }
          const sessionsData = d.data || d;
          body.innerHTML = renderSessionsTable(sessionsData, me);
          bindSessionsTable(sessionsData, { showMsg, clearMsg });
        } else {
          body.innerHTML = renderTabHtml(tab, me);
          showMsg('error', 'Не удалось получить список сессий.');
        }
      } catch {
        body.innerHTML = renderTabHtml(tab, me);
        showMsg('error', 'Ошибка сети при загрузке сессий.');
      }

      return; // важно: чтобы ниже не перетерло body
    }
  } catch {
    showMsg('error', 'Не удалось загрузить профиль. Проверь интернет и попробуй ещё раз.');
    return;
  }

  function renderSessionsTable(data, me) {
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const current = data.current;

    const rows = sessions
      .map((s) => {
        const ua = parseUA(s.user_agent || '');
        const isCur = s.id === current;

        // Используем deviceIcon и browser/os из бэкенда, если доступны
        const deviceIcon = s.deviceIcon || (ua.isMobile ? '📱' : '💻');
        const browser = s.browser || ua.browser || 'Browser';
        const os = s.os || ua.os || 'Unknown OS';
        const deviceType = s.deviceType || ua.deviceType || 'desktop';

        // Cтроки:
        let line1 = ''; // верхняя строка (имя)
        let line2 = ''; // нижняя строка (версия/модель)

        // Если это вход из приложения — показываем устройство/модель (если когда-то появится маркер isApp)
        if (ua.isApp) {
          const devName = String(s.device_name || s.device || '').trim();
          line1 = devName && devName.toLowerCase() !== 'pc' ? devName : 'CybLight App';
          line2 = String(s.model || ua.model || '').trim();
        } else {
          // Обычный браузер
          line1 = browser;
          line2 = browser !== os ? `${browser} на ${os}` : '';
        }

        const loc = [s.city, s.region, countryFull(s.country)].filter(Boolean).join(', ') || '—';
        const lastLogin = s.created_at; // когда вошёл (создал сессию)
        const lastSeen = s.last_seen_at || s.created_at; // когда последний раз был активен

        return `
        <tr class="${isCur ? 'is-current' : ''}">
          <td data-label="Device">
            <div class="dev">
              <div class="dev-top">

                <span class="dev-ico" aria-hidden="true" style="font-size:24px;">
                ${deviceIcon}
                </span>

                <div class="dev-text">
                  <div class="dev-name-row">
                    <span class="dev-name">${escapeHtml(line1)}</span>
                    ${isCur ? '<span class="pill">Текущая</span>' : ''}
                  </div>
              
                  ${
                    line2
                      ? `<div class="dev-sub mono">
                    ${escapeHtml(line2 || '—')}
                  </div>`
                      : ``
                  }
                </div>
              </div>
            </div>
          </td>

          <td data-label="OS">${escapeHtml(os)}</td>
          <td data-label="Location" title="Edge: ${s.colo || '—'}">${escapeHtml(loc)}</td>
          <td data-label="Last Login">${escapeHtml(fmtTs(lastLogin))}</td>
          <td data-label="Last Seen">${escapeHtml(fmtTs(lastSeen))}</td>

          <td class="td-action" data-label="Action" style="text-align:right;">
            <button class="icon-btn" type="button" title="Завершить" data-revoke="${escapeHtml(
              s.id
            )}">
              ⎋
            </button>
          </td>
        </tr>
      `;
      })
      .join('');

    const sessionsCount = Number(me.sessionsCount || sessions.length || 0);

    return `
    <div class="sessions-head">
      <div style="opacity:.8">Активных сессий: <b>${sessionsCount}</b></div>
      <button class="btn btn-outline" id="logoutOthersBtn" type="button" ${
        sessionsCount <= 1 ? 'disabled style="opacity:.55;cursor:not-allowed;"' : ''
      }>
        Выход из всех, кроме текущей
      </button>
    </div>

    <div class="sessions-table-wrap">
      <table class="sessions-table">
        <thead>
          <tr>
            <th>Device</th>
            <th>OS</th>
            <th>Location</th>
            <th>Last Login</th>
            <th>Last Seen</th>
            <th style="text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6" style="opacity:.7;padding:14px;">Нет сессий</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  }

  function bindSessionsTable(data, api) {
    // revoke single
    document.querySelectorAll('[data-revoke]').forEach((b) => {
      b.onclick = async () => {
        api.clearMsg();
        const sid = b.getAttribute('data-revoke');
        b.disabled = true;

        try {
          const r = await apiCall('/auth/sessions/revoke', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sid }),
          });
          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось завершить сессию.');
          } else {
            api.showMsg('ok', 'Сессия завершена ✅');
            // если это была текущая — улетишь на логин
            if (d.loggedOut) {
              setNoStrawberries(false);
              CybRouter.navigate('username');
              return;
            }
            setTimeout(() => CybRouter.navigate('account-sessions'), 300);
          }
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          b.disabled = false;
        }
      };
    });

    // logout others (если есть твой старый endpoint)
    const lo = document.getElementById('logoutOthersBtn');
    if (lo && !lo.disabled) {
      lo.onclick = async () => {
        api.clearMsg();
        lo.disabled = true;

        try {
          const r = await apiCall('/auth/logout-others', {
            method: 'POST',
            credentials: 'include',
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось.');
          else api.showMsg('ok', `Готово ✅ Завершено: ${d.removed ?? 0}`);
          setTimeout(() => CybRouter.navigate('account-sessions'), 350);
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          lo.disabled = false;
        }
      };
    }
  }

  if (me?.meta?.time) {
    document.getElementById('metaLine').textContent = new Date(me.meta.time).toLocaleString();
  }

  // render tab
  const body = document.getElementById('accBody');
  body.innerHTML = renderTabHtml(tab, me);

  // Вычисляем emailVerified из данных пользователя
  const u = me?.user || {};
  emailVerified =
    u.emailVerified === true ||
    u.email_verified === true ||
    u.email_verified === 1 ||
    u.email_verified === '1' ||
    Boolean(u.email_verified_at || u.emailVerifiedAt);

  // Создаем объект для управления состоянием безопасности
  const securityState = {
    get twoFAEnabled() {
      return twoFAEnabled;
    },
    set twoFAEnabled(val) {
      twoFAEnabled = val;
    },
    get passkeyCount() {
      return passkeyCount;
    },
    set passkeyCount(val) {
      passkeyCount = val;
    },
    get emailVerified() {
      return emailVerified;
    },
    updateIndicator: updateSecurityIndicator,
  };

  // attach handlers inside tabs
  bindTabActions(tab, me, { showMsg, clearMsg, securityState });
}

function tabTitle(tab) {
  if (tab === 'profile') return 'Профиль';
  if (tab === 'friends') return 'Друзья';
  if (tab === 'messages') return 'Сообщения';
  if (tab === 'security') return 'Безопасность';
  if (tab === 'sessions') return 'Сессии';
  if (tab === 'easter') return 'Пасхалки';
  return 'Учётка';
}

function renderIdRow(label, value, keyForCopy) {
  const v = String(value || '—');
  const short = value ? shortId(v, 10, 10) : '—';
  return `
    <div class="k">${label}</div>
    <div class="v">
      <span class="mono-pill" title="${escapeHtml(v)}">
        <span data-full="${escapeHtml(v)}" data-copy="${escapeHtml(keyForCopy || '')}">${escapeHtml(
          short
        )}</span>
        ${
          value
            ? `<button class="copy-btn" type="button" data-copybtn="${escapeHtml(v)}">Copy</button>`
            : ''
        }
      </span>
    </div>
  `;
}

function renderTabHtml(tab, me) {
  const u = me.user || {};
  const s = me.session || {};
  const sessionsCount = Number(me.sessionsCount || 0);
  const emailVerified =
    u.emailVerified === true ||
    u.email_verified === true ||
    u.email_verified === 1 ||
    u.email_verified === '1' ||
    Boolean(u.email_verified_at || u.emailVerifiedAt);

  if (tab === 'profile') {
    const login = u.login || '—';
    const pubId = formatPublicId(u.publicId);
    const reg = fmtTs(u.createdAt);
    const status = getUserStatus(u);

    return `
    <section class="profile-hero">
      <div class="profile-hero__left">
        <div class="profile-avatar" aria-hidden="true">
          <span>${escapeHtml(String(login).slice(0, 1).toUpperCase())}</span>
        </div>

        <div class="profile-hero__meta">
          <div class="profile-hero__title">
            <h2 class="profile-name">${escapeHtml(login)}</h2>

            <span class="chip status ${status.main.cls}" title="Статус аккаунта">
              <span class="dot"></span> ${status.main.label}
            </span>
          </div>

          <div class="profile-hero__subtitle">
            ${
              status.badges?.length
                ? `
                <span class="badges">
                ${status.badges
                  .map(
                    (b) => `
                  <span class="chip badge ${b.cls}" ${b.title ? `title="${b.title}"` : ''}>
                    ${b.label}
                  </span>
                  `
                  )
                  .join('')}
                  </span>
                `
                : ''
            }

          </div>
        </div>
      </div>
    </section>

    <section class="card-grid">
      <article class="info-card">
        <div class="info-card__label">Логин</div>
        <div class="info-card__value">${escapeHtml(login)}</div>
        <div class="info-card__hint">Основное имя для входа</div>
      </article>

      <article class="info-card">
        <div class="info-card__label">ID пользователя</div>
        <div class="info-card__value">
          <span class="mono-pill id-pill">
            <b class="mono">${escapeHtml(pubId)}</b>
            ${
              u.publicId
                ? `<button class="copy-btn copy-btn--icon"
                      type="button"
                      data-copybtn="${escapeHtml(pubId)}"
                      aria-label="Скопировать ID пользователя"
                      title="Скопировать">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
                    </svg>
                  </button>`
                : ''
            }
          </span>
        </div>
        <div class="info-card__hint">Отправляй его поддержке</div>
      </article>

      <article class="info-card">
        <div class="info-card__label">Дата регистрации</div>
        <div class="info-card__value">${escapeHtml(reg)}</div>
        <div class="info-card__hint">Создано в системе</div>
      </article>

      <article class="info-card">
        <div class="info-card__label">Публичный профиль</div>
        <div class="info-card__value">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="https://login.cyblight.org/${encodeURIComponent(login)}" 
               target="_blank" 
               class="profile-link-btn"
               style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s;"
               onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';"
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Посмотреть профиль
            </a>
            <button onclick="CybRouter.navigate('edit-profile')" 
                    class="profile-edit-btn"
                    style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;"
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.4)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';"
                    title="Редактировать профиль">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Редактировать
            </button>
          </div>
        </div>
        <div class="info-card__hint">Ваша публичная страница</div>
      </article>
    </section>
  `;
  }

  if (tab === 'security') {
    const emailText = u.email ? escapeHtml(u.email) : '—';
    const badgeHtml = emailVerified
      ? `<span class="sec-badge sec-badge--ok">Подтверждён</span>`
      : u.email
        ? `<span class="sec-badge sec-badge--warn">Не подтверждён</span>`
        : `<span class="sec-badge">—</span>`;

    const emailStatus = emailVerified
      ? '✅ Email подтверждён'
      : u.email
        ? '⚠️ Email не подтверждён'
        : 'Email не указан';

    const passChanged =
      u.password_changed_at || u.passwordChangedAt || u.passChangedAt || u.pass_changed_at || null;

    const passChangedText = passChanged ? escapeHtml(fmtTs(passChanged)) : '—';

    // Расчет уровня безопасности (будет обновлен после загрузки 2FA и passkeys)
    let securityScore = 0;
    let securityChecks = [];

    if (emailVerified) {
      securityScore += 30;
      securityChecks.push({ done: true, text: 'Email подтвержден', icon: '✅' });
    } else {
      securityChecks.push({ done: false, text: 'Подтвердите email адрес', icon: '⚠️' });
    }

    // Placeholder для 2FA и passkeys (будут обновлены после загрузки)
    securityChecks.push({
      done: false,
      text: 'Включите двухфакторную аутентификацию',
      icon: '🔐',
      id: '2fa-check',
    });
    securityChecks.push({
      done: false,
      text: 'Добавьте ключ доступа (Passkey)',
      icon: '🔑',
      id: 'passkey-check',
    });

    const securityLevel = securityScore >= 80 ? 'high' : securityScore >= 50 ? 'medium' : 'low';
    const securityLevelText =
      securityScore >= 80
        ? 'Надёжная защита'
        : securityScore >= 50
          ? 'Средняя защита'
          : 'Требует улучшения';
    const securityColor =
      securityScore >= 80 ? '#4ade80' : securityScore >= 50 ? '#fbbf24' : '#f87171';

    const securityItemTitle =
      securityScore >= 100 ? 'Ваш аккаунт под защитой' : 'Проверка безопасности';
    const securityItemSubtitle =
      securityScore >= 100
        ? 'Ваш аккаунт прошёл Проверку безопасности. Рекомендуемых действий не найдено.'
        : 'Обнаружены рекомендации по защите';

    return `
    <div class="sec-list">

      <!-- Security Check Item -->
      <button class="sec-item" id="secSecurityCheckItem" type="button">
        <div class="sec-left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              ${
                securityScore >= 100
                  ? `<img src="/assets/img/security/okey_64.png" width="32" height="32" alt="Защищён" style="display:block;" />`
                  : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 6V11C4 16.55 7.84 21.74 13 23C18.16 21.74 22 16.55 22 11V6L12 2Z" fill="${securityScore >= 50 ? '#fbbf24' : '#ef4444'}" opacity="0.9"/>
              </svg>`
              }
            </div>
            <div class="sec-title">${securityItemTitle}</div>
          </div>
          <div class="sec-sub">${securityItemSubtitle}</div>
        </div>
        <div class="sec-right">
          <div id="securityStatusBadge" style="font-size:13px;font-weight:600;color:${securityScore >= 100 ? '#22c55e' : securityScore >= 50 ? '#fbbf24' : '#ef4444'};">
            ${securityScore >= 100 ? '✓ Защищён' : securityScore >= 50 ? '⚠ Средняя' : '⚠ Низкая'}
          </div>
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel" id="secSecurityCheckPanel" style="display:none;">
        <div class="sec-panel-inner">
          <!-- Progress Bar -->
          <div style="background:rgba(255,255,255,.1);height:8px;border-radius:4px;overflow:hidden;margin-bottom:12px;">
            <div id="securityProgressBar" style="height:100%;background:${securityColor};width:${securityScore}%;transition:width 0.5s ease, background 0.5s ease;"></div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="font-size:14px;opacity:0.8;">Уровень защиты:</div>
            <div id="securityScoreText" style="font-size:20px;font-weight:800;color:${securityColor};">${securityScore}%</div>
          </div>

          <!-- Security Checklist -->
          <div id="securityChecklist" style="display:grid;gap:8px;margin-bottom:12px;">
            ${securityChecks
              .map(
                (check) => `
              <div ${check.id ? `id="${check.id}"` : ''} style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px;${check.done ? 'opacity:0.7;' : ''}">
                <div style="font-size:18px;">${check.icon}</div>
                <div style="flex:1;font-size:13px;">${check.text}</div>
                ${check.done ? '<div style="font-size:12px;color:#4ade80;font-weight:600;">Выполнено</div>' : ''}
              </div>
            `
              )
              .join('')}
          </div>

          <!-- Recommendations -->
          <div id="securityRecommendations">
            ${
              securityScore < 100
                ? `
            <div style="padding:10px;background:rgba(59,130,246,.15);border-radius:6px;border-left:3px solid #3b82f6;">
              <div style="font-size:12px;font-weight:600;margin-bottom:4px;">💡 Рекомендация</div>
              <div style="font-size:12px;opacity:0.9;">
                ${
                  securityScore < 30
                    ? 'Начните с подтверждения email и включения 2FA для базовой защиты аккаунта.'
                    : securityScore < 50
                      ? 'Добавьте еще несколько методов защиты для повышения безопасности.'
                      : 'Отлично! Осталось совсем немного для максимальной защиты.'
                }
              </div>
            </div>
          `
                : `
            <div style="padding:10px;background:rgba(34,197,94,.15);border-radius:6px;border-left:3px solid #22c55e;">
              <div style="font-size:12px;font-weight:600;margin-bottom:4px;">🎉 Превосходно!</div>
              <div style="font-size:12px;opacity:0.9;">Ваш аккаунт под надёжной защитой. Рекомендуемых действий не найдено.</div>
            </div>
          `
            }
          </div>
        </div>
      </div>

      <!-- EMAIL item -->
      <button class="sec-item" id="secEmailItem" type="button">
        <div class="sec-left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="#3b82f6" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">Адрес электронной почты</div>
          </div>
          <div class="sec-sub">${emailText}</div>
        </div>
        <div class="sec-right">
          ${badgeHtml}
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel" id="secEmailPanel" style="display:none;">
        <div class="sec-panel-inner">
          <div class="sec-status" id="secEmailStatus">${emailStatus}</div>

          <div class="sec-form-row">
            <input class="input" id="secEmailInp" type="email"
              placeholder="name@example.com"
              value="${escapeHtml(u.email || '')}"
            />
          </div>

          <div class="sec-actions">
            <button class="btn btn-outline" id="secEmailCancelBtn" type="button">Отменить</button>
            <button class="btn btn-primary" id="secEmailSaveBtn" type="button">Сохранить</button>
          </div>

          <div class="sec-hint" id="secEmailHint" style="display:none;"></div>

          ${
            !emailVerified && u.email
              ? `
                <button class="btn btn-outline" id="secEmailResendBtn" type="button" style="margin-top:10px;">
                  Отправить письмо ещё раз
                </button>
              `
              : ``
          }
        </div>
      </div>

      <!-- PASSWORD item -->
      <button class="sec-item" id="secPassItem" type="button">
        <div class="sec-left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8H17V6C17 3.24 14.76 1 12 1C9.24 1 7 3.24 7 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17ZM15.1 8H8.9V6C8.9 4.29 10.29 2.9 12 2.9C13.71 2.9 15.1 4.29 15.1 6V8Z" fill="#8b5cf6" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">Сменить пароль</div>
          </div>
          <div class="sec-sub">Последний раз был изменён: ${passChangedText}</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel" id="secPassPanel" style="display:none;">
        <div class="sec-panel-inner">
          <div class="sec-status" id="secPassStatus">—</div>

          <div class="sec-form-row">
            <label class="label" style="margin:0 0 6px;">Действующий пароль</label>
             <div class="pass-wrap">
              <input class="input" id="secPassCur" type="password" autocomplete="current-password" />
              <button type="button" class="pass-eye" data-target="secPassCur" aria-label="Показать пароль"></button>
             </div>
          </div>

          <div class="sec-form-row" style="margin-top:10px;">
            <label class="label" style="margin:0 0 6px;">Новый пароль</label>
            <div class="pass-wrap">
              <input class="input" id="secPassNew" type="password" autocomplete="new-password" />
              <button type="button" class="pass-eye" data-target="secPassNew" aria-label="Показать пароль"></button>
            </div>
            <div id="passHintsChange"></div>
          </div>

          <div class="sec-form-row" style="margin-top:10px;">
            <label class="label" style="margin:0 0 6px;">Введите новый пароль еще раз</label>
             <div class="pass-wrap">
              <input class="input" id="secPassNew2" type="password" autocomplete="new-password" />
              <button type="button" class="pass-eye" data-target="secPassNew2" aria-label="Показать пароль"></button>
            </div>
          </div>

          <div class="sec-actions" style="margin-top:12px;">
            <button class="btn btn-outline" id="secPassCancelBtn" type="button">Отменить</button>
            <button class="btn btn-primary" id="secPassSaveBtn" type="button">Сохранить</button>
          </div>

          <div class="sec-hint" id="secPassHint" style="display:none;"></div>
        </div>
      </div>

      <!-- 2FA item -->
      <button class="sec-item" id="sec2FAItem" type="button">
        <div class="sec-left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 1H7C5.9 1 5 1.9 5 3V21C5 22.1 5.9 23 7 23H17C18.1 23 19 22.1 19 21V3C19 1.9 18.1 1 17 1ZM17 19H7V5H17V19ZM12 17C13.1 17 14 16.1 14 15C14 13.9 13.1 13 12 13C10.9 13 10 13.9 10 15C10 16.1 10.9 17 12 17Z" fill="#10b981" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">Двухфакторная аутентификация (2FA)</div>
          </div>
          <div class="sec-sub" id="sec2FAStatus">Загрузка...</div>
          <div class="sec-sub" id="sec2FADate" style="display:none;"></div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel" id="sec2FAPanel" style="display:none;">
        <div class="sec-panel-inner" id="sec2FAContent">
          <!-- Динамический контент -->
        </div>
      </div>

      <!-- Passkeys item -->
      <button class="sec-item" id="secPasskeysItem" type="button">
        <div class="sec-left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.65 10C11.7 7.31 8.9 5.5 5.77 6.12C3.48 6.58 1.62 8.41 1.14 10.7C0.32 14.57 3.26 18 7 18C9.61 18 11.83 16.33 12.65 14H17V18H21V14H23V10H12.65ZM7 14C5.9 14 5 13.1 5 12C5 10.9 5.9 10 7 10C8.1 10 9 10.9 9 12C9 13.1 8.1 14 7 14Z" fill="#f59e0b" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">Ключи доступа (Passkeys)</div>
          </div>
          <div class="sec-sub" id="secPasskeysStatus">Загрузка...</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel" id="secPasskeysPanel" style="display:none;">
        <div class="sec-panel-inner" id="secPasskeysContent">
          <!-- Динамический контент -->
        </div>
      </div>

      <!-- Trusted Devices item -->
      <button class="sec-item" id="secDevicesItem" type="button">
        <div class="sec-left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 18C21.1 18 21.99 17.1 21.99 16L22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V16C2 17.1 2.9 18 4 18H0V20H24V18H20ZM4 6H20V16H4V6Z" fill="#06b6d4" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">Доверенные устройства</div>
          </div>
          <div class="sec-sub">Управление устройствами для входа с 2FA</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel" id="secDevicesPanel" style="display:none;">
        <div class="sec-panel-inner">
          <div class="sec-status" style="opacity:.85;line-height:1.5;margin-bottom:14px;">
            Доверенные устройства для входа с 2FA. Эти устройства не требуют код при входе.
          </div>
          <div id="trustedDevicesList" style="color:var(--muted);">Загружаю...</div>
        </div>
      </div>

      <!-- Login History item -->
      <button class="sec-item" id="secHistoryItem" type="button">
        <div class="sec-left">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 3C8.03 3 4 7.03 4 12H1L4.89 15.89L4.96 16.03L9 12H6C6 8.13 9.13 5 13 5C16.87 5 20 8.13 20 12C20 15.87 16.87 19 13 19C11.07 19 9.32 18.21 8.06 16.94L6.64 18.36C8.27 19.99 10.51 21 13 21C17.97 21 22 16.97 22 12C22 7.03 17.97 3 13 3ZM12 8V13L16.25 15.52L17.02 14.24L13.5 12.15V8H12Z" fill="#64748b" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">История входов</div>
          </div>
          <div class="sec-sub">Просмотр активности аккаунта</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel" id="secHistoryPanel" style="display:none;">
        <div class="sec-panel-inner">
          <div class="sec-status" style="opacity:.85;line-height:1.5;margin-bottom:14px;">
            История входов в аккаунт за последнее время
          </div>
          <div id="loginHistoryList" style="color:var(--muted);">Загружаю...</div>
        </div>
      </div>

    </div>
  `;
  }

  if (tab === 'sessions') {
    return `
      <div class="kv">
        ${renderIdRow('Текущая сессия', s.id, 'sessionId')}

        <div class="k">Сессия создана</div>
        <div class="v">${escapeHtml(fmtTs(s.createdAt))}</div>

        <div class="k">Сессия истекает</div>
        <div class="v">${escapeHtml(fmtTs(s.expiresAt))}</div>

        <div class="k">Активных сессий</div>
        <div class="v"><b>${escapeHtml(String(sessionsCount))}</b></div>
      </div>

      <div style="height:1px;background:rgba(255,255,255,.08);margin:14px 0;"></div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-outline" id="logoutOthersBtn" type="button" ${
          sessionsCount <= 1
            ? 'disabled style="opacity:.55;cursor:not-allowed;" title="Других сессий нет"'
            : ''
        }>
          Выйти из других
        </button>
      </div>
    `;
  }

  if (tab === 'easter') {
    const canSeeStrawberry = hasStrawberryAccess() || !!me?.user?.easter?.strawberry;
    const canSeeDarkTrigger = hasDarkTriggerAccess() || !!me?.user?.easter?.darkTrigger;

    return `
      <style>
        .easter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .easter-card {
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 12px;
          padding: 20px;
          background: linear-gradient(135deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.01) 100%);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .easter-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at top-right, rgba(255,255,255,.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .easter-card:hover {
          border-color: rgba(255,255,255,.25);
          background: linear-gradient(135deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.03) 100%);
          transform: translateY(-2px);
        }
        .easter-card.locked {
          opacity: 0.7;
        }
        .easter-card-icon {
          font-size: 48px;
          margin-bottom: 12px;
          display: block;
        }
        .easter-card-title {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .easter-card-desc {
          font-size: 13px;
          opacity: 0.75;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .easter-card-badge {
          display: inline-block;
          padding: 4px 12px;
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .easter-card-badge.locked {
          background: rgba(107, 114, 128, 0.15);
          color: #9ca3af;
        }
        .easter-intro {
          opacity: 0.85;
          line-height: 1.6;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(255,255,255,.03);
          border-left: 3px solid rgba(59, 130, 246, 0.5);
          border-radius: 4px;
        }
        .easter-steno-btn {
          width: 100%;
          margin-top: 12px;
        }
      </style>

      <div>
        <div class="easter-intro">
          🎯 Пасхалки открываются, когда ты находишь секреты на сайте
        </div>

        <div class="easter-grid">
          <!-- Strawberry Card -->
          <div class="easter-card ${canSeeStrawberry ? '' : 'locked'}">
            <span class="easter-card-icon">🍓</span>
            <div class="easter-card-title">
              Strawberry Hunt
              ${canSeeStrawberry ? '<span style="opacity:.6;font-size:11px;">✓</span>' : ''}
            </div>
            <div class="easter-card-desc">
              ${
                canSeeStrawberry
                  ? 'Ты нашел особую клубничку на сайте! Отличная работа 🎉'
                  : 'Найди спрятанную клубничку где-то на основном сайте'
              }
            </div>
            ${
              canSeeStrawberry
                ? '<span class="easter-card-badge">✓ Найдено</span>'
                : '<span class="easter-card-badge locked">🔒 Закрыто</span>'
            }
            ${
              canSeeStrawberry
                ? `<button class="btn btn-outline easter-steno-btn" id="toHistoryBtn" type="button">
                  📖 Открыть стенографию
                </button>`
                : '<div style="opacity:.6;font-size:12px;margin-top:12px;">💡 Подсказка: исследуй темные уголки...</div>'
            }
          </div>

          <!-- Dark Trigger Card -->
          <div class="easter-card ${canSeeDarkTrigger ? '' : 'locked'}">
            <span class="easter-card-icon">🌑</span>
            <div class="easter-card-title">
              Dark Trigger
              ${canSeeDarkTrigger ? '<span style="opacity:.6;font-size:11px;">✓</span>' : ''}
            </div>
            <div class="easter-card-desc">
              ${
                canSeeDarkTrigger
                  ? 'Ты заметил тёмный триггер в полной темноте! Редкое достижение 🌟'
                  : 'Разгадай загадку тьмы, припрятанную где-то на сайте'
              }
            </div>
            ${
              canSeeDarkTrigger
                ? '<span class="easter-card-badge">✓ Найдено</span>'
                : '<span class="easter-card-badge locked">🔒 Закрыто</span>'
            }
            <div style="opacity:.6;font-size:12px;margin-top:12px;">
              ${
                canSeeDarkTrigger
                  ? '🎊 Конгратулейшн, ты настоящий детектив!'
                  : '💡 Подсказка: посмотри в тёмную папку на сайте...'
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============ FRIENDS TAB ============
  if (tab === 'friends') {
    return `
      <div id="friendsContent">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    `;
  }

  // ============ MESSAGES TAB ============
  if (tab === 'messages') {
    return `
      <div id="messagesContent">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    `;
  }

  return `—`;
}

// ============ FRIENDS & MESSAGES FUNCTIONS ============

async function loadFriendsTab(api) {
  const container = document.getElementById('friendsContent');
  if (!container) return;

  try {
    // Загружаем список друзей
    const friendsRes = await apiCall('/api/friends/list', { credentials: 'include' });
    const friendsData = await friendsRes.json();

    // Загружаем входящие запросы
    const pendingRes = await apiCall('/api/friends/pending', { credentials: 'include' });
    const pendingData = await pendingRes.json();

    // Загружаем отправленные запросы
    const sentRes = await apiCall('/api/friends/sent', { credentials: 'include' });
    const sentData = await sentRes.json();

    if (!friendsData.ok) {
      container.innerHTML = `<div class="error-message">Не удалось загрузить друзей</div>`;
      return;
    }

    const friends = friendsData.friends || [];
    const pendingRequests = pendingData.pendingRequests || [];
    const sentRequests = sentData.sentRequests || [];

    container.innerHTML = `
      <style>
        .friends-search {
          margin-bottom: 24px;
          display: flex;
          gap: 8px;
        }
        .friends-search input {
          flex: 1;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.1);
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
        }
        .friends-search input::placeholder {
          color: rgba(255,255,255,.5);
        }
        .friends-search input:focus {
          outline: none;
          border-color: rgba(102,126,234,0.5);
          background: rgba(255,255,255,.08);
        }
        .friends-search button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .friends-search button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        #searchResults {
          display: none;
          margin-bottom: 24px;
          padding: 16px;
          background: rgba(102, 126, 234, 0.1);
          border: 1px solid rgba(102, 126, 234, 0.3);
          border-radius: 12px;
        }
        #searchResults.active {
          display: block;
        }
        .search-result-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255,255,255,.03);
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .search-result-item:last-child {
          margin-bottom: 0;
        }
        .search-result-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .search-result-info {
          flex: 1;
        }
        .search-result-username {
          font-weight: 600;
          font-size: 14px;
        }
        .search-result-actions {
          display: flex;
          gap: 8px;
        }
        .friends-section {
          margin-bottom: 32px;
        }
        .friends-section-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .friends-list {
          display: grid;
          gap: 12px;
        }
        .friend-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          transition: all 0.2s;
        }
        .friend-card:hover {
          background: rgba(255,255,255,.07);
          border-color: rgba(255,255,255,.2);
        }
        .friend-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        .friend-info {
          flex: 1;
        }
        .friend-username {
          font-weight: 600;
          font-size: 15px;
        }
        .friend-actions {
          display: flex;
          gap: 8px;
        }
        .btn-friend {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-friend-message {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .btn-friend-message:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .btn-friend-profile {
          background: rgba(255,255,255,.1);
          color: white;
        }
        .btn-friend-profile:hover {
          background: rgba(255,255,255,.15);
        }
        .btn-friend-remove {
          background: rgba(255, 67, 54, 0.2);
          color: #ff4336;
        }
        .btn-friend-remove:hover {
          background: rgba(255, 67, 54, 0.3);
        }
        .btn-friend-add {
          background: rgba(76, 175, 80, 0.2);
          color: #4caf50;
        }
        .btn-friend-add:hover {
          background: rgba(76, 175, 80, 0.3);
        }
        .btn-friend-accept {
          background: rgba(76, 175, 80, 0.2);
          color: #4caf50;
        }
        .btn-friend-accept:hover {
          background: rgba(76, 175, 80, 0.3);
        }
        .btn-friend-reject, .btn-friend-cancel {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }
        .btn-friend-reject:hover, .btn-friend-cancel:hover {
          background: rgba(255, 193, 7, 0.3);
        }
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          opacity: 0.7;
        }
        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .friend-meta {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 4px;
        }
      </style>

      <div class="friends-search">
        <input type="text" id="friendSearchInput" placeholder="🔍 Поиск пользователей...">
        <button onclick="searchFriendsAndAdd(event)">🔍</button>
      </div>

      <div id="searchResults"></div>

      <div class="friends-section">
        <div class="friends-section-title">
          <span>👥</span>
          <span>Мои друзья (${friends.length})</span>
        </div>
        ${
          friends.length > 0
            ? `
          <div class="friends-list">
            ${friends
              .map(
                (friend) => `
              <div class="friend-card">
                <div class="friend-avatar">
                  ${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="">` : '👤'}
                </div>
                <div class="friend-info">
                  <div class="friend-username">${escapeHtml(friend.username)}</div>
                </div>
                <div class="friend-actions">
                  <button class="btn-friend btn-friend-message" onclick="openChat('${escapeHtml(friend.id)}', '${escapeHtml(friend.username)}')">
                    💬 Написать
                  </button>
                  <button class="btn-friend btn-friend-profile" onclick="CybRouter.navigate('${escapeHtml(friend.username)}')">
                    👤 Профиль
                  </button>
                  <button class="btn-friend btn-friend-remove" onclick="removeFriend('${escapeHtml(friend.id)}', '${escapeHtml(friend.username)}')">
                    ❌ Удалить
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : `
          <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <p>У вас пока нет друзей</p>
            <p style="font-size: 14px; opacity: 0.7; margin-top: 8px;">
              Найдите пользователей и добавьте их в друзья
            </p>
          </div>
        `
        }
      </div>

      <div class="friends-section">
        <div class="friends-section-title">
          <span>📥</span>
          <span>Входящие запросы (${pendingRequests.length})</span>
        </div>
        ${
          pendingRequests.length > 0
            ? `
          <div class="friends-list">
            ${pendingRequests
              .map(
                (request) => `
              <div class="friend-card">
                <div class="friend-avatar">
                  ${request.avatar ? `<img src="${escapeHtml(request.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="">` : '👤'}
                </div>
                <div class="friend-info">
                  <div class="friend-username">${escapeHtml(request.username)}</div>
                  <div class="friend-meta">📬 Запрос в друзья ${new Date(request.createdAt).toLocaleDateString('ru-RU')}</div>
                </div>
                <div class="friend-actions">
                  <button class="btn-friend btn-friend-accept" onclick="acceptFriend('${escapeHtml(request.id)}', '${escapeHtml(request.username)}')">
                    ✅ Принять
                  </button>
                  <button class="btn-friend btn-friend-reject" onclick="rejectFriend('${escapeHtml(request.id)}', '${escapeHtml(request.username)}')">
                    ❌ Отклонить
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <p>Нет новых запросов</p>
            <p style="font-size: 14px; opacity: 0.7; margin-top: 8px;">
              Когда кто-то захочет добавить вас в друзья, запрос появится здесь
            </p>
          </div>
        `
        }
      </div>

      <div class="friends-section">
        <div class="friends-section-title">
          <span>📤</span>
          <span>Отправленные запросы (${sentRequests.length})</span>
        </div>
        ${
          sentRequests.length > 0
            ? `
          <div class="friends-list">
            ${sentRequests
              .map(
                (request) => `
              <div class="friend-card">
                <div class="friend-avatar">
                  ${request.avatar ? `<img src="${escapeHtml(request.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="">` : '👤'}
                </div>
                <div class="friend-info">
                  <div class="friend-username">${escapeHtml(request.username)}</div>
                  <div class="friend-meta">⏳ Ожидание ответа ${new Date(request.createdAt).toLocaleDateString('ru-RU')}</div>
                </div>
                <div class="friend-actions">
                  <button class="btn-friend btn-friend-profile" onclick="CybRouter.navigate('${escapeHtml(request.username)}')">
                    👤 Профиль
                  </button>
                  <button class="btn-friend btn-friend-cancel" onclick="cancelFriendRequest('${escapeHtml(request.id)}')">
                    ❌ Отменить
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : `
          <div class="empty-state">
            <div class="empty-state-icon">📨</div>
            <p>Нет отправленных запросов</p>
            <p style="font-size: 14px; opacity: 0.7; margin-top: 8px;">
              Найдите пользователей и отправьте им запрос в друзья
            </p>
          </div>
        `
        }
      </div>
    `;

    // Привязываем обработчик поиска при вводе
    const searchInput = document.getElementById('friendSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          searchFriendsAndAdd(e);
        }
      });
    }
  } catch (error) {
    console.error('Error loading friends:', error);
    container.innerHTML = `<div class="error-message">Ошибка загрузки. Попробуйте обновить страницу.</div>`;
  }
}

async function searchFriendsAndAdd(event) {
  event?.preventDefault();

  const searchInput = document.getElementById('friendSearchInput');
  const searchResults = document.getElementById('searchResults');

  if (!searchInput || !searchInput.value.trim()) {
    if (searchResults) {
      searchResults.classList.remove('active');
    }
    return;
  }

  const query = searchInput.value.trim();

  try {
    // Вызываем API поиска пользователей
    const res = await apiCall(`/api/search/users?q=${encodeURIComponent(query)}`, {
      credentials: 'include',
    });

    const data = await res.json();

    if (searchResults) {
      searchResults.classList.add('active');

      if (!data.ok || !data.users || data.users.length === 0) {
        searchResults.innerHTML = `
          <div style="text-align: center; color: rgba(255,255,255,0.7); padding: 16px;">
            🔍 Пользователи не найдены<br>
            <small style="opacity: 0.7;">Попробуйте изменить запрос</small>
          </div>
        `;
        return;
      }

      // Отображаем результаты поиска
      searchResults.innerHTML = `
        <div style="margin-bottom: 12px; font-weight: 600;">📋 Найдено: ${data.users.length}</div>
        ${data.users
          .map(
            (user) => `
          <div class="search-result-item">
            <div class="search-result-avatar">
              ${user.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="">` : '👤'}
            </div>
            <div class="search-result-info">
              <div class="search-result-username">${escapeHtml(user.username)}</div>
            </div>
            <div class="search-result-actions">
              <button class="btn-friend btn-friend-add" onclick="addFriendFromSearch('${escapeHtml(user.username)}')">
                ➕ Добавить
              </button>
              <button class="btn-friend btn-friend-profile" onclick="CybRouter.navigate('${escapeHtml(user.username)}')">
                👤 Профиль
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      `;
    }
  } catch (err) {
    console.error('Search error:', err);
    if (searchResults) {
      searchResults.classList.add('active');
      searchResults.innerHTML = `
        <div style="text-align: center; color: rgba(255,67,54,0.9); padding: 16px;">
          ⚠️ Ошибка при поиске<br>
          <small>${escapeHtml(err.message || 'Неизвестная ошибка')}</small>
        </div>
      `;
    }
  }
}

async function acceptFriend(friendId, friendUsername) {
  try {
    const res = await apiCall('/api/friends/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId }),
    });

    if (res.ok) {
      showTopNotification('success', `✅ ${friendUsername} добавлен в друзья!`);
      loadFriendsTab();
    } else {
      showTopNotification('error', 'Ошибка при принятии запроса');
    }
  } catch (err) {
    console.error('Error accepting friend:', err);
    showTopNotification('error', 'Ошибка сети');
  }
}

async function rejectFriend(friendId, friendUsername) {
  try {
    const res = await apiCall('/api/friends/reject', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId }),
    });

    if (res.ok) {
      showTopNotification('success', `❌ Запрос от ${friendUsername} отклонен`);
      loadFriendsTab();
    } else {
      showTopNotification('error', 'Ошибка при отклонении запроса');
    }
  } catch (err) {
    console.error('Error rejecting friend:', err);
    showTopNotification('error', 'Ошибка сети');
  }
}

async function removeFriend(friendId, friendUsername) {
  if (!confirm(`Вы уверены, что хотите удалить ${friendUsername}?`)) return;

  try {
    const res = await apiCall('/api/friends/remove', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId }),
    });

    if (res.ok) {
      showTopNotification('success', `${friendUsername} удален из друзей`);
      loadFriendsTab();
    } else {
      showTopNotification('error', 'Ошибка при удалении друга');
    }
  } catch (err) {
    console.error('Error removing friend:', err);
    showTopNotification('error', 'Ошибка сети');
  }
}

async function cancelFriendRequest(friendshipId) {
  try {
    const res = await apiCall(`/api/friends/remove`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId: friendshipId }),
    });

    if (res.ok) {
      showTopNotification('success', 'Запрос отменен');
      loadFriendsTab();
    } else {
      showTopNotification('error', 'Ошибка при отмене запроса');
    }
  } catch (err) {
    console.error('Error canceling request:', err);
    showTopNotification('error', 'Ошибка сети');
  }
}

async function addFriendFromSearch(friendUsername) {
  try {
    const res = await apiCall('/api/friends/add', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendUsername }),
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      showTopNotification('success', `✅ Запрос отправлен пользователю ${friendUsername}!`);
      // Очищаем поле поиска и результаты
      const searchInput = document.getElementById('friendSearchInput');
      const searchResults = document.getElementById('searchResults');
      if (searchInput) searchInput.value = '';
      if (searchResults) searchResults.classList.remove('active');
      // Обновляем вкладку друзей
      loadFriendsTab();
    } else {
      showTopNotification('error', data.error || 'Ошибка при отправке запроса');
    }
  } catch (err) {
    console.error('Error adding friend:', err);
    showTopNotification('error', 'Ошибка сети');
  }
}

async function loadMessagesTab(api) {
  const container = document.getElementById('messagesContent');
  if (!container) return;

  try {
    // Загружаем список друзей для отображения чатов
    const friendsRes = await apiCall('/api/friends/list', { credentials: 'include' });
    const friendsData = await friendsRes.json();

    if (!friendsData.ok) {
      container.innerHTML = `<div class="error-message">Не удалось загрузить сообщения</div>`;
      return;
    }

    const friends = friendsData.friends || [];

    container.innerHTML = `
      <style>
        .messages-info {
          padding: 16px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          margin-bottom: 24px;
        }
        .chat-list {
          display: grid;
          gap: 12px;
        }
        .chat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chat-card:hover {
          background: rgba(255,255,255,.07);
          border-color: rgba(255,255,255,.2);
          transform: translateX(4px);
        }
        .chat-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        .chat-info {
          flex: 1;
        }
        .chat-username {
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 4px;
        }
        .chat-preview {
          font-size: 13px;
          opacity: 0.7;
        }
      </style>

      <div class="messages-info">
        <strong>💬 Сообщения</strong>
        <p style="margin-top: 8px; font-size: 14px; opacity: 0.9;">
          Выберите друга, чтобы начать переписку
        </p>
      </div>

      ${
        friends.length > 0
          ? `
        <div class="chat-list">
          ${friends
            .map(
              (friend) => `
            <div class="chat-card" onclick="openChat('${escapeHtml(friend.id)}', '${escapeHtml(friend.username)}')">
              <div class="chat-avatar">
                ${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="">` : '👤'}
              </div>
              <div class="chat-info">
                <div class="chat-username">${escapeHtml(friend.username)}</div>
                <div class="chat-preview">Нажмите, чтобы открыть чат</div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <p>Нет доступных чатов</p>
          <p style="font-size: 14px; opacity: 0.7; margin-top: 8px;">
            Добавьте друзей, чтобы начать общение
          </p>
        </div>
      `
      }
    `;
  } catch (error) {
    console.error('Error loading messages:', error);
    container.innerHTML = `<div class="error-message">Ошибка загрузки. Попробуйте обновить страницу.</div>`;
  }

  // Проверяем, нужно ли автоматически открыть чат
  const openChatData = sessionStorage.getItem('openChatWith');
  if (openChatData) {
    try {
      const { friendId, username } = JSON.parse(openChatData);
      sessionStorage.removeItem('openChatWith'); // Удаляем, чтобы не открывать повторно
      // Небольшая задержка, чтобы контейнер успел отрендериться
      setTimeout(() => openChat(friendId, username), 100);
    } catch (err) {
      console.error('Error auto-opening chat:', err);
    }
  }
}

// ============ EMOJI SELECTOR ============
// Быстрые реакции как в Telegram
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏'];
// Время, в течение которого можно редактировать сообщения (15 минут как в Telegram)
const EDIT_TIME_LIMIT = 15 * 60 * 1000; // 15 минут в миллисекундах
// Расширенный набор эмодзи
const EMOJI_LIST = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '🤣',
  '😂',
  '🙂',
  '😉',
  '😊',
  '😇',
  '🥰',
  '😍',
  '🤩',
  '😘',
  '😋',
  '😛',
  '😝',
  '😜',
  '🤪',
  '🤨',
  '🧐',
  '🤓',
  '😎',
  '🥳',
  '😏',
  '😒',
  '😞',
  '😔',
  '😟',
  '😕',
  '🙁',
  '☹️',
  '😣',
  '😖',
  '😫',
  '😩',
  '🥺',
  '😢',
  '😭',
  '😤',
  '😠',
  '😡',
  '🤬',
  '🤯',
  '😳',
  '🥵',
  '🥶',
  '😱',
  '😨',
  '😰',
  '😥',
  '😓',
  '🤗',
  '🤔',
  '🤭',
  '🤫',
  '🤥',
  '😶',
  '😐',
  '😑',
  '😬',
  '🙄',
  '👍',
  '👎',
  '👊',
  '✊',
  '🤛',
  '🤜',
  '👏',
  '🙌',
  '👐',
  '🤲',
  '🤝',
  '🙏',
  '✌️',
  '🤞',
  '🤟',
  '🤘',
  '🤙',
  '👌',
  '🤏',
  '👈',
  '👉',
  '👆',
  '👇',
  '☝️',
  '✋',
  '🤚',
  '🖐',
  '🖖',
  '👋',
  '🤙',
  '💪',
  '🦾',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '🤎',
  '💔',
  '❣️',
  '💕',
  '💞',
  '💓',
  '💗',
  '💖',
  '🔥',
  '✨',
  '⭐',
  '🌟',
  '💫',
  '💥',
  '💯',
  '🎉',
  '🎊',
  '🎈',
  '🎁',
  '🏆',
  '🥇',
  '🥈',
  '🥉',
  '🏅',
];

function createEmojiReactionPicker(messageId) {
  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  picker.innerHTML = EMOJI_LIST.map(
    (emoji) => `
    <button class="emoji-btn" data-emoji="${emoji}" onclick="addReactionToMessage('${messageId}', '${emoji}')" title="${emoji}">
      ${emoji}
    </button>
  `
  ).join('');
  return picker;
}

async function addReactionToMessage(messageId, emoji) {
  try {
    const res = await apiCall(`/api/messages/${messageId}/react`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });

    if (res.ok) {
      // Перезагружаем чат для отображения реакции
      const friendId = document.getElementById('chatFriendId')?.value;
      if (friendId) loadChatMessages(friendId);
    }
  } catch (err) {
    console.error('Error adding reaction:', err);
  }
}

async function deleteMessage(messageId) {
  if (!confirm('Удалить это сообщение?')) return;

  try {
    const res = await apiCall(`/api/messages/${messageId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (res.ok) {
      const friendId = document.getElementById('chatFriendId')?.value;
      if (friendId) loadChatMessages(friendId);
    }
  } catch (err) {
    console.error('Error deleting message:', err);
  }
}

async function loadChatMessages(friendId) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  try {
    const res = await apiCall(`/api/messages/${friendId}`, {
      credentials: 'include',
    });

    const data = await res.json();

    if (!data.ok) return;

    const messages = data.messages || [];

    messagesContainer.innerHTML = messages
      .map((msg) => {
        const isSentByMe = msg.senderId === document.getElementById('currentUserId')?.value;
        const reactions = msg.reactions || [];
        const timeSinceCreation = Date.now() - msg.createdAt;
        const canEdit = isSentByMe && timeSinceCreation < EDIT_TIME_LIMIT;
        const editTimeLeft = canEdit ? Math.ceil((EDIT_TIME_LIMIT - timeSinceCreation) / 60000) : 0;

        return `
        <div class="message ${isSentByMe ? 'sent' : 'received'}" data-message-id="${msg.id}">
          <div class="message-content">
            ${parseFormattedText(msg.content)}
            ${msg.editedAt ? '<span class="edited">(отредактировано)</span>' : ''}
          </div>
          ${
            reactions.length > 0
              ? `
            <div class="reactions">
              ${reactions
                .map(
                  (r) => `
                <span class="reaction" title="${r.count} реакций">${r.emoji}</span>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
          <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="quick-reactions">
            ${QUICK_REACTIONS.map(
              (emoji) => `
              <button class="quick-reaction-btn" onclick="addReactionToMessage('${msg.id}', '${emoji}')" title="${emoji}">${emoji}</button>
            `
            ).join('')}
            <button class="quick-reaction-btn" onclick="toggleEmojiPicker('${msg.id}')" title="Ещё реакции">➕</button>
          </div>
          ${
            isSentByMe
              ? `
            <div class="message-actions">
              <button class="msg-btn" onclick="deleteMessage('${msg.id}')">🗑️ Удалить</button>
              ${
                canEdit
                  ? `
                <button class="msg-btn" onclick="editMessage('${msg.id}', '${escapeHtml(msg.content).replace(/'/g, "\\'")}')" title="Осталось ${editTimeLeft} мин">✏️ Изменить</button>
              `
                  : `
                <button class="msg-btn" disabled style="opacity: 0.5; cursor: not-allowed;" title="Время редактирования истекло (доступно 15 мин)">⏱️ Время истекло</button>
              `
              }
            </div>
          `
              : ''
          }
        </div>
      `;
      })
      .join('');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

function toggleEmojiPicker(messageId) {
  const existing = document.getElementById(`picker-${messageId}`);
  if (existing) {
    existing.remove();
    return;
  }

  const message = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!message) return;

  const picker = createEmojiReactionPicker(messageId);
  picker.id = `picker-${messageId}`;
  message.appendChild(picker);
}

async function sendChatMessage(friendId) {
  const input = document.getElementById('messageInput');
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  const editingMessageId = document.getElementById('editingMessageId')?.value;

  try {
    let res;

    if (editingMessageId) {
      // Редактирование существующего сообщения
      res = await apiCall(`/api/messages/${editingMessageId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json().catch(() => ({ ok: false }));

      if (res.ok && data.ok) {
        showTopNotification('success', 'Сообщение отредактировано');
        cancelEdit();
      } else {
        const errorMsg = data.error || 'Не удалось отредактировать сообщение';
        showTopNotification('error', errorMsg);
        if (errorMsg.includes('15 minutes') || errorMsg.includes('15 минут')) {
          cancelEdit(); // Отменяем редактирование если время истекло
        }
      }
    } else {
      // Отправка нового сообщения
      res = await apiCall('/api/messages/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: friendId, content }),
      });

      if (res.ok) {
        input.value = '';
        // Сбрасываем высоту textarea
        input.style.height = 'auto';
      } else {
        showTopNotification('error', 'Не удалось отправить сообщение');
      }
    }

    if (res.ok) {
      loadChatMessages(friendId);
    }
  } catch (err) {
    console.error('Error sending message:', err);
    showTopNotification('error', 'Ошибка при отправке');
  }
}

function openChat(friendId, friendUsername) {
  const container = document.getElementById('messagesContent');
  if (!container) return;

  // Полноценный интерфейс чата
  container.innerHTML = `
    <style>
      .chat-container {
        display: flex;
        flex-direction: column;
        height: 600px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(0,0,0,.3);
      }
      .chat-header {
        padding: 16px;
        border-bottom: 1px solid rgba(255,255,255,.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .chat-header-title {
        font-weight: 600;
        font-size: 16px;
      }
      .chat-close-btn {
        background: rgba(255,255,255,.1);
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      .chat-close-btn:hover {
        background: rgba(255,255,255,.15);
      }
      #chatMessages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .message {
        display: flex;
        flex-direction: column;
        max-width: 70%;
        gap: 4px;
      }
      .message.sent {
        align-self: flex-end;
        align-items: flex-end;
      }
      .message.received {
        align-self: flex-start;
        align-items: flex-start;
      }
      .message-content {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 12px 16px;
        border-radius: 12px;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.5;
      }
      .message.received .message-content {
        background: rgba(255,255,255,.1);
      }
      /* Форматирование текста */
      .message-content code {
        background: rgba(0,0,0,.3);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
      }
      .message-content pre {
        background: rgba(0,0,0,.4);
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 8px 0;
      }
      .message-content pre code {
        background: transparent;
        padding: 0;
      }
      .message-content strong {
        font-weight: 700;
      }
      .message-content em {
        font-style: italic;
      }
      .message-content del {
        text-decoration: line-through;
        opacity: 0.7;
      }
      .message-content a {
        color: #88ccff;
        text-decoration: underline;
        transition: color 0.2s;
      }
      .message-content a:hover {
        color: #aaddff;
      }
      .message-content .spoiler {
        background: rgba(0,0,0,.5);
        color: transparent;
        user-select: none;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        transition: all 0.2s;
      }
      .message-content .spoiler.revealed {
        background: transparent;
        color: inherit;
      }
      .edited {
        font-size: 11px;
        opacity: 0.7;
        margin-left: 4px;
      }
      .reactions {
        display: flex;
        gap: 4px;
        margin-top: 4px;
      }
      .reaction {
        background: rgba(255,255,255,.1);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .reaction:hover {
        background: rgba(255,255,255,.2);
      }
      .message-time {
        font-size: 11px;
        opacity: 0.6;
        margin-top: 2px;
      }
      .message-actions {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .message:hover .message-actions {
        opacity: 1;
      }
      .quick-reactions {
        display: none;
        gap: 4px;
        margin-top: 6px;
        padding: 6px;
        background: rgba(0,0,0,.3);
        border-radius: 8px;
        flex-wrap: wrap;
      }
      .message:hover .quick-reactions {
        display: flex;
      }
      .quick-reaction-btn {
        background: transparent;
        border: 1px solid rgba(255,255,255,.2);
        color: white;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      .quick-reaction-btn:hover {
        background: rgba(255,255,255,.15);
        border-color: rgba(255,255,255,.3);
        transform: scale(1.1);
      }
      .msg-btn {
        background: rgba(255,255,255,.1);
        border: none;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .msg-btn:hover {
        background: rgba(255,255,255,.2);
      }
      .emoji-picker {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        flex-wrap: wrap;
        background: rgba(0,0,0,.3);
        padding: 8px;
        border-radius: 8px;
      }
      .emoji-btn {
        background: transparent;
        border: 1px solid rgba(255,255,255,.2);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
      }
      .emoji-btn:hover {
        background: rgba(255,255,255,.1);
        border-color: rgba(255,255,255,.3);
      }
      .formatting-toolbar {
        display: flex;
        gap: 4px;
        padding: 8px;
        border-bottom: 1px solid rgba(255,255,255,.1);
        background: rgba(0,0,0,.2);
        flex-wrap: wrap;
      }
      .format-btn {
        background: rgba(255,255,255,.1);
        border: 1px solid rgba(255,255,255,.15);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
        font-family: monospace;
      }
      .format-btn:hover {
        background: rgba(255,255,255,.2);
        border-color: rgba(255,255,255,.3);
      }
      .format-btn.bold {
        font-weight: bold;
      }
      .format-btn.italic {
        font-style: italic;
      }
      .format-btn.mono {
        font-family: 'Courier New', monospace;
      }
      .chat-footer {
        display: flex;
        flex-direction: column;
        border-top: 1px solid rgba(255,255,255,.1);
      }
      .chat-input-wrapper {
        display: flex;
        gap: 8px;
        padding: 16px;
      }
      .chat-footer textarea {
        flex: 1;
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.1);
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        resize: none;
        min-height: 44px;
        max-height: 150px;
      }
      .chat-footer textarea::placeholder {
        color: rgba(255,255,255,.5);
      }
      .chat-footer textarea:focus {
        outline: none;
        border-color: rgba(102,126,234,0.5);
        background: rgba(255,255,255,.08);
      }
      .chat-send-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }
      .chat-send-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      .chat-send-btn:active {
        transform: translateY(0);
      }
    </style>

    <div class="chat-container">
      <div class="chat-header">
        <div class="chat-header-title">💬 ${escapeHtml(friendUsername)}</div>
        <button class="chat-close-btn" onclick="loadMessagesTab()">Закрыть</button>
      </div>
      <div id="chatMessages"></div>
      <input type="hidden" id="chatFriendId" value="${escapeHtml(friendId)}">
      <input type="hidden" id="currentUserId" value="">
      <input type="hidden" id="editingMessageId" value="">
      <div class="chat-footer">
        <div class="formatting-toolbar">
          <button class="format-btn bold" onclick="insertFormatting('**', '**')" title="Жирный (Ctrl+B)"><b>B</b></button>
          <button class="format-btn italic" onclick="insertFormatting('_', '_')" title="Курсив (Ctrl+I)"><i>I</i></button>
          <button class="format-btn mono" onclick="insertFormatting('\`', '\`')" title="Моноширинный"><code>M</code></button>
          <button class="format-btn" onclick="insertFormatting('~~', '~~')" title="Зачёркнутый"><s>S</s></button>
          <button class="format-btn" onclick="insertLink()" title="Вставить ссылку">🔗</button>
          <button class="format-btn" onclick="insertFormatting('||', '||')" title="Спойлер">||</button>
          <button class="format-btn" onclick="insertCode()" title="Блок кода">{ }</button>
        </div>
        <div class="chat-input-wrapper">
          <textarea id="messageInput" placeholder="Напишите сообщение..." rows="1"></textarea>
          <button class="chat-send-btn" onclick="sendChatMessage('${escapeHtml(friendId)}')">Отправить</button>
        </div>
      </div>
    </div>
  `;

  // Получаем текущего пользователя
  apiCall('/auth/me', { credentials: 'include' })
    .then((r) => r.json())
    .then((data) => {
      if (data.ok && data.user) {
        document.getElementById('currentUserId').value = data.user.id;
      }
    })
    .catch(() => {});

  // Загружаем сообщения
  loadChatMessages(friendId);

  // Настройка textarea
  const messageInput = document.getElementById('messageInput');

  // Автоматическое изменение высоты
  messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
  });

  // Позволяем отправлять по Enter (но Shift+Enter - новая строка)
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(friendId);
    }
  });

  // Горячие клавиши для форматирования
  messageInput.addEventListener('keydown', (e) => {
    // ESC для отмены редактирования
    if (e.key === 'Escape') {
      const editingId = document.getElementById('editingMessageId')?.value;
      if (editingId) {
        e.preventDefault();
        cancelEdit();
      }
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        insertFormatting('**', '**');
      } else if (e.key === 'i') {
        e.preventDefault();
        insertFormatting('_', '_');
      } else if (e.key === 'k') {
        e.preventDefault();
        insertLink();
      }
    }
  });

  // Обновляем сообщения каждые 3 секунды
  const updateInterval = setInterval(() => {
    if (!document.getElementById('chatMessages')) {
      clearInterval(updateInterval);
    } else {
      loadChatMessages(friendId);
    }
  }, 3000);
}

// ============ TEXT FORMATTING FUNCTIONS ============

function insertFormatting(start, end) {
  const input = document.getElementById('messageInput');
  if (!input) return;

  const selStart = input.selectionStart;
  const selEnd = input.selectionEnd;
  const text = input.value;
  const selectedText = text.substring(selStart, selEnd);

  const newText = text.substring(0, selStart) + start + selectedText + end + text.substring(selEnd);
  input.value = newText;

  // Устанавливаем курсор
  if (selectedText) {
    input.setSelectionRange(selStart + start.length, selEnd + start.length);
  } else {
    input.setSelectionRange(selStart + start.length, selStart + start.length);
  }

  input.focus();
}

function insertLink() {
  const input = document.getElementById('messageInput');
  if (!input) return;

  const selStart = input.selectionStart;
  const selEnd = input.selectionEnd;
  const text = input.value;
  const selectedText = text.substring(selStart, selEnd);

  const url = prompt('Введите URL:', 'https://');
  if (!url) return;

  const linkText = selectedText || prompt('Текст ссылки:', url) || url;
  const markdown = `[${linkText}](${url})`;

  const newText = text.substring(0, selStart) + markdown + text.substring(selEnd);
  input.value = newText;

  input.setSelectionRange(selStart + markdown.length, selStart + markdown.length);
  input.focus();
}

function insertCode() {
  const input = document.getElementById('messageInput');
  if (!input) return;

  const selStart = input.selectionStart;
  const selEnd = input.selectionEnd;
  const text = input.value;
  const selectedText = text.substring(selStart, selEnd);

  const language = prompt('Язык программирования (необязательно):', '') || '';
  const formatted = `\`\`\`${language}\n${selectedText || 'код здесь'}\n\`\`\``;

  const newText = text.substring(0, selStart) + formatted + text.substring(selEnd);
  input.value = newText;

  if (!selectedText) {
    input.setSelectionRange(
      selStart + 3 + language.length + 1,
      selStart + 3 + language.length + 1 + 10
    );
  }

  input.focus();
}

// Парсинг форматированного текста
function parseFormattedText(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Блоки кода ```lang\ncode\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  });

  // Инлайн код `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Жирный **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Курсив _text_
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Зачёркнутый ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Спойлер ||text||
  html = html.replace(
    /\|\|([^|]+)\|\|/g,
    '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>'
  );

  // Ссылки [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Автоматические ссылки
  html = html.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return html;
}

// Редактирование сообщения
async function editMessage(messageId, currentContent) {
  const input = document.getElementById('messageInput');
  if (!input) return;

  // Устанавливаем текущий контент для редактирования
  input.value = currentContent;
  input.focus();

  // Сохраняем ID редактируемого сообщения
  document.getElementById('editingMessageId').value = messageId;

  // Меняем кнопку отправки и добавляем кнопку отмены
  const sendBtn = document.querySelector('.chat-send-btn');
  if (sendBtn) {
    sendBtn.textContent = '💾 Сохранить';
    sendBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  }

  // Добавляем индикатор редактирования
  const inputWrapper = document.querySelector('.chat-input-wrapper');
  if (inputWrapper && !document.getElementById('editingIndicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'editingIndicator';
    indicator.style.cssText = `
      background: rgba(240, 147, 251, 0.15);
      border: 1px solid rgba(240, 147, 251, 0.3);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;
    indicator.innerHTML = `
      <span>✏️ Редактирование сообщения... <small style="opacity: 0.7;">(ESC для отмены)</small></span>
      <button onclick="cancelEdit()" style="background: rgba(255,255,255,.1); border: none; color: white; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">❌ Отмена</button>
    `;
    inputWrapper.parentElement.insertBefore(indicator, inputWrapper);
  }

  showTopNotification('info', 'Редактирование сообщения. ESC для отмены');
}

// Отмена редактирования
function cancelEdit() {
  const input = document.getElementById('messageInput');
  const sendBtn = document.querySelector('.chat-send-btn');
  const indicator = document.getElementById('editingIndicator');

  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }

  document.getElementById('editingMessageId').value = '';

  if (sendBtn) {
    sendBtn.textContent = 'Отправить';
    sendBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }

  if (indicator) {
    indicator.remove();
  }
}

async function bindTabActions(tab, me, api) {
  const u = me.user || {};

  // Copy buttons (иконка -> галочка)
  document.querySelectorAll('[data-copybtn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const v = btn.getAttribute('data-copybtn') || '';
      if (!v) return;

      const oldHtml = btn.innerHTML;
      const oldLabel = btn.getAttribute('aria-label') || '';

      const ok = await copyText(v);

      if (ok) {
        api.showMsg('ok', 'Скопировано ✅');

        btn.classList.add('is-copied');
        btn.setAttribute('aria-label', 'Скопировано');

        // ✓ icon
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
          </svg>
        `;

        setTimeout(() => {
          btn.classList.remove('is-copied');
          btn.innerHTML = oldHtml;
          if (oldLabel) btn.setAttribute('aria-label', oldLabel);
          else btn.setAttribute('aria-label', 'Скопировать');
        }, 900);
      } else {
        api.showMsg('error', 'Не удалось скопировать');
      }

      setTimeout(api.clearMsg, 1100);
    });
  });

  // SECURITY tab
  if (tab === 'security') {
    // EMAIL handlers
    const item = document.getElementById('secEmailItem');
    const panel = document.getElementById('secEmailPanel');
    const inp = document.getElementById('secEmailInp');
    const cancelBtn = document.getElementById('secEmailCancelBtn');
    const saveBtn = document.getElementById('secEmailSaveBtn');
    const statusEl = document.getElementById('secEmailStatus');
    const hintEl = document.getElementById('secEmailHint');
    const resendBtn = document.getElementById('secEmailResendBtn');

    function isVerified(userObj) {
      const v = userObj?.email_verified;
      return (
        userObj.emailVerified === true ||
        v === true ||
        v === 1 ||
        v === '1' ||
        Boolean(userObj.email_verified_at || userObj.emailVerifiedAt)
      );
    }

    function openPanel() {
      if (!panel) return;
      panel.style.display = '';
      // чуть приятнее UX: фокус
      setTimeout(() => inp?.focus(), 0);
    }

    function closePanel() {
      if (!panel) return;
      panel.style.display = 'none';
      if (hintEl) {
        hintEl.style.display = 'none';
        hintEl.textContent = '';
      }
      // вернуть значение к текущему
      if (inp) inp.value = u.email || '';
    }

    function setHint(type, text) {
      if (!hintEl) return;
      hintEl.style.display = '';
      hintEl.className = `sec-hint sec-hint--${type}`;
      hintEl.textContent = text;
    }

    function setStatusFromUser(userObj) {
      const ok = isVerified(userObj);
      if (!statusEl) return;

      if (ok) {
        statusEl.textContent = '✅ Email подтверждён';
      } else if (userObj.email) {
        statusEl.textContent = '⚠️ Email не подтверждён';
      } else {
        statusEl.textContent = '— Email не указан';
      }
    }

    function setBadgeFromUser(userObj) {
      const ok = isVerified(userObj);
      const badge = item?.querySelector('.sec-badge');
      if (!badge) return;

      if (ok) {
        badge.className = 'sec-badge sec-badge--ok';
        badge.textContent = 'Подтверждён';
      } else if (userObj.email) {
        badge.className = 'sec-badge sec-badge--warn';
        badge.textContent = 'Не подтверждён';
      } else {
        badge.className = 'sec-badge';
        badge.textContent = '—';
      }
    }

    async function refreshEmailStatus() {
      const ok = await syncUser(u);
      if (!ok) {
        setHint('warn', 'Не удалось обновить данные профиля. Обнови страницу.');
        return;
      }
      updateEmailUiFromUser(u, {
        item,
        panel,
        inp,
        statusEl,
        hintEl,
        setStatusFromUser,
        setBadgeFromUser,
      });
    }

    function onEmailVerifiedPing(e) {
      if (e.key !== 'cyb_email_verified_ping') return;

      // мы в вкладке аккаунта получили сигнал: email подтвердили в другой вкладке
      (async () => {
        const ok = await syncUser(u);
        if (!ok) {
          setHint('warn', 'Email подтверждён, но профиль не обновился. Обнови страницу.');
          return;
        }

        updateEmailUiFromUser(u, {
          item,
          panel,
          inp,
          statusEl,
          hintEl,
          setStatusFromUser,
          setBadgeFromUser,
        });

        setHint('ok', 'Email подтверждён ✅');
        api.showMsg?.('ok', 'Email подтверждён ✅');
      })();
    }

    // ✅ слушаем изменения localStorage (только из других вкладок!)
    window.addEventListener('storage', onEmailVerifiedPing);

    // ✅ важно: снять слушатель при смене вкладки/роута (чтобы не копились)
    if (!window.__cyb_cleanup) window.__cyb_cleanup = [];
    window.__cyb_cleanup.push(() => window.removeEventListener('storage', onEmailVerifiedPing));

    // клик по строке — открыть/закрыть
    if (item && panel) {
      item.onclick = async () => {
        const isClosed = panel.style.display === 'none';

        if (isClosed) {
          await refreshEmailStatus();
          openPanel();
        } else {
          closePanel();
        }
      };

      // чтобы по умолчанию было скрыто явно
      panel.style.display = 'none';
    }

    cancelBtn && (cancelBtn.onclick = () => closePanel());

    saveBtn &&
      (saveBtn.onclick = async () => {
        api.clearMsg();

        const email = (inp?.value || '').trim();
        if (!email) {
          api.showMsg('warn', 'Введите email.');
          return;
        }

        // ЗАПРЕТ: нельзя сохранять тот же email
        const cur = String(u.email || '')
          .trim()
          .toLowerCase();
        const next = String(email).trim().toLowerCase();

        if (cur && cur === next) {
          api.showMsg('warn', 'Это текущий email. Введите другой адрес, чтобы сохранить.');
          // подсказка в панели:
          setHint?.('warn', 'Адрес не изменён — письмо не отправили.');
          return;
        }

        saveBtn.disabled = true;
        const old = saveBtn.textContent;
        saveBtn.textContent = 'Сохраняю…';

        try {
          const r = await apiCall('/auth/email/set', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось сохранить email.');
            return;
          }

          // 1) быстрый локальный апдейт
          u.email = email;

          // 2) подтянуть реальную истину с сервера (может вернуть нормализованный email, verified_at, cooldown и т.д.)
          const ok = await syncUser(u);
          if (!ok) {
            setHint('warn', 'Email сохранён, но не удалось обновить профиль. Обнови страницу.');
          } else {
            // 3) обновить UI
            updateEmailUiFromUser(u, {
              item,
              panel,
              inp,
              statusEl,
              hintEl,
              setStatusFromUser,
              setBadgeFromUser,
            });

            // сообщение как у тебя по задумке
            setHint(
              'ok',
              'Сохранено ✅ Проверьте почту и подтвердите её по ссылке в письме (включая “Спам”).'
            );
            showInfoModal({
              title: 'Email сохранён ✅',
              text: 'Мы отправили письмо для подтверждения. Открой его (и проверь Спам).',
            });
          }
          api.showMsg(
            'ok',
            d?.cooldown
              ? 'Email сохранён ✅ Письмо уже отправляли недавно.'
              : 'Email сохранён ✅ Письмо отправлено.'
          );
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = old;
        }
      });

    resendBtn &&
      (resendBtn.onclick = async () => {
        api.clearMsg();
        resendBtn.disabled = true;
        const old = resendBtn.textContent;
        resendBtn.textContent = 'Отправляю…';

        try {
          const r = await apiCall('/auth/email/resend', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось отправить письмо.');
          } else if (d?.alreadyVerified) {
            api.showMsg('ok', 'Email уже подтверждён ✅');

            // подтянем /auth/me и обновим локальный
            const ok = await syncUser(u);
            if (!ok) {
              setHint('warn', 'Email уже подтверждён, но профиль не обновился. Обнови страницу.');
            } else {
              // обновим UI (статус + бейдж + email)
              updateEmailUiFromUser(u, {
                item,
                panel,
                inp,
                statusEl,
                hintEl,
                setStatusFromUser,
                setBadgeFromUser,
              });

              setHint('ok', 'Email уже подтверждён. Всё готово ✅');
            }
          } else if (d?.cooldown) {
            api.showMsg('warn', 'Письмо уже отправляли недавно. Подожди минутку и попробуй снова.');
          } else {
            api.showMsg('ok', 'Письмо отправлено ✅ Проверь почту (и Спам).');
            setHint('ok', 'Письмо отправлено. Проверьте почту и подтвердите её по ссылке.');
          }
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          resendBtn.disabled = false;
          resendBtn.textContent = old;
        }
      });

    // на старте выставим статус
    setStatusFromUser(u);
    setBadgeFromUser(u);
    refreshEmailStatus();

    // если только что подтвердили email — подтянем свежие данные сразу
    if (getStorage('cyb_email_just_verified', '', sessionStorage) === '1') {
      sessionStorage.removeItem('cyb_email_just_verified');

      // небольшая пауза на всякий (если бекенд обновляет запись асинхронно)
      setTimeout(async () => {
        const ok = await syncUser(u);
        if (!ok) {
          setHint?.('warn', 'Email подтверждён, но профиль не обновился. Обнови страницу.');
          return;
        }
        updateEmailUiFromUser(u, {
          item,
          panel,
          inp,
          statusEl,
          hintEl,
          setStatusFromUser,
          setBadgeFromUser,
        });
      }, 200);
    }

    // --- PASSWORD handlers (security) ---
    const passItem = document.getElementById('secPassItem');
    const passSubEl = passItem?.querySelector('.sec-sub');
    const passPanel = document.getElementById('secPassPanel');
    const passCur = document.getElementById('secPassCur');
    const passNew = document.getElementById('secPassNew');
    const passNew2 = document.getElementById('secPassNew2');
    const passCancelBtn = document.getElementById('secPassCancelBtn');
    const passSaveBtn = document.getElementById('secPassSaveBtn');
    const passStatusEl = document.getElementById('secPassStatus');
    const passHintEl = document.getElementById('secPassHint');
    const hintsChange = document.getElementById('passHintsChange');

    attachPasswordHints(passNew, hintsChange, {
      minLen: 8,
      requireUpper: true,
      requireLower: true,
    });

    initPasswordEyes(document.getElementById('accBody') || document);

    function setPassHint(type, text) {
      if (!passHintEl) return;
      passHintEl.style.display = '';
      passHintEl.className = `sec-hint sec-hint--${type}`;
      passHintEl.textContent = text;
    }

    function clearPassHint() {
      if (!passHintEl) return;
      passHintEl.style.display = 'none';
      passHintEl.textContent = '';
    }

    function openPassPanel() {
      if (!passPanel) return;
      passPanel.style.display = '';
      clearPassHint();
      if (passStatusEl) passStatusEl.textContent = 'Введите текущий пароль и новый пароль.';
      setTimeout(() => passCur?.focus(), 0);
    }

    function closePassPanel() {
      if (!passPanel) return;
      passPanel.style.display = 'none';
      clearPassHint();
      if (passCur) passCur.value = '';
      if (passNew) passNew.value = '';
      if (passNew2) passNew2.value = '';
      if (passCur) passCur.type = 'password';
      if (passNew) passNew.type = 'password';
      if (passNew2) passNew2.type = 'password';
    }

    if (passItem && passPanel) {
      passItem.onclick = () => {
        const isClosed = passPanel.style.display === 'none';
        if (isClosed) openPassPanel();
        else closePassPanel();
      };
      passPanel.style.display = 'none';
    }

    passCancelBtn && (passCancelBtn.onclick = closePassPanel);

    // ✅ Смена пароля
    passSaveBtn &&
      (passSaveBtn.onclick = async () => {
        api.clearMsg?.();
        clearPassHint();

        const cur = String(passCur?.value || '');
        const n1 = String(passNew?.value || '');
        const n2 = String(passNew2?.value || '');

        if (!cur) {
          setPassHint('warn', 'Введите действующий пароль.');
          passCur?.focus();
          return;
        }

        if (!/^[\x20-\x7E]*$/.test(n1)) {
          setPassHint('warn', 'Нельзя использовать рус/укр буквы и любые не-ASCII символы.');
          passNew?.focus();
          return;
        }

        if (n1.length < 8) {
          setPassHint('warn', 'Новый пароль должен быть минимум 8 символов.');
          passNew?.focus();
          return;
        }
        if (n1 !== n2) {
          setPassHint('error', 'Новые пароли не совпадают.');
          passNew2?.focus();
          return;
        }
        if (cur === n1) {
          setPassHint('warn', 'Новый пароль должен отличаться от текущего.');
          passNew?.focus();
          return;
        }

        passSaveBtn.disabled = true;
        const old = passSaveBtn.textContent;
        passSaveBtn.textContent = 'Сохраняю…';

        try {
          // ⚠️ эндпоинт должен быть на бэке
          const r = await apiCall('/auth/password/change', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentPassword: cur,
              newPassword: n1,
            }),
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            const err = String(d?.error || '');
            if (r.status === 401 || err.includes('invalid')) {
              setPassHint('error', 'Неверный действующий пароль.');
            } else if (r.status === 429) {
              setPassHint('warn', 'Слишком много попыток. Подожди и попробуй снова.');
            } else {
              setPassHint('error', err ? `Ошибка: ${err}` : 'Не удалось сменить пароль.');
            }
            return;
          }

          // ✅ подтянем /auth/me и обновим локальный профиль
          const ok = await syncUser(u);
          if (!ok) {
            setPassHint('warn', 'Пароль изменён, но профиль не обновился. Обнови страницу.');
          } else {
            setPassHint('ok', 'Пароль изменён ✅');
          }

          showInfoModal({
            title: 'Готово ✅',
            text: 'Пароль успешно изменён.',
            onOk: () => closePassPanel(),
          });

          if (passSubEl) {
            const passChanged =
              u.password_changed_at ||
              u.passwordChangedAt ||
              u.passChangedAt ||
              u.pass_changed_at ||
              null;

            passSubEl.textContent = `Последний раз был изменён: ${fmtTs(passChanged)}`;
          }

          api.showMsg?.('ok', 'Пароль изменён ✅');
        } catch {
          setPassHint('error', 'Ошибка сети.');
        } finally {
          passSaveBtn.disabled = false;
          passSaveBtn.textContent = old;
        }
      });
  }

  // --- 2FA handlers (security) ---
  if (tab === 'security') {
    // ==================== SECURITY CHECK SECTION ====================
    const itemSecurityCheck = document.getElementById('secSecurityCheckItem');
    const panelSecurityCheck = document.getElementById('secSecurityCheckPanel');

    if (itemSecurityCheck && panelSecurityCheck) {
      itemSecurityCheck.onclick = () => {
        const isClosed = panelSecurityCheck.style.display === 'none';
        panelSecurityCheck.style.display = isClosed ? 'block' : 'none';
      };
    }

    // ==================== 2FA SECTION ====================
    const item2FA = document.getElementById('sec2FAItem');
    const panel2FA = document.getElementById('sec2FAPanel');
    const content2FA = document.getElementById('sec2FAContent');
    const status2FA = document.getElementById('sec2FAStatus');
    const date2FA = document.getElementById('sec2FADate');

    async function load2FAStatus() {
      try {
        const r = await apiCall('/auth/me', { credentials: 'include' });
        const data = await r.json().catch(() => ({}));
        console.log('load2FAStatus response:', { ok: r.ok, user: data.user });
        if (r.ok && data.user) {
          const enabled = Boolean(data.user.totpEnabled || data.user.totp_enabled);
          const totpEnabledAt = data.user.totp_enabled_at || data.user.totpEnabledAt || null;

          if (api.securityState) {
            api.securityState.twoFAEnabled = enabled;
            api.securityState.totpEnabledAt = totpEnabledAt;
          }
          console.log('2FA status loaded:', enabled, 'enabled at:', totpEnabledAt);
          if (status2FA) {
            status2FA.textContent = enabled ? '✅ Включена' : 'Отключена';
          }
          if (date2FA) {
            if (enabled && totpEnabledAt) {
              date2FA.textContent = `${fmtTs(totpEnabledAt)}`;
              date2FA.style.display = 'block';
            } else {
              date2FA.style.display = 'none';
            }
          }
          render2FAContent();
          // Обновляем индикатор безопасности
          if (api.securityState?.updateIndicator) {
            api.securityState.updateIndicator();
          }
        }
      } catch {
        if (status2FA) status2FA.textContent = 'Ошибка загрузки';
      }
    }

    function render2FAContent() {
      if (!content2FA) return;

      const enabled = api.securityState?.twoFAEnabled || false;
      const totpEnabledAt = api.securityState?.totpEnabledAt || null;

      if (enabled) {
        const enabledAtText = totpEnabledAt ? escapeHtml(fmtTs(totpEnabledAt)) : '—';

        content2FA.innerHTML = `
          <div class="sec-status">✅ Двухфакторная аутентификация активна</div>
          <div style="margin:8px 0;font-size:13px;color:rgba(231,236,255,0.6);">
            Включена: ${enabledAtText}
          </div>
          <p style="margin:10px 0;font-size:13px;color:rgba(231,236,255,0.7);">
            При входе потребуется код из приложения аутентификатора.
          </p>
          <button class="btn btn-outline" id="disable2FABtn" type="button">
            Отключить 2FA
          </button>
        `;

        document.getElementById('disable2FABtn').onclick = () => show2FADisableForm();
      } else {
        content2FA.innerHTML = `
          <div class="sec-status">Двухфакторная аутентификация не активна</div>
          <p style="margin:10px 0;font-size:13px;color:rgba(231,236,255,0.7);">
            Добавь дополнительный уровень защиты для своего аккаунта.
          </p>
          <button class="btn btn-primary" id="enable2FABtn" type="button">
            Включить 2FA
          </button>
        `;

        document.getElementById('enable2FABtn').onclick = () => start2FASetup();
      }
    }

    async function start2FASetup() {
      api.clearMsg?.();
      content2FA.innerHTML = '<div style="text-align:center;padding:20px;">Загрузка...</div>';

      try {
        const r = await apiCall('/auth/2fa/setup', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await r.json().catch(() => ({}));

        console.log('2FA setup response:', { ok: r.ok, data });

        if (!r.ok) {
          if (data.alreadyEnabled || data?.data?.alreadyEnabled) {
            twoFAEnabled = true;
            render2FAContent();
            api.showMsg?.('ok', '2FA уже включена');
          } else {
            content2FA.innerHTML = `<div class="sec-status">Ошибка: ${data.error || 'Неизвестная ошибка'}</div>`;
          }
          return;
        }

        // Сервер возвращает {ok: true, data: {secret, uri, qrData}}
        const setupData = data.data || data;
        const qrData = setupData.uri || setupData.qrData;
        const secretKey = setupData.secret || 'Не получен';

        console.log('QR Data:', qrData, 'Secret:', secretKey);
        content2FA.innerHTML = `
          <div class="sec-status">Шаг 1: Отсканируй QR-код</div>
          <p style="margin:10px 0;font-size:13px;color:rgba(231,236,255,0.7);text-align:center;">
            Используй приложение Proton , Google , Microsoft Authenticator или Authy.
          </p>
          <div style="text-align:center;margin:20px 0;">
            <div style="background:#fff;padding:16px;border-radius:8px;display:inline-block;">
              <div id="qrcode"></div>
            </div>
          </div>
          <div style="margin:20px 0;text-align:center;">
            <p style="font-size:12px;color:rgba(231,236,255,0.6);margin-bottom:8px;">Секретный ключ (если не работает QR):</p>
            <div style="background:rgba(255,255,255,0.1);padding:12px 16px;border-radius:6px;display:inline-block;max-width:100%;">
              <code id="secretKeyCode" style="font-size:13px;color:#fff;word-break:break-all;cursor:pointer;user-select:all;" 
                    title="Нажми, чтобы скопировать">${secretKey}</code>
            </div>
            <div style="margin-top:8px;">
              <button class="btn btn-outline" id="copySecretBtn" type="button" style="padding:6px 16px;font-size:12px;">
                📋 Скопировать ключ
              </button>
            </div>
          </div>

          <div class="sec-form-row" style="margin-top:16px;">
            <label class="label">Шаг 2: Введи код из приложения</label>
            <input class="input" id="confirm2FACode" type="text" inputmode="numeric" 
                   placeholder="000000" maxlength="6" 
                   style="text-align:center;font-size:20px;letter-spacing:4px;" />
          </div>

          <div class="sec-actions" style="margin-top:12px;">
            <button class="btn btn-outline" id="cancel2FABtn" type="button">Отменить</button>
            <button class="btn btn-primary" id="confirm2FABtn" type="button">Подтвердить</button>
          </div>

          <div class="sec-hint" id="hint2FA" style="display:none;"></div>
        `;

        // Генерируем QR-код используя библиотеку (нужно подключить qrcode.js)
        if (window.QRCode && qrData) {
          new window.QRCode(document.getElementById('qrcode'), {
            text: qrData,
            width: 200,
            height: 200,
          });
        } else {
          document.getElementById('qrcode').innerHTML =
            `<p style="color:#666;font-size:12px;">QR библиотека не загружена. Используй секретный ключ.</p>`;
        }

        // Обработчик копирования секретного ключа
        const copySecretBtn = document.getElementById('copySecretBtn');
        const secretKeyCode = document.getElementById('secretKeyCode');

        const copySecret = () => {
          navigator.clipboard
            .writeText(secretKey)
            .then(() => {
              const originalText = copySecretBtn.textContent;
              copySecretBtn.textContent = '✓ Скопировано!';
              copySecretBtn.style.background = '#22c55e';
              setTimeout(() => {
                copySecretBtn.textContent = originalText;
                copySecretBtn.style.background = '';
              }, 2000);
            })
            .catch(() => {
              alert('Не удалось скопировать. Выдели текст вручную.');
            });
        };

        copySecretBtn.onclick = copySecret;
        secretKeyCode.onclick = copySecret;

        document.getElementById('cancel2FABtn').onclick = () => {
          render2FAContent();
        };

        document.getElementById('confirm2FABtn').onclick = async () => {
          const code = document.getElementById('confirm2FACode').value.trim();
          const hint = document.getElementById('hint2FA');

          if (!code || code.length !== 6) {
            hint.style.display = '';
            hint.className = 'sec-hint sec-hint--warn';
            hint.textContent = 'Введи 6-значный код';
            return;
          }

          const btn = document.getElementById('confirm2FABtn');
          btn.disabled = true;
          const oldText = btn.textContent;
          btn.textContent = 'Проверяю...';

          try {
            const r2 = await apiCall('/auth/2fa/enable', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code }),
            });
            const d2 = await r2.json().catch(() => ({}));

            if (!r2.ok) {
              hint.style.display = '';
              hint.className = 'sec-hint sec-hint--error';
              hint.textContent =
                d2.error === 'invalid_code' ? 'Неверный код' : `Ошибка: ${d2.error}`;
              btn.disabled = false;
              btn.textContent = oldText;
              return;
            }

            // Успех! Показываем резервные коды
            const enableData = d2.data || d2;
            const backupCodes = enableData.backupCodes || [];
            content2FA.innerHTML = `
              <div class="sec-status">✅ 2FA успешно активирована!</div>
              <p style="margin:10px 0;font-size:13px;color:rgba(231,236,255,0.7);text-align:center;">
                Сохрани эти резервные коды в безопасном месте. Каждый можно использовать только один раз.
              </p>
              <div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:8px;margin:16px 0;">
                <div id="backupCodesGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-family:monospace;font-size:13px;user-select:all;">
                  ${backupCodes.map((code) => `<div style="padding:4px;">${code}</div>`).join('')}
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:12px;">
                <button class="btn btn-outline" id="copyCodesBtn" type="button" style="flex:1;">
                  📋 Копировать все коды
                </button>
                <button class="btn btn-outline" id="downloadCodesBtn" type="button" style="flex:1;">
                  💾 Скачать
                </button>
              </div>
              <button class="btn btn-primary" id="done2FABtn" type="button">Готово</button>
            `;

            // Обработчик копирования всех кодов
            document.getElementById('copyCodesBtn').onclick = () => {
              const codesText = backupCodes.join('\n');
              navigator.clipboard
                .writeText(codesText)
                .then(() => {
                  const btn = document.getElementById('copyCodesBtn');
                  const originalText = btn.textContent;
                  btn.textContent = '✓ Скопировано!';
                  btn.style.background = '#22c55e';
                  setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                  }, 2000);
                })
                .catch(() => {
                  alert('Не удалось скопировать. Выдели коды вручную.');
                });
            };

            // Обработчик скачивания файла
            document.getElementById('downloadCodesBtn').onclick = () => {
              const login = getStorage('cyb_login', '', sessionStorage) || 'user';
              const date = new Date().toISOString().split('T')[0];
              const filename = `CybLight_2FA_BackupCodes_${login}_${date}.txt`;

              const content = `CybLight - Резервные коды двухфакторной аутентификации
Пользователь: ${login}
Дата создания: ${new Date().toLocaleString('ru-RU')}

ВАЖНО: Храните эти коды в безопасном месте!
Каждый код можно использовать только один раз для входа без доступа к приложению аутентификации.

Резервные коды:
${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

---
© ${new Date().getFullYear()} CybLight
`;

              const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              const btn = document.getElementById('downloadCodesBtn');
              const originalText = btn.textContent;
              btn.textContent = '✓ Скачано!';
              btn.style.background = '#22c55e';
              setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
              }, 2000);
            };

            document.getElementById('done2FABtn').onclick = () => {
              if (api.securityState) {
                api.securityState.twoFAEnabled = true;
              }
              render2FAContent();
              close2FAPanel();
              api.showMsg?.('ok', '2FA включена ✅');
              // Обновляем индикатор безопасности
              if (api.securityState?.updateIndicator) {
                api.securityState.updateIndicator();
              }
            };
          } catch {
            hint.style.display = '';
            hint.className = 'sec-hint sec-hint--error';
            hint.textContent = 'Ошибка сети';
            btn.disabled = false;
            btn.textContent = oldText;
          }
        };
      } catch {
        content2FA.innerHTML = '<div class="sec-status">Ошибка сети</div>';
      }
    }

    function show2FADisableForm() {
      api.clearMsg?.();
      content2FA.innerHTML = `
        <div class="sec-status">Отключение 2FA</div>
        <p style="margin:10px 0;font-size:13px;color:rgba(231,236,255,0.7);">
          Для отключения введи свой пароль и текущий 2FA код.
        </p>

        <div class="sec-form-row">
          <label class="label">Пароль</label>
          <input class="input" id="disable2FAPass" type="password" autocomplete="current-password" />
        </div>

        <div class="sec-form-row" style="margin-top:10px;">
          <label class="label">2FA код</label>
          <input class="input" id="disable2FACode" type="text" inputmode="numeric" 
                 placeholder="000000" maxlength="6" 
                 style="text-align:center;font-size:20px;letter-spacing:4px;" />
        </div>

        <div class="sec-actions" style="margin-top:12px;">
          <button class="btn btn-outline" id="cancelDisable2FABtn" type="button">Отменить</button>
          <button class="btn btn-danger" id="confirmDisable2FABtn" type="button">Отключить 2FA</button>
        </div>

        <div class="sec-hint" id="hintDisable2FA" style="display:none;"></div>
      `;

      document.getElementById('cancelDisable2FABtn').onclick = () => {
        render2FAContent();
      };

      document.getElementById('confirmDisable2FABtn').onclick = async () => {
        const password = document.getElementById('disable2FAPass').value.trim();
        const code = document.getElementById('disable2FACode').value.trim();
        const hint = document.getElementById('hintDisable2FA');

        if (!password) {
          hint.style.display = '';
          hint.className = 'sec-hint sec-hint--warn';
          hint.textContent = 'Введи пароль';
          return;
        }

        if (!code || code.length !== 6) {
          hint.style.display = '';
          hint.className = 'sec-hint sec-hint--warn';
          hint.textContent = 'Введи 6-значный код';
          return;
        }

        const btn = document.getElementById('confirmDisable2FABtn');
        btn.disabled = true;
        const oldText = btn.textContent;
        btn.textContent = 'Отключаю...';

        try {
          const r = await apiCall('/auth/2fa/disable', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, code }),
          });
          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            hint.style.display = '';
            hint.className = 'sec-hint sec-hint--error';
            if (d.error === 'invalid_password') hint.textContent = 'Неверный пароль';
            else if (d.error === 'invalid_code') hint.textContent = 'Неверный 2FA код';
            else hint.textContent = `Ошибка: ${d.error}`;
            btn.disabled = false;
            btn.textContent = oldText;
            return;
          }

          if (api.securityState) {
            api.securityState.twoFAEnabled = false;
          }
          render2FAContent();
          close2FAPanel();
          api.showMsg?.('ok', '2FA отключена');
          // Обновляем индикатор безопасности
          if (api.securityState?.updateIndicator) {
            api.securityState.updateIndicator();
          }
        } catch {
          hint.style.display = '';
          hint.className = 'sec-hint sec-hint--error';
          hint.textContent = 'Ошибка сети';
          btn.disabled = false;
          btn.textContent = oldText;
        }
      };
    }

    function open2FAPanel() {
      if (!panel2FA) return;
      panel2FA.style.display = '';
    }

    function close2FAPanel() {
      if (!panel2FA) return;
      panel2FA.style.display = 'none';
    }

    if (item2FA && panel2FA) {
      item2FA.onclick = () => {
        const isClosed = panel2FA.style.display === 'none';
        if (isClosed) open2FAPanel();
        else close2FAPanel();
      };
      panel2FA.style.display = 'none';
    }

    load2FAStatus();

    // ==================== PASSKEYS SECTION ====================
    const itemPasskeys = document.getElementById('secPasskeysItem');
    const panelPasskeys = document.getElementById('secPasskeysPanel');
    const contentPasskeys = document.getElementById('secPasskeysContent');
    const statusPasskeys = document.getElementById('secPasskeysStatus');

    let passkeys = [];

    async function loadPasskeys() {
      try {
        const r = await apiCall('/auth/passkey/list', { credentials: 'include' });
        const d = await r.json().catch(() => ({}));

        if (r.ok && d.ok) {
          passkeys = d.passkeys || [];
          const count = passkeys.length;
          if (api.securityState) {
            api.securityState.passkeyCount = count;
          }
          console.log('loadPasskeys: passkeys count =', count);
          if (statusPasskeys) {
            statusPasskeys.textContent =
              passkeys.length > 0
                ? `Зарегистрировано ключей: ${passkeys.length}`
                : 'Ключи не добавлены';
          }
          renderPasskeysContent();

          // Обновляем индикатор безопасности
          console.log('Calling updateSecurityIndicator from loadPasskeys');
          if (api.securityState?.updateIndicator) {
            api.securityState.updateIndicator();
          }
        } else {
          if (statusPasskeys) statusPasskeys.textContent = 'Ошибка загрузки';
        }
      } catch {
        if (statusPasskeys) statusPasskeys.textContent = 'Ошибка загрузки';
      }
    }

    function renderPasskeysContent() {
      if (!contentPasskeys) return;

      if (passkeys.length === 0) {
        contentPasskeys.innerHTML = `
          <div class="sec-status">Ключи доступа не добавлены</div>
          <p style="margin:10px 0;font-size:13px;color:rgba(231,236,255,0.7);">
            Ключи доступа (passkeys) позволяют входить в аккаунт без пароля, используя биометрию или PIN-код устройства.
          </p>
          <button class="btn btn-primary" id="addPasskeyBtn" type="button">
            ➕ Добавить ключ доступа
          </button>
        `;

        document.getElementById('addPasskeyBtn').onclick = () => registerPasskey();
      } else {
        const listHtml = passkeys
          .map(
            (pk) => `
          <div class="passkey-item" style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(pk.name)}</div>
                <div style="font-size:12px;opacity:0.7;">
                  Создан: ${escapeHtml(fmtTs(pk.createdAt))}
                  ${pk.lastUsedAt ? ` • Использован: ${escapeHtml(fmtTs(pk.lastUsedAt))}` : ''}
                </div>
              </div>
              <button class="btn btn-outline" data-delete-passkey="${escapeHtml(pk.id)}" type="button" style="padding:6px 12px;font-size:12px;">
                Удалить
              </button>
            </div>
          </div>
        `
          )
          .join('');

        contentPasskeys.innerHTML = `
          <div class="sec-status">Ваши ключи доступа</div>
          <div style="margin:12px 0;">
            ${listHtml}
          </div>
          <button class="btn btn-primary" id="addPasskeyBtn" type="button">
            ➕ Добавить ключ доступа
          </button>
        `;

        document.getElementById('addPasskeyBtn').onclick = () => registerPasskey();

        document.querySelectorAll('[data-delete-passkey]').forEach((btn) => {
          btn.onclick = async () => {
            const passkeyId = btn.getAttribute('data-delete-passkey');
            if (!passkeyId) return;

            if (!confirm('Удалить этот ключ доступа?')) return;

            try {
              const r = await apiCall(`/auth/passkey/${passkeyId}`, {
                method: 'DELETE',
                credentials: 'include',
              });

              if (r.ok) {
                api.showMsg?.('ok', 'Ключ доступа удалён');
                await loadPasskeys();
              } else {
                api.showMsg?.('error', 'Ошибка удаления ключа');
              }
            } catch {
              api.showMsg?.('error', 'Ошибка сети');
            }
          };
        });
      }
    }

    async function registerPasskey() {
      try {
        // Проверка поддержки WebAuthn
        if (!window.PublicKeyCredential) {
          api.showMsg?.('error', 'Ваш браузер не поддерживает ключи доступа');
          return;
        }

        // Получаем options для регистрации
        const r1 = await apiCall('/auth/passkey/register/options', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const d1 = await r1.json().catch(() => ({}));

        if (!r1.ok || !d1.ok) {
          api.showMsg?.('error', 'Ошибка получения параметров регистрации');
          return;
        }

        const options = d1.options;

        // Преобразуем base64url в ArrayBuffer
        const challenge = Uint8Array.from(
          atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        );
        const userId = Uint8Array.from(
          atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        );

        const publicKeyOptions = {
          challenge: challenge,
          rp: options.rp,
          user: {
            id: userId,
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          timeout: options.timeout,
          excludeCredentials: (options.excludeCredentials || []).map((c) => ({
            ...c,
            id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), (ch) =>
              ch.charCodeAt(0)
            ),
          })),
          authenticatorSelection: options.authenticatorSelection,
          attestation: options.attestation,
        };

        // Вызываем WebAuthn API
        const credential = await navigator.credentials.create({
          publicKey: publicKeyOptions,
        });

        if (!credential) {
          api.showMsg?.('error', 'Регистрация ключа отменена');
          return;
        }

        // Преобразуем credential в формат для отправки
        const credentialData = {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, ''),
          response: {
            clientDataJSON: btoa(
              String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))
            )
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
            attestationObject: btoa(
              String.fromCharCode(...new Uint8Array(credential.response.attestationObject))
            )
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, ''),
          },
          type: credential.type,
        };

        // Спрашиваем имя для ключа
        const name =
          prompt('Введите название для этого ключа доступа:', 'Мой ключ') || 'Ключ доступа';

        // Отправляем на сервер
        const r2 = await apiCall('/auth/passkey/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential: credentialData,
            name: name,
          }),
        });

        const d2 = await r2.json().catch(() => ({}));

        if (r2.ok && d2.ok) {
          api.showMsg?.('ok', 'Ключ доступа успешно добавлен! ✅');
          await loadPasskeys();
        } else {
          api.showMsg?.('error', `Ошибка сохранения ключа: ${d2.error || 'unknown'}`);
        }
      } catch (err) {
        console.error('Passkey registration error:', err);
        if (err.name === 'NotAllowedError') {
          api.showMsg?.('warn', 'Регистрация ключа отменена');
        } else {
          api.showMsg?.('error', `Ошибка: ${err.message || 'unknown'}`);
        }
      }
    }

    function openPasskeysPanel() {
      if (!panelPasskeys) return;
      panelPasskeys.style.display = '';
      loadPasskeys();
    }

    function closePasskeysPanel() {
      if (!panelPasskeys) return;
      panelPasskeys.style.display = 'none';
    }

    if (itemPasskeys && panelPasskeys) {
      itemPasskeys.onclick = () => {
        const isClosed = panelPasskeys.style.display === 'none';
        if (isClosed) openPasskeysPanel();
        else closePasskeysPanel();
      };
      panelPasskeys.style.display = 'none';
    }

    loadPasskeys();
    // ==================== END PASSKEYS SECTION ====================

    // ==================== TRUSTED DEVICES SECTION ====================
    const itemDevices = document.getElementById('secDevicesItem');
    const panelDevices = document.getElementById('secDevicesPanel');
    const listDevices = document.getElementById('trustedDevicesList');

    async function loadDevices() {
      if (!listDevices) return;

      try {
        const r = await apiCall('/auth/trusted-devices', {
          credentials: 'include',
        });
        const d = await r.json().catch(() => ({}));

        if (!r.ok || !d.ok) {
          listDevices.innerHTML = '<div style="color:var(--red);">Ошибка загрузки устройств</div>';
          return;
        }

        const devices = d.devices || [];
        if (devices.length === 0) {
          listDevices.innerHTML = '<div style="opacity:.7;">Нет доверенных устройств</div>';
          return;
        }

        const html = devices
          .map((device) => {
            const created = fmtTs(device.createdAt);
            const lastUsed = device.lastUsedAt ? fmtTs(device.lastUsedAt) : 'Не использовалось';
            const ip = device.ipAddress || '—';
            const ua = device.userAgent || '—';

            return `
              <div style="background:rgba(255,255,255,.03);padding:12px;border-radius:8px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                  <div style="flex:1;min-width:200px;">
                    <div style="font-weight:600;margin-bottom:4px;">📱 Доверенное устройство</div>
                    <div style="font-size:12px;opacity:0.7;">Добавлено: ${escapeHtml(created)}</div>
                    <div style="font-size:12px;opacity:0.7;">Последний вход: ${escapeHtml(lastUsed)}</div>
                  </div>
                  <div style="flex:1;min-width:200px;font-size:12px;opacity:0.8;">
                    <div><b>IP:</b> ${escapeHtml(ip)}</div>
                    <div style="word-break:break-all;"><b>Устройство:</b> ${escapeHtml(ua)}</div>
                    <button class="btn btn-outline" data-remove-device="${escapeHtml(device.id)}" 
                            style="margin-top:8px;padding:4px 12px;font-size:12px;">
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            `;
          })
          .join('');

        listDevices.innerHTML = html;

        // Обработчики удаления
        document.querySelectorAll('[data-remove-device]').forEach((btn) => {
          btn.onclick = async () => {
            const deviceId = btn.getAttribute('data-remove-device');
            if (!deviceId || !confirm('Удалить это доверенное устройство?')) return;

            try {
              const r = await apiCall(`/auth/trusted-devices/${deviceId}`, {
                method: 'DELETE',
                credentials: 'include',
              });

              if (r.ok) {
                api.showMsg?.('ok', 'Устройство удалено');
                loadDevices(); // Перезагружаем список
              } else {
                api.showMsg?.('error', 'Ошибка удаления');
              }
            } catch {
              api.showMsg?.('error', 'Ошибка сети');
            }
          };
        });
      } catch (e) {
        console.error('Error loading trusted devices:', e);
        listDevices.innerHTML = '<div style="color:var(--red);">Ошибка сети</div>';
      }
    }

    if (itemDevices && panelDevices) {
      itemDevices.onclick = () => {
        const isClosed = panelDevices.style.display === 'none';
        if (isClosed) {
          panelDevices.style.display = '';
          loadDevices();
        } else {
          panelDevices.style.display = 'none';
        }
      };
      panelDevices.style.display = 'none';
    }
    // ==================== END TRUSTED DEVICES SECTION ====================

    // ==================== LOGIN HISTORY SECTION ====================
    const itemHistory = document.getElementById('secHistoryItem');
    const panelHistory = document.getElementById('secHistoryPanel');
    const listHistory = document.getElementById('loginHistoryList');

    async function loadHistory() {
      if (!listHistory) return;

      try {
        const r = await apiCall('/auth/login-history?limit=50', {
          credentials: 'include',
        });
        const d = await r.json().catch(() => ({}));

        if (!r.ok || !d.ok) {
          listHistory.innerHTML = '<div style="color:var(--red);">Ошибка загрузки истории</div>';
          return;
        }

        const history = d.history || [];
        if (history.length === 0) {
          listHistory.innerHTML = '<div style="opacity:.7;">История входов пуста</div>';
          return;
        }

        const actionLabels = {
          login_success: '✅ Успешный вход',
          login_failed: '❌ Неудачная попытка',
          login_2fa: '🔐 Вход с 2FA',
          passkey_login: '🔑 Вход через passkey',
        };

        const html = history
          .map((item) => {
            const date = fmtTs(item.createdAt);
            const label = actionLabels[item.action] || item.action;
            const ip = item.ip || '—';
            const ua = item.userAgent || '—';

            return `
              <div style="background:rgba(255,255,255,.03);padding:12px;border-radius:8px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                  <div style="flex:1;min-width:200px;">
                    <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(label)}</div>
                    <div style="font-size:12px;opacity:0.7;">${escapeHtml(date)}</div>
                  </div>
                  <div style="flex:1;min-width:200px;font-size:12px;opacity:0.8;">
                    <div><b>IP:</b> ${escapeHtml(ip)}</div>
                    <div style="word-break:break-all;"><b>Устройство:</b> ${escapeHtml(ua)}</div>
                  </div>
                </div>
              </div>
            `;
          })
          .join('');

        listHistory.innerHTML = html;
      } catch (e) {
        console.error('Error loading login history:', e);
        listHistory.innerHTML = '<div style="color:var(--red);">Ошибка сети</div>';
      }
    }

    if (itemHistory && panelHistory) {
      itemHistory.onclick = () => {
        const isClosed = panelHistory.style.display === 'none';
        if (isClosed) {
          panelHistory.style.display = '';
          loadHistory();
        } else {
          panelHistory.style.display = 'none';
        }
      };
      panelHistory.style.display = 'none';
    }
  }
  // ==================== END LOGIN HISTORY SECTION ====================
  // ==================== END SECURITY TAB ====================

  // Sessions tab action
  if (tab === 'sessions') {
    const b = document.getElementById('logoutOthersBtn');
    if (b && !b.disabled) {
      b.onclick = async () => {
        api.clearMsg();
        b.disabled = true;
        const old = b.textContent;
        b.textContent = 'Выхожу…';
        try {
          const res = await apiCall('/auth/logout-others', {
            method: 'POST',
            credentials: 'include',
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) api.showMsg('error', data?.error ? `Ошибка: ${data.error}` : 'Не удалось.');
          else api.showMsg('ok', `Готово ✅ Завершено сессий: ${data.removed ?? 0}`);
          setTimeout(() => CybRouter.navigate('account-sessions'), 450);
        } catch {
          api.showMsg('error', 'Ошибка сети. Попробуй ещё раз.');
        } finally {
          b.disabled = false;
          b.textContent = old;
        }
      };
    }
  }

  // Easter tab
  if (tab === 'easter') {
    const btn = document.getElementById('toHistoryBtn');
    if (btn && !btn.disabled)
      btn.onclick = () => {
        setStorage(HISTORY_FROM_KEY, 'account-easter-eggs', sessionStorage); // ✅ пришли из пасхалок
        CybRouter.navigate('strawberry-history');
      };
  }

  // ==================== FRIENDS TAB ====================
  if (tab === 'friends') {
    loadFriendsTab(api);
  }

  // ==================== MESSAGES TAB ====================
  if (tab === 'messages') {
    loadMessagesTab(api);
  }

  // PROFILE tab

  if (tab === 'profile') {
    const btn = document.getElementById('saveEmailBtn');
    const inp = document.getElementById('emailInp');

    if (btn && inp) {
      btn.onclick = async () => {
        api.clearMsg();

        const email = (inp?.value || '').trim();
        if (!email) {
          api.showMsg('warn', 'Введите email.');
          return;
        }

        // ✅ запрет сохранять тот же email
        const cur = String(u.email || '')
          .trim()
          .toLowerCase();
        const next = String(email).trim().toLowerCase();
        if (cur && cur === next) {
          api.showMsg('warn', 'Это текущий email. Введите другой адрес.');
          return;
        }

        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = 'Сохраняю…';

        try {
          const r = await apiCall('/auth/email/set', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось сохранить email.');
          } else {
            if (d?.cooldown) {
              api.showMsg(
                'warn',
                'Email сохранён ✅ Письмо уже отправляли недавно — попробуй позже.'
              );
            } else {
              api.showMsg('ok', 'Email сохранён ✅ Проверь почту для подтверждения.');
            }
            setTimeout(() => CybRouter.navigate('account-profile'), 450);
          }
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          btn.disabled = false;
          btn.textContent = old;
        }
      };
    }

    const resend = document.getElementById('resendVerifyBtn');
    if (resend) {
      resend.onclick = async () => {
        api.clearMsg();
        resend.disabled = true;
        const old = resend.textContent;
        resend.textContent = 'Отправляю…';

        try {
          const r = await apiCall('/auth/email/resend', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось отправить письмо.');
          } else if (d?.alreadyVerified) {
            api.showMsg('ok', 'Email уже подтверждён ✅');
            setTimeout(() => CybRouter.navigate('account-profile'), 350);
          } else if (d?.cooldown) {
            api.showMsg('warn', 'Письмо уже отправляли недавно. Подожди минутку и попробуй снова.');
          } else {
            api.showMsg('ok', 'Письмо отправлено ✅ Проверь почту (и Спам).');
          }
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          resend.disabled = false;
          resend.textContent = old;
        }
      };
    }
  }
}

async function viewStrawberryHistory() {
  // ✅ умная проверка доступа:
  // 1) если есть локально — пускаем сразу
  // 2) если нет — пробуем спросить сервер /auth/me
  if (!hasStrawberryAccess()) {
    try {
      const res = await apiCall('/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await res.json().catch(() => null);

      const serverHas = !!(
        res.ok &&
        data?.ok &&
        (data?.user?.easter?.strawberry || data?.easter?.strawberry)
      );

      if (serverHas) {
        setStrawberryAccess(); // ✅ сохраняем локально
      } else {
        CybRouter.navigate('account-easter-eggs');
        return;
      }
    } catch {
      // сеть/сервер недоступны — считаем, что доступа нет
      CybRouter.navigate('account-easter-eggs');
      return;
    }
  }

  const from = getStorage(HISTORY_FROM_KEY, sessionStorage) || '';
  const login = getStorage('cyb_login', '', sessionStorage) || 'Гость';

  setNoStrawberries(false);

  app.innerHTML = shell(`
    <section class="auth-card strawberry-history">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Стенография 🍓</h1>
          <span class="brand">${escapeHtml(login)}</span>
        </div>
      </div>

      <p class="strawberry-text">
        Мы зафиксировали необычную активность.<br>
        Этот клубничный дождь не зря тут падает…
      </p>

      <div class="strawberry-grid">
        <img src="/assets/img/strawberries/1-StrwAlex.png" alt="🍓Alex">
        <img src="/assets/img/strawberries/2.webp" alt="🍓 Alex">
        <img src="/assets/img/strawberries/3.jpg" alt="🍓 Alex">
        <img src="/assets/img/strawberries/4.jpg" alt="🍓 Izzzi">
        <img src="/assets/img/strawberries/5.jpg" alt="🍓 CybLight">
        <img src="/assets/img/strawberries/6.jpg" alt="🍓 Alex">
        <img src="/assets/img/strawberries/7.jpg" alt="🍓 Vlad">
        <img src="/assets/img/strawberries/8.jpg" alt="🍓 Izzzi">
      </div>

      <button class="btn btn-primary" id="toUsername">
         ${from === 'account-easter-eggs' ? '← Вернуться назад' : 'Продолжить'}
      </button>
    </section>
  `);

  // scroll top btn (чтобы не плодить)
  const old = document.getElementById('scrollTopBtn');
  if (old) old.remove();

  // создаём кнопку
  const scrollBtn = document.createElement('div');
  scrollBtn.id = 'scrollTopBtn';
  scrollBtn.textContent = '⬆';
  document.body.appendChild(scrollBtn);

  // клик всегда вешаем заново (на актуальную кнопку)
  scrollBtn.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ один глобальный обработчик скролла, который НЕ зависит от старого scrollBtn
  if (!window.__history_scroll_bound) {
    window.__history_scroll_bound = true;

    window.__history_scroll_handler = () => {
      const btn = document.getElementById('scrollTopBtn');
      if (!btn) return;

      if (window.scrollY > 300) btn.classList.add('show');
      else btn.classList.remove('show');
    };

    window.addEventListener('scroll', window.__history_scroll_handler, { passive: true });
  }

  // сразу обновим видимость после захода
  window.__history_scroll_handler?.();

  // подключаем лайтбокс к фоткам стенографии + подписи
  const imgs = Array.from(document.querySelectorAll('.strawberry-grid img'));

  const sources = imgs.map((x) => x.src);
  const captions = imgs.map((x) => x.alt || '🍓 Strawberry');

  imgs.forEach((img, i) => {
    img.addEventListener('click', () => {
      StrawberryLightbox.open({ sources, captions }, i);
    });
  });

  // кнопка "Продолжить"
  document.getElementById('toUsername').onclick = () => {
    const from2 = getStorage(HISTORY_FROM_KEY, '', sessionStorage) || '';
    if (from2 === 'account-easter-eggs') {
      sessionStorage.removeItem(HISTORY_FROM_KEY);
      CybRouter.navigate('account-easter-eggs');
    } else {
      CybRouter.navigate('username');
    }
  };
}

function escapeHtml(s) {
  return (s || '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );
}

// -------------- Helper Query --------------

function getQuery() {
  try {
    const u = new URL(window.location.href);
    return u.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function attachPasswordHints(inputEl, containerEl, opts = {}) {
  if (!inputEl || !containerEl) return;

  const settings = {
    minLen: opts.minLen ?? 8,
    requireUpper: !!opts.requireUpper,
    requireLower: !!opts.requireLower,
  };

  // HTML подсказок
  containerEl.innerHTML = `
    <div class="pass-hints">
      <div class="pass-hints__title">Пароль должен содержать как минимум:</div>
      <ul class="pass-hints__list">
        <li data-rule="minLen"><span class="icon" aria-hidden="true"></span> ${
          settings.minLen
        } символов</li>
        ${
          settings.requireUpper
            ? `<li data-rule="hasUpper"><span class="icon" aria-hidden="true"></span> 1 заглавную букву (A-Z)</li>`
            : ''
        }
        ${
          settings.requireLower
            ? `<li data-rule="hasLower"><span class="icon" aria-hidden="true"></span> 1 строчную букву (a-z)</li>`
            : ''
        }
        <li data-rule="hasDigit"><span class="icon" aria-hidden="true"></span> 1 число</li>
        <li data-rule="hasSpecial"><span class="icon" aria-hidden="true"></span> 1 спецсимвол (например, $ ! @ % &)</li>
        <li data-rule="noEdgeSpaces"><span class="icon" aria-hidden="true"></span> Без пробелов в начале и конце</li>
        <li data-rule="asciiOnly"><span class="icon" aria-hidden="true"></span>Только латиница (без рус/укр)</li>
      </ul>
    </div>
  `;

  const rules = {
    minLen: (v) => v.length >= settings.minLen,
    hasDigit: (v) => /\d/.test(v),

    // ✅ спецсимволы: проверяем по конкретному набору, а не "всё кроме латиницы"
    hasSpecial: (v) => /[!@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]/.test(v),

    noEdgeSpaces: (v) => v === v.trim(),

    // ✅ запрет любых не-ASCII символов (кириллица, эмодзи и т.д.)
    asciiOnly: (v) => /^[\x20-\x7E]*$/.test(v),

    hasUpper: (v) => /[A-Z]/.test(v),
    hasLower: (v) => /[a-z]/.test(v),
  };

  function update() {
    const v = String(inputEl.value || '');
    containerEl.querySelectorAll('[data-rule]').forEach((li) => {
      const key = li.getAttribute('data-rule');
      const ok = rules[key] ? rules[key](v) : false;
      li.classList.toggle('ok', ok);
    });
  }

  // обновлять на ввод/фокус/блюр
  const onInput = () => update();
  inputEl.addEventListener('input', onInput);
  inputEl.addEventListener('focus', onInput);
  inputEl.addEventListener('blur', onInput);

  // первичный рендер
  update();

  // чтобы не копились слушатели при смене роутов — добавляем в твой cleanup
  if (!window.__cyb_cleanup) window.__cyb_cleanup = [];
  window.__cyb_cleanup.push(() => {
    inputEl.removeEventListener('input', onInput);
    inputEl.removeEventListener('focus', onInput);
    inputEl.removeEventListener('blur', onInput);
  });
}

function initPasswordEyes(root = document) {
  root.querySelectorAll('.pass-eye').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-target');
      const input = document.getElementById(id);
      if (!input) return;

      const open = input.type === 'password';
      input.type = open ? 'text' : 'password';
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-label', open ? 'Скрыть пароль' : 'Показать пароль');
    };
  });
}

/* ============================
   🍓 Rain of strawberries
      is dedicated to Sanya
   ============================ */

(function initAlexStrawberries() {
  // --- CONFIG ---
  const LOG_URL = 'https://cyblight.org/e-log';
  const COUNT = 35;

  // ОДИН РАЗ на вкладку
  if (window.__alex_inited) return;
  window.__alex_inited = true;

  initBackground();
  ensureModal();

  let AlexUnlocked = false;

  // ---------- helpers ----------
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getRouteSafe() {
    try {
      if (window.CybRouter && typeof CybRouter.getRoute === 'function') {
        return CybRouter.getRoute();
      }
    } catch (_) {}
    const path = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    return path || 'username';
  }

  function sendWorkLog(extra = {}) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const payload = {
      type: 'alex_strawberry',
      page: window.location.href,
      timezone: tz,

      // requested extra fields:
      route: getRouteSafe(),
      ua: navigator.userAgent,
      referrer: document.referrer || null,

      ...extra,
    };

    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  // ---------- modal (injected, ONE for all pages) ----------
  function ensureModal() {
    let modal = document.getElementById('customPrompt');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'customPrompt';
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-label="CybLight Modal">
        <div class="convariant">
          <div class="circle"></div>
          <div class="emoji">🍓</div>
        </div>

        <h2 class="title"></h2>
        <p class="subtitle"></p>

        <input type="text" id="promptInput" placeholder="Ваш Nickname" autocomplete="nickname"/>

        <div class="buttons">
          <button id="confirmBtn" type="button">OK</button>
          <button id="cancelBtn" class="cancel" type="button">Отмена</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Закрытие по клику на фон
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const cancel = modal.querySelector('#cancelBtn');
        if (cancel) cancel.click();
      }
    });

    // Закрытие по Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        const cancel = modal.querySelector('#cancelBtn');
        if (cancel) cancel.click();
      }
    });

    return modal;
  }

  function customPrompt(title, subtitle) {
    return new Promise((resolve) => {
      const modal = ensureModal();

      const input = modal.querySelector('#promptInput');
      const ok = modal.querySelector('#confirmBtn');
      const cancel = modal.querySelector('#cancelBtn');
      const titleEl = modal.querySelector('.title');
      const textEl = modal.querySelector('.subtitle');
      const emojiEl = modal.querySelector('.emoji');

      // режим запроса ника
      modal.classList.remove('modal--congrats');
      modal.classList.add('modal--strawberry');
      if (emojiEl) emojiEl.textContent = '🍓';

      if (titleEl) titleEl.textContent = title || '';
      if (textEl) textEl.textContent = subtitle || '';

      // показываем input/cancel
      input.style.display = '';
      cancel.style.display = '';
      ok.textContent = 'OK';

      modal.style.display = 'flex';
      input.value = '';
      setTimeout(() => input.focus(), 0);

      // ---- Функция проверки ----
      function submit() {
        const val = input.value.trim();

        if (!val) {
          // ❌ Показываем ошибку
          input.classList.add('input-error');
          input.style.animation = 'shake .25s';

          // убираем shake, чтобы можно снова дергать
          setTimeout(() => {
            input.style.animation = '';
          }, 300);

          return; // Не закрывать!
        }

        input.classList.remove('input-error');

        cleanup();
        resolve(val);
      }

      // ---- Enter только внутри модалки ----
      function onKey(e) {
        if (modal.style.display !== 'flex') return;
        if (modal.classList.contains('modal--congrats')) return;

        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      }

      window.addEventListener('keydown', onKey, true);

      // ---- Кнопки ----
      ok.onclick = submit;

      cancel.onclick = () => {
        cleanup();
        resolve('');
      };

      // ---- Очистка ----
      function cleanup() {
        modal.style.display = 'none';
        ok.onclick = null;
        cancel.onclick = null;

        // ВАЖНО: убираем глобальный листенер
        window.removeEventListener('keydown', onKey, true);

        // возвращаем скрытые элементы к норме
        input.value = '';
        input.style.display = '';
        cancel.style.display = '';
        ok.textContent = 'OK';
      }
    });
  }

  const _1xAbe = [
    1090, 1099, 32, 1087, 1086, 1081, 1084, 1072, 1083, 32, 1077, 1105, 32, 1074, 1086, 1074, 1088,
    1077, 1084, 1103, 44, 32, 60, 98, 114, 62, 32, 1087, 1086, 1082, 1072, 32, 1086, 1085, 1072, 32,
    1085, 1077, 32, 1088, 1072, 1079, 1073, 1080, 1083, 1072, 1089, 1100, 32, 1086, 1073, 32, 1092,
    1091, 1090, 1077, 1088, 32, 1089, 1072, 1081, 1090, 1072, 46,
  ]
    .map((c) => String.fromCharCode(c))
    .join('');

  const _strPr2 = [
    1101, 1090, 1072, 32, 1082, 1083, 1091, 1073, 1085, 1080, 1095, 1082, 1072, 32, 1073, 1099,
    1083, 1072, 32, 1086, 1089, 1086, 1073, 1077, 1085, 1085, 1072, 1103,
  ]
    .map((c) => String.fromCharCode(c))
    .join('');

  const __al3x = [
    1055, 1086, 1079, 1076, 1088, 1072, 1074, 1083, 1103, 1102, 33, 32, 1042, 1099, 32, 1085, 1072,
    1096, 1083, 1080, 32, 1087, 1072, 1089, 1093, 1072, 1083, 1082, 1091, 32, 8470, 50,
  ]
    .map((c) => String.fromCharCode(c))
    .join('');

  function showCongratsModal(userName) {
    return new Promise((resolve) => {
      const modal = ensureModal();

      const input = modal.querySelector('#promptInput');
      const ok = modal.querySelector('#confirmBtn');
      const cancel = modal.querySelector('#cancelBtn');
      const titleEl = modal.querySelector('.title');
      const textEl = modal.querySelector('.subtitle');
      const emojiEl = modal.querySelector('.emoji');
      const convex = modal.querySelector('.convariant');

      // --- очищаем ВСЕ старые обработчики Enter ---
      window.removeEventListener('keydown', window.__customPromptEnter, true);
      delete window.__customPromptEnter;

      function baseCleanup() {
        modal.style.display = 'none';
        modal.classList.remove('modal--congrats', 'modal--strawberry');

        // возвращаем состояние
        if (input) {
          input.style.display = '';
          input.value = '';
        }
        if (cancel) cancel.style.display = '';
        if (ok) ok.textContent = 'OK';

        ok.onclick = null;
        cancel.onclick = null;

        emojiEl?.classList.remove('float');

        // убираем Keydown
        window.removeEventListener('keydown', onEnterCongrats, true);
      }

      let cleanup = baseCleanup;

      emojiEl.classList.add('float');

      // 3D эффект движения клубнички
      function tilt(e) {
        const rect = convex.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        const rotateX = (y / 18).toFixed(2);
        const rotateY = (-x / 18).toFixed(2);

        emojiEl.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }

      function resetTilt() {
        emojiEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
      }

      convex.addEventListener('mousemove', tilt);
      convex.addEventListener('mouseleave', resetTilt);

      // убрать обработчики при закрытии
      const oldCleanup = cleanup;
      cleanup = () => {
        convex.removeEventListener('mousemove', tilt);
        convex.removeEventListener('mouseleave', resetTilt);
        oldCleanup();
      };

      // режим поздравления
      modal.classList.add('modal--congrats', 'modal--strawberry');
      if (emojiEl) emojiEl.textContent = '🎉';

      if (titleEl) titleEl.textContent = 'Поздравляю!';
      if (textEl) {
        textEl.innerHTML = `<b>${escapeHtml(userName)}</b>,🍓 ${_strPr2} 😉<br> ${_1xAbe}`;
      }

      // скрываем input и cancel
      if (input) input.style.display = 'none';
      if (cancel) cancel.style.display = 'none';
      if (ok) ok.textContent = 'Круто!';

      modal.style.display = 'flex';

      // центр модалки
      const rect = modal.querySelector('.modal-content').getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // эффекты
      spawnStrawberryConfetti(cx, cy);
      spawnRingWave(cx, cy);
      flashModal(modal.querySelector('.modal-content'));
      pulseBackground();
      launchBigStrawberries(cx, cy);

      function onEnterCongrats(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          ok.click();
        }
      }

      window.addEventListener('keydown', onEnterCongrats, true);

      // ---- Кнопки ----
      ok.onclick = () => {
        // Анимация кнопки
        ok.classList.add('btn-okay-animate');

        // Вспышка клубнички
        if (emojiEl) {
          emojiEl.classList.add('flash');

          setTimeout(() => emojiEl.classList.remove('flash'), 350);
        }

        // Вибрация на телефонах
        if (navigator.vibrate) {
          navigator.vibrate([15, 35, 15]);
        }

        // Мини-пауза, чтобы анимация успела сыграть
        setTimeout(async () => {
          setStrawberryAccess(); // ✅ отмечаем, что пасхалка найдена локально
          console.log('🍓 Strawberry flag set in localStorage');

          // Проверяем авторизацию перед отправкой на сервер
          const isLoggedIn = await checkSession();

          if (isLoggedIn) {
            console.log('🍓 User is logged in, saving to server...');
            // Отправляем на сервер и ЖДЕМ ответа
            try {
              const strawberryRes = await apiCall('/auth/easter/strawberry', {
                method: 'POST',
                credentials: 'include',
              });

              const strawberryData = await strawberryRes.json().catch(() => ({}));
              console.log('🍓 Server response:', {
                ok: strawberryRes.ok,
                status: strawberryRes.status,
                data: strawberryData,
              });

              if (!strawberryRes.ok) {
                console.error('❌ Failed to save strawberry on server:', strawberryData);
                console.warn('⚠️ Strawberry saved locally, will sync after login');
              } else {
                console.log('✅ Strawberry saved to server successfully!');
              }
            } catch (e) {
              console.error('❌ Error saving strawberry to server:', e);
              console.warn('⚠️ Strawberry saved locally, will sync after login');
            }
          } else {
            console.log('⚠️ User not logged in, strawberry saved locally only');
            console.log('📌 Will be synced to server automatically after login');
          }

          cleanup();
          CybRouter.navigate('strawberry-history');
          resolve('ok');
        }, 300);
      };

      cancel.onclick = () => {
        cleanup();
        resolve('cancel');
      };
    });
  }

  // ---------- Logic-a ----------
  async function triggerAlex() {
    if (AlexUnlocked) return;
    if (getStorage('alex_done', '', sessionStorage) === '1') return;

    AlexUnlocked = true;

    setStorage('alex_done', '1', sessionStorage);

    let storedName = (getStorage('itemUserName') || '').trim();

    while (!storedName) {
      const input = await customPrompt(__al3x, 'Введите ваше имя пользователя:');

      if (!input) {
        // отмена -> даём шанс снова
        AlexUnlocked = false;
        sessionStorage.removeItem('alex_done');
        return;
      }

      storedName = input.trim();
      setStorage('itemUserName', storedName);
    }

    sendWorkLog({
      alex: 2,
      userName: storedName || null,
      source: 'special_strawberry_click',
    });

    await showCongratsModal(storedName);
  }

  function spawnStrawberryConfetti(x, y) {
    const COUNT = 28;

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'strawberry-confetti';
      el.textContent = '🍓';

      const angle = i * ((Math.PI * 2) / COUNT);
      let radius = 0;

      const speed = 1.2 + Math.random() * 1.1;
      const spin = 0.15 + Math.random() * 0.2;

      el.style.left = x + 'px';
      el.style.top = y + 'px';

      document.body.appendChild(el);

      let alpha = 1;

      function animate() {
        radius += speed;
        const dx = Math.cos(angle + radius * 0.03) * radius;
        const dy = Math.sin(angle + radius * 0.03) * radius * 0.75;

        alpha -= 0.008;

        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${
          radius * spin
        }deg) scale(${alpha})`;
        el.style.opacity = alpha;

        if (alpha > 0) requestAnimationFrame(animate);
        else el.remove();
      }

      requestAnimationFrame(animate);
    }
  }

  function spawnRingWave(x, y) {
    const ring = document.createElement('div');
    ring.className = 'strawberry-ring-wave';
    ring.style.left = x - 40 + 'px';
    ring.style.top = y - 40 + 'px';
    ring.style.width = '80px';
    ring.style.height = '80px';

    document.body.appendChild(ring);

    setTimeout(() => ring.remove(), 900);
  }

  function flashModal(modal) {
    modal.classList.remove('flash');
    void modal.offsetWidth; // restart animation
    modal.classList.add('flash');
  }

  function pulseBackground() {
    document.body.classList.remove('body-pulse');
    void document.body.offsetWidth;
    document.body.classList.add('body-pulse');
  }

  function launchBigStrawberries(centerX, centerY) {
    const COUNT = 4 + Math.floor(Math.random() * 2); // 4–5 крупных клубничек

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'big-strawberry';
      el.textContent = '🍓';

      document.body.appendChild(el);

      // Начальная позиция — чуть смещённая в случайную сторону
      const offsetX = Math.random() * 60 - 30;
      const offsetY = Math.random() * 30 - 15;

      let x = centerX + offsetX;
      let y = centerY + offsetY;

      // параметры slow-mo движения
      const driftX = Math.random() * 80 - 40; // горизонтальный дрейф
      const rise = 180 + Math.random() * 120; // высота подъёма
      const sway = Math.random() * 0.02 + 0.015; // синусоида
      const rotSpeed = Math.random() * 0.6 - 0.3; // вращение

      let t = 0;

      function animate() {
        t += 0.015; // скорость SLOW-MO

        // синусоидальный дрейф
        const dx = Math.sin(t * 3) * 25;
        const dy = -t * rise;

        // позиция
        el.style.left = x + dx + driftX * t + 'px';
        el.style.top = y + dy + 'px';

        // вращение + плавное уменьшение
        el.style.transform = `scale(${1 - t * 0.3}) rotate(${rotSpeed * t * 180}deg)`;

        // плавное исчезновение
        el.style.opacity = 1 - t * 0.9;

        if (t < 1.0) {
          requestAnimationFrame(animate);
        } else {
          el.remove();
        }
      }

      requestAnimationFrame(animate);
    }
  }

  // ---------- background strawberries ----------
  function initBackground() {
    // если уже есть фон — не дублируем
    if (document.querySelector('.bg-strawberries')) return;

    const bg = document.createElement('div');
    bg.className = 'bg-strawberries';
    document.body.appendChild(bg);

    // выбранная особая клубника
    const specialIndex = rand(0, COUNT - 1);

    function createStrawberry(i) {
      const el = document.createElement('div');
      el.className = 'strawberry' + (i === specialIndex ? ' special' : '');
      el.textContent = '🍓';

      const size = rand(16, 44);
      const left = rand(0, 100);
      const duration = rand(6, 14);
      const delay = rand(-12, 0);
      const drift = rand(-120, 120) + 'px';
      const rot = rand(-360, 360) + 'deg';

      el.style.left = left + 'vw';
      el.style.fontSize = size + 'px';
      el.style.setProperty('--drift', drift);
      el.style.setProperty('--rot', rot);
      el.style.animation = `fallStrawberry ${duration}s linear ${delay}s infinite`;

      // На всякий: делаем клубнику "кликабельной" по поверхности
      el.style.pointerEvents = 'auto';
      el.style.userSelect = 'none';

      if (i === specialIndex) {
        el.title = '🤫';
        el.style.cursor = 'pointer';

        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerAlex();
        });
      }

      el.addEventListener('animationiteration', () => {
        el.style.left = rand(0, 100) + 'vw';
        el.style.setProperty('--drift', rand(-120, 120) + 'px');
        el.style.setProperty('--rot', rand(-360, 360) + 'deg');
      });

      return el;
    }

    for (let i = 0; i < COUNT; i++) bg.appendChild(createStrawberry(i));
  }

  // Включаем фон сразу + работает на всех роуттах
  initBackground();
})();
