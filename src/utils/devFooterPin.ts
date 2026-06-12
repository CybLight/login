/**
 * При открытой консоли (F12) закрепляет футер над панелью разработчика.
 */

const DEVTOOLS_MQ = '(max-height: 700px) and (min-width: 1024px)';

let resizeObserver: ResizeObserver | null = null;
let observedFooter: Element | null = null;
let mutationObserver: MutationObserver | null = null;
let bound = false;

function getFooter(): HTMLElement | null {
  return document.querySelector('.auth-footer');
}

function unobserveFooter(): void {
  if (resizeObserver && observedFooter) {
    resizeObserver.unobserve(observedFooter);
    observedFooter = null;
  }
}

function observeFooter(footer: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') return;

  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(syncDevFooterPin);
  }

  if (observedFooter !== footer) {
    unobserveFooter();
    resizeObserver.observe(footer);
    observedFooter = footer;
  }
}

function isDevToolsViewport(): boolean {
  if (window.innerWidth < 1024) return false;
  if (window.matchMedia(DEVTOOLS_MQ).matches) return true;

  const vv = window.visualViewport;
  if (!vv) return false;

  return window.innerHeight - vv.height > 100;
}

export function syncDevFooterPin(): void {
  const root = document.documentElement;
  const body = document.body;
  const footer = getFooter();
  const pinned = isDevToolsViewport() && !!footer;

  if (!pinned) {
    root.classList.remove('dev-footer-pinned');
    body.classList.remove('dev-footer-pinned');
    root.style.removeProperty('--dev-footer-height');
    unobserveFooter();
    return;
  }

  root.classList.add('dev-footer-pinned');
  body.classList.add('dev-footer-pinned');
  root.style.setProperty('--dev-footer-height', `${footer.offsetHeight}px`);
  observeFooter(footer);
}

export function initDevFooterPin(): void {
  if (bound) return;
  bound = true;

  const mq = window.matchMedia(DEVTOOLS_MQ);
  mq.addEventListener('change', syncDevFooterPin);
  window.addEventListener('resize', syncDevFooterPin);
  window.visualViewport?.addEventListener('resize', syncDevFooterPin);

  const app = document.getElementById('app');
  if (app && typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver(syncDevFooterPin);
    mutationObserver.observe(app, { childList: true, subtree: true });
  }

  syncDevFooterPin();
}
