/**
 * Account Banned view - страница блокировки аккаунта
 */

import { t } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import { escapeHtml } from '@/utils';

export function renderAccountBanned(params: Record<string, unknown> = {}): void {
  const reason = String((params as Record<string, unknown>).reason ?? t('Нарушение правил сообщества'));
  const username = String((params as Record<string, unknown>).username ?? '');

  // Убираем no-strawberries класс
  document.body.classList.remove('no-strawberries');

  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
          <img src="/assets/img/logo.svg" alt="CybLight" style="filter: grayscale(1) opacity(0.5);" />
        </div>
        <div class="auth-title">
          <h1 style="color: #ef4444;">${t('Доступ заблокирован')}</h1>
        </div>
      </div>

      <div style="padding: 20px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 32px; line-height: 1; flex-shrink: 0;">🚫</div>
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #ef4444;">${t('Ваш аккаунт заблокирован')}</div>
            <div style="font-size: 13px; line-height: 1.5; color: rgba(231, 236, 255, 0.85);">
              <strong>${t('Причина:')}</strong> ${escapeHtml(reason)}
            </div>
          </div>
        </div>
      </div>

      <div style="margin: 16px 0; padding: 14px; background: rgba(255, 255, 255, 0.04); border-radius: 6px; font-size: 13px; line-height: 1.5; color: var(--muted);">
        <p style="margin: 0 0 8px;">${t('Если вы считаете, что это ошибка, вы можете связаться с администрацией.')}</p>
        ${username ? `<p style="margin: 0;">${t('Пользователь:')} <strong>${escapeHtml(username)}</strong></p>` : ''}
      </div>

      <button class="btn btn-primary" id="contactAdminBtn" aria-label="${t('✉️ Написать администратору')}">
        ${t('✉️ Написать администратору')}
      </button>

      <div class="row" style="margin-top: 12px;">
        <a class="link" href="#" id="back">${t('← Вернуться к входу')}</a>
      </div>
    </section>
  `)
  );

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.onclick = (e: MouseEvent) => {
      e.preventDefault();
      Router.navigate('username');
    };
  }

  const contactBtn = document.getElementById('contactAdminBtn');
  if (contactBtn) {
    contactBtn.onclick = (e: MouseEvent) => {
      e.preventDefault();
      Router.navigate('contact-admin', { banContext: reason, username });
    };
  }
}
