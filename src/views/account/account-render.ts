/**
 * Account page renderer - отрисовка основной страницы
 */

import { getTabTitle, renderTabContent } from './tabs-render';
import { escapeHtml } from '@/utils';

/**
 * Главный рендер страницы аккаунта
 */
import type { User as AppUser } from '@/types';

export function renderAccountPage(tab: string, user: AppUser): string {
  const tabTitle = getTabTitle(tab);
  const maybe = user as unknown as Record<string, unknown>;
  const login = String(maybe.login ?? maybe.username ?? user.username ?? 'User');
  const role = user.role?.toLowerCase();
  const isAdminOrOwner =
    role === 'admin' ||
    role === 'owner' ||
    user.flags?.includes('admin') ||
    user.flags?.includes('owner');

  return `
    <div class="account-page">
      <!-- Toast уведомление (fixed в верхней части экрана) -->
      <div id="msg" class="msg is-hidden" aria-live="polite"></div>

      <div class="account-wrap">
        <!-- Боковая панель -->
        <aside class="account-sidebar">
          <div class="account-brand">
            <a href="https://cyblight.org/" aria-label="Главная страница">
              <img src="/assets/img/logo.svg" alt="CybLight" />
            </a>
            <div>
              <div class="account-brand-title">Учётка</div>
              <div id="accLogin" class="account-brand-login">${escapeHtml(login)}</div>
            </div>
          </div>

          <!-- Навигация вкладок -->
          <nav class="account-nav">
            <button data-tab="profile" ${tab === 'profile' ? 'class="active"' : ''} aria-label="👤 Профиль">
              <span class="nav-icon">👤</span> Профиль
            </button>
            <button data-tab="friends" ${tab === 'friends' ? 'class="active"' : ''} aria-label="👥 Друзья">
              <span class="nav-icon">👥</span> Друзья
              <span class="nav-badge is-hidden" data-badge-type="pending-requests"></span>
            </button>
            <button data-tab="messages" ${tab === 'messages' ? 'class="active"' : ''} aria-label="💬 Сообщения">
              <span class="nav-icon">💬</span> Сообщения
              <span class="nav-badge is-hidden" data-badge-type="unread-messages"></span>
            </button>
            <button data-tab="security" ${tab === 'security' ? 'class="active"' : ''} aria-label="🛡️ Безопасность">
              <span class="nav-icon">🛡️</span> Безопасность
            </button>
            <button data-tab="sessions" ${tab === 'sessions' ? 'class="active"' : ''} aria-label="🧩 Сессии">
              <span class="nav-icon">🧩</span> Сессии
            </button>
            <button data-tab="easter" ${tab === 'easter' ? 'class="active"' : ''} aria-label="🍓 Пасхалки">
              <span class="nav-icon">🍓</span> Пасхалки
            </button>
          </nav>

          <!-- Действия -->
          <div class="account-actions">
            ${
              isAdminOrOwner
                ? `<button class="btn btn-outline" id="adminPanelBtn" type="button" data-open-url="https://admin.cyblight.org" aria-label="⚙️ Панель администратора">⚙️ Панель администратора</button>`
                : ''
            }
            <button class="btn btn-primary" id="logoutBtn" type="button" aria-label="Выйти">Выйти</button>
          </div>
        </aside>

        <!-- Основной контент -->
        <main id="main-content" class="account-main" tabindex="-1">
          <div class="account-header-row">
            <div>
              <div class="account-header-title">${tabTitle}</div>
              ${tab === 'profile' || tab === 'easter' ? '' : '<div class="account-header-subtitle">Управление аккаунтом</div>'}
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
            <a class="footer-brand" href="https://cyblight.org/" aria-label="Главная страница" target="_blank" rel="noopener">
              <img src="/assets/img/logo.svg" class="footer-logo" alt="CybLight" />
              <span>CybLight.org</span>
            </a>

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

    <link rel="stylesheet" href="/account-render.css">
  `;
}
