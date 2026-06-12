/**
 * Router - handles page navigation with locale prefix (/ru, /uk, /en)
 */

import { getLocale, isLocale, localePath, stripLocalePrefix, t } from '@/i18n';

type RouteHandler = (params?: Record<string, unknown>) => Promise<void> | void;

export class Router {
  private static routes = new Set([
    'signup',
    'username',
    'password',
    'reset',
    '2fa-verify',
    'verify-email',
    'cancel-email-change',
    'done',
    'account',
    'account-profile',
    'edit-profile',
    'account-security',
    'account-sessions',
    'account-easter-eggs',
    'account-friends',
    'account-messages',
    'account-banned',
    'contact-admin',
    'strawberry-history',
    'postmaster',
    'profile',
    '2fa',
  ]);

  private static handlers: Record<string, RouteHandler> = {};

  /** Tab / page titles (Russian source strings for t()) */
  private static titles: Record<string, string> = {
    signup: 'Регистрация',
    username: 'Вход',
    password: 'Вход',
    reset: 'Сброс пароля',
    '2fa-verify': 'Подтверждение входа',
    '2fa': 'Подтверждение входа',
    'verify-email': 'Подтверждение почты',
    'cancel-email-change': 'Отмена смены email',
    done: 'Готово',
    account: 'Учётка',
    'account-profile': 'Профиль',
    'edit-profile': 'Редактирование профиля',
    'account-security': 'Безопасность',
    'account-sessions': 'Сессии',
    'account-easter-eggs': 'Пасхалки',
    'account-friends': 'Друзья',
    'account-messages': 'Сообщения',
    'account-banned': 'Аккаунт заблокирован',
    'contact-admin': 'Связь с администрацией',
    'strawberry-history': 'Клубничная история',
    postmaster: 'Postmaster',
    profile: 'Профиль',
  };

  private static pathWithoutLocale(): string {
    return stripLocalePrefix().path;
  }

  /**
   * Register route handler
   */
  static on(route: string, handler: RouteHandler): void {
    this.handlers[route] = handler;
  }

  /**
   * Get current route name
   */
  static getRoute(): string {
    const path = this.pathWithoutLocale();
    console.log('[ROUTER] getRoute: path =', path);

    if (this.routes.has(path)) {
      console.log('[ROUTER] getRoute: found in routes, returning:', path);
      return path;
    }

    if (path && !path.includes('/') && !isLocale(path)) {
      console.log('[ROUTER] getRoute: treating as username profile, returning: profile');
      return 'profile';
    }

    console.log('[ROUTER] getRoute: defaulting to username');
    return 'username';
  }

  /**
   * Get route parameter
   */
  static getRouteParam(paramName: string): string | null {
    const path = this.pathWithoutLocale();
    console.log('[ROUTER] getRouteParam:', paramName, 'path:', path);

    if (this.routes.has(path) || isLocale(path)) {
      return null;
    }

    if (path && !path.includes('/') && paramName === 'username') {
      console.log('[ROUTER] getRouteParam: returning username:', path);
      return path;
    }

    return null;
  }

  /**
   * Navigate to route (locale prefix applied automatically)
   */
  static navigate(to: string, params?: Record<string, unknown>): void {
    const target = localePath(to.replace(/^\/+/, ''));
    history.pushState(params || {}, '', target);
    this.render();
  }

  /**
   * Render current route
   */
  static async render(): Promise<void> {
    const route = this.getRoute();
    const stateParams = history.state || {};
    const usernameParam = this.getRouteParam('username');
    const params = {
      ...stateParams,
      ...(usernameParam ? { username: usernameParam } : {}),
    };

    console.log('[ROUTER] Rendering route:', route, params);

    document.title = `${t(this.titles[route] || 'Вход')} — CybLight`;

    const handler = this.handlers[route];
    if (handler) {
      try {
        await handler(params);
      } catch (error) {
        console.error('[ROUTER] Handler error:', error);
        this.showErrorPage();
      }
    } else {
      console.warn('[ROUTER] No handler for route:', route);
      this.showErrorPage();
    }

    window.dispatchEvent(
      new CustomEvent('cyb:route', {
        detail: { route, params, locale: getLocale() },
      })
    );
  }

  private static showErrorPage(): void {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-page" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 20px;">
          <h1 style="font-size: 48px; margin-bottom: 16px;">404</h1>
          <h2 style="font-size: 24px; margin-bottom: 8px;">${t('Страница не найдена')}</h2>
          <p style="color: var(--muted, #888); margin-bottom: 24px;">${t('Извините, запрашиваемая страница не существует.')}</p>
          <button id="goHomeBtn" class="btn btn-primary" aria-label="${t('Вернуться на главную')}">${t('Вернуться на главную')}</button>
        </div>
      `;

      const btn = document.getElementById('goHomeBtn');
      if (btn) {
        btn.onclick = () => this.navigate('username');
      }
    }
  }

  static init(): void {
    window.addEventListener('popstate', () => this.render());

    (window as unknown as { CybRouter?: Record<string, unknown> }).CybRouter = {
      getRoute: this.getRoute.bind(this),
      getRouteParam: this.getRouteParam.bind(this),
      navigate: this.navigate.bind(this),
      render: this.render.bind(this),
    } as unknown as Record<string, unknown>;

    this.render();
  }
}
