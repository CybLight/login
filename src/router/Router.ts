/**
 * Router - handles page navigation
 */

type RouteHandler = (params?: Record<string, unknown>) => Promise<void> | void;

export class Router {
  private static routes = new Set([
    'signup',
    'username',
    'password',
    'reset',
    '2fa-verify',
    'verify-email',
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
    'profile',
  ]);

  private static handlers: Record<string, RouteHandler> = {};

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
    const path = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    console.log('[ROUTER] getRoute: path =', path);

    if (this.routes.has(path)) {
      console.log('[ROUTER] getRoute: found in routes, returning:', path);
      return path;
    }

    // If not in routes and looks like a username (no slash)
    // Show public profile for that username
    if (path && !path.includes('/')) {
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
    const path = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    console.log('[ROUTER] getRouteParam:', paramName, 'path:', path);

    // Если путь - это зарегистрированный роут, не считаем его параметром
    if (this.routes.has(path)) {
      return null;
    }

    // Если путь выглядит как username (без слэшей) и мы ищем username
    if (path && !path.includes('/') && paramName === 'username') {
      console.log('[ROUTER] getRouteParam: returning username:', path);
      return path;
    }

    return null;
  }

  /**
   * Navigate to route
   */
  static navigate(to: string, params?: Record<string, unknown>): void {
    history.pushState(params || {}, '', '/' + to);
    this.render();
  }

  /**
   * Render current route
   */
  static async render(): Promise<void> {
    const route = this.getRoute();
    // Получаем параметры из history.state или создаем пустой объект
    const stateParams = history.state || {};
    const usernameParam = this.getRouteParam('username');
    const params = {
      ...stateParams,
      ...(usernameParam ? { username: usernameParam } : {}),
    };

    console.log('[ROUTER] Rendering route:', route, params);

    const handler = this.handlers[route];
    if (handler) {
      try {
        await handler(params);
      } catch (error) {
        console.error('[ROUTER] Handler error:', error);
        // При ошибке показываем страницу ошибки (не редиректим!)
        this.showErrorPage();
      }
    } else {
      console.warn('[ROUTER] No handler for route:', route);
      // Если обработчик не найден, показываем страницу ошибки
      this.showErrorPage();
    }

    // Dispatch route change event
    window.dispatchEvent(
      new CustomEvent('cyb:route', {
        detail: { route, params },
      })
    );
  }

  /**
   * Show error page
   */
  private static showErrorPage(): void {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="error-page" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 20px;">
          <h1 style="font-size: 48px; margin-bottom: 16px;">404</h1>
          <h2 style="font-size: 24px; margin-bottom: 8px;">Страница не найдена</h2>
          <p style="color: var(--muted, #888); margin-bottom: 24px;">Извините, запрашиваемая страница не существует.</p>
          <button id="goHomeBtn" class="btn btn-primary" aria-label="Вернуться на главную">Вернуться на главную</button>
        </div>
      `;

      // Attach event listener
      const btn = document.getElementById('goHomeBtn');
      if (btn) {
        btn.onclick = () => this.navigate('username');
      }
    }
  }

  /**
   * Initialize router
   */
  static init(): void {
    window.addEventListener('popstate', () => this.render());

    // Expose router to window
    (window as unknown as { CybRouter?: Record<string, unknown> }).CybRouter = {
      getRoute: this.getRoute.bind(this),
      getRouteParam: this.getRouteParam.bind(this),
      navigate: this.navigate.bind(this),
      render: this.render.bind(this),
    } as unknown as Record<string, unknown>;

    // Initial render
    this.render();
  }
}
