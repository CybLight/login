/**
 * Developer Mode easter egg — open DevTools, then click the footer marquee.
 */

import { apiCall, getStorage, setStorage, maybeLogBridgeEaster, sendEasterLog } from '@/utils';
import { DEVELOPER_MODE_KEY } from '@/config/constants';
import { t } from '@/i18n';
import { authService, extractEasterFlags } from '@/services';

let isUnlocking = false;
let bound = false;

export function hasDeveloperModeAccess(): boolean {
  return getStorage(DEVELOPER_MODE_KEY) === '1';
}

export function setDeveloperModeAccess(): void {
  setStorage(DEVELOPER_MODE_KEY, '1');
}

function isDevFooterPinned(): boolean {
  return document.documentElement.classList.contains('dev-footer-pinned');
}

function showDeveloperModeModal(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'developer-mode-overlay';
    overlay.innerHTML = `
      <div class="developer-mode-modal" role="dialog" aria-modal="true" aria-labelledby="developerModeTitle">
        <div class="developer-mode-modal__glow" aria-hidden="true"></div>
        <div class="developer-mode-modal__icon" aria-hidden="true">🛠️</div>
        <h2 id="developerModeTitle" class="developer-mode-modal__title">Developer Mode</h2>
        <p class="developer-mode-modal__text">
          ${t('Ты заглянул под капот и поймал бегущую строку.')}
          <br><br>
          ${t('Редкая пасхалка для тех, кто не боится консоли.')}
        </p>
        <button type="button" class="developer-mode-modal__btn" id="developerModeClose">
          ${t('console.log("ok") ✦')}
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    const close = () => {
      overlay.classList.remove('is-visible');
      overlay.addEventListener(
        'transitionend',
        () => {
          overlay.remove();
          resolve();
        },
        { once: true }
      );
      setTimeout(() => {
        if (overlay.isConnected) {
          overlay.remove();
          resolve();
        }
      }, 320);
    };

    overlay.querySelector('#developerModeClose')?.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
  });
}

async function saveDeveloperModeToServer(): Promise<boolean> {
  try {
    const response = await apiCall('/auth/easter/developer-mode', {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch (error) {
    console.warn('[DEV MODE] Server save error:', error);
    return false;
  }
}

function pulseDevStrip(): void {
  document.querySelectorAll('.cyb-dev-footer-strip').forEach((strip) => {
    strip.classList.remove('cyb-dev-footer-strip--found');
    void (strip as HTMLElement).offsetWidth;
    strip.classList.add('cyb-dev-footer-strip--found');
    strip.addEventListener(
      'animationend',
      () => strip.classList.remove('cyb-dev-footer-strip--found'),
      { once: true }
    );
  });
}

async function logDeveloperModeUnlock(): Promise<void> {
  try {
    const user = await authService.checkSession();
    if (!user?.username) return;

    const hadBridge = user.easter?.bridge === true;

    sendEasterLog({
      type: 'developer_mode',
      userName: user.username,
      source: 'devtools_footer_marquee_click',
      alex: 11,
    });

    const meRes = await apiCall('/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    if (!meRes.ok) return;

    const meData = await meRes.json().catch(() => ({}));
    maybeLogBridgeEaster(user.username, hadBridge, extractEasterFlags(meData).bridge === true);
  } catch {
    // fire-and-forget
  }
}

async function unlockDeveloperModeEaster(): Promise<void> {
  if (isUnlocking || hasDeveloperModeAccess()) {
    if (hasDeveloperModeAccess()) pulseDevStrip();
    return;
  }

  isUnlocking = true;

  setDeveloperModeAccess();
  const saved = await saveDeveloperModeToServer();
  if (!saved) {
    console.warn('[DEV MODE] Saved locally; sync on next login');
  }

  void logDeveloperModeUnlock();
  pulseDevStrip();
  await showDeveloperModeModal();
  isUnlocking = false;
}

function isMarqueeClickTarget(target: HTMLElement): boolean {
  if (target.closest('.cyb-dev-footer-strip')) return true;

  const footer = target.closest('.auth-footer');
  if (!footer) return false;

  if (target.closest('a, button, input, select, textarea, .footer-lang-btn, .footer-lang-menu')) {
    return false;
  }

  return true;
}

function onDocumentClick(event: MouseEvent): void {
  if (!isDevFooterPinned()) return;

  const target = event.target as HTMLElement | null;
  if (!target || !isMarqueeClickTarget(target)) return;

  void unlockDeveloperModeEaster();
}

export function initDeveloperModeEaster(): void {
  if (bound) return;
  bound = true;
  document.addEventListener('click', onDocumentClick);
}
