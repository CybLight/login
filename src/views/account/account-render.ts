/**
 * Account page renderer - отрисовка основной страницы
 */

import { getLocale, getLocaleLabel, localePath, sitePath, t } from '@/i18n';
import { formatPublicId, getTabTitle, getUserStatus, renderTabContent } from './tabs-render';
import { getAvatarInnerHtml } from './avatar';
import { escapeHtml } from '@/utils';

/**
 * Главный рендер страницы аккаунта
 */
import type { User as AppUser } from '@/types';

function accountRouteForTab(tab: string): string {
  if (tab === 'profile') return 'account-profile';
  if (tab === 'easter') return 'account-easter-eggs';
  return `account-${tab}`;
}

export function renderAccountPage(tab: string, user: AppUser): string {
  const locale = getLocale();
  const homeUrl = sitePath('', locale);
  const privacyUrl = sitePath('privacy', locale);
  const accountRoute = accountRouteForTab(tab);
  const tabTitle = getTabTitle(tab);
  const maybe = user as unknown as Record<string, unknown>;
  const login = String(maybe.login ?? maybe.username ?? user.username ?? 'User');
  const role = user.role?.toLowerCase();
  const userStatus = getUserStatus(user as Parameters<typeof getUserStatus>[0]);
  const userPublicId = formatPublicId(maybe.publicId as string | undefined);
  const isAdminOrOwner =
    role === 'admin' ||
    role === 'owner' ||
    user.flags?.includes('admin') ||
    user.flags?.includes('owner');

  return `
    <div class="account-page">
      <!-- Toast уведомление (fixed в верхней части экрана) -->
      <div id="msg" class="msg is-hidden" aria-live="polite"></div>

      <header class="account-mobile-header" aria-label="${t('Навигация аккаунта')}">
        <div class="account-mobile-header__inner">
          <a href="${homeUrl}" class="account-mobile-header__logo" aria-label="${t('Главная страница')}">
            <img src="/assets/img/logo.svg" alt="CybLight" />
          </a>
          <div class="account-mobile-header__info">
            <div class="account-mobile-header__title">${escapeHtml(tabTitle)}</div>
            <div id="accLogin" class="account-mobile-header__login">${escapeHtml(login)}</div>
          </div>
          <div class="account-header-actions">
            <button
              type="button"
              class="account-lang-btn"
              id="accountLangBtn"
              aria-haspopup="true"
              aria-expanded="false"
              aria-label="${t('Выбор языка')}"
              title="${t('Язык')}"
            >
              <svg class="cl-language" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="currentColor" d="M3.814 16.464a.501.501 0 00.65-.278L5.54 13.5h2.923l1.074 2.686a.5.5 0 00.928-.372l-3-7.5a.52.52 0 00-.928 0l-3 7.5a.5.5 0 00.278.65zM7 9.846L8.061 12.5H5.94zM6 7.5a.5.5 0 00.224-.053l2-1a.5.5 0 10-.448-.894l-2 1A.5.5 0 006 7.5zM11.75 14.25a2.025 2.025 0 001.75 2.25 2.584 2.584 0 001.482-.431c.039.088.07.152.075.162a.5.5 0 00.887-.461 4.654 4.654 0 01-.15-.368c.176-.168.359-.348.56-.548a11.374 11.374 0 001.92-2.652A1.55 1.55 0 0119 13.5a2.082 2.082 0 01-1.607 2.012.5.5 0 00.107.988.506.506 0 00.107-.012A3.055 3.055 0 0020 13.5a2.542 2.542 0 00-1.283-2.205c.16-.364.244-.6.255-.63a.5.5 0 10-.944-.33 7.97 7.97 0 01-.225.552 5.11 5.11 0 00-2.482-.21c.04-.428.091-.845.153-1.229 1.427-.123 3.04-.44 3.124-.458a.5.5 0 00-.196-.98c-.019.003-1.43.283-2.736.418.162-.761.31-1.273.313-1.284a.5.5 0 10-.958-.288c-.016.053-.206.695-.393 1.64-.041 0-.088.004-.128.004h-2a.5.5 0 000 1h1.955c-.072.476-.134.985-.17 1.517a4.001 4.001 0 00-2.535 3.233zm1.75 1.25c-.362 0-.75-.502-.75-1.25a2.82 2.82 0 011.506-2.094 11.674 11.674 0 00.384 2.927 1.684 1.684 0 01-1.14.417zm2.604-3.897a4.4 4.4 0 011.251.193 10.325 10.325 0 01-1.708 2.35l-.163.162A11.04 11.04 0 0115.25 12c0-.093.008-.185.01-.278a3.318 3.318 0 01.844-.12z M22.5 3h-21a.5.5 0 00-.5.5v16a.5.5 0 00.5.5H10v3.5a.5.5                       0 00.854.354L14.707 20H22.5a.5.5 0 00.5-.5v-16a.5.5 0 00-.5-.5zM22 19h-7.5a.5.5 0 00-.354.146L11 22.293V19.5a.5.5 0 00-.5-.5H2V4h20z"></path>
              </svg>
              <span class="account-lang-btn__label">${getLocaleLabel(locale)}</span>
            </button>
            <button
              type="button"
              class="account-avatar-btn"
              id="accountAvatarBtn"
              aria-haspopup="true"
              aria-expanded="false"
              aria-label="${t('Меню пользователя')}"
              title="${escapeHtml(login)}"
            >${getAvatarInnerHtml(String((user as unknown as Record<string, unknown>).avatar ?? ''), login)}</button>
            <button
              type="button"
              class="account-burger"
              id="accountMenuToggle"
              aria-expanded="false"
              aria-controls="accountSidebar"
              aria-label="${t('Открыть меню')}"
            >
              <span></span><span></span><span></span>
            </button>

            <div class="account-lang-menu" id="accountLangMenu" hidden>
              <ul role="listbox">
                <li><a href="${localePath(accountRoute, 'ru')}" class="${locale === 'ru' ? 'is-active' : ''}" hreflang="ru">🇷🇺 ${t('Русский')}</a></li>
                <li><a href="${localePath(accountRoute, 'uk')}" class="${locale === 'uk' ? 'is-active' : ''}" hreflang="uk">🇺🇦 Українська</a></li>
                <li><a href="${localePath(accountRoute, 'en')}" class="${locale === 'en' ? 'is-active' : ''}" hreflang="en">🇬🇧 English</a></li>
              </ul>
            </div>

            <div class="account-user-menu" id="accountUserMenu" hidden>
              <div class="account-user-menu__name">${escapeHtml(String(user.username ?? login))}</div>
              <div class="account-user-menu__divider" aria-hidden="true"></div>
              <div class="account-user-menu__meta">
                <span class="chip status ${userStatus.main.cls}" title="${t('Статус аккаунта')}"><span class="dot"></span> ${escapeHtml(userStatus.main.label)}</span>
                <span class="account-user-menu__id" title="${t('ID пользователя')}">${escapeHtml(userPublicId)}</span>
              </div>
              <div class="account-user-menu__divider"></div>
              <button class="account-user-menu__edit" id="headerEditAccountBtn" type="button" aria-label="${t('Изменить аккаунт')}">${t('Изменить аккаунт')}</button>
              <button class="account-user-menu__logout" id="headerLogoutBtn" type="button" aria-label="${t('Выйти')}">${t('Выйти')}</button>
            </div>
          </div>
        </div>
      </header>

      <div class="account-nav-overlay" id="accountNavOverlay" aria-hidden="true"></div>

      <div class="account-wrap">
        <!-- Боковая панель -->
        <aside class="account-sidebar" id="accountSidebar">
          <!-- Навигация вкладок -->
          <nav class="account-nav">
            <button data-tab="profile" ${tab === 'profile' ? 'class="active"' : ''} aria-label="👤 ${t('Профиль')}">
              <span class="nav-icon">👤</span> ${t('Профиль')}
            </button>
            <button data-tab="friends" ${tab === 'friends' ? 'class="active"' : ''} aria-label="👥 ${t('Друзья')}">
              <span class="nav-icon">👥</span> ${t('Друзья')}
              <span class="nav-badge is-hidden" data-badge-type="pending-requests"></span>
            </button>
            <button data-tab="messages" ${tab === 'messages' ? 'class="active"' : ''} aria-label="💬 ${t('Сообщения')}">
              <span class="nav-icon">💬</span> ${t('Сообщения')}
              <span class="nav-badge is-hidden" data-badge-type="unread-messages"></span>
            </button>
            <button data-tab="security" ${tab === 'security' ? 'class="active"' : ''} aria-label="🛡️ ${t('Безопасность')}">
              <span class="nav-icon">🛡️</span> ${t('Безопасность')}
            </button>
            <button data-tab="sessions" ${tab === 'sessions' ? 'class="active"' : ''} aria-label="🧩 ${t('Сессии')}">
              <span class="nav-icon">🧩</span> ${t('Сессии')}
            </button>
            <button data-tab="easter" ${tab === 'easter' ? 'class="active"' : ''} aria-label="🍓 ${t('Пасхалки')}">
              <span class="nav-icon">🍓</span> ${t('Пасхалки')}
            </button>
          </nav>

          <!-- Действия -->
          <div class="account-actions">
            ${
              isAdminOrOwner
                ? `<button class="btn btn-outline" id="adminPanelBtn" type="button" data-open-url="https://admin.cyblight.org" aria-label="⚙️ ${t('Панель администратора')}">⚙️ ${t('Панель администратора')}</button>`
                : ''
            }
            <button class="btn btn-primary" id="logoutBtn" type="button" aria-label="${t('Выйти')}">${t('Выйти')}</button>
          </div>
        </aside>

        <!-- Основной контент -->
        <main id="main-content" class="account-main" tabindex="-1">
          <div class="account-header-row">
            <div>
              <div class="account-header-title">${tabTitle}</div>
              ${tab === 'profile' || tab === 'easter' ? '' : `<div class="account-header-subtitle">${t('Управление аккаунтом')}</div>`}
            </div>
          </div>

          <div class="account-divider"></div>

          <div id="accBody" class="account-body">
            ${renderTabContent(tab, user)}
          </div>
        </main>
      </div>

      <!-- Футер -->
      <footer class="auth-footer">
        <div class="footer-row">
          <div class="footer-copy">
            <p class="footer-text" dir="ltr" lang="en">
              © ${new Date().getFullYear()} CybLight
            </p>
          </div>
          <div class="footer-links">
            <a class="footer-brand" href="${homeUrl}" aria-label="${t('Главная страница')}" target="_blank" rel="noopener">
              <img src="/assets/img/logo.svg" class="footer-logo" alt="CybLight" />
              <span>CybLight.org</span>
            </a>

            <a class="report-btn" href="#" data-report-modal-open>
              <img src="/assets/img/report.svg" alt="Report" class="report-icon" />
              ${t('Сообщить о проблеме')}
            </a>

            <a href="#" data-noop>${t('Условия использования')}</a>
            <a href="${privacyUrl}" target="_blank" rel="noopener">${t('Политика конфиденциальности')}</a>
            <a href="${localePath('contact-admin', getLocale())}">${t('Взломали аккаунт?')}</a>
            <a href="#" data-noop>${t('Настройки конфиденциальности')}</a>
          </div>
        </div>
      </footer>
    </div>
  `;
}
