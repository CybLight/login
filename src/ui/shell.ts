/**
 * Shell component - wrapper для страниц аутентификации
 */

import { getLocale, getLocaleLabel, localePath, sitePath, stripLocalePrefix, t, type Locale } from '@/i18n';

export function shell(contentHtml: string): string {
  const locale = getLocale();
  const homeUrl = sitePath('', locale);
  const privacyUrl = `${sitePath('privacy', locale)}`;
  const langHref = (code: Locale) => localePath(stripLocalePrefix().path || 'username', code);

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
            <a class="footer-brand" href="${homeUrl}" aria-label="${t('Главная страница')}" target="_blank" rel="noopener">
            <img src="/assets/img/logo.svg" class="footer-logo" alt="CybLight" /><span>CybLight.org</span></a>

            <div class="footer-lang-wrap">
              <button type="button" class="footer-lang-btn" aria-haspopup="listbox" aria-expanded="false">
                ${getLocaleLabel(locale)}
              </button>
              <ul class="footer-lang-menu" role="listbox" hidden>
                <li><a href="${langHref('ru')}" data-locale-link="ru" hreflang="ru">Русский</a></li>
                <li><a href="${langHref('uk')}" data-locale-link="uk" hreflang="uk">Українська</a></li>
                <li><a href="${langHref('en')}" data-locale-link="en" hreflang="en">English</a></li>
              </ul>
            </div>

            <a class="report-btn" href="#" data-report-modal-open>
              <img src="/assets/img/report.svg" alt="Report" class="report-icon" />
              ${t('Сообщить о проблеме')}
            </a>

            <a href="#" data-noop>${t('Условия использования')}</a>
            <a href="${privacyUrl}" target="_blank" rel="noopener">${t('Политика конфиденциальности')}</a>
            <a href="#" data-noop>${t('Настройки конфиденциальности')}</a>
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
  initFooterLangSwitcher();
}

let footerLangSwitcherBound = false;

function positionFooterLangMenu(btn: HTMLButtonElement, menu: HTMLUListElement): void {
  const gap = 6;
  const rect = btn.getBoundingClientRect();
  let top = rect.top - menu.offsetHeight - gap;
  let left = rect.right - menu.offsetWidth;

  if (top < gap) {
    top = rect.bottom + gap;
  }
  left = Math.max(gap, Math.min(left, window.innerWidth - menu.offsetWidth - gap));

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}

function closeFooterLangMenus(): void {
  document.querySelectorAll('.footer-lang-menu').forEach((m) => {
    m.setAttribute('hidden', '');
    (m as HTMLElement).style.top = '';
    (m as HTMLElement).style.left = '';
  });
  document.querySelectorAll('.footer-lang-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function initFooterLangSwitcher(): void {
  document.querySelectorAll('.footer-lang-wrap').forEach((wrap) => {
    const btn = wrap.querySelector('.footer-lang-btn') as HTMLButtonElement | null;
    const menu = wrap.querySelector('.footer-lang-menu') as HTMLUListElement | null;
    if (!btn || !menu || wrap.getAttribute('data-lang-init') === '1') return;
    wrap.setAttribute('data-lang-init', '1');

    menu.querySelectorAll('[data-locale-link]').forEach((link) => {
      link.addEventListener('click', () => {
        const loc = link.getAttribute('data-locale-link');
        if (loc) {
          try {
            localStorage.setItem('cyblight-lang', loc);
          } catch {
            /* ignore */
          }
        }
      });
    });

    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = menu.hasAttribute('hidden');
      closeFooterLangMenus();
      if (open) {
        menu.removeAttribute('hidden');
        positionFooterLangMenu(btn, menu);
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  if (!footerLangSwitcherBound) {
    footerLangSwitcherBound = true;
    document.addEventListener('click', closeFooterLangMenus);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeFooterLangMenus();
    });
  }
}
