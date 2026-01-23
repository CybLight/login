const app = document.getElementById('app');
const API_BASE = 'https://api.cyblight.org';

const EASTER_KEY = 'cyb_strawberry_unlocked';
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

function setStrawberryAccess() {
  setStorage(EASTER_KEY, '1');
}

function setNoStrawberries(on) {
  document.body.classList.toggle('no-strawberries', !!on);
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
    if (
      response.status === 401 &&
      !endpoint.includes('/auth/me') &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/register')
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

// Функция рендера по маршруту
function renderRoute(r) {
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

  // EMAIL VERIFY
  if (r === 'verify-email') return viewVerifyEmail();

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
    'strawberry-history', // ✅ разрешаем стенографию
    'verify-email',
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
    const response = await apiCall('/error/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || null,
        category: category,
        message: message,
        userAgent: navigator.userAgent,
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

  document.getElementById('keyLogin').onclick = () => {
    alert('Ключ доступа (demo). Позже подключим passkey/WebAuthn.');
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
      const res = await apiCall('/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password: pass1,
          turnstileToken,
        }),
      });

      console.log('Registration response:', { ok: res.ok, status: res.status });
      const data = await res.json().catch(() => ({}));
      console.log('Registration data:', data);
      console.log('Cookies after registration:', document.cookie);

      if (!res.ok) {
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
      const res = await apiCall('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password: pass,
          turnstileToken,
        }),
      });

      console.log('Login response:', { ok: res.ok, status: res.status });
      const data = await res.json().catch(() => ({}));
      console.log('Login data:', data);
      console.log('Cookies after login:', document.cookie);

      if (!res.ok) {
        // сброс капчи
        if (window.turnstile && turnstileWidgetId !== null) {
          turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = '';

        // красивые сообщения по коду ошибки
        const err = String(data?.error || '').toLowerCase();

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

      // успех
      showMsg('ok', 'Успешный вход! Перенаправляю…');

      const okSession = await checkSession();
      console.log('checkSession result:', okSession);

      if (!okSession) {
        showMsg(
          'warn',
          'Вход успешный, но сессия не сохранилась (cookie). Проверь CORS/credentials.'
        );
        return;
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
        !/[!@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]/.test(p1)
      ) {
        showMsg('Пароль не соответствует требованиям.');
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
  if (user.emailVerified) badges.push({ label: 'Verified', cls: 'badge--ok' });
  else badges.push({ label: 'Not verified', cls: 'badge--warn' }); // опционально

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

  const d = new Date(n);
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
            <button data-tab="profile">👤 Профиль</button>
            <button data-tab="security">🛡️ Безопасность</button>
            <button data-tab="sessions">🧩 Сессии</button>
            <button data-tab="easter">🍓 Пасхалки</button>
          </nav>

          <div style="margin-top:14px;display:grid;gap:10px;">
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
    // ✅ возвращаем “обычный” режим с клубникой
    setNoStrawberries(false);
    CybRouter.navigate('username');
  };

  // load me
  let me = null;
  try {
    const { res, data } = await fetchMe();
    if (!res.ok || !data?.ok) {
      setNoStrawberries(false);
      CybRouter.navigate('username');
      return;
    }
    me = data;

    // ✅ если сервер прислал флаг (будет после доработки API) — сохраняем локально
    if (me?.user?.easter?.strawberry) {
      setStrawberryAccess();
    }

    // header
    const login = me?.user?.login || getStorage('cyb_login', '', sessionStorage) || 'Пользователь';
    const acc = document.getElementById('accLogin');
    if (acc) acc.textContent = login;

    if (tab === 'sessions') {
      const body = document.getElementById('accBody');
      body.innerHTML = `<div style="opacity:.75">Загружаю список устройств…</div>`;

      try {
        const r = await apiCall('/auth/sessions', { credentials: 'include' });
        const d = await r.json().catch(() => null);
        if (r.ok && d?.ok) {
          body.innerHTML = renderSessionsTable(d, me);
          bindSessionsTable(d, { showMsg, clearMsg });
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
    console.log('renderSessionsTable called with:', { data, me });
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const current = data.current;
    console.log('Sessions array:', sessions);
    console.log('Current session ID:', current);

    const rows = sessions
      .map((s) => {
        const ua = parseUA(s.user_agent || '');
        const isCur = s.id === current;

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
          line1 = ua.browser || 'Browser';
          line2 = ua.version ? `${ua.browser} ${ua.version}` : '';
        }

        const loc = [s.city, s.region, countryFull(s.country)].filter(Boolean).join(', ') || '—';
        const lastLogin = s.created_at; // когда вошёл (создал сессию)
        const lastSeen = s.last_seen_at || s.created_at; // когда последний раз был активен

        return `
        <tr class="${isCur ? 'is-current' : ''}">
          <td data-label="Device">
            <div class="dev">
              <div class="dev-top">

                <span class="dev-ico" aria-hidden="true">
                ${getDeviceIconSvg(s.user_agent || '', ua)}
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

          <td data-label="OS">${escapeHtml(ua.os)}</td>
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

    console.log('Generated rows HTML length:', rows.length);
    console.log('First 500 chars of rows:', rows.substring(0, 500));

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

  // attach handlers inside tabs
  bindTabActions(tab, me, { showMsg, clearMsg });
}

function tabTitle(tab) {
  if (tab === 'profile') return 'Профиль';
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

      <div class="profile-hero__right">
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
    </section>

    <section class="card-grid">
      <article class="info-card">
        <div class="info-card__label">Логин</div>
        <div class="info-card__value">${escapeHtml(login)}</div>
        <div class="info-card__hint">Основное имя для входа</div>
      </article>

      <article class="info-card">
        <div class="info-card__label">ID пользователя</div>
        <div class="info-card__value mono">${escapeHtml(pubId)}</div>
        <div class="info-card__hint">Показывай его поддержке</div>
      </article>

      <article class="info-card">
        <div class="info-card__label">Дата регистрации</div>
        <div class="info-card__value">${escapeHtml(reg)}</div>
        <div class="info-card__hint">Создано в системе</div>
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

    return `
    <div class="sec-list">

      <!-- EMAIL item -->
      <button class="sec-item" id="secEmailItem" type="button">
        <div class="sec-left">
          <div class="sec-title">Адрес электронной почты</div>
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
          <div class="sec-title">Сменить пароль</div>
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

      <div class="sec-note">
        Тут будут настройки безопасности (2FA, ключи доступа).
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
    const canSee = hasStrawberryAccess() || !!me?.user?.easter?.strawberry;
    return `
      <div style="display:grid;gap:10px;">
        <div style="opacity:.85;line-height:1.5;">
          Пасхалки открываются, когда ты находишь секреты на сайте 🍓
        </div>

        <button class="btn btn-outline" id="toHistoryBtn" type="button"
          ${canSee ? '' : 'disabled style="opacity:.55;cursor:not-allowed;"'}>
          ${canSee ? '🍓 Открыть стенографию' : '🔒 Стенография (закрыто)'}
        </button>

        ${
          canSee
            ? ''
            : `<div style="opacity:.7;font-size:12px;">Подсказка: ищи особую клубничку 😉</div>`
        }
      </div>
    `;
  }

  return `—`;
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
        setTimeout(() => {
          setStrawberryAccess(); // ✅ отмечаем, что пасхалка найдена
          apiCall('/auth/easter/strawberry', {
            method: 'POST',
            credentials: 'include',
          }).catch(() => {});
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
