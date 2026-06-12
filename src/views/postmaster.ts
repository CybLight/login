/**
 * Postmaster easter egg — hidden link in password recovery email footer.
 */

import { Router } from '@/router/Router';
import { apiCall, getStorage, setStorage } from '@/utils';
import { POSTMASTER_KEY } from '@/config/constants';
import { t } from '@/i18n';
import { setAppContent, shell } from '@/ui';

export function hasPostmasterAccess(): boolean {
  return getStorage(POSTMASTER_KEY) === '1';
}

export function setPostmasterAccess(): void {
  setStorage(POSTMASTER_KEY, '1');
}

function showPostmasterModal(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'postmaster-overlay';
    overlay.innerHTML = `
      <div class="postmaster-modal" role="dialog" aria-modal="true" aria-labelledby="postmasterTitle">
        <div class="postmaster-modal__glow" aria-hidden="true"></div>
        <div class="postmaster-modal__icon" aria-hidden="true">📬</div>
        <h2 id="postmasterTitle" class="postmaster-modal__title">${t('Postmaster')}</h2>
        <p class="postmaster-modal__text">
          ${t('Ты заглянул в самый низ письма — туда, куда почти никто не смотрит.')}
          <br><br>
          ${t('Редкий секрет из почтового ящика добавлен в коллекцию пасхалок.')}
        </p>
        <button type="button" class="postmaster-modal__btn" id="postmasterClose">
          ${t('Принято ✦')}
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    const close = () => {
      overlay.classList.remove('is-visible');
      overlay.addEventListener(
        'transitionend',
        () => {
          overlay.remove();
          resolve();
        },
        { once: true }
      );
      setTimeout(() => {
        if (overlay.isConnected) {
          overlay.remove();
          resolve();
        }
      }, 320);
    };

    overlay.querySelector('#postmasterClose')?.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
  });
}

async function savePostmasterToServer(): Promise<boolean> {
  try {
    const response = await apiCall('/auth/easter/postmaster', {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch (error) {
    console.warn('[POSTMASTER] Server save error:', error);
    return false;
  }
}

export async function unlockPostmasterEaster(): Promise<boolean> {
  if (hasPostmasterAccess()) {
    return true;
  }

  const saved = await savePostmasterToServer();
  if (!saved) {
    return false;
  }

  setPostmasterAccess();
  await showPostmasterModal();
  return true;
}

export async function renderPostmaster(): Promise<void> {
  setAppContent(
    shell(`
      <section class="auth-card">
        <div class="loading-spinner loading-spinner--centered">
          <div class="spinner loading-spinner__icon"></div>
          <p class="loading-spinner__text">${t('Проверяем секрет...')}</p>
        </div>
      </section>
    `)
  );

  const ok = await unlockPostmasterEaster();

  if (!ok) {
    setAppContent(
      shell(`
        <section class="auth-card">
          <div class="auth-head">
            <div class="brand-logo">
              <img src="/assets/img/logo.svg" alt="CybLight" />
            </div>
            <div class="auth-title">
              <h1>${t('Postmaster')}</h1>
            </div>
          </div>
          <p>${t('Войди в аккаунт, чтобы сохранить эту пасхалку.')}</p>
          <button type="button" class="btn btn-primary" id="postmasterLoginBtn">${t('Войти')}</button>
        </section>
      `)
    );
    document.getElementById('postmasterLoginBtn')?.addEventListener('click', () => {
      Router.navigate('password');
    });
    return;
  }

  Router.navigate('account-easter-eggs');
}
