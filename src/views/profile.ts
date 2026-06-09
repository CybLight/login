/**
 * Public profile view - отображение профилей других пользователей
 */

import { apiCall, escapeHtml, renderPresenceChip } from '@/utils';
import { Router } from '@/router/Router';

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
    return 'Владелец';
  }
  if (normalizedRole === 'admin' || flagsArray.includes('admin')) {
    return 'Администратор';
  }
  if (normalizedRole === 'moderator' || flagsArray.includes('moderator')) {
    return 'Модератор';
  }
  if (normalizedRole === 'support' || flagsArray.includes('support')) {
    return 'Поддержка';
  }
  if (normalizedRole === 'registrar' || flagsArray.includes('registrar')) {
    return 'Регистратор';
  }
  if (normalizedRole === 'tester' || flagsArray.includes('tester')) {
    return 'Тестер';
  }
  if (normalizedRole === 'developer' || flagsArray.includes('developer')) {
    return 'Разработчик';
  }
  if (normalizedRole === 'vip' || flagsArray.includes('vip')) {
    return 'VIP';
  }
  if (normalizedRole === 'premium' || flagsArray.includes('premium')) {
    return 'Premium';
  }

  return 'Пользователь';
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
      '<span class="chip badge badge--ok" title="Двухфакторная аутентификация">2FA</span>'
    );
  }

  // Developer
  if (flags.includes('dev') || flags.includes('developer')) {
    badges.push('<span class="chip badge badge--dev" title="Разработчик">Dev</span>');
  }

  // Premium / Sponsor
  if (flags.includes('premium') || flags.includes('sponsor')) {
    badges.push('<span class="chip badge badge--premium" title="Premium">★</span>');
  }

  // Helper / Contributor
  if (flags.includes('helper') || flags.includes('contributor')) {
    badges.push('<span class="chip badge badge--info" title="Помощник">Helper</span>');
  }

  // Trusted
  if (flags.includes('trusted')) {
    badges.push('<span class="chip badge badge--ok" title="Доверенный">Trusted</span>');
  }

  // Beta
  if (flags.includes('beta')) {
    badges.push('<span class="chip badge badge--beta" title="Beta тестер">Beta</span>');
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

function buildProfileHeader(subtitle: string, isLoggedIn: boolean): string {
  const headerAction = isLoggedIn
    ? `
      <button
        type="button"
        class="account-burger"
        id="accountMenuToggle"
        aria-expanded="false"
        aria-controls="accountSidebar"
        aria-label="Открыть меню"
      >
        <span></span><span></span><span></span>
      </button>
    `
    : `
      <button type="button" class="account-mobile-header__signin" id="profileSigninBtn" aria-label="Войти">
        Войти
      </button>
    `;

  const navHtml = isLoggedIn
    ? `
      <div class="account-nav-overlay" id="accountNavOverlay" aria-hidden="true"></div>
      <aside class="account-sidebar profile-mobile-nav" id="accountSidebar">
        <nav class="account-nav">
          <button data-tab="profile" type="button" aria-label="👤 Профиль"><span class="nav-icon">👤</span> Профиль</button>
          <button data-tab="friends" type="button" aria-label="👥 Друзья"><span class="nav-icon">👥</span> Друзья</button>
          <button data-tab="messages" type="button" aria-label="💬 Сообщения"><span class="nav-icon">💬</span> Сообщения</button>
          <button data-tab="security" type="button" aria-label="🛡️ Безопасность"><span class="nav-icon">🛡️</span> Безопасность</button>
          <button data-tab="sessions" type="button" aria-label="🧩 Сессии"><span class="nav-icon">🧩</span> Сессии</button>
          <button data-tab="easter" type="button" aria-label="🍓 Пасхалки"><span class="nav-icon">🍓</span> Пасхалки</button>
        </nav>
        <div class="account-actions">
          <button class="btn btn-primary" id="profileLogoutBtn" type="button" aria-label="Выйти">Выйти</button>
        </div>
      </aside>
    `
    : '';

  return `
    <header class="account-mobile-header" aria-label="Профиль пользователя">
      <div class="account-mobile-header__inner">
        <a href="https://cyblight.org/" class="account-mobile-header__logo" aria-label="Главная страница">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </a>
        <div class="account-mobile-header__info">
          <div class="account-mobile-header__title">Профиль</div>
          <div class="account-mobile-header__login">${escapeHtml(subtitle)}</div>
        </div>
        ${headerAction}
      </div>
    </header>
    ${navHtml}
  `;
}

function bindProfileHeaderHandlers(): void {
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
    menuToggle.setAttribute('aria-label', 'Открыть меню');
    overlay?.setAttribute('aria-hidden', 'true');
  };

  const openNav = () => {
    document.body.classList.add('account-nav-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Закрыть меню');
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
      <p>Загрузка профиля...</p>
    </div>
  `;

  document.body.classList.remove('account-nav-open');

  const [profile, currentUser] = await Promise.all([loadProfile(username), getCurrentUser()]);

  if (!profile) {
    app.innerHTML = `
      ${profileStyles}
      ${buildProfileHeader(username, Boolean(currentUser))}
      <div class="profile-notfound">
        <h1>Профиль не найден</h1>
        <p>Пользователь <strong>${escapeHtml(username)}</strong> не существует</p>
        <button class="btn btn-primary" type="button" data-route="username" aria-label="Вернуться">Вернуться</button>
      </div>
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
      ).toLocaleDateString('ru-RU', {
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
          <button class="btn btn-primary" type="button" data-profile-toast="Сообщения скоро будут доступны" aria-label="💬 Написать сообщение">
            💬 Написать сообщение
          </button>
          <button class="btn btn-secondary" type="button" data-profile-toast="Удаление из друзей скоро будет доступно" aria-label="✕ Удалить из друзей">
            ✕ Удалить из друзей
          </button>
        </div>
      `;
    } else if (friendStatus === 'pending') {
      actionButtons = `
        <div class="profile-actions">
          <button class="btn btn-secondary" disabled aria-label="⏳ Запрос на добавление отправлен">
            ⏳ Запрос на добавление отправлен
          </button>
        </div>
      `;
    } else {
      actionButtons = `
        <div class="profile-actions">
          <button class="btn btn-primary" type="button" data-profile-toast="Добавление в друзья скоро будет доступно" aria-label="➕ Добавить в друзья">
            ➕ Добавить в друзья
          </button>
        </div>
      `;
    }
  } else {
    actionButtons = `
      <div class="profile-actions">
        <p style="color: #999; font-size: 0.9em;">Войдите, чтобы добавить в друзья</p>
      </div>
    `;
  }

  const avatarEmoji = getAvatarEmoji(profile.avatar || '');
  const roleClass = getRoleClass(profile.role);
  const roleLabel = getRoleLabel(profile.role, profile.flags);
  const badgesHtml = buildProfileBadges(profile);
  const presenceHtml = renderPresenceChip(profile);
  const friendsCount = profile.friendsCount || 0;

  app.innerHTML = `
    ${profileStyles}
    ${buildProfileHeader(String(profile.username || profile.login || username), Boolean(currentUser))}
    <div class="profile-container">
      <div class="profile-header">
        <div class="profile-info">
          <div class="profile-avatar">${avatarEmoji}</div>
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
            <p class="profile-joined">На CybLight с ${createdAt}</p>
            <div class="profile-top-meta">
              <div class="profile-friends-pill" title="Количество друзей">
                <span class="profile-friends-value">${friendsCount}</span>
                <span class="profile-friends-label">друзей</span>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-share">
          ${
            isSelf
              ? `
              <button class="btn btn-icon" type="button" data-route="edit-profile" title="Редактирование профиля" aria-label="Редактирование профиля">
                ✏️
              </button>
            `
              : ''
          }
          <button class="btn btn-icon" type="button" data-share-profile title="Поделиться профилем" aria-label="Поделиться профилем">
            🔗
          </button>
        </div>
      </div>

      ${actionButtons}

      <div class="profile-extra">
        <h3>О себе</h3>
        ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
        ${profile.aboutMe ? `<p class="profile-about">${escapeHtml(profile.aboutMe)}</p>` : ''}
        ${
          profile.gender && profile.gender !== 'not_specified'
            ? `<p class="profile-gender">Пол: ${profile.gender === 'male' ? 'Мужской' : 'Женский'}</p>`
            : ''
        }
        ${profile.dateOfBirth ? `<p class="profile-dob">Дата рождения: ${new Date(profile.dateOfBirth).toLocaleDateString('ru-RU')}</p>` : ''}
      </div>

      <div class="profile-content">
        <p>Это профиль пользователя. Дополнительная информация скоро будет доступна.</p>
      </div>
    </div>
  `;

  bindProfileHeaderHandlers();

  app.querySelectorAll('[data-profile-toast]').forEach((element) => {
    element.addEventListener('click', () => {
      const message = element.getAttribute('data-profile-toast');
      if (message) {
        showProfileToast(message);
      }
    });
  });

  const shareBtn = app.querySelector('[data-share-profile]') as HTMLButtonElement | null;
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const url = window.location.href;
      navigator.clipboard
        .writeText(url)
        .then(() => {
          showProfileToast('Ссылка на Профиль скопирована');
        })
        .catch(() => {
          window.prompt('Копируйте ссылку:', url);
        });
    });
  }
}
