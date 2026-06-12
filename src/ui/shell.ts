/**
 * Shell component - wrapper для страниц аутентификации
 */

import { getLocale, getLocaleLabel, localePath, sitePath, stripLocalePrefix, t, type Locale } from '@/i18n';

export function shell(contentHtml: string): string {
  const locale = getLocale();
  const homeUrl = sitePath('', locale);
  const privacyUrl = `${sitePath('privacy', locale)}`;
  const contactAdminUrl = localePath('contact-admin', locale);
  const langHref = (code: Locale) => localePath(stripLocalePrefix().path, code);

  return `
    <div class="auth-shell">
      <main id="main-content" class="auth-center" tabindex="-1">
        <div class="auth-content-wrap">
          ${contentHtml}
        </div>
      </main>

      <footer class="auth-footer">
        <div class="cyb-dev-footer-strip" aria-hidden="true"></div>
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

            <a class="hacked-btn" href="${contactAdminUrl}">
              <img src="/assets/img/account-alert.svg" alt="" class="hacked-icon" aria-hidden="true" />
              ${t('Взломали аккаунт?')}
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

function restoreFooterLangMenu(menu: HTMLUListElement): void {
  const wrapId = menu.dataset.langWrapId;
  if (!wrapId) return;
  const wrap = document.querySelector(`[data-lang-wrap-id="${wrapId}"]`);
  if (wrap) wrap.appendChild(menu);
}

function openFooterLangMenu(btn: HTMLButtonElement, menu: HTMLUListElement): void {
  if (menu.parentElement !== document.body) {
    document.body.appendChild(menu);
  }
  menu.removeAttribute('hidden');
  positionFooterLangMenu(btn, menu);
  btn.setAttribute('aria-expanded', 'true');
}

function closeFooterLangMenus(): void {
  document.querySelectorAll('.footer-lang-menu').forEach((m) => {
    const menu = m as HTMLUListElement;
    menu.setAttribute('hidden', '');
    menu.style.top = '';
    menu.style.left = '';
    restoreFooterLangMenu(menu);
  });
  document.querySelectorAll('.footer-lang-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function initFooterLangSwitcher(): void {
  document.querySelectorAll('body > .footer-lang-menu').forEach((menu) => menu.remove());

  document.querySelectorAll('.footer-lang-wrap').forEach((wrap) => {
    const btn = wrap.querySelector('.footer-lang-btn') as HTMLButtonElement | null;
    const menu = wrap.querySelector('.footer-lang-menu') as HTMLUListElement | null;
    if (!btn || !menu || wrap.getAttribute('data-lang-init') === '1') return;

    const wrapId = `footer-lang-${Math.random().toString(36).slice(2, 9)}`;
    wrap.setAttribute('data-lang-init', '1');
    wrap.setAttribute('data-lang-wrap-id', wrapId);
    menu.dataset.langWrapId = wrapId;

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

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = menu.hasAttribute('hidden');
      closeFooterLangMenus();
      if (willOpen) {
        openFooterLangMenu(btn, menu);
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
