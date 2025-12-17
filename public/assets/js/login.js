const app = document.getElementById("app");

function viewUsername() {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">⚡ CybLight</div>
          <h1>Вход</h1>
          <p>Шаг 1: логин</p>
        </div>

        <form id="f">
          <div class="field">
            <label>Email или логин</label>
            <input id="login" required placeholder="example@cyblight.org"/>
          </div>
          <button class="btn-primary" type="submit">Далее</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("f").addEventListener("submit", (e) => {
    e.preventDefault();
    const login = document.getElementById("login").value.trim();
    if (!login) return alert("Введите логин");
    sessionStorage.setItem("cyb_login", login);
    CybRouter.navigate("password");
  });
}

function viewPassword() {
  const login = sessionStorage.getItem("cyb_login") || "";
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">⚡ CybLight</div>
          <h1>Пароль</h1>
          <p>Шаг 2 для: <b>${escapeHtml(login)}</b></p>
        </div>

        <form id="f">
          <div class="field">
            <label>Пароль</label>
            <input id="pass" type="password" required placeholder="••••••••"/>
          </div>
          <div class="options">
            <a class="link" href="#" id="back">← Назад</a>
            <a class="link" href="#" id="reset">Забыли пароль?</a>
          </div>
          <button class="btn-primary" type="submit">Войти</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("back").onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate("username");
  };
  document.getElementById("reset").onclick = (e) => {
    e.preventDefault();
    CybRouter.navigate("reset");
  };

  document.getElementById("f").addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = document.getElementById("pass").value.trim();
    if (!pass) return alert("Введите пароль");
    alert("Успешный вход (demo)");
    CybRouter.navigate("done");
  });
}

function viewReset() {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">⚡ CybLight</div>
          <h1>Восстановление</h1>
          <p>Шаг: reset</p>
        </div>
        <button class="btn-secondary" id="back">← Назад</button>
      </div>
    </div>
  `;
  document.getElementById("back").onclick = () =>
    CybRouter.navigate("username");
}

function viewDone() {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">⚡ CybLight</div>
          <h1>Готово ✅</h1>
          <p>Вы вошли (demo)</p>
        </div>
        <button class="btn-primary" id="toUser">В /username</button>
      </div>
    </div>
  `;
  document.getElementById("toUser").onclick = () =>
    CybRouter.navigate("username");
}

window.addEventListener("cyb:route", (e) => {
  const r = e.detail.route;
  if (r === "username") return viewUsername();
  if (r === "password") return viewPassword();
  if (r === "reset") return viewReset();
  if (r === "done") return viewDone();
  // fallback
  viewUsername();
});

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
