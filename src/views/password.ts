/**
 * Password view - второй этап входа (ввод пароля)
 */

import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import type { EasterLoginPayload } from '@/types';
import { getStorage, setStorage, escapeHtml, apiCall } from '@/utils';
import { EASTER_KEY, DARK_TRIGGER_KEY, PROFILE_MIRROR_KEY } from '@/config/constants';
import { captchaService } from '@/services';
import { initPasswordEyes, shakeElement } from '@/components/password/password-helpers';

function extractEasterFlags(payload: EasterLoginPayload): {
  strawberry?: boolean;
  darkTrigger?: boolean;
  profileMirror?: boolean;
} {
  const easter = payload?.easter ?? payload?.user?.easter;
  const flags = Array.isArray(payload?.flags)
    ? payload.flags
    : Array.isArray(payload?.user?.flags)
      ? payload.user.flags
      : [];

  const strawberryFromEaster =
    typeof easter?.strawberry === 'boolean' ? easter.strawberry : undefined;
  const darkTriggerFromEaster =
    typeof easter?.darkTrigger === 'boolean'
      ? easter.darkTrigger
      : typeof easter?.dark_trigger === 'boolean'
        ? easter.dark_trigger
        : undefined;
  const profileMirrorFromEaster =
    typeof easter?.profileMirror === 'boolean'
      ? easter.profileMirror
      : typeof easter?.profile_mirror === 'boolean'
        ? easter.profile_mirror
        : undefined;

  const strawberryFromFlags =
    flags.includes('strawberry') ||
    flags.includes('strawberry_unlocked') ||
    flags.includes('easter_strawberry');
  const darkTriggerFromFlags =
    flags.includes('dark_trigger') ||
    flags.includes('dark_trigger_unlocked') ||
    flags.includes('easter_dark_trigger');
  const profileMirrorFromFlags =
    flags.includes('profile_mirror') ||
    flags.includes('profile_mirror_unlocked') ||
    flags.includes('easter_profile_mirror');

  return {
    strawberry: strawberryFromEaster ?? (strawberryFromFlags ? true : undefined),
    darkTrigger: darkTriggerFromEaster ?? (darkTriggerFromFlags ? true : undefined),
    profileMirror: profileMirrorFromEaster ?? (profileMirrorFromFlags ? true : undefined),
  };
}

function syncEasterFlagsToStorage(source: {
  strawberry?: boolean;
  darkTrigger?: boolean;
  profileMirror?: boolean;
}): void {
  if (source.strawberry === true) {
    localStorage.setItem(EASTER_KEY, '1');
  }

  if (source.darkTrigger === true) {
    localStorage.setItem(DARK_TRIGGER_KEY, '1');
  }

  if (source.profileMirror === true) {
    localStorage.setItem(PROFILE_MIRROR_KEY, '1');
  }
}

