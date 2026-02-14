(function () {
  const routes = new Set([
    'signup',
    'account-profile',
    'account-security',
    'account-sessions',
    'account-easter-eggs',
    'verify-email',
    'username',
    'password',
    '2fa',
    '2fa-verify',
    'reset',
    'done',
    'strawberry-history',
  ]);

  function getRoute() {
    const path = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    console.log('[ROUTER] getRoute: path =', path);
    
    // Проверяем есть ли этот путь в списке
    if (routes.has(path)) {
      console.log('[ROUTER] getRoute: found in routes, returning:', path);
      return path;
    }
    
    // Если нет и путь не пустой, это может быть профиль пользователя
    if (path && !path.includes('/')) {
      console.log('[ROUTER] getRoute: treating as profile route, returning: profile');
      return 'profile';
    }
    
    console.log('[ROUTER] getRoute: defaulting to username');
    return 'username';
  }

  function getRouteParam(paramName) {
    const path = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    console.log('[ROUTER] getRouteParam:', paramName, 'path:', path);
    
    if (path && !path.includes('/') && paramName === 'username') {
      console.log('[ROUTER] getRouteParam: returning username:', path);
      return path;
    }
    
    console.log('[ROUTER] getRouteParam: returning null');
    return null;
  }

  function navigate(to) {
    history.pushState({}, '', '/' + to);
    render();
  }

  window.CybRouter = { getRoute, getRouteParam, navigate };

  window.addEventListener('popstate', render);

  function render() {
    const route = getRoute();
    window.dispatchEvent(new CustomEvent('cyb:route', { detail: { route } }));
  }

  // first render
  render();
})();
