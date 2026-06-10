/**
 * Username view - первый этап входа
 */

import { t, sitePath, getLocale } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell, showAppAlert } from '@/ui';
import { setStorage, apiCall } from '@/utils';

export function renderUsername(): void {
  document.body.classList.remove('no-strawberries');

  const homeUrl = sitePath('', getLocale());

  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
        <a href="${homeUrl}" aria-label="${t('Главная страница')}" title="${t('Открыть главную страницу')}">
          <img src="/assets/img/logo.svg" alt="CybLight" />
          </a>
        </div>
        <div class="auth-title">
          <h1>${t('Войти')}</h1>
        </div>
      </div>

      <form id="f">
        <div class="field">
          <label class="label" for="login">${t('Пользователь')}</label>
          <input class="input" id="login" autocomplete="username" required />
        </div>

        <div class="row">
          <a class="link" href="#" id="forgotUser">${t('Забыли имя пользователя?')}</a>
        </div>

        <button class="btn btn-primary" type="submit" aria-label="${t('Далее')}">${t('Далее')}</button>

        <div class="divider">${t('ИЛИ')}</div>

        <button class="btn btn-outline" type="button" id="keyLogin" aria-label="${t('Войти с помощью ключа доступа')}">
          ${t('Войти с помощью ключа доступа')}
        </button>
      </form>
    </section>

    <div class="below">
      <p class="hint">${t('Ты еще не с нами?')}</p>
      <button class="btn-create" type="button" id="createAcc" aria-label="${t('Регистрируйся!')}">${t('Регистрируйся!')}</button>
    </div>
  `)
  );

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const forgotUserLink = document.getElementById('forgotUser');
  if (forgotUserLink) {
    forgotUserLink.onclick = (e) => {
      e.preventDefault();
      setStorage('cyb_recovery_mode', 'username', sessionStorage);
      Router.navigate('reset');
    };
  }

  const keyLoginBtn = document.getElementById('keyLogin');
  if (keyLoginBtn) {
    keyLoginBtn.onclick = () => handlePasskeyLogin();
  }

  const createAccBtn = document.getElementById('createAcc');
  if (createAccBtn) {
    createAccBtn.onclick = () => {
      Router.navigate('signup');
    };
  }

  const form = document.getElementById('f') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginInput = document.getElementById('login') as HTMLInputElement;
      const login = loginInput.value.trim();
      if (!login) {
        await showAppAlert(t('Введите имя пользователя'), { tone: 'warn' });
        return;
      }
      setStorage('cyb_login', login, sessionStorage);
      Router.navigate('password');
    });
  }
}

async function handlePasskeyLogin(): Promise<void> {
  if (!window.isSecureContext) {
    await showAppAlert(
      t('❌ WebAuthn требует безопасный контекст.\n\nОткройте страницу на https:// или используйте Chrome/Edge.\n\nДля Firefox: убедитесь, что страница открыта именно как http://localhost:5173/ без прокси/iframe.'),
      { tone: 'error' }
    );
    return;
  }

  if (!window.PublicKeyCredential) {
    await showAppAlert(
      t('❌ Ваш браузер не поддерживает ключи доступа (passkeys).\n\nИспользуйте современный браузер: Chrome, Edge, Safari или Firefox.'),
      { tone: 'error' }
    );
    return;
  }

  const keyLoginBtn = document.getElementById('keyLogin') as HTMLButtonElement | null;
  if (!keyLoginBtn) return;

  const originalText = keyLoginBtn.innerHTML;
  keyLoginBtn.disabled = true;
  keyLoginBtn.innerHTML = t('🔐 Проверка...');

  try {
    const optionsRes = await apiCall('/auth/passkey/login/options', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!optionsRes.ok) {
      const err = await optionsRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || t('Не удалось получить параметры аутентификации'));
    }

    const optionsData = await optionsRes.json();
    if (!optionsData.ok || !optionsData.options || !optionsData.challengeId) {
      throw new Error(t('Некорректный ответ сервера'));
    }

    const options = optionsData.options;
    const challengeId = optionsData.challengeId;

    const challengeUint8 = b64urlToUint8(options.challenge) as Uint8Array;
    const allowCredentials = (options.allowCredentials || []).map(
      (cred: { id: string; type?: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }) => ({
        ...cred,
        id: b64urlToUint8(cred.id),
      })
    );

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: challengeUint8 as BufferSource,
      rpId: options.rpId,
      allowCredentials,
      timeout: options.timeout || 60000,
      userVerification: options.userVerification || 'preferred',
    };

    keyLoginBtn.innerHTML = t('🔑 Используйте ключ доступа...');

    const credential = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error(t('Аутентификация отменена'));
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    const credentialData = {
      id: credential.id,
      rawId: uint8ToB64url(new Uint8Array(credential.rawId)),
      response: {
        clientDataJSON: uint8ToB64url(new Uint8Array(response.clientDataJSON)),
        authenticatorData: uint8ToB64url(new Uint8Array(response.authenticatorData)),
        signature: uint8ToB64url(new Uint8Array(response.signature)),
        userHandle: response.userHandle ? uint8ToB64url(new Uint8Array(response.userHandle)) : null,
      },
      type: credential.type,
    };

    keyLoginBtn.innerHTML = t('✅ Вход...');

    const loginRes = await apiCall('/auth/passkey/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, credential: credentialData }),
    });

    const loginData = await loginRes.json().catch(() => ({}));

    if (!loginRes.ok) {
      throw new Error(loginData.error || t('Ошибка входа'));
    }

    Router.navigate('account-profile');
  } catch (err: unknown) {
    console.error('Passkey login error:', err);

    let errorMessage = t('Не удалось войти по ключу доступа');

    if (err instanceof Error && err.name === 'NotAllowedError') {
      errorMessage = t('❌ Аутентификация отменена или время ожидания истекло');
    } else if (err instanceof Error && err.name === 'InvalidStateError') {
      errorMessage = t('❌ Ключ доступа не найден на этом устройстве');
    } else if (err instanceof Error && err.message) {
      errorMessage = `${t('Ошибка: {error}', { error: err.message })}`;
    }

    await showAppAlert(errorMessage, { tone: 'error' });
  } finally {
    keyLoginBtn.disabled = false;
    keyLoginBtn.innerHTML = originalText;
  }
}

function b64urlToUint8(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ToB64url(bytes: Uint8Array): string {
  let str = '';
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
