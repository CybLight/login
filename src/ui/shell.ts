/**
 * Shell component - wrapper для страниц аутентификации
 */

export function shell(contentHtml: string): string {
  return `
    <div class="auth-shell">
      <main id="main-content" class="auth-center" tabindex="-1">
        <div class="auth-content-wrap">
          ${contentHtml}
        </div>
      </main>

      <footer class="auth-footer">
        <div class="footer-row">
          <div class="footer-copy">
          <p class="footer-text" dir="ltr" lang="en">
         © ${new Date().getFullYear()} CybLight
         </p>
          </div>
          <div class="footer-links">
            <a class="footer-brand" href="https://cyblight.org/" aria-label="Главная страница" target="_blank" rel="noopener">
            <img src="/assets/img/logo.svg" class="footer-logo" alt="CybLight" /><span>CybLight.org</span></a>

            <a class="report-btn" href="#" data-report-modal-open>
              <img src="/assets/img/report.svg" alt="Report" class="report-icon" />
              Сообщить о проблеме
            </a>

            <a href="#" data-noop>Условия использования</a>
            <a href="https://cyblight.org/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a>
            <a href="#" data-noop>Настройки конфиденциальности</a>
          </div>
        </div>
      </footer>
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
}
