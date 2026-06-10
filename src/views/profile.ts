/**
 * Public profile view - отображение профилей других пользователей
 */

import { bindProfileMirrorEaster } from '@/components/easter/profile-mirror';
import { t, sitePath, getLocale, getLocaleLabel, localePath, localeTag, type Locale } from '@/i18n';
import { apiCall, escapeHtml, renderPresenceChip } from '@/utils';
import { Router } from '@/router/Router';
import { showAppPrompt } from '@/ui';

interface PublicProfile {
  id?: string;
  username?: string;
  login?: string;
  email?: string;
  verified?: boolean;
  role?: string;
  flags?: string[];
  createdAt?: number | string;
  bio?: string;
  aboutMe?: string;
  gender?: string;
  dateOfBirth?: string;
  avatar?: string;
  friendsCount?: number;
  sessionsCount?: number;
  publicId?: string;
  twoFactorEnabled?: boolean;
  isOnline?: boolean;
  lastSeenAt?: number | null;
  [key: string]: unknown;
}

interface CurrentUser {
  id?: string;
  username?: string;
}

// Стандартные аватары
const AVATAR_EMOJI_MAP: Record<string, string> = {
  'avatar-cat': '🐱',
  'avatar-dog': '🐶',
  'avatar-fox': '🦊',
  'avatar-bear': '🐻',
  'avatar-panda': '🐼',
  'avatar-rabbit': '🐰',
  'avatar-owl': '🦉',
  'avatar-penguin': '🐧',
  'avatar-koala': '🐨',
  'avatar-tiger': '🐯',
  'avatar-crown': '👑',
  'avatar-shield': '🛡️',
  'avatar-code': '💻',
  'avatar-verified': '✔️',
  'avatar-fire': '🔥',
  'avatar-star': '⭐',
  'avatar-robot': '🤖',
  'avatar-diamond': '💎',
};

function getAvatarEmoji(avatarId: string): string {
  return AVATAR_EMOJI_MAP[avatarId] || '👤';
}

function getRoleClass(role: string | undefined): string {
  const roleMap: Record<string, string> = {
    owner: 'status--owner',
    admin: 'status--admin',
    moderator: 'status--mod',
    support: 'status--support',
    registrar: 'status--registrar',
    tester: 'status--tester',
    developer: 'status--dev',
    verified: 'status--verified',
    vip: 'status--premium',
    premium: 'status--premium',
  };
  const normalizedRole = role?.toLowerCase();
  return roleMap[normalizedRole || ''] || 'status--active';
}

function getRoleLabel(role: string | undefined, flags?: string[]): string {
  const flagsArray = flags || [];
  const normalizedRole = role?.toLowerCase();

  if (normalizedRole === 'owner' || flagsArray.includes('owner')) {
    return t('Владелец');
  }
  if (normalizedRole === 'admin' || flagsArray.includes('admin')) {
    return t('Администратор');
  }
  if (normalizedRole === 'moderator' || flagsArray.includes('moderator')) {
    return t('Модератор');
  }
  if (normalizedRole === 'support' || flagsArray.includes('support')) {
    return t('Поддержка');
  }
  if (normalizedRole === 'registrar' || flagsArray.includes('registrar')) {
    return t('Регистратор');
  }
  if (normalizedRole === 'tester' || flagsArray.includes('tester')) {
    return t('Тестер');
  }
  if (normalizedRole === 'developer' || flagsArray.includes('developer')) {
    return t('Разработчик');
  }
  if (normalizedRole === 'vip' || flagsArray.includes('vip')) {
    return 'VIP';
  }
  if (normalizedRole === 'premium' || flagsArray.includes('premium')) {
    return 'Premium';
  }

  return t('Пользователь');
}