async function syncEasterAfterLogin(loginPayload: EasterLoginPayload): Promise<void> {
  syncEasterFlagsToStorage(extractEasterFlags(loginPayload));

  try {
    const meRes = await apiCall('/auth/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (!meRes.ok) return;

    const meData = await meRes.json().catch(() => ({}));
    syncEasterFlagsToStorage(extractEasterFlags(meData));
  } catch (syncError) {
    console.warn('[PASSWORD] Easter sync skipped:', syncError);
  }
}

export async function renderPassword(): Promise<void> {
  const login = getStorage('cyb_login', '', sessionStorage) || '';
  if (!login) {
    Router.navigate('username');
    return;
  }

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
          <h1>Войти</h1>
        </div>
      </div>
      
      <form id="f">
        <div class="field">
          <label class="label">Пользователь</label>
          <input class="input" value="${escapeHtml(login)}" disabled />
        </div>

        <div class="field">
          <label class="label" for="pass" id="pass-label">
            Пароль
            <span class="required" aria-label="обязательное поле">*</span>
          </label>
          <div class="pass-wrap">
            <input
              class="input"
              id="pass"
              type="password"
              autocomplete="current-password"
              aria-labelledby="pass-label"
              aria-describedby="pass-error"
              aria-required="true"
              required
            />
            <button type="button" class="pass-eye" data-target="pass" aria-label="Показать пароль"></button>
          </div>
        </div>

        <div class="field" style="margin-top:12px;">
          <div id="cf-turnstile" class="cf-turnstile"></div>
        </div>

        <div class="row">
          <a class="link" href="#" id="back">← Назад</a>
          <a class="link" href="#" id="forgotPass">Забыли пароль?</a>
        </div>

        <div id="msg" class="msg" role="alert" aria-live="polite" style="display:none;"></div>
        <span id="pass-error" class="sr-only" hidden></span>

        <button class="btn btn-primary" type="submit" aria-label="Войти">Войти</button>
      </form>
    </section>
  `)
  );

  // Инициализируем password eyes
  initPasswordEyes();

  // Удаляем старую кнопку scroll-to-top
  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  // Обработчики ссылок
  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.onclick = (e) => {
      e.preventDefault();
      Router.navigate('username');
    };
  }

  const forgotPassLink = document.getElementById('forgotPass');
  if (forgotPassLink) {
    forgotPassLink.onclick = (e) => {
      e.preventDefault();
      setStorage('cyb_recovery_mode', 'password', sessionStorage);
      Router.navigate('reset');
    };
  }

  // Инициализируем Turnstile
  await captchaService.init('cf-turnstile');

  // Вспомогательные функции для сообщений
  const msgEl = document.getElementById('msg');
  const passEl = document.getElementById('pass') as HTMLInputElement;

  const passErrorEl = document.getElementById('pass-error');

  function clearMsg(): void {
    if (!msgEl) return;
    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
    if (passErrorEl) {
      passErrorEl.textContent = '';
      passErrorEl.hidden = true;
    }
    passEl?.removeAttribute('aria-invalid');
  }

  function showMsg(type: string, text: string): void {
    if (!msgEl) return;
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
    if (passErrorEl && type === 'error') {
      passErrorEl.textContent = text;
      passErrorEl.hidden = false;
    }
    if (type === 'error') {
      passEl?.setAttribute('aria-invalid', 'true');
    }
  }

  // Очистка сообщения при вводе
  if (passEl) {
    passEl.addEventListener('input', clearMsg);
  }

  // Обработчик формы
  const form = document.getElementById('f') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      const oldText = btn.textContent || 'Войти';

      clearMsg();

      const pass = passEl?.value || '';
      if (!pass) {
        showMsg('error', 'Введите пароль.');
        shakeElement(passEl);
        return;
      }

      if (!captchaService.token) {
        showMsg('warn', 'Подтверди, что ты не робот (Turnstile).');
        return;
      }

      // Блокируем кнопку
      btn.disabled = true;
      btn.textContent = 'Вхожу…';

      try {
        console.log('[PASSWORD] Attempting login for:', login);

        // Проверяем наличие токена устройства
        const deviceToken = localStorage.getItem('cyb_device_token') || '';

        const res = await apiCall('/auth/login', {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            login,
            password: pass,
            turnstileToken: captchaService.token,
            deviceToken,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // Сброс капчи
          await captchaService.reset();

          // Обработка ошибок
          const err = String(data?.error || '').toLowerCase();

          if (res.status === 401 || err.includes('invalid_credentials')) {
            showMsg('error', 'Неправильный пароль или логин. Попробуй ещё раз.');
            shakeElement(passEl);
            passEl?.focus();
            passEl?.select();
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

          // Проверка на бан (только если сервер явно сообщает)
          const isBanned =
            err.includes('account_banned') ||
            err.includes('banned') ||
            data?.code === 'ACCOUNT_BANNED' ||
            data?.errorCode === 'ACCOUNT_BANNED';

          if (isBanned) {
            const banReason = data?.reason || 'Нарушение правил сообщества';
            Router.navigate('account-banned', { reason: banReason, username: login });
            return;
          }

          showMsg(
            'error',
            data?.error ? `Ошибка: ${data.error}` : 'Не удалось войти. Попробуй позже.'
          );
          return;
        }

        // Проверка требуется ли 2FA
        const loginData = data?.data || data;
        if (loginData.requires2FA && loginData.userId) {
          console.log('[PASSWORD] 2FA required for user:', loginData.userId);
          showMsg('ok', 'Требуется код двухфакторной аутентификации');
          setStorage('cyb_2fa_userId', loginData.userId, sessionStorage);
          Router.navigate('2fa-verify');
          return;
        }

        showMsg('ok', 'Успешный вход! Перенаправляю…');

        await syncEasterAfterLogin(loginData);

        // Переход в профиль
        Router.navigate('account-profile');
      } catch (err) {
        console.error('[PASSWORD] Login error:', err);
        await captchaService.reset();
        showMsg('error', 'Непредвиденная ошибка. Попробуйте обновить страницу.');
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  }
}
