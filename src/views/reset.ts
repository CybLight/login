/**
 * Reset password view - восстановление пароля
 */

import { t } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import { getStorage, apiCall } from '@/utils';

export async function renderReset(): Promise<void> {
  // Убираем no-strawberries класс
  document.body.classList.remove('no-strawberries');

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const forcedMode = getStorage('cyb_recovery_mode', '', sessionStorage) || 'password';

  // Если есть token - показываем форму установки нового пароля
  if (token) {
    renderPasswordResetForm(token);
    return;
  }

  // Иначе показываем форму запроса восстановления
  renderRecoveryRequestForm(forcedMode);
}

/**
 * Форма установки нового пароля (когда пришли по ссылке)
 */
function renderPasswordResetForm(token: string): void {
  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Новый пароль')}</h1>
        </div>
      </div>

      <form id="fReset">
        <div class="field">
          <label class="label" for="p1">${t('Новый пароль')}</label>
          <input class="input" id="p1" type="password" autocomplete="new-password" required />
        </div>

        <div class="field">
          <label class="label" for="p2">${t('Повтори пароль')}</label>
          <input class="input" id="p2" type="password" autocomplete="new-password" required />
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <div class="row" style="margin-top:10px;">
          <a class="link" href="#" id="back">${t('← Назад')}</a>
        </div>

        <button class="btn btn-primary" type="submit" aria-label="${t('Сохранить пароль')}">${t('Сохранить пароль')}</button>
      </form>
    </section>
  `)
  );

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.onclick = (e) => {
      e.preventDefault();
      history.replaceState(null, '', '/reset');
      sessionStorage.removeItem('cyb_recovery_mode');
      Router.navigate('username');
    };
  }

  const msgEl = document.getElementById('msg');
  const showMsg = (type: string, text: string) => {
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

  const form = document.getElementById('fReset') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg();

      const p1 = (document.getElementById('p1') as HTMLInputElement)?.value || '';
      const p2 = (document.getElementById('p2') as HTMLInputElement)?.value || '';

      if (!p1 || !p2) {
        showMsg('error', t('Заполните оба поля'));
        return;
      }
      if (p1 !== p2) {
        showMsg('error', t('Пароли не совпадают'));
        return;
      }

      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = t('Сохраняю...');

      try {
        const res = await apiCall('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password: p1 }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showMsg('error', data?.error || t('Ошибка смены пароля'));
          btn.disabled = false;
          btn.textContent = t('Сохранить пароль');
          return;
        }

        showMsg('ok', t('Пароль успешно изменён! Переход к входу...'));
        setTimeout(() => {
          Router.navigate('username');
        }, 2000);
      } catch (err) {
        console.error('[RESET] Error:', err);
        showMsg('error', t('Ошибка сети. Попробуйте ещё раз.'));
        btn.disabled = false;
        btn.textContent = t('Сохранить пароль');
      }
    });
  }
}

/**
 * Форма запроса восстановления
 */
function renderRecoveryRequestForm(mode: string): void {
  const isUsername = mode === 'username';

  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${isUsername ? t('Восстановление логина') : t('Восстановление пароля')}</h1>
        </div>
      </div>

      <p style="margin:0 0 16px;color:var(--muted);font-size:13px;">
        ${isUsername ? t('Введите email, указанный при регистрации. Мы отправим вам логин.') : t('Введите email для получения ссылки на сброс пароля.')}
      </p>

      <form id="fRecover">
        <div class="field">
          <label class="label" for="email">Email</label>
          <input class="input" id="email" type="email" autocomplete="email" required />
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <div class="row" style="margin-top:10px;">
          <a class="link" href="#" id="back">${t('← Назад')}</a>
        </div>

        <button class="btn btn-primary" type="submit" aria-label="${t('Отправить')}">${t('Отправить')}</button>
      </form>
    </section>
  `)
  );

  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.onclick = (e) => {
      e.preventDefault();
      sessionStorage.removeItem('cyb_recovery_mode');
      Router.navigate('username');
    };
  }

  const msgEl = document.getElementById('msg');
  const showMsg = (type: string, text: string) => {
    if (!msgEl) return;
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  };

  const form = document.getElementById('fRecover') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById('email') as HTMLInputElement;
      const email = emailInput.value.trim();

      if (!email) {
        showMsg('error', t('Введите email'));
        return;
      }

      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = t('Отправляю...');

      try {
        const endpoint = isUsername ? '/auth/recover-username' : '/auth/request-password-reset';
        const res = await apiCall(endpoint, {
          method: 'POST',
          body: JSON.stringify({ email }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          showMsg('ok', data?.message || t('Письмо отправлено! Проверьте свой email.'));
          emailInput.value = '';
        } else {
          showMsg('error', data?.error || t('Ошибка при отправке'));
        }
      } catch (err) {
        console.error('[RESET] Error:', err);
        showMsg('error', t('Ошибка сети. Попробуйте ещё раз.'));
      } finally {
        btn.disabled = false;
        btn.textContent = t('Отправить');
      }
    });
  }
}
