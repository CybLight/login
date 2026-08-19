/**
 * Verify Email view - подтверждение email
 */

import { t } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import { apiCall } from '@/utils';
import { formatApiError } from '@/utils/apiErrors';

export async function renderVerifyEmail(): Promise<void> {
  // Убираем no-strawberries класс
  document.body.classList.remove('no-strawberries');

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  if (!token) {
    renderNoToken();
    return;
  }

  // Автоматическая верификация при загрузке
  await performVerification(token);
}

/**
 * Страница без токена
 */
function renderNoToken(): void {
  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Подтверждение email')}</h1>
        </div>
      </div>

      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <p style="font-size: 14px; color: var(--muted);">
          ${t('Отсутствует токен подтверждения. Проверьте ссылку из письма.')}
        </p>
      </div>

      <button class="btn btn-primary" id="goBack" aria-label="${t('На главную')}">
        ${t('На главную')}
      </button>
    </section>
  `)
  );

  const goBackBtn = document.getElementById('goBack');
  if (goBackBtn) {
    goBackBtn.onclick = () => Router.navigate('username');
  }
}

/**
 * Выполнение верификации
 */
async function performVerification(token: string): Promise<void> {
  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Подтверждение email')}</h1>
        </div>
      </div>

      <div id="verifyContent" style="text-align: center; padding: 20px 0;">
        <div class="spinner" style="margin: 0 auto 16px;"></div>
        <p style="font-size: 14px; color: var(--muted);">
          ${t('Проверяем email...')}
        </p>
      </div>

      <div id="verifyActions" style="display: none;"></div>
    </section>
  `)
  );

  try {
    const res = await apiCall('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    const data = await res.json().catch(() => ({}));

    const contentEl = document.getElementById('verifyContent');
    const actionsEl = document.getElementById('verifyActions');

    if (!contentEl || !actionsEl) return;

    if (res.ok) {
      const pendingMsg = data?.emailFinalized
        ? t('Новый email активирован. Все сессии завершены — войдите снова.')
        : data?.pendingVerified
          ? t('Новый email подтверждён. Смена завершится через 24 часа; до этого действует текущий адрес.')
          : t('Теперь вы можете войти в аккаунт');

      contentEl.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 16px; color: #10b981;">✓</div>
        <p style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
          ${data?.pendingVerified ? t('Новый email подтверждён') : t('Email успешно подтверждён!')}
        </p>
        <p style="font-size: 14px; color: var(--muted); line-height: 1.5;">
          ${pendingMsg}
        </p>
      `;
      actionsEl.innerHTML = `
        <button class="btn btn-primary" id="goLogin" aria-label="${t('Перейти к входу')}">${t('Перейти к входу')}</button>
      `;
      actionsEl.style.display = 'block';

      const loginBtn = document.getElementById('goLogin');
      if (loginBtn) {
        loginBtn.onclick = () => Router.navigate('username');
      }
    } else {
      const rawError = String(data?.error || '').trim().toLowerCase();

      // Пользователь уже подтвердил почту ранее и перешел по ссылке повторно
      if (rawError === 'token_used') {
        contentEl.innerHTML = `
          <div style="font-size: 54px; margin-bottom: 16px;">📧</div>
          <p style="font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
            ${t('Email уже подтверждён')}
          </p>
          <p style="font-size: 14px; color: var(--muted); line-height: 1.5;">
            ${t('Этот адрес электронной почты уже был успешно подтверждён ранее. Вы можете войти в свой аккаунт.')}
          </p>
        `;
        actionsEl.innerHTML = `
          <button class="btn btn-primary" id="goLogin" aria-label="${t('Перейти к входу')}">${t('Перейти к входу')}</button>
        `;
        actionsEl.style.display = 'block';

        const loginBtn = document.getElementById('goLogin');
        if (loginBtn) {
          loginBtn.onclick = () => Router.navigate('username');
        }
      } else if (rawError === 'token_expired') {
        contentEl.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px; color: #f59e0b;">⏳</div>
          <p style="font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
            ${t('Срок действия ссылки истёк')}
          </p>
          <p style="font-size: 14px; color: var(--muted); line-height: 1.5;">
            ${t('Срок действия этой ссылки подтверждения истёк. Пожалуйста, запросите новую ссылку в настройках аккаунта.')}
          </p>
        `;
        actionsEl.innerHTML = `
          <button class="btn btn-primary" id="goBack" aria-label="${t('На главную')}">${t('На главную')}</button>
        `;
        actionsEl.style.display = 'block';

        const backBtn = document.getElementById('goBack');
        if (backBtn) {
          backBtn.onclick = () => Router.navigate('username');
        }
      } else {
        const errorMsg = formatApiError(data?.error, t('Неверная или устаревшая ссылка'));
        contentEl.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px; color: #ef4444;">✕</div>
          <p style="font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
            ${t('Ошибка подтверждения')}
          </p>
          <p style="font-size: 14px; color: var(--muted); line-height: 1.5;">
            ${errorMsg}
          </p>
        `;
        actionsEl.innerHTML = `
          <button class="btn btn-primary" id="goBack" aria-label="${t('На главную')}">${t('На главную')}</button>
        `;
        actionsEl.style.display = 'block';

        const backBtn = document.getElementById('goBack');
        if (backBtn) {
          backBtn.onclick = () => Router.navigate('username');
        }
      }
    }
  } catch (err) {
    console.error('[VERIFY] Error:', err);

    const contentEl = document.getElementById('verifyContent');
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <p style="font-size: 14px; color: var(--muted);">
          ${t('Ошибка сети. Попробуйте позже.')}
        </p>
      `;
    }
  }
}
