/**
 * Shell component - wrapper для страниц аутентификации
 */

import { buildAuthFooter, initFooterLangSwitcher } from '@/ui/auth-footer';

export function shell(contentHtml: string): string {
  return `
    <div class="auth-shell">
      <main id="main-content" class="auth-center" tabindex="-1">
        <div class="auth-content-wrap">
          ${contentHtml}
        </div>
      </main>

      ${buildAuthFooter()}
    </div>
  `;
}

/**
 * Получить app контейнер
 */
export function getAppContainer(): HTMLElement {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('App container not found');
  }
  return app;
}

/**
 * Установить HTML контент в app контейнер
 */
export function setAppContent(html: string): void {
  const app = getAppContainer();
  app.innerHTML = html;
  initFooterLangSwitcher();
}
