/**
 * Main entry point for CybLight Login application
 */

// Import global styles
import '@/styles/global.css';
import '@/styles/login.css';
import '@/styles/accessibility.css';

import { initLocaleRouting, t } from '@/i18n';
import { Router } from '@/router/Router';
import { initDevFooterPin, initErrorHandlers, logger } from '@/utils';
import { authService } from '@/services';
import { NotificationManager } from '@/components/notification/NotificationManager';
import { initStrawberryBackground } from '@/components/strawberry';
import { initDeveloperModeEaster } from '@/components/easter/developer-mode';
import { initReportModalTriggers } from '@/ui/report-modal';

// Import all views
import {
  renderUsername,
  renderPassword,
  renderSignup,
  renderReset,
  render2FAVerify,
  renderVerifyEmail,
  renderCancelEmailChange,
  renderAccountBanned,
  renderContactAdmin,
  renderDone,
  renderAccount,
  renderStrawberryHistory,
  renderPublicProfile,
  renderEditProfile,
  renderPostmaster,
} from '@/views';

function initGlobalUiDelegation(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const routeTrigger = target.closest('[data-route]') as HTMLElement | null;
    if (routeTrigger) {
      event.preventDefault();
      const route = routeTrigger.getAttribute('data-route');
      if (route) Router.navigate(route);
      return;
    }

    const reloadTrigger = target.closest('[data-reload]') as HTMLElement | null;
    if (reloadTrigger) {
      event.preventDefault();
      window.location.reload();
      return;
    }

    const openUrlTrigger = target.closest('[data-open-url]') as HTMLElement | null;
    if (openUrlTrigger) {
      event.preventDefault();
      const url = openUrlTrigger.getAttribute('data-open-url');
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    const noopTrigger = target.closest('[data-noop]') as HTMLElement | null;
    if (noopTrigger) {
      event.preventDefault();
    }
  });
}

// Export Router globally for use in HTML onclick handlers
(window as unknown as { CybRouter?: typeof Router }).CybRouter = Router;

export async function initApp(): Promise<void> {
  initLocaleRouting();

  console.log('📱 CybLight Login - Initializing...');

  if (!document.getElementById('skip-to-main')) {
    const skipLink = document.createElement('a');
    skipLink.id = 'skip-to-main';
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = t('Перейти к основному содержимому');
    document.body.prepend(skipLink);
  }

  // Ensure live regions for screen readers
  if (!document.getElementById('a11y-notifications')) {
    const notif = document.createElement('div');
    notif.id = 'a11y-notifications';
    notif.setAttribute('role', 'status');
    notif.setAttribute('aria-live', 'polite');
    notif.setAttribute('aria-atomic', 'true');
    notif.className = 'sr-only';
    document.body.appendChild(notif);
  }
  if (!document.getElementById('a11y-errors')) {
    const err = document.createElement('div');
    err.id = 'a11y-errors';
    err.setAttribute('role', 'alert');
    err.setAttribute('aria-live', 'assertive');
    err.setAttribute('aria-atomic', 'true');
    err.className = 'sr-only';
    document.body.appendChild(err);
  }

  initReportModalTriggers();
  initGlobalUiDelegation();

  // Initialize error handlers
  initErrorHandlers();
  logger.info('Error handlers initialized');

  // Register route handlers BEFORE initializing router
  Router.on('username', renderUsername);
  Router.on('password', renderPassword);
  Router.on('signup', renderSignup);
  Router.on('reset', renderReset);
  Router.on('2fa-verify', render2FAVerify);
  Router.on('verify-email', renderVerifyEmail);
  Router.on('cancel-email-change', renderCancelEmailChange);
  Router.on('account-banned', renderAccountBanned);
  Router.on('contact-admin', renderContactAdmin);
  Router.on('done', renderDone);
  Router.on('account', () => renderAccount('profile'));
  Router.on('account-profile', () => renderAccount('profile'));
  Router.on('edit-profile', renderEditProfile);
  Router.on('account-security', () => renderAccount('security'));
  Router.on('account-sessions', () => renderAccount('sessions'));
  Router.on('account-easter-eggs', () => renderAccount('easter'));
  Router.on('account-friends', () => renderAccount('friends'));
  Router.on('account-messages', () => renderAccount('messages'));
  Router.on('strawberry-history', renderStrawberryHistory);
  Router.on('postmaster', renderPostmaster);
  Router.on('profile', (params) => {
    const maybeFromParams = params && (params as Record<string, unknown>).username;
    const usernameFromParams = typeof maybeFromParams === 'string' ? maybeFromParams : undefined;
    const username = usernameFromParams ?? Router.getRouteParam('username');
    if (typeof username === 'string') {
      return renderPublicProfile(username);
    }
  });

  // Дополнительные роуты с заглушками
  Router.on('2fa', render2FAVerify); // алиас для 2fa-verify

  logger.info('Routes registered');

  // Initialize router (this will call render() for the first time)
  Router.init();
  logger.info('Router initialized');

  initDevFooterPin();
  initDeveloperModeEaster();

  // Initialize strawberry background
  initStrawberryBackground();
  logger.info('Strawberry background initialized');

  // Check if user is already logged in
  const user = await authService.checkSession();
  if (user) {
    logger.info('User logged in', { username: user.username });
  } else {
    logger.info('User not logged in');
  }

  // Listen for auth-related events
  window.addEventListener('auth:unauthorized', () => {
    NotificationManager.error(t('Ваша сессия истекла. Пожалуйста, войдите снова.'));
    authService.clearAuthCookie();
    Router.navigate('username');
  });

  logger.info('✅ Application initialized successfully');
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp().catch((error) => {
    console.error('Fatal error during app initialization:', error);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-page">
          <h1>${t('Ошибка инициализации')}</h1>
          <p>${t('Не удалось инициализировать приложение.')}</p>
          <button type="button" data-reload aria-label="${t('Обновить страницу')}">${t('Обновить страницу')}</button>
        </div>
      `;
    }
  });
}
