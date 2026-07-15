/**
 * Account page renderer - отрисовка основной страницы
 */

import { getLocale, getLocaleLabel, localePath, sitePath, t } from '@/i18n';
import { buildAuthFooter } from '@/ui/auth-footer';
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
  if (tab === 'settings') return 'account-settings';
  return `account-${tab}`;
}

export function renderAccountPage(tab: string, user: AppUser): string {
  const locale = getLocale();
  const homeUrl = sitePath('', locale);
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
            <button data-tab="messages" ${tab === 'messages' ? 'class="active"' : ''} aria-label="${t('Сообщения')}">
              <span class="nav-icon nav-icon--svg">
                <svg class="messages-bubble-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  <circle class="typing-dot typing-dot--1" cx="8" cy="12" r="1.2" fill="currentColor" stroke="none"></circle>
                  <circle class="typing-dot typing-dot--2" cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"></circle>
                  <circle class="typing-dot typing-dot--3" cx="16" cy="12" r="1.2" fill="currentColor" stroke="none"></circle>
                </svg>
              </span> ${t('Сообщения')}
              <span class="nav-badge is-hidden" data-badge-type="unread-messages"></span>
            </button>

            <div class="nav-divider"></div>

            <button data-tab="security" ${tab === 'security' ? 'class="active"' : ''} aria-label="🛡️ ${t('Безопасность')}">
              <span class="nav-icon">🛡️</span> ${t('Безопасность')}
            </button>
            <button data-tab="sessions" ${tab === 'sessions' ? 'class="active"' : ''} aria-label="${t('Сессии')}">
              <span class="nav-icon nav-icon--svg">
                <svg aria-hidden="true" viewBox="0 0 16 16" version="1.1" fill="currentColor">
                  <!-- Spire -->
                  <path class="broadcast-spire" d="M8.75 8.582v5.668a.75.75 0 0 1-1.5 0V8.582a1.75 1.75 0 1 1 1.5 0Z"></path>
                  <!-- Inner waves -->
                  <path class="broadcast-wave-inner" d="M12.039 3.778A4.988 4.988 0 0 1 13 7a4.988 4.988 0 0 1-1.177 3.222.75.75 0 1 1-1.146-.967A3.487 3.487 0 0 0 11.5 7c0-.86-.309-1.645-.823-2.255a.75.75 0 0 1 1.146-.967Zm-6.492.958A3.48 3.48 0 0 0 4.5 7a3.48 3.48 0 0 0 .823 2.255.75.75 0 0 1-1.146.967A4.981 4.981 0 0 1 3 7a4.982 4.982 0 0 1 1.188-3.236.75.75 0 1 1 1.143.972Z"></path>
                  <!-- Outer waves -->
                  <path class="broadcast-wave-outer" d="M12.733 1.457a.75.75 0 0 1 1.06.026A7.976 7.976 0 0 1 16 7c0 2.139-.84 4.083-2.207 5.517a.75.75 0 1 1-1.086-1.034A6.474 6.474 0 0 0 14.5 7a6.474 6.474 0 0 0-1.793-4.483.75.75 0 0 1 .026-1.06Zm-9.466 0c.3.286.312.76.026 1.06A6.474 6.474 0 0 0 1.5 7a6.47 6.47 0 0 0 1.793 4.483.75.75 0 0 1-1.086 1.034A7.973 7.973 0 0 1 0 7c0-2.139.84-4.083 2.207-5.517a.75.75 0 0 1 1.06-.026Z"></path>
                </svg>
              </span> ${t('Сессии')}
            </button>
            <button data-tab="settings" ${tab === 'settings' ? 'class="active"' : ''} aria-label="⚙️ ${t('Настройки')}">
              <span class="nav-icon">⚙️</span> ${t('Настройки')}
            </button>

            <div class="nav-divider"></div>

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
        <main id="main-content" class="account-main${tab === 'sessions' ? ' is-sessions-view' : ''}" tabindex="-1">
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

      ${buildAuthFooter({ showLangSwitcher: false })}
    </div>
  `;
}
