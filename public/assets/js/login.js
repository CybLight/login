const app = document.getElementById("app");

// Функция рендера по маршруту
function renderRoute(r) {
  if (r === "username") return viewUsername();
  if (r === "password") return viewPassword();
  if (r === "reset") return viewReset();
  if (r === "done") return viewDone();
  if (r === "strawberry-history") return viewStrawberryHistory();
  return viewUsername();
}

// Слушаем роут-события
window.addEventListener("cyb:route", (e) => {
  renderRoute(e.detail.route);
});

// Начальный рендер
renderRoute(window.CybRouter?.getRoute?.() || "username");

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

  document.getElementById("forgotUser").onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate("reset");
  };

  document.getElementById("keyLogin").onclick = () => {
    alert("Ключ доступа (demo). Позже подключим passkey/WebAuthn.");
  };

  document.getElementById("createAcc").onclick = () => {
    alert("Регистрация (demo). Потом сделаем отдельный маршрут /signup.");
  };

  document.getElementById("f").addEventListener("submit", (e) => {
    e.preventDefault();
    const login = document.getElementById("login").value.trim();
    if (!login) return alert("Введите имя пользователя");
    sessionStorage.setItem("cyb_login", login);
    CybRouter.navigate("password");
  });
}

function viewPassword() {
  const login = sessionStorage.getItem("cyb_login") || "";
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

        <div class="row">
          <a class="link" href="#" id="back">← Назад</a>
          <a class="link" href="#" id="forgotPass">Забыли пароль?</a>
        </div>

        <button class="btn btn-primary" type="submit">Войти</button>
      </form>
    </section>
  `);

  document.getElementById("back").onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate("username");
  };
  document.getElementById("forgotPass").onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate("reset");
  };

  document.getElementById("f").addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = document.getElementById("pass").value.trim();
    if (!pass) return alert("Введите пароль");

    // demo
    alert("Успешный вход (demo)");
    CybRouter.navigate("done");
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

  document.getElementById("back").onclick = () =>
    CybRouter.navigate("username");
}

function viewDone() {
  app.innerHTML = shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>Готово ✅</h1>
          
        </div>
      </div>

      <p style="margin:0;color:var(--muted);font-size:13px;">
        Вы вошли (demo). Далее подключим backend.
      </p>

      <button class="btn btn-primary" id="toUser" style="margin-top:16px;">
        В /username
      </button>
    </section>
  `);

  document.getElementById("toUser").onclick = () =>
    CybRouter.navigate("username");
}

function viewStrawberryHistory() {
  const login = sessionStorage.getItem("cyb_login") || "Гость";

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
        Эти клубнички что-то значат…
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

  function ensureLightbox() {
    let lb = document.querySelector(".strawberry-lightbox");
    if (lb) return lb;

    lb = document.createElement("div");
    lb.className = "strawberry-lightbox";
    lb.innerHTML = `
      <button class="strawberry-lightbox__close" type="button" aria-label="Закрыть">✕</button>
      <img class="strawberry-lightbox__img" alt="strawberry photo" />
    `;
    document.body.appendChild(lb);

    const img = lb.querySelector(".strawberry-lightbox__img");
    const closeBtn = lb.querySelector(".strawberry-lightbox__close");

    function close() {
      lb.classList.remove("is-open");
      if (img) img.src = "";
    }

    // закрытие по крестику
    closeBtn.addEventListener("click", close);

    // закрытие по клику на фон (но не на картинку)
    lb.addEventListener("click", (e) => {
      if (e.target === lb) close();
    });

    // ESC
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lb.classList.contains("is-open")) {
        close();
      }
    });

    // экспортируем close для использования
    lb.__close = close;

    return lb;
  }

  function openInLightbox(src) {
    const lb = ensureLightbox();
    const img = lb.querySelector(".strawberry-lightbox__img");
    if (img) img.src = src;
    lb.classList.add("is-open");
  }

  // Клик по фото -> открыть full screen
  document.querySelectorAll(".strawberry-grid img").forEach((img) => {
    img.addEventListener("click", () => {
      openInLightbox(img.src);
    });
  });

  document.getElementById("toUsername").onclick = () => {
    CybRouter.navigate("username");
  };
}


