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
    
    // Проверяем есть ли этот путь в списке
    if (routes.has(path)) {
      return path;
    }
    
    // Если нет и путь не пустой, это может быть профиль пользователя
    if (path && !path.includes('/')) {
      return 'profile';
    }
    
    return 'username';
  }

  function getRouteParam(paramName) {
    const path = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    
    if (path && !path.includes('/') && paramName === 'username') {
      return path;
    }
    
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