function showProfileToast(message: string): void {
  let container = document.querySelector('.profile-toast-container') as HTMLDivElement | null;

  if (!container) {
    container = document.createElement('div');
    container.className = 'profile-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'profile-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  setTimeout(() => {
    toast.classList.remove('is-visible');

    setTimeout(() => {
      toast.remove();

      if (container && container.childElementCount === 0) {
        container.remove();
      }
    }, 180);
  }, 2400);
}

if (typeof window !== 'undefined') {
  window.showProfileToast = showProfileToast;
}

function buildProfileBadges(profile: PublicProfile): string {
  const badges: string[] = [];
  const flags = profile.flags || [];

  // 2FA
  if (profile.twoFactorEnabled || flags.includes('2fa')) {
    badges.push(
      `<span class="chip badge badge--ok" title="${t('Двухфакторная аутентификация')}">2FA</span>`
    );
  }

  // Developer
  if (flags.includes('dev') || flags.includes('developer')) {
    badges.push(`<span class="chip badge badge--dev" title="${t('Разработчик')}">Dev</span>`);
  }

  // Premium / Sponsor
  if (flags.includes('premium') || flags.includes('sponsor')) {
    badges.push('<span class="chip badge badge--premium" title="Premium">★</span>');
  }

  // Helper / Contributor
  if (flags.includes('helper') || flags.includes('contributor')) {
    badges.push(`<span class="chip badge badge--info" title="${t('Помощник')}">Helper</span>`);
  }

  // Trusted
  if (flags.includes('trusted')) {
    badges.push(`<span class="chip badge badge--ok" title="${t('Доверенный')}">Trusted</span>`);
  }

  // Beta
  if (flags.includes('beta')) {
    badges.push(`<span class="chip badge badge--beta" title="${t('Beta тестер')}">Beta</span>`);
  }

  return badges.join(' ');
}

/**
 * Загрузить публичный профиль пользователя
 */
async function loadProfile(username: string): Promise<PublicProfile | null> {
  try {
    const response = await apiCall(`/profile/${encodeURIComponent(username)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.ok ? data.profile : null;
  } catch (error) {
    console.error('Error loading profile:', error);
    return null;
  }
}

/**
 * Получить текущего пользователя (для проверки авторизации)
 */
async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await apiCall('/auth/me');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.ok ? data.user : null;
  } catch (error) {
    console.error('Error loading current user:', error);
    return null;
  }
}

/**
 * Получить статус дружбы между текущим пользователем и просматриваемым профилем
 */
async function getFriendshipStatus(friendId: string): Promise<string | null> {
  try {
    const response = await apiCall(`/friends/status/${friendId}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.ok ? data.status : null;
  } catch (error) {
    console.error('Error getting friendship status:', error);
    return null;
  }
}

const LANG_ICON_SVG = `<svg class="cl-language" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3.814 16.464a.501.501 0 00.65-.278L5.54 13.5h2.923l1.074 2.686a.5.5 0 00.928-.372l-3-7.5a.52.52 0 00-.928 0l-3 7.5a.5.5 0 00.278.65zM7 9.846L8.061 12.5H5.94zM6 7.5a.5.5 0 00.224-.053l2-1a.5.5 0 10-.448-.894l-2 1A.5.5 0 006 7.5zM11.75 14.25a2.025 2.025 0 001.75 2.25 2.584 2.584 0 001.482-.431c.039.088.07.152.075.162a.5.5 0 00.887-.461 4.654 4.654 0 01-.15-.368c.176-.168.359-.348.56-.548a11.374 11.374 0 001.92-2.652A1.55 1.55 0 0119 13.5a2.082 2.082 0 01-1.607 2.012.5.5 0 00.107.988.506.506 0 00.107-.012A3.055 3.055 0 0020 13.5a2.542 2.542 0 00-1.283-2.205c.16-.364.244-.6.255-.63a.5.5 0 10-.944-.33 7.97 7.97 0 01-.225.552 5.11 5.11 0 00-2.482-.21c.04-.428.091-.845.153-1.229 1.427-.123 3.04-.44 3.124-.458a.5.5 0 00-.196-.98c-.019.003-1.43.283-2.736.418.162-.761.31-1.273.313-1.284a.5.5 0 10-.958-.288c-.016.053-.206.695-.393 1.64-.041 0-.088.004-.128.004h-2a.5.5 0 000 1h1.955c-.072.476-.134.985-.17 1.517a4.001 4.001 0 00-2.535 3.233zm1.75 1.25c-.362 0-.75-.502-.75-1.25a2.82 2.82 0 011.506-2.094 11.674 11.674 0 00.384 2.927 1.684 1.684 0 01-1.14.417zm2.604-3.897a4.4 4.4 0 011.251.193 10.325 10.325 0 01-1.708 2.35l-.163.162A11.04 11.04 0 0115.25 12c0-.093.008-.185.01-.278a3.318 3.318 0 01.844-.12z M22.5 3h-21a.5.5 0 00-.5.5v16a.5.5 0 00.5.5H10v3.5a.5.5                       0 00.854.354L14.707 20H22.5a.5.5 0 00.5-.5v-16a.5.5 0 00-.5-.5zM22 19h-7.5a.5.5 0 00-.354.146L11 22.293V19.5a.5.5 0 00-.5-.5H2V4h20z"></path></svg>`;

function buildProfileLangSwitcher(profileRoute: string): string {
  const locale = getLocale();
  const langHref = (code: Locale) => localePath(profileRoute, code);

  return `
    <button
      type="button"
      class="account-lang-btn"
      id="profileLangBtn"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-label="${t('Выбор языка')}"
      title="${t('Язык')}"
    >
      ${LANG_ICON_SVG}
      <span class="account-lang-btn__label">${getLocaleLabel(locale)}</span>
    </button>
    <div class="account-lang-menu" id="profileLangMenu" hidden>
      <ul role="listbox">
        <li><a href="${langHref('ru')}" class="${locale === 'ru' ? 'is-active' : ''}" hreflang="ru">🇷🇺 ${t('Русский')}</a></li>
        <li><a href="${langHref('uk')}" class="${locale === 'uk' ? 'is-active' : ''}" hreflang="uk">🇺🇦 Українська</a></li>
        <li><a href="${langHref('en')}" class="${locale === 'en' ? 'is-active' : ''}" hreflang="en">🇬🇧 English</a></li>
      </ul>
    </div>
  `;
}

function buildProfileHeader(profileRoute: string, isLoggedIn: boolean, subtitle?: string): string {
  const locale = getLocale();
  const homeUrl = sitePath('', locale);
  const displayName = subtitle ?? profileRoute;
  const headerAction = isLoggedIn
    ? `
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
    `
    : `
      <button type="button" class="account-mobile-header__signin" id="profileSigninBtn" aria-label="${t('Войти')}">
        ${t('Войти')}
      </button>
    `;

  const navHtml = isLoggedIn
    ? `
      <div class="account-nav-overlay" id="accountNavOverlay" aria-hidden="true"></div>
      <aside class="account-sidebar profile-mobile-nav" id="accountSidebar">
        <nav class="account-nav">
          <button data-tab="profile" type="button" aria-label="👤 ${t('Профиль')}"><span class="nav-icon">👤</span> ${t('Профиль')}</button>
          <button data-tab="friends" type="button" aria-label="👥 ${t('Друзья')}"><span class="nav-icon">👥</span> ${t('Друзья')}</button>
          <button data-tab="messages" type="button" aria-label="💬 ${t('Сообщения')}"><span class="nav-icon">💬</span> ${t('Сообщения')}</button>
          <button data-tab="security" type="button" aria-label="🛡️ ${t('Безопасность')}"><span class="nav-icon">🛡️</span> ${t('Безопасность')}</button>
          <button data-tab="sessions" type="button" aria-label="🧩 ${t('Сессии')}"><span class="nav-icon">🧩</span> ${t('Сессии')}</button>
          <button data-tab="easter" type="button" aria-label="🍓 ${t('Пасхалки')}"><span class="nav-icon">🍓</span> ${t('Пасхалки')}</button>
        </nav>
        <div class="account-actions">
          <button class="btn btn-primary" id="profileLogoutBtn" type="button" aria-label="${t('Выйти')}">${t('Выйти')}</button>
        </div>
      </aside>
    `
    : '';

  return `
    <header class="account-mobile-header" aria-label="${t('Профиль пользователя')}">
      <div class="account-mobile-header__inner">
        <a href="${homeUrl}" class="account-mobile-header__logo" aria-label="${t('Главная страница')}">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </a>
        <div class="account-mobile-header__info">
          <div class="account-mobile-header__title">${t('Профиль')}</div>
          <div class="account-mobile-header__login">${escapeHtml(displayName)}</div>
        </div>
        <div class="account-header-actions">
          ${buildProfileLangSwitcher(profileRoute)}
          ${headerAction}
        </div>
      </div>
    </header>
    ${navHtml}
  `;
}

function buildProfileFooter(): string {
  const locale = getLocale();
  const homeUrl = sitePath('', locale);
  const privacyUrl = sitePath('privacy', locale);
  return `
    <footer class="auth-footer">
      <div class="footer-row">
        <div class="footer-copy">
          <p class="footer-text" dir="ltr" lang="en">
            © ${new Date().getFullYear()} CybLight
          </p>
        </div>
        <div class="footer-links">
          <a class="footer-brand" href="${homeUrl}" aria-label="${t('Главная страница')}" target="_blank" rel="noopener">
            <img src="/assets/img/logo.svg" class="footer-logo" alt="CybLight" />
            <span>CybLight.org</span>
          </a>

          <a class="report-btn" href="#" data-report-modal-open>
            <img src="/assets/img/report.svg" alt="Report" class="report-icon" />
            ${t('Сообщить о проблеме')}
          </a>

          <a href="#" data-noop>${t('Условия использования')}</a>
          <a href="${privacyUrl}" target="_blank" rel="noopener">${t('Политика конфиденциальности')}</a>
          <a href="#" data-noop>${t('Настройки конфиденциальности')}</a>
        </div>
      </div>
    </footer>
  `;
}

let profileLangMenuBound = false;

function bindProfileLangMenu(): void {
  const langBtn = document.getElementById('profileLangBtn');
  const langMenu = document.getElementById('profileLangMenu');
  if (!langBtn || !langMenu) return;

  const closeLangMenu = () => {
    document.getElementById('profileLangMenu')?.setAttribute('hidden', '');
    document.getElementById('profileLangBtn')?.setAttribute('aria-expanded', 'false');
  };

  langBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = langMenu.hasAttribute('hidden');
    closeLangMenu();
    if (willOpen) {
      langMenu.removeAttribute('hidden');
      langBtn.setAttribute('aria-expanded', 'true');
    }
  });

  langMenu.addEventListener('click', (event) => event.stopPropagation());

  langMenu.querySelectorAll('a[hreflang]').forEach((link) => {
    link.addEventListener('click', () => {
      const loc = link.getAttribute('hreflang');
      if (loc) {
        try {
          localStorage.setItem('cyblight-lang', loc);
        } catch {
          /* ignore */
        }
      }
    });
  });

  if (!profileLangMenuBound) {
    profileLangMenuBound = true;
    document.addEventListener('click', closeLangMenu);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLangMenu();
    });
  }
}