function escapeHtml(s) {
  return (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

/* ============================
   🍓 Rain of strawberries
      is dedicated to Sanya
   ============================ */

(function initAlexStrawberries() {
  // --- CONFIG ---
  const LOG_URL = "https://cyblight.org/e-log";
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
    return (s || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  }

  function getRouteSafe() {
    try {
      if (window.CybRouter && typeof CybRouter.getRoute === "function") {
        return CybRouter.getRoute();
      }
    } catch (_) {}
    const path = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    return path || "username";
  }

  function sendWorkLog(extra = {}) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const payload = {
      type: "alex_strawberry",
      page: window.location.href,
      timezone: tz,

      // requested extra fields:
      route: getRouteSafe(),
      ua: navigator.userAgent,
      referrer: document.referrer || null,

      ...extra,
    };

    fetch(LOG_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  // ---------- modal (injected, ONE for all pages) ----------
  function ensureModal() {
    let modal = document.getElementById("customPrompt");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "customPrompt";
    modal.className = "modal";

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
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        const cancel = modal.querySelector("#cancelBtn");
        if (cancel) cancel.click();
      }
    });

    // Закрытие по Escape
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") {
        const cancel = modal.querySelector("#cancelBtn");
        if (cancel) cancel.click();
      }
    });

    return modal;
  }

  function customPrompt(title, subtitle) {
    return new Promise((resolve) => {
      const modal = ensureModal();

      const input = modal.querySelector("#promptInput");
      const ok = modal.querySelector("#confirmBtn");
      const cancel = modal.querySelector("#cancelBtn");

      const titleEl = modal.querySelector(".title");
      const textEl = modal.querySelector(".subtitle");
      const emojiEl = modal.querySelector(".emoji");

      // режим запроса ника
      modal.classList.remove("modal--congrats");
      modal.classList.add("modal--strawberry");
      if (emojiEl) emojiEl.textContent = "🍓";

      if (titleEl) titleEl.textContent = title || "";
      if (textEl) textEl.textContent = subtitle || "";

      // показываем input/cancel
      if (input) input.style.display = "";
      if (cancel) cancel.style.display = "";
      if (ok) ok.textContent = "OK";

      modal.style.display = "flex";
      if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 0);
      }

      const cleanup = () => {
        modal.style.display = "none";
        ok.onclick = null;
        cancel.onclick = null;
      };

      ok.onclick = () => {
        const val = input ? input.value : "";
        cleanup();
        resolve((val || "").trim());
      };

      cancel.onclick = () => {
        cleanup();
        resolve("");
      };
    });
  }

  const _1xAbe = [
    1090,1099,32,1087,1086,1081,1084,1072,1083,32,1077,1105,32,1074,1086,
    1074,1088,1077,1084,1103,44,32,60,98,114,62,32,1087,1086,1082,1072,32,
    1086,1085,1072,32,1085,1077,32,1088,1072,1079,1073,1080,1083,1072,1089,1100,
    32,1086,1073,32,1092,1091,1090,1077,1088,32,1089,1072,1081,1090,1072,46
  ]
  .map(c => String.fromCharCode(c))
  .join("");

  const _strPr2 = [1101,1090,1072,32,1082,1083,1091,1073,1085,1080,
    1095,1082,1072,32,1073,1099,1083,1072,32,1086,1089,1086,1073,1077,
    1085,1085,1072,1103
  ]
  .map(c => String.fromCharCode(c))
  .join("");


  const __al3x = [
    1055,1086,1079,1076,1088,1072,1074,1083,1103,1102,33,32,1042,
    1099,32,1085,1072,1096,1083,1080,32,1087,1072,1089,1093,1072,
    1083,1082,1091,32,8470,50
  ]
  .map(c => String.fromCharCode(c))
  .join("");

  function showCongratsModal(userName) {
    return new Promise((resolve) => {
      const modal = ensureModal();

      const input = modal.querySelector("#promptInput");
      const ok = modal.querySelector("#confirmBtn");
      const cancel = modal.querySelector("#cancelBtn");

      const titleEl = modal.querySelector(".title");
      const textEl = modal.querySelector(".subtitle");
      const emojiEl = modal.querySelector(".emoji");

      // режим поздравления
      modal.classList.add("modal--congrats", "modal--strawberry");
      if (emojiEl) emojiEl.textContent = "🎉";

      if (titleEl) titleEl.textContent = "Поздравляю!";
      if (textEl) {
        textEl.innerHTML =
          `<b>${escapeHtml(userName)}</b>,🍓 ${_strPr2} 😉<br> ${_1xAbe}`;
      }

      // скрываем input и cancel
      if (input) input.style.display = "none";
      if (cancel) cancel.style.display = "none";
      if (ok) ok.textContent = "Круто!";

      modal.style.display = "flex";

      const cleanup = () => {
        modal.style.display = "none";
        modal.classList.remove("modal--congrats", "modal--strawberry");

        // возвращаем состояние
        if (input) {
          input.style.display = "";
          input.value = "";
        }
        if (cancel) cancel.style.display = "";
        if (ok) ok.textContent = "OK";

        ok.onclick = null;
        cancel.onclick = null;
      };

        ok.onclick = () => {
        cleanup();

        // Редирект на стенографию
        if (window.CybRouter && typeof CybRouter.navigate === "function") {
          CybRouter.navigate("strawberry-history");
        }

        resolve("ok");
      };

      cancel.onclick = () => {
        cleanup();
        resolve("cancel");
      };
    });
  }

  // ---------- Logic-a ----------
  async function triggerAlex() {
    if (AlexUnlocked) return;
    if (sessionStorage.getItem("alex_done") === "1") return;

    AlexUnlocked = true;
    sessionStorage.setItem("alex_done", "1");

    let storedName = (localStorage.getItem("itemUserName") || "").trim();

    while (!storedName) {
      const input = await customPrompt(__al3x, "Введите ваше имя пользователя:");

      if (!input) {
        // отмена -> даём шанс снова
        AlexUnlocked = false;
        sessionStorage.removeItem("alex_done");
        return;
      }

      storedName = input.trim();
      localStorage.setItem("itemUserName", storedName);
    }

    sendWorkLog({ 
      alex: 2, 
      userName: storedName || null, 
      source: "special_strawberry_click", 
    });

    await showCongratsModal(storedName);
  }

  // ---------- background strawberries ----------
  function initBackground() {
    // если уже есть фон — не дублируем
    if (document.querySelector(".bg-strawberries")) return;

    const bg = document.createElement("div");
    bg.className = "bg-strawberries";
    document.body.appendChild(bg);

    // выбранная особая клубника
    const specialIndex = rand(0, COUNT - 1);

    function createStrawberry(i) {
      const el = document.createElement("div");
      el.className = "strawberry" + (i === specialIndex ? " special" : "");
      el.textContent = "🍓";

      const size = rand(16, 44);
      const left = rand(0, 100);
      const duration = rand(6, 14);
      const delay = rand(-12, 0);
      const drift = rand(-120, 120) + "px";
      const rot = rand(-360, 360) + "deg";

      el.style.left = left + "vw";
      el.style.fontSize = size + "px";
      el.style.setProperty("--drift", drift);
      el.style.setProperty("--rot", rot);
      el.style.animation = `fallStrawberry ${duration}s linear ${delay}s infinite`;

      // На всякий: делаем клубнику "кликабельной" по поверхности
      el.style.pointerEvents = "auto";
      el.style.userSelect = "none";

      if (i === specialIndex) {
        el.title = "🤫";
        el.style.cursor = "pointer";

        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerAlex();
        });
      }

      el.addEventListener("animationiteration", () => {
        el.style.left = rand(0, 100) + "vw";
        el.style.setProperty("--drift", rand(-120, 120) + "px");
        el.style.setProperty("--rot", rand(-360, 360) + "deg");
      });

      return el;
    }

    for (let i = 0; i < COUNT; i++) bg.appendChild(createStrawberry(i));
  }

  // Включаем фон сразу + работает на всех роуттах
  initBackground();
})();

