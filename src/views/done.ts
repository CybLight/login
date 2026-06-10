/**
 * Done view - страница успешного завершения действия
 */

import { t, sitePath, getLocale } from '@/i18n';
import { setAppContent, shell } from '@/ui';

export async function renderDone(): Promise<void> {
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
          <h1>${t('Готово!')}</h1>
        </div>
      </div>

      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 64px; margin-bottom: 16px;">✓</div>
        <p style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;">
          ${t('Действие выполнено успешно!')}
        </p>
        <p style="font-size: 14px; color: var(--muted);">
          ${t('Вы можете закрыть эту страницу')}
        </p>
      </div>

      <button class="btn btn-primary" id="goHome" aria-label="${t('Перейти на главную')}">
        ${t('Перейти на главную')}
      </button>
    </section>
  `)
  );

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const goHomeBtn = document.getElementById('goHome');
  if (goHomeBtn) {
    goHomeBtn.onclick = () => {
      window.location.href = sitePath('', getLocale());
    };
  }
}