function bindProfileHeaderHandlers(): void {
  bindProfileLangMenu();

  const signinBtn = document.getElementById('profileSigninBtn');
  signinBtn?.addEventListener('click', () => {
    Router.navigate('username');
  });

  const menuToggle = document.getElementById('accountMenuToggle');
  const overlay = document.getElementById('accountNavOverlay');
  if (!menuToggle) return;

  const closeNav = () => {
    document.body.classList.remove('account-nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', t('Открыть меню'));
    overlay?.setAttribute('aria-hidden', 'true');
  };

  const openNav = () => {
    document.body.classList.add('account-nav-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', t('Закрыть меню'));
    overlay?.setAttribute('aria-hidden', 'false');
  };

  menuToggle.addEventListener('click', () => {
    if (document.body.classList.contains('account-nav-open')) {
      closeNav();
    } else {
      openNav();
    }
  });

  overlay?.addEventListener('click', closeNav);

  document.querySelectorAll('.profile-mobile-nav .account-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeNav();
      const targetTab = btn.getAttribute('data-tab');
      if (!targetTab) return;
      const route = targetTab === 'easter' ? 'account-easter-eggs' : `account-${targetTab}`;
      Router.navigate(route);
    });
  });

  const logoutBtn = document.getElementById('profileLogoutBtn');
  logoutBtn?.addEventListener('click', async () => {
    closeNav();
    try {
      await apiCall('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e: unknown) {
      console.error('Logout error:', e);
    }
    document.body.classList.remove('no-strawberries');
    Router.navigate('username');
  });
}

