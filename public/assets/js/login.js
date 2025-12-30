const app = document.getElementById('app');
const API_BASE = 'https://api.cyblight.org';

const EASTER_KEY = 'cyb_strawberry_unlocked';
const HISTORY_FROM_KEY = 'cyb_history_from'; // откуда открыли стенографию

function hasStrawberryAccess() {
  return localStorage.getItem(EASTER_KEY) === '1';
}
function setStrawberryAccess() {
  localStorage.setItem(EASTER_KEY, '1');
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
    : isMac
    ? 'macOS'
    : isIphone
    ? 'iOS'
    : isIpad
    ? 'iPadOS'
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
};

window.onTurnstileError = () => {
  turnstileToken = '';
};

function initTurnstile() {
  const el = document.querySelector('.cf-turnstile');
  if (!el) return;

  // ждём, пока скрипт Turnstile загрузится
  if (!window.turnstile) {
    setTimeout(initTurnstile, 150);
    return;
  }

  // если уже был виджет — убираем
  if (turnstileWidgetId !== null) {
    try {
      turnstile.remove(turnstileWidgetId);
    } catch {}
    turnstileWidgetId = null;
  }

  // чистим контейнер (убирает следы прошлого iframe)
  el.innerHTML = '';

  turnstileWidgetId = turnstile.render(el, {
    sitekey: '0x4AAAAAACIMk1fcGPcs3NLf',
    theme: 'dark',
    callback: window.onTurnstileOk,
    'expired-callback': window.onTurnstileExpired,
    'error-callback': window.onTurnstileError,
  });

  turnstileToken = '';
}

