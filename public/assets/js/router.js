(function () {
  const routes = new Set(["username", "password", "2fa", "reset", "done"]);

  function getRoute() {
    const path = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    return routes.has(path) ? path : "username";
  }

  function navigate(to) {
    history.pushState({}, "", "/" + to);
    render();
  }

  window.CybRouter = { getRoute, navigate };

  window.addEventListener("popstate", render);

  function render() {
    const route = getRoute();
    window.dispatchEvent(new CustomEvent("cyb:route", { detail: { route } }));
  }

  // first render
  render();
})();