/**
 * Отобразить публичный профиль пользователя
 */
export async function renderPublicProfile(username: string): Promise<void> {
  // Показываем фон без клубники
  document.body.classList.add('no-strawberries');

  const app = document.getElementById('app') || document.body;
  const profileStyles = `
    <style>
      .profile-container {
        max-width: 1280px;
        margin: 0 auto;
        padding: 24px 16px 28px;
        color: #eef2ff;
      }
      .profile-loading,
      .profile-notfound {
        max-width: 760px;
        margin: 48px auto;
        padding: 24px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        background: rgba(255,255,255,.03);
        text-align: center;
      }
      .profile-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.03) 100%);
        padding: 18px;
      }
      .profile-info {
        display: flex;
        gap: 14px;
        min-width: 0;
      }
      .profile-avatar {
        width: 108px;
        height: 108px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.08);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 75px;
        flex-shrink: 0;
        box-shadow: 0 10px 24px rgba(0,0,0,.24);
        position: relative;
        overflow: visible;
      }
      .profile-avatar--easter {
        cursor: pointer;
        user-select: none;
        transform-style: preserve-3d;
      }
      .profile-avatar--easter::after {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        border: 1px solid rgba(147, 197, 253, 0);
        pointer-events: none;
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .profile-avatar--easter:hover::after {
        border-color: rgba(147, 197, 253, 0.22);
        box-shadow: 0 0 18px rgba(96, 165, 250, 0.15);
      }
      .profile-avatar-pulse {
        animation: profileAvatarPulse 0.35s ease;
      }
      .profile-avatar--found {
        animation: profileAvatarFlip 0.82s cubic-bezier(0.34, 1.1, 0.44, 1);
      }
      .profile-avatar--found::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        z-index: 2;
        pointer-events: none;
        background: linear-gradient(
          105deg,
          transparent 0%,
          rgba(255, 255, 255, 0.04) 40%,
          rgba(186, 230, 253, 0.7) 50%,
          rgba(255, 255, 255, 0.04) 60%,
          transparent 100%
        );
        opacity: 0;
        animation: profileAvatarMirrorShine 0.82s ease-out;
      }
      .profile-avatar-ring {
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 2px solid rgba(147, 197, 253, calc(0.25 + var(--mirror-step, 1) * 0.08));
        pointer-events: none;
        animation: profileAvatarRing 0.55s ease forwards;
      }
      @keyframes profileAvatarPulse {
        0% { transform: scale(1); }
        45% { transform: scale(0.94); }
        100% { transform: scale(1); }
      }
      @keyframes profileAvatarFlip {
        0% {
          transform: perspective(720px) rotateY(0deg) scale(1);
          filter: brightness(1);
        }
        42% {
          transform: perspective(720px) rotateY(168deg) scale(0.95);
          filter: brightness(0.72);
        }
        50% {
          transform: perspective(720px) rotateY(180deg) scale(0.9);
          filter: brightness(1.45) drop-shadow(0 0 20px rgba(147, 197, 253, 0.75));
        }
        58% {
          transform: perspective(720px) rotateY(192deg) scale(0.95);
          filter: brightness(0.72);
        }
        100% {
          transform: perspective(720px) rotateY(360deg) scale(1);
          filter: brightness(1);
        }
      }
      @keyframes profileAvatarMirrorShine {
        0%, 36%, 64%, 100% { opacity: 0; }
        48%, 52% { opacity: 1; }
      }
      @keyframes profileAvatarRing {
        0% { transform: scale(0.92); opacity: 0.9; }
        100% { transform: scale(1.22); opacity: 0; }
      }
      .profile-mirror-flip {
        animation: profileMirrorFlip 0.9s cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes profileMirrorFlip {
        0% { transform: perspective(900px) rotateY(0deg); }
        45% { transform: perspective(900px) rotateY(180deg) scale(0.98); }
        100% { transform: perspective(900px) rotateY(360deg); }
      }
      body.profile-mirror-active::before {
        content: '';
        position: fixed;
        inset: 0;
        z-index: 1100;
        pointer-events: none;
        background: linear-gradient(90deg, transparent 49.5%, rgba(147, 197, 253, 0.12) 50%, transparent 50.5%);
        animation: profileMirrorScan 0.9s ease;
      }
      @keyframes profileMirrorScan {
        0% { opacity: 0; transform: translateX(-8%); }
        35% { opacity: 1; }
        100% { opacity: 0; transform: translateX(8%); }
      }
      .profile-mirror-particle {
        position: fixed;
        z-index: 1200;
        pointer-events: none;
        font-size: 16px;
        animation: profileMirrorParticle 0.85s ease forwards;
      }
      @keyframes profileMirrorParticle {
        0% { opacity: 1; transform: translate(0, 0) scale(1); }
        100% { opacity: 0; transform: translate(var(--mx), var(--my)) scale(0.4) rotate(180deg); }
      }
      .profile-mirror-overlay {
        position: fixed;
        inset: 0;
        z-index: 1300;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(2, 6, 18, 0.78);
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.28s ease;
      }
      .profile-mirror-overlay.is-visible { opacity: 1; }
      .profile-mirror-modal {
        position: relative;
        width: min(420px, 100%);
        border-radius: 18px;
        border: 1px solid rgba(147, 197, 253, 0.35);
        background:
          radial-gradient(120% 90% at 0% 0%, rgba(96, 165, 250, 0.18) 0%, transparent 55%),
          linear-gradient(180deg, #1a2138 0%, #12182b 100%);
        padding: 28px 24px 22px;
        text-align: center;
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.06) inset,
          0 0 28px rgba(96, 165, 250, 0.22),
          0 24px 60px rgba(0, 0, 0, 0.65);
        transform: translateY(12px) scale(0.96);
        transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .profile-mirror-overlay.is-visible .profile-mirror-modal {
        transform: translateY(0) scale(1);
      }
      .profile-mirror-modal__glow {
        position: absolute;
        inset: -1px;
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(147, 197, 253, 0.25), transparent 45%, rgba(255, 127, 39, 0.18));
        opacity: 0.45;
        pointer-events: none;
      }
      .profile-mirror-modal__icon {
        font-size: 52px;
        margin-bottom: 10px;
        filter: drop-shadow(0 0 16px rgba(147, 197, 253, 0.45));
      }
      .profile-mirror-modal__title {
        margin: 0 0 10px;
        font-size: 24px;
        font-weight: 800;
        color: #eef2ff;
      }
      .profile-mirror-modal__text {
        margin: 0 0 18px;
        font-size: 14px;
        line-height: 1.55;
        color: rgba(238, 242, 255, 0.82);
      }
      .profile-mirror-modal__text strong {
        color: #93c5fd;
      }
      .profile-mirror-modal__btn {
        border: none;
        border-radius: 10px;
        padding: 11px 22px;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        cursor: pointer;
        background: linear-gradient(135deg, rgba(96, 165, 250, 0.95) 0%, rgba(59, 130, 246, 0.9) 100%);
        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
      }
      .profile-details h1 {
        margin: 0;
        font-size: 38px;
        line-height: 1.1;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .profile-status-badges {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(255,255,255,.06);
        font-size: 12px;
        font-weight: 700;
      }
      .status .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }
      .status--owner,
      .badge--owner {
        color: #f59e0b;
        border-color: rgba(245,158,11,.48);
        background: rgba(245,158,11,.16);
      }
      .status--admin,
      .badge--admin {
        color: #ef4444;
        border-color: rgba(239,68,68,.5);
        background: rgba(239,68,68,.16);
      }
      .status--mod,
      .badge--mod,
      .status--support,
      .badge--support,
      .status--registrar,
      .badge--registrar,
      .status--tester,
      .badge--tester,
      .status--dev,
      .status--verified,
      .status--active {
        color: #60a5fa;
        border-color: rgba(96,165,250,.46);
        background: rgba(96,165,250,.16);
      }
      .badge--dev {
        color: #f472b6;
        border-color: rgba(244,114,182,.5);
        background: rgba(244,114,182,.16);
      }
      .badge--premium,
      .status--premium {
        color: #fbbf24;
        border-color: rgba(251,191,36,.5);
        background: rgba(251,191,36,.16);
      }
      .badge--ok,
      .badge--info,
      .badge--beta {
        color: #34d399;
        border-color: rgba(52,211,153,.48);
        background: rgba(52,211,153,.15);
      }
      .profile-joined,
      .profile-bio,
      .profile-about,
      .profile-gender,
      .profile-dob {
        margin: 10px 0 0;
        color: rgba(238,242,255,.9);
      }
      .profile-top-meta {
        margin-top: 12px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .profile-friends-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(103, 232, 249, .35);
        background: rgba(34, 211, 238, .12);
        color: #d9f8ff;
      }
      .profile-friends-value {
        font-weight: 800;
        font-size: 15px;
        line-height: 1;
      }
      .profile-friends-label {
        font-size: 13px;
        opacity: .9;
      }
      .profile-share {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .profile-actions {
        margin-top: 14px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .profile-content {
        margin-top: 14px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px;
        padding: 14px;
        background: rgba(255,255,255,.03);
      }
      .profile-extra {
        margin-top: 14px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px;
        padding: 14px;
        background: rgba(255,255,255,.03);
      }
      .profile-extra h3 {
        margin: 0 0 8px;
        font-size: 18px;
      }
      .btn {
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 8px;
        padding: 10px 14px;
        color: #fff;
        background: rgba(255,255,255,.08);
        cursor: pointer;
      }
      .btn-primary {
        border: none;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      .btn-secondary { background: rgba(255,255,255,.06); }
      .btn-icon {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
      .profile-toast-container {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1200;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
        align-items: center;
      }
      .profile-toast {
        min-width: 260px;
        max-width: min(92vw, 360px);
        border-radius: 12px;
        border: 1px solid rgba(103, 232, 249, .35);
        background: linear-gradient(135deg, rgba(17, 24, 39, .96) 0%, rgba(30, 41, 59, .94) 100%);
        color: #e5f9ff;
        padding: 12px 14px;
        box-shadow: 0 12px 28px rgba(2, 8, 23, .5);
        opacity: 0;
        transform: translateY(10px) scale(.98);
        transition: opacity .18s ease, transform .18s ease;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.35;
      }
      .profile-toast::before {
        content: '✓';
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-right: 8px;
        border-radius: 999px;
        background: rgba(45, 212, 191, .22);
        color: #2dd4bf;
        font-size: 12px;
        font-weight: 800;
      }
      .profile-toast.is-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      @media (max-width: 900px) {
        .profile-container { padding: 16px 16px 24px; }
        .profile-header { flex-direction: column; }
        .profile-details h1 { font-size: 32px; }
        .profile-share { flex-direction: row; }
        .profile-toast-container {
          top: 12px;
          left: 12px;
          right: 12px;
          transform: none;
        }
        .profile-toast {
          min-width: 0;
          max-width: none;
          width: 100%;
        }
      }
    </style>
  `;

  // Показываем загрузку
  app.innerHTML = `
    ${profileStyles}
    <div class="profile-loading">
      <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto 20px; border: 4px solid rgba(255, 255, 255, 0.1); border-top-color: #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <p>${t('Загрузка профиля...')}</p>
    </div>
  `;

  document.body.classList.remove('account-nav-open');

  const [profile, currentUser] = await Promise.all([loadProfile(username), getCurrentUser()]);

  if (!profile) {
    document.title = `${t('Профиль не найден')} — CybLight`;
    app.innerHTML = `
      ${profileStyles}
      ${buildProfileHeader(username, Boolean(currentUser), username)}
      <div class="profile-notfound">
        <h1>${t('Профиль не найден')}</h1>
        <p>${t('Пользователь')} <strong>${escapeHtml(username)}</strong> ${t('не существует')}</p>
        <button class="btn btn-primary" type="button" data-route="username" aria-label="${t('Вернуться')}">${t('Вернуться')}</button>
      </div>
      ${buildProfileFooter()}
    `;
    bindProfileHeaderHandlers();
    return;
  }

  const isSelf = currentUser?.id === profile.id;

  let friendStatus = null;
  if (currentUser && !isSelf && profile.id) {
    friendStatus = await getFriendshipStatus(profile.id);
  }

  const createdAt = profile.createdAt
    ? new Date(
        typeof profile.createdAt === 'string' ? parseInt(profile.createdAt) : profile.createdAt
      ).toLocaleDateString(localeTag(getLocale()), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  let actionButtons = '';

  if (isSelf) {
    actionButtons = '';
  } else if (currentUser) {
    if (friendStatus === 'accepted') {
      actionButtons = `
        <div class="profile-actions">
          <button class="btn btn-primary" type="button" data-action="open-message" data-user-id="${escapeHtml(String(profile.id || ''))}" data-username="${escapeHtml(String(profile.username || profile.login || username))}" aria-label="💬 ${t('Написать сообщение')}">
            💬 ${t('Написать сообщение')}
          </button>
          <button class="btn btn-secondary" type="button" data-profile-toast="${t('Удаление из друзей скоро будет доступно')}" aria-label="✕ ${t('Удалить из друзей')}">
            ✕ ${t('Удалить из друзей')}
          </button>
        </div>
      `;
    } else if (friendStatus === 'pending') {
      actionButtons = `
        <div class="profile-actions">
          <button class="btn btn-secondary" disabled aria-label="⏳ ${t('Запрос на добавление отправлен')}">
            ⏳ ${t('Запрос на добавление отправлен')}
          </button>
        </div>
      `;
    } else {
      actionButtons = `
        <div class="profile-actions">
          <button class="btn btn-primary" type="button" data-profile-toast="${t('Добавление в друзья скоро будет доступно')}" aria-label="➕ ${t('Добавить в друзья')}">
            ➕ ${t('Добавить в друзья')}
          </button>
        </div>
      `;
    }
  } else {
    actionButtons = `
      <div class="profile-actions">
        <p style="color: #999; font-size: 0.9em;">${t('Войдите, чтобы добавить в друзья')}</p>
      </div>
    `;
  }

  document.title = `${String(profile.username || profile.login || username)} — CybLight`;

  const avatarEmoji = getAvatarEmoji(profile.avatar || '');
  const roleClass = getRoleClass(profile.role);
  const roleLabel = getRoleLabel(profile.role, profile.flags);
  const badgesHtml = buildProfileBadges(profile);
  const presenceHtml = renderPresenceChip(profile);
  const friendsCount = profile.friendsCount || 0;

  app.innerHTML = `
    ${profileStyles}
    ${buildProfileHeader(username, Boolean(currentUser), String(profile.username || profile.login || username))}
    <div class="profile-container">
      <div class="profile-header">
        <div class="profile-info">
          <div class="profile-avatar" id="profileAvatar">${avatarEmoji}</div>
          <div class="profile-details">
            <h1>
              ${escapeHtml(profile.username || profile.login || '')}
              ${
                profile.verified
                  ? '<span class="verified-badge" title="Verified"><svg class="verified-icon" style="width: 24px; height: 24px; display: inline-block;" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#3b82f6"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
                  : ''
              }
            </h1>
            <div class="profile-status-badges">
              <span class="chip status ${roleClass}" style="margin-right: 8px;">
                <span class="dot"></span> ${roleLabel}
              </span>
              ${presenceHtml}
              ${badgesHtml}
            </div>
            <p class="profile-joined">${t('На CybLight с')} ${createdAt}</p>
            <div class="profile-top-meta">
              <div class="profile-friends-pill" title="${t('Количество друзей')}">
                <span class="profile-friends-value">${friendsCount}</span>
                <span class="profile-friends-label">${t('друзей')}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-share">
          ${
            isSelf
              ? `
              <button class="btn btn-icon" type="button" data-route="edit-profile" title="${t('Редактирование профиля')}" aria-label="${t('Редактирование профиля')}">
                ✏️
              </button>
            `
              : ''
          }
          <button class="btn btn-icon" type="button" data-share-profile title="${t('Поделиться профилем')}" aria-label="${t('Поделиться профилем')}">
            🔗
          </button>
        </div>
      </div>

      ${actionButtons}

      <div class="profile-extra">
        <h3>${t('О себе')}</h3>
        ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
        ${profile.aboutMe ? `<p class="profile-about">${escapeHtml(profile.aboutMe)}</p>` : ''}
        ${
          profile.gender && profile.gender !== 'not_specified'
            ? `<p class="profile-gender">${t('Пол:')} ${profile.gender === 'male' ? t('Мужской') : t('Женский')}</p>`
            : ''
        }
        ${profile.dateOfBirth ? `<p class="profile-dob">${t('Дата рождения:')} ${new Date(profile.dateOfBirth).toLocaleDateString(localeTag(getLocale()))}</p>` : ''}
      </div>

      <div class="profile-content">
        <p>${t('Это профиль пользователя. Дополнительная информация скоро будет доступна.')}</p>
      </div>
    </div>
    ${buildProfileFooter()}
  `;

  bindProfileHeaderHandlers();

  bindProfileMirrorEaster(app.querySelector('#profileAvatar') as HTMLElement | null, {
    enabled: Boolean(isSelf && currentUser),
    username: String(profile.username || profile.login || username),
  });

  app.querySelectorAll('[data-profile-toast]').forEach((element) => {
    element.addEventListener('click', () => {
      const message = element.getAttribute('data-profile-toast');
      if (message) {
        showProfileToast(message);
      }
    });
  });

  const messageBtn = app.querySelector('[data-action="open-message"]') as HTMLButtonElement | null;
  if (messageBtn) {
    messageBtn.addEventListener('click', () => {
      const friendId = messageBtn.getAttribute('data-user-id') || '';
      const friendUsername = messageBtn.getAttribute('data-username') || '';
      if (!friendId || !friendUsername) return;
      sessionStorage.setItem('openChatWith', JSON.stringify({ friendId, username: friendUsername }));
      Router.navigate('account-messages');
    });
  }

  const shareBtn = app.querySelector('[data-share-profile]') as HTMLButtonElement | null;
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const url = window.location.href;
      navigator.clipboard
        .writeText(url)
        .then(() => {
          showProfileToast(t('Ссылка на Профиль скопирована'));
        })
        .catch(async () => {
          await showAppPrompt(t('Копируйте ссылку:'), url, {
            title: t('Поделиться профилем'),
          });
        });
    });
  }
}
