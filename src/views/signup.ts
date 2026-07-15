/**
 * Signup view - регистрация нового пользователя
 */

import { t, localePath } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell, showAppAlert } from '@/ui';
import { setStorage, apiCall } from '@/utils';
import { authService, captchaService, pushLocalEasterFlagsToServer } from '@/services';
import { initPasswordEyes } from '@/components/password/password-helpers';
import { attachPasswordHints } from '@/components/password/password-hints';

export async function renderSignup(): Promise<void> {
  // Убираем no-strawberries класс
  document.body.classList.remove('no-strawberries');

  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Регистрация')}</h1>
        </div>
      </div>

      <form id="f">
        <div class="field">
          <label class="label" for="login">${t('Логин')}</label>
          <input class="input" id="login" autocomplete="username" required />
        </div>

        <div class="field">
          <label class="label" for="pass1">${t('Пароль')}</label>
          <div class="pass-wrap">
            <input class="input" id="pass1" type="password" autocomplete="new-password" required />
            <button type="button" class="pass-eye" data-target="pass1" aria-label="${t('Показать пароль')}"></button>
          </div>
        </div>

        <div class="field">
          <label class="label" for="pass2">${t('Повтори пароль')}</label>
          <div class="pass-wrap">
            <input class="input" id="pass2" type="password" autocomplete="new-password" required />
            <button type="button" class="pass-eye" data-target="pass2" aria-label="${t('Показать пароль')}"></button>
          </div>

          <div id="passHintsSignup"></div>
        </div>

        <div class="field" style="margin-top:12px;">
          <div id="cf-turnstile" class="cf-turnstile"></div>
        </div>

        <div class="field checkbox-field">
          <input class="checkbox-input" type="checkbox" id="acceptTerms" aria-required="true" />
          <label class="checkbox-label" for="acceptTerms">
            ${t('Я ознакомился и принимаю {terms} и {privacy}.', {
              terms: `<a href="${localePath('terms')}" target="_blank" rel="noopener noreferrer" class="link">${t('Условия использования')}</a>`,
              privacy: `<a href="${localePath('privacy')}" target="_blank" rel="noopener noreferrer" class="link">${t('Политику конфиденциальности')}</a>`
            })}
          </label>
        </div>

        <div class="row">
          <a class="link" href="#" id="back">${t('← Назад')}</a>
        </div>

        <button class="btn btn-primary" type="submit" aria-label="${t('Создать аккаунт')}" disabled>${t('Создать аккаунт')}</button>
      </form>
    </section>
  `)
  );

  // Инициализируем password eyes
  initPasswordEyes();

  const pass1El = document.getElementById('pass1') as HTMLInputElement;
  const pass2El = document.getElementById('pass2') as HTMLInputElement;
  const hintsEl = document.getElementById('passHintsSignup');

  // Подсказки по правилам пароля
  attachPasswordHints(pass1El, hintsEl, {
    minLen: 8,
    requireUpper: true,
    requireLower: true,
  });

  // Обработчик кнопки "Назад"
  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.onclick = (e) => {
      e.preventDefault();
      Router.navigate('username');
    };
  }

  // Инициализируем Turnstile
  await captchaService.init('cf-turnstile');

  // Обработчик формы
  const form = document.getElementById('f') as HTMLFormElement;

  // Управление кнопкой регистрации на основе чекбокса согласия
  const acceptTermsCheckbox = document.getElementById('acceptTerms') as HTMLInputElement;
  const submitBtn = form?.querySelector('button[type="submit"]') as HTMLButtonElement;
  if (acceptTermsCheckbox && submitBtn) {
    acceptTermsCheckbox.checked = false;
    submitBtn.disabled = true;

    acceptTermsCheckbox.addEventListener('change', () => {
      submitBtn.disabled = !acceptTermsCheckbox.checked;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const loginInput = document.getElementById('login') as HTMLInputElement;
      const login = loginInput.value.trim();
      const pass1 = pass1El?.value ?? '';
      const pass2 = pass2El?.value ?? '';

      // Валидация пароля
      if (
        !/[A-Z]/.test(pass1) ||
        !/[a-z]/.test(pass1) ||
        !/\d/.test(pass1) ||
        !/[^\w\s]/.test(pass1)
      ) {
        await showAppAlert(t('Пароль не соответствует требованиям.'), { tone: 'warn' });
        return;
      }

      if (!/^[\x20-\x7E]*$/.test(pass1)) {
        await showAppAlert(t('Пароль: нельзя использовать русские/украинские буквы и любые не-ASCII символы.'), {
          tone: 'warn',
        });
        pass1El?.focus();
        return;
      }

      // Валидация логина
      if (!login) {
        await showAppAlert(t('🚫 Введите логин'), { tone: 'warn' });
        return;
      }
      if (!/^[A-Za-z0-9_]{3,24}$/.test(login)) {
        await showAppAlert(t('Логин: только латиница (A–Z), цифры (0–9) и "_" . Длина 3–24.'), {
          tone: 'warn',
        });
        return;
      }

      // Проверка совпадения паролей
      if (!pass1) {
        await showAppAlert(t('🚫 Введите пароль'), { tone: 'warn' });
        return;
      }
      if (pass1 !== pass2) {
        await showAppAlert(t('🚫 Пароли не совпадают'), { tone: 'warn' });
        pass2El?.focus();
        pass2El?.select();
        return;
      }

      // Валидация принятия условий
      const acceptTerms = document.getElementById('acceptTerms') as HTMLInputElement;
      if (!acceptTerms || !acceptTerms.checked) {
        await showAppAlert(
          t('Для создания аккаунта необходимо принять Условия использования и Политику конфиденциальности.'),
          { tone: 'warn' }
        );
        acceptTerms?.focus();
        return;
      }

      // Проверка Turnstile
      if (!captchaService.token) {
        await showAppAlert(
          t('🛡️ Не удалось получить токен Turnstile.\n\nВозможные причины:\n• Открыта панель разработчика (DevTools) в Firefox\n• Включён режим приватности или блокировщик\n\nПопробуйте закрыть DevTools или использовать другой браузер.'),
          { tone: 'error' }
        );
        return;
      }

      try {
        console.log('[SIGNUP] Attempting registration for:', login);

        const res = await apiCall('/auth/register', {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            login,
            password: pass1,
            turnstileToken: captchaService.token,
            acceptedTerms: true,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.error('[SIGNUP] Registration failed!', {
            status: res.status,
            error: data?.error,
          });

          // Сброс капчи
          await captchaService.reset();

          await showAppAlert(data.error || t('Ошибка регистрации'), { tone: 'error' });
          return;
        }

        // Проверяем, что сессия установилась
        const user = await authService.checkSession();
        if (!user) {
          await showAppAlert(
            t('Регистрация прошла, но сессия не установилась (cookie заблокирована). Проверь CORS / credentials.'),
            { tone: 'error' }
          );
          return;
        }

        await pushLocalEasterFlagsToServer();

        // Показываем успех
        const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (btn) {
          btn.disabled = true;
          btn.textContent = t('✅ Регистрация успешна');
        }
        if (backLink) {
          (backLink as HTMLElement).style.pointerEvents = 'none';
        }

        // Сохраним логин
        setStorage('cyb_login', login, sessionStorage);

        // Переход в профиль
        setTimeout(() => {
          Router.navigate('account-profile');
        }, 1500);
      } catch (err) {
        console.error('[SIGNUP] Signup failed:', err);

        await captchaService.reset();

        await showAppAlert(t('Ошибка сети. Проверьте соединение и попробуйте ещё раз.'), { tone: 'error' });
      }
    });
  }
}
