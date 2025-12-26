const app = document.getElementById('app');
const API_BASE = 'https://api.cyblight.org';

const EASTER_KEY = 'cyb_strawberry_unlocked';

function hasStrawberryAccess() {
  return localStorage.getItem(EASTER_KEY) === '1';
}
function setStrawberryAccess() {
  localStorage.setItem(EASTER_KEY, '1');
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

let tsRendered = false;

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
    callback: onTurnstileOk,
    'expired-callback': onTurnstileExpired,
    'error-callback': onTurnstileError,
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
  // 🍓 отключаем фон только на profile
  document.body.classList.toggle('no-strawberry-bg', r === 'profile');

  if (r === 'signup') return viewSignup();
  if (r === 'profile') return viewProfile();
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
renderRoute(window.CybRouter?.getRoute?.() || 'username');

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
  tsRendered = false;
  turnstileToken = '';
  initTurnstile();

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('login').value.trim();
    const pass = document.getElementById('pass').value.trim();

    if (!login) return alert('🚫 Введите логин');
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
        CybRouter.navigate('profile');
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

  tsRendered = false;
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

      CybRouter.navigate('profile'); // ✅ или куда тебе надо
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

async function viewProfile() {
  const canSee = hasStrawberryAccess();

  app.innerHTML = `
    <div class="profile-page">
      <header class="profile-topbar">
        <div class="profile-brand">
          <a href="https://cyblight.org/" target="_blank" rel="noopener" aria-label="Главная">
            <img src="/assets/img/logo.svg" alt="CybLight" />
          </a>
          <div class="profile-title">
            <h1>Профиль <span class="brand" id="pLogin">...</span></h1>
            <div class="profile-muted" id="pSub">Проверяю сессию…</div>
          </div>
        </div>

        <div class="profile-actions">
          <button class="btn btn-outline" id="toLogin" type="button">← Вход</button>
          <button class="btn btn-primary" id="logoutBtn" type="button">Выйти</button>
        </div>
      </header>

      <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

      <main class="profile-grid">
        <section class="profile-card">
          <h3 style="margin:0 0 10px 0;">Данные аккаунта</h3>
          <div id="profileBody" class="profile-muted">Загружаю данные…</div>
        </section>

        <aside class="profile-card">
          <h3 style="margin:0 0 10px 0;">Действия</h3>

          <div class="profile-actions" style="margin-bottom:10px;">
            ${
              canSee
                ? `<button class="btn btn-outline" id="toHistory" type="button">🍓 Стенография</button>`
                : `<button class="btn btn-outline" type="button" disabled style="opacity:.55;cursor:not-allowed;">🔒 Стенография</button>`
            }
            <button class="btn btn-outline" id="logoutOthersBtn" type="button">Выйти из других</button>
          </div>

          ${
            canSee
              ? ''
              : `<div class="profile-muted" style="opacity:.9;">
                  Стенография откроется, если найдёшь пасхалку 🍓
                </div>`
          }

          <div style="height:1px;background:rgba(255,255,255,.08);margin:12px 0;"></div>
        </aside>
      </main>
    </div>
  `;

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  // ---- красивое сообщение ----
  const msgEl = document.getElementById('msg');
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

  // ---- кнопки ----
  const toLogin = document.getElementById('toLogin');
  if (toLogin) toLogin.onclick = () => CybRouter.navigate('username');

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      clearMsg();
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      } catch {}
      CybRouter.navigate('username');
    };
  }

  if (canSee) {
    const toHistory = document.getElementById('toHistory');
    if (toHistory) toHistory.onclick = () => CybRouter.navigate('strawberry-history');
  }

  const logoutOthersBtn = document.getElementById('logoutOthersBtn');

  // ---- грузим /auth/me ----
  let me = null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { method: 'GET', credentials: 'include' });
    me = await res.json().catch(() => null);

    if (!res.ok || !me?.ok) {
      CybRouter.navigate('username');
      return;
    }
  } catch (e) {
    console.error('Profile /auth/me failed:', e);
    CybRouter.navigate('username');
    return;
  }

  // ---- рисуем данные (и НЕ даём “Загружаю…” висеть) ----
  const pLogin = document.getElementById('pLogin');
  const pSub = document.getElementById('pSub');
  const body = document.getElementById('profileBody');

  const login = me?.user?.login || sessionStorage.getItem('cyb_login') || 'Пользователь';
  if (pLogin) pLogin.textContent = login;
  if (pSub) pSub.textContent = 'Сессия активна ✅';

  // миллисекунды -> дата
  function fmtTs(ms) {
    if (ms == null || ms === '') return '—';
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '—';
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  try {
    const u = me.user || {};
    const s = me.session || {};

    if (body) {
      body.innerHTML = `
        <div style="display:grid;gap:8px;">
          <div><b>Логин:</b> ${escapeHtml(login)}</div>
          ${
            u.id ? `<div><b>ID:</b> <span style="opacity:.85">${escapeHtml(u.id)}</span></div>` : ''
          }
          <div><b>Дата регистрации:</b> ${escapeHtml(fmtTs(u.createdAt))}</div>

          <div style="height:1px;background:rgba(255,255,255,.08);margin:6px 0;"></div>

          <div><b>Текущая сессия:</b> <span style="opacity:.85">${escapeHtml(
            s.id || '—'
          )}</span></div>
          <div><b>Сессия создана:</b> ${escapeHtml(fmtTs(s.createdAt))}</div>
          <div><b>Сессия истекает:</b> ${escapeHtml(fmtTs(s.expiresAt))}</div>
          <div><b>Активных сессий:</b> ${escapeHtml(String(me.sessionsCount ?? '—'))}</div>
        </div>
      `;
    }
  } catch (e) {
    console.error('Profile render error:', e);
    if (body) body.textContent = 'Ошибка отображения профиля (см. Console).';
    showMsg('error', 'Ошибка в профиле (см. Console).');
  }

  // ---- “выйти из других” ----
  if (logoutOthersBtn) {
    const cnt = Number(me.sessionsCount || 0);
    if (cnt <= 1) {
      logoutOthersBtn.disabled = true;
      logoutOthersBtn.style.opacity = '.55';
      logoutOthersBtn.style.cursor = 'not-allowed';
      logoutOthersBtn.title = 'Других сессий нет';
    } else {
      logoutOthersBtn.onclick = async () => {
        clearMsg();
        logoutOthersBtn.disabled = true;
        const oldText = logoutOthersBtn.textContent;
        logoutOthersBtn.textContent = 'Выхожу…';

        try {
          const res = await fetch(`${API_BASE}/auth/logout_others`, {
            method: 'POST',
            credentials: 'include',
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            showMsg(
              'error',
              data?.error ? `Ошибка: ${data.error}` : 'Не удалось завершить другие сессии.'
            );
          } else {
            showMsg('ok', `Готово ✅ Завершено сессий: ${data.removed ?? 0}`);
            setTimeout(() => CybRouter.navigate('profile'), 450);
          }
        } catch {
          showMsg('error', 'Ошибка сети. Попробуй ещё раз.');
        } finally {
          logoutOthersBtn.disabled = false;
          logoutOthersBtn.textContent = oldText;
        }
      };
    }
  }
}

function fmtTs(ms) {
  if (ms == null || ms === '') return '—';

  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '—';

  const d = new Date(n); // ✅ миллисекунды!
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString();
}

function viewStrawberryHistory() {
  const login = sessionStorage.getItem('cyb_login') || 'Гость';

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
        Продолжить
      </button>
    </section>
  `);

  if (!hasStrawberryAccess()) {
    CybRouter.navigate('profile'); // или 'username'
    return;
  }

  const btn = document.createElement('div');
  btn.id = 'scrollTopBtn';
  btn.textContent = '⬆';
  document.body.appendChild(btn);

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
    CybRouter.navigate('username');
  };

  // Логика появления кнопки "вверх"
  const scrollBtn = document.getElementById('scrollTopBtn');

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