async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include', // ✅ обязательно
    });
    const data = await res.json().catch(() => null);
    return !!(res.ok && data?.ok);
  } catch {
    return false;
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
  let baseTx = 0,
    baseTy = 0;
  let tx = 0,
    ty = 0;

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
      tx = 0;
      ty = 0;
      baseTx = 0;
      baseTy = 0;
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
      pinchStartScale = scale;
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchActive = true;

      // если уже зумнули — начинаем pan
      if (scale > 1.01) {
        isPanning = true;
        panStartX = t.clientX;
        panStartY = t.clientY;
        panStartTx = tx;
        panStartTy = ty;
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

    if (isPanning && e.touches.length === 1 && scale > 1.01) {
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
    panStartTx = tx;
    panStartTy = ty;

    const onMove = (ev) => {
      if (!isPanning) return;
      tx = panStartTx + (ev.clientX - panStartX);
      ty = panStartTy + (ev.clientY - panStartY);
      applyTransform();
    };

    const onUp = () => {
      isPanning = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return { open };
})();

// Функция рендера по маршруту
function renderRoute(r) {
  // account pages
  if (r === 'account-profile') return viewAccount('profile');
  if (r === 'account-security') return viewAccount('security');
  if (r === 'account-sessions') return viewAccount('sessions');
  if (r === 'account-easter-eggs') return viewAccount('easter');

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

// Начальный рендер

(async function boot() {
  const r = window.CybRouter?.getRoute?.() || 'username';

  // если пользователь уже вошёл — сразу в учётку
  const ok = await checkSession();

  // ✅ какие роуты разрешены при активной сессии
  const allowedWhenLoggedIn = new Set([
    'strawberry-history', // ✅ разрешаем стенографию
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
            <a href="#" onclick="return false;">Условия использования</a>
            <a href="https://cyblight.org/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a>
            <a href="#" onclick="return false;">Настройки конфиденциальности</a>
          </div>
        </div>
      </footer>
    </div>
  `;
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
    sessionStorage.setItem('cyb_login', login);
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
          <label class="label" for="pass">Пароль</label>
          <input class="input" id="pass" type="password" autocomplete="new-password" required />
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
    const pass = document.getElementById('pass').value.trim();

    if (!login) return alert('🚫 Введите логин');
    if (!/^[A-Za-z0-9_]{3,24}$/.test(login)) {
      alert('Логин: только латиница (A–Z), цифры (0–9) и "_" . Длина 3–24.');
      return;
    }
    if (!pass) return alert('🚫 Введите пароль');
    if (!turnstileToken) {
      alert('🛡️ Подтверди, что ты не робот');
      return;
    }

    console.log('API_BASE=', API_BASE);
    console.log('REGISTER URL=', `${API_BASE}/auth/register`);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login,
          password: pass,
          turnstileToken,
        }),
      });

      const data = await res.json().catch(() => ({}));

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
      sessionStorage.setItem('cyb_login', login);

      setTimeout(() => {
        CybRouter.navigate('account-profile');
      }, 900);
      return;
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
  const login = sessionStorage.getItem('cyb_login') || '';
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
          <input class="input" id="pass" type="password" autocomplete="current-password" required />
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

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  document.getElementById('back').onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate('username');
  };
  document.getElementById('forgotPass').onclick = (e) => {
    e.preventDefault();
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
    clearMsg();

    const pass = document.getElementById('pass').value.trim();
    if (!pass) {
      showMsg('error', 'Введите пароль.');
      shake(passEl);
      return;
    }

    if (!turnstileToken) {
      showMsg('warn', 'Подтверди, что ты не робот (Turnstile).');
      return;
    }

    const login = sessionStorage.getItem('cyb_login');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password: pass,
          turnstileToken,
        }),
      });

      const data = await res.json().catch(() => ({}));

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
      if (!okSession) {
        showMsg(
          'warn',
          'Вход успешный, но сессия не сохранилась (cookie). Проверь CORS/credentials.'
        );
        return;
      }

      CybRouter.navigate('account-profile'); // ✅ или куда тебе надо
    } catch (err) {
      if (window.turnstile && turnstileWidgetId !== null) {
        turnstile.reset(turnstileWidgetId);
      }
      turnstileToken = '';

      showMsg('error', 'Ошибка сети. Проверь интернет и попробуй ещё раз.');
    }
  });
}

function viewReset() {
  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Восстановление</h1>
  
        </div>
      </div>

      <p style="margin:0;color:var(--muted);font-size:13px;line-height:1.5;">
        Это демо-страница. Позже добавим восстановление по email/Telegram.
      </p>

      <button class="btn btn-outline" style="margin-top:16px;" id="back">← Назад</button>
    </section>
  `);
  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  document.getElementById('back').onclick = () => CybRouter.navigate('username');
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
    await fetch(`${API_BASE}/auth/logout`, {
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

function fmtTs(ms) {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
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
  const res = await fetch(`${API_BASE}/auth/me`, { method: 'GET', credentials: 'include' });
  const data = await res.json().catch(() => null);
  return { res, data };
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
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
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
    const login = me?.user?.login || sessionStorage.getItem('cyb_login') || 'Пользователь';
    const acc = document.getElementById('accLogin');
    if (acc) acc.textContent = login;

    if (tab === 'sessions') {
      const body = document.getElementById('accBody');
      body.innerHTML = `<div style="opacity:.75">Загружаю список устройств…</div>`;

      try {
        const r = await fetch(`${API_BASE}/auth/sessions`, { credentials: 'include' });
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
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const current = data.current;

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
          const r = await fetch(`${API_BASE}/auth/sessions/revoke`, {
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
          const r = await fetch(`${API_BASE}/auth/logout_others`, {
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

  if (tab === 'profile') {
    return `
      <div class="kv">
        <div class="k">Логин</div>
        <div class="v"><b>${escapeHtml(u.login || '—')}</b></div>

        ${renderIdRow('ID пользователя', u.id, 'userId')}

        <div class="k">Дата регистрации</div>
        <div class="v">${escapeHtml(fmtTs(u.createdAt))}</div>
      </div>
    `;
  }

  if (tab === 'security') {
    return `
      <div style="display:grid;gap:10px;">
        <div style="opacity:.85;line-height:1.5;">
          Тут будут настройки безопасности (смена пароля, 2FA, ключи доступа).
        </div>
        <div style="padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(0,0,0,.12);">
          <div style="font-weight:800;">Рекомендации</div>
          <ul style="margin:8px 0 0 18px;opacity:.85;">
            <li>Длинный пароль (12+ символов)</li>
            <li>Не использовать один пароль везде</li>
            <li>Следить за активными сессиями</li>
          </ul>
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

function bindTabActions(tab, me, api) {
  // Copy buttons
  document.querySelectorAll('[data-copybtn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const v = btn.getAttribute('data-copybtn');
      const ok = await copyText(v);
      if (ok) api.showMsg('ok', 'Скопировано ✅');
      else api.showMsg('error', 'Не удалось скопировать');
      setTimeout(api.clearMsg, 900);
    });
  });

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
          const res = await fetch(`${API_BASE}/auth/logout_others`, {
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
        sessionStorage.setItem(HISTORY_FROM_KEY, 'account-easter-eggs'); // ✅ пришли из пасхалок
        CybRouter.navigate('strawberry-history');
      };
  }
}

function viewStrawberryHistory() {
  // ✅ сначала проверяем доступ
  if (!hasStrawberryAccess()) {
    CybRouter.navigate('account-easter-eggs'); // или 'username'
    return;
  }

  const from = sessionStorage.getItem(HISTORY_FROM_KEY) || '';
  const login = sessionStorage.getItem('cyb_login') || 'Гость';

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

  // Логика появления кнопки "вверх"
  const scrollBtn = document.createElement('div');
  scrollBtn.id = 'scrollTopBtn';
  scrollBtn.textContent = '⬆';
  document.body.appendChild(scrollBtn);

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
    const from2 = sessionStorage.getItem(HISTORY_FROM_KEY) || '';
    if (from2 === 'account-easter-eggs') {
      sessionStorage.removeItem(HISTORY_FROM_KEY);
      CybRouter.navigate('account-easter-eggs');
    } else {
      CybRouter.navigate('username');
    }
  };

  function checkScroll() {
    if (window.scrollY > 300) {
      scrollBtn.classList.add('show');
    } else {
      scrollBtn.classList.remove('show');
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();

  // При нажатии — плавный скролл вверх
  scrollBtn.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      }[c])
  );
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
      window.onkeydown = null;
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
          fetch(`${API_BASE}/auth/easter/strawberry`, {
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
    if (sessionStorage.getItem('alex_done') === '1') return;

    AlexUnlocked = true;
    sessionStorage.setItem('alex_done', '1');

    let storedName = (localStorage.getItem('itemUserName') || '').trim();

    while (!storedName) {
      const input = await customPrompt(__al3x, 'Введите ваше имя пользователя:');

      if (!input) {
        // отмена -> даём шанс снова
        AlexUnlocked = false;
        sessionStorage.removeItem('alex_done');
        return;
      }

      storedName = input.trim();
      localStorage.setItem('itemUserName', storedName);
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
