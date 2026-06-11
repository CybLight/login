/**
 * Cancel pending email change (link from old email)
 */

import { t } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import { apiCall } from '@/utils';

export async function renderCancelEmailChange(): Promise<void> {
  document.body.classList.remove('no-strawberries');

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  if (!token) {
    renderNoToken();
    return;
  }

  await performCancel(token);
}

function renderNoToken(): void {
  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Отмена смены email')}</h1>
        </div>
      </div>

      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <p style="font-size: 14px; color: var(--muted);">
          ${t('Отсутствует токен. Проверьте ссылку из письма.')}
        </p>
      </div>

      <button class="btn btn-primary" id="goBack" aria-label="${t('На главную')}">
        ${t('На главную')}
      </button>
    </section>
  `)
  );

  document.getElementById('goBack')?.addEventListener('click', () => Router.navigate('username'));
}

async function performCancel(token: string): Promise<void> {
  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Отмена смены email')}</h1>
        </div>
      </div>

      <div id="cancelContent" style="text-align: center; padding: 20px 0;">
        <div class="spinner" style="margin: 0 auto 16px;"></div>
        <p style="font-size: 14px; color: var(--muted);">${t('Отменяем смену email...')}</p>
      </div>

      <div id="cancelActions" style="display: none;"></div>
    </section>
  `)
  );

  try {
    const res = await apiCall('/auth/email/cancel-change', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    const data = await res.json().catch(() => ({}));
    const contentEl = document.getElementById('cancelContent');
    const actionsEl = document.getElementById('cancelActions');
    if (!contentEl || !actionsEl) return;

    if (res.ok) {
      contentEl.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 16px; color: #10b981;">✓</div>
        <p style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;">
          ${t('Смена email отменена')}
        </p>
        <p style="font-size: 14px; color: var(--muted);">
          ${t('Ваш текущий адрес электронной почты сохранён. Рекомендуем сменить пароль и включить 2FA.')}
        </p>
      `;
      actionsEl.innerHTML = `
        <button class="btn btn-primary" id="goLogin">${t('Перейти к входу')}</button>
        <button class="btn btn-outline" id="goContact" style="margin-top: 8px;">${t('Взломали аккаунт?')}</button>
      `;
      actionsEl.style.display = 'block';
      document.getElementById('goLogin')?.addEventListener('click', () => Router.navigate('username'));
      document.getElementById('goContact')?.addEventListener('click', () => Router.navigate('contact-admin'));
    } else {
      contentEl.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px; color: #ef4444;">✕</div>
        <p style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;">${t('Не удалось отменить')}</p>
        <p style="font-size: 14px; color: var(--muted);">${data?.error || t('Неверная или устаревшая ссылка')}</p>
      `;
      actionsEl.innerHTML = `
        <button class="btn btn-primary" id="goContact">${t('Связаться с администрацией')}</button>
        <button class="btn btn-outline" id="goBack" style="margin-top: 8px;">${t('На главную')}</button>
      `;
      actionsEl.style.display = 'block';
      document.getElementById('goContact')?.addEventListener('click', () => Router.navigate('contact-admin'));
      document.getElementById('goBack')?.addEventListener('click', () => Router.navigate('username'));
    }
  } catch {
    const contentEl = document.getElementById('cancelContent');
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <p style="font-size: 14px; color: var(--muted);">${t('Ошибка сети. Попробуйте позже.')}</p>
      `;
    }
  }
}
