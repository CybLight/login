// ===== PROFILE RENDERING =====

// Стандартные аватары
const AVATAR_EMOJI_MAP = {
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
  // Эксклюзивные аватары
  'avatar-crown': '👑',
  'avatar-shield': '🛡️',
  'avatar-code': '💻',
  'avatar-verified': '✔️',
  'avatar-fire': '🔥',
  'avatar-star': '⭐',
  'avatar-robot': '🤖',
  'avatar-diamond': '💎',
};

function getAvatarEmoji(avatarId) {
  return AVATAR_EMOJI_MAP[avatarId] || '👤';
}

// Функции для отображения ролей и статусов
function getRoleClass(role) {
  const roleMap = {
    'admin': 'status--admin',
    'moderator': 'status--mod',
    'developer': 'status--dev',
    'verified': 'status--verified',
    'vip': 'status--premium',
    'premium': 'status--premium',
  };
  return roleMap[role] || 'status--active';
}

function getRoleLabel(role, flags) {
  const flagsArray = flags || [];
  
  if (role === 'admin' || flagsArray.includes('admin')) {
    return 'Администратор';
  }
  if (role === 'moderator' || flagsArray.includes('moderator')) {
    return 'Модератор';
  }
  if (role === 'developer' || flagsArray.includes('developer')) {
    return 'Разработчик';
  }
  if (role === 'vip' || flagsArray.includes('vip')) {
    return 'VIP';
  }
  if (role === 'premium' || flagsArray.includes('premium')) {
    return 'Premium';
  }
  
  return 'Пользователь';
}

function buildProfileBadges(profile) {
  const badges = [];
  const flags = profile.flags || [];
  
  // 2FA
  if (profile.twoFactorEnabled || flags.includes('2fa')) {
    badges.push('<span class="chip badge badge--ok" title="Двухфакторная аутентификация">2FA</span>');
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

const profileModule = (() => {
  async function loadProfile(username) {
    try {
      console.log(
        '[PROFILE] loadProfile: fetching',
        `${API_BASE}/api/profile/${encodeURIComponent(username)}`
      );
      const response = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(username)}`);

      console.log('[PROFILE] loadProfile: response status', response.status, response.ok);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      console.log('[PROFILE] loadProfile: data', data);
      return data.ok ? data.profile : null;
    } catch (error) {
      console.error('[PROFILE] Error loading profile:', error);
      return null;
    }
  }

  async function getCurrentUser() {
    try {
      console.log('[PROFILE] getCurrentUser: fetching', `${API_BASE}/auth/me`);
      const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });

      console.log('[PROFILE] getCurrentUser: response status', response.status, response.ok);

      if (!response.ok) {
        console.log('[PROFILE] getCurrentUser: not authorized, returning null');
        return null;
      }

      const data = await response.json();
      console.log('[PROFILE] getCurrentUser: data', data);
      return data.ok ? data.user : null;
    } catch (error) {
      console.error('[PROFILE] Error loading current user:', error);
      return null;
    }
  }

  async function getFriendshipStatus(friendId) {
    try {
      console.log('[PROFILE] getFriendshipStatus: fetching for', friendId);
      const response = await fetch(`${API_BASE}/api/friends/status/${friendId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        console.log('[PROFILE] getFriendshipStatus: not authorized or not found');
        return null;
      }

      const data = await response.json();
      console.log('[PROFILE] getFriendshipStatus: data', data);
      return data.ok ? data.status : null;
    } catch (error) {
      console.error('[PROFILE] Error getting friendship status:', error);
      return null;
    }
  }

  async function addFriend(friendUsername) {
    try {
      console.log('[PROFILE] addFriend: adding', friendUsername);
      const response = await fetch(`${API_BASE}/api/friends/add`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendUsername }),
      });

      const data = await response.json();
      console.log('[PROFILE] addFriend: response', data);
      return data.ok;
    } catch (error) {
      console.error('[PROFILE] Error adding friend:', error);
      return false;
    }
  }

  async function removeFriend(friendId) {
    try {
      console.log('[PROFILE] removeFriend: removing', friendId);
      const response = await fetch(`${API_BASE}/api/friends/remove`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });

      const data = await response.json();
      console.log('[PROFILE] removeFriend: response', data);
      return data.ok;
    } catch (error) {
      console.error('[PROFILE] Error removing friend:', error);
      return false;
    }
  }

  function shareProfile(username) {
    const url = `${window.location.origin}/${username}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        showNotification('Профиль скопирован в буфер обмена');
      })
      .catch(() => {
        // Fallback: показываем URL
        const text = prompt('Копируйте ссылку:', url);
      });
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  async function renderProfile(username) {
    console.log('[PROFILE] renderProfile called with username:', username);
    // Отключаем клубничный фон при просмотре профиля
    setNoStrawberries(true);

    const app = document.getElementById('app');

    // Показываем загрузку
    app.innerHTML = `
      <div class="profile-loading">
        <div class="spinner"></div>
        <p>Загрузка профиля...</p>
      </div>
    `;

    const profile = await loadProfile(username);
    console.log('[PROFILE] Profile loaded:', profile);

    const currentUser = await getCurrentUser();
    console.log('[PROFILE] Current user:', currentUser);

    if (!profile) {
      app.innerHTML = `
        <div class="profile-notfound">
          <h1>Профиль не найден</h1>
          <p>Пользователь <strong>${escapeHtml(username)}</strong> не существует</p>
          <button onclick="CybRouter.navigate('username')">Вернуться</button>
        </div>
      `;
      return;
    }

    let friendStatus = null;
    let isSelf = false;

    if (currentUser) {
      console.log('[PROFILE] User is logged in');
      isSelf = currentUser.id === profile.id;
      if (!isSelf) {
        friendStatus = await getFriendshipStatus(profile.id);
      }
    } else {
      console.log('[PROFILE] User is not logged in (anonymous)');
    }

    const formattedDate = new Date(profile.createdAt).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let actionButtons = '';

    if (isSelf) {
      // Для своего профиля не показываем кнопки действий в этом блоке
      actionButtons = '';
    } else if (currentUser) {
      if (friendStatus === 'accepted') {
        actionButtons = `
          <div class="profile-actions">
            <button class="btn btn-primary" onclick="profileModule.sendMessage('${profile.id}', '${escapeHtml(profile.username)}')">
              💬 Написать сообщение
            </button>
            <button class="btn btn-secondary" onclick="profileModule.removeFriendAction('${profile.id}')">
              ✕ Удалить из друзей
            </button>
          </div>
        `;
      } else if (friendStatus === 'pending') {
        actionButtons = `
          <div class="profile-actions">
            <button class="btn btn-secondary" disabled>
              ⏳ Запрос на добавление отправлен
            </button>
          </div>
        `;
      } else {
        actionButtons = `
          <div class="profile-actions">
            <button class="btn btn-primary" onclick="profileModule.addFriendAction('${profile.username}')">
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

    app.innerHTML = `
      <div class="profile-container">
        <div class="profile-header">
          <div class="profile-info">
            <div class="profile-avatar">${profile.avatar ? getAvatarEmoji(profile.avatar) : '👤'}</div>
            <div class="profile-details">
              <h1>
                ${escapeHtml(profile.username)}
                ${profile.verified ? '<span class="verified-badge" title="Verified"><svg class="verified-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#3b82f6"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' : ''}
              </h1>
              <div class="profile-status-badges">
                <span class="chip status ${getRoleClass(profile.role)}" style="margin-right: 8px;">
                  <span class="dot"></span> ${getRoleLabel(profile.role, profile.flags)}
                </span>
                ${buildProfileBadges(profile)}
              </div>
              <p class="profile-joined">На CybLight с ${formattedDate}</p>
              ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
              ${profile.aboutMe ? `<p class="profile-about">${escapeHtml(profile.aboutMe)}</p>` : ''}
              ${profile.gender && profile.gender !== 'not_specified' ? `<p class="profile-gender">Пол: ${profile.gender === 'male' ? 'Мужской' : 'Женский'}</p>` : ''}
              ${profile.dateOfBirth ? `<p class="profile-dob">Дата рождения: ${new Date(profile.dateOfBirth).toLocaleDateString('ru-RU')}</p>` : ''}
              <div class="profile-stats">
                <div class="stat">
                  <span class="stat-value">${profile.friendsCount}</span>
                  <span class="stat-label">друзей</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="profile-share">
            ${
              isSelf
                ? `
            <button class="btn btn-icon" onclick="CybRouter.navigate('edit-profile')" title="Редактирование профиля">
              ✏️
            </button>
            `
                : ''
            }
            <button class="btn btn-icon" onclick="profileModule.shareProfile('${escapeHtml(profile.username)}')" title="Поделиться профилем">
              🔗
            </button>
          </div>
        </div>

        ${actionButtons}

        <div class="profile-content">
          <p>Это профиль пользователя. Дополнительная информация скоро будет доступна.</p>
        </div>
      </div>
    `;

    // Добавляем стили
    addProfileStyles();
  }

  function addProfileStyles() {
    let style = document.getElementById('profile-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'profile-styles';
      style.textContent = `
        .profile-container {
          max-width: 800px;
          margin: 30px auto;
          padding: 20px;
        }

        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .profile-info {
          display: flex;
          gap: 20px;
          flex: 1;
        }

        .profile-avatar,
        .profile-avatar-placeholder {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
        }

        .profile-details {
          flex: 1;
        }

        .profile-details h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          animation: verifiedPulse 2s ease-in-out infinite;
        }

        .verified-icon {
          width: 24px;
          height: 24px;
          filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.6));
          animation: verifiedRotate 3s ease-in-out infinite;
        }

        @keyframes verifiedPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes verifiedRotate {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(-10deg); }
          20% { transform: rotate(10deg); }
          30% { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }

        .profile-joined {
          color: #999;
          font-size: 14px;
          margin: 5px 0;
        }

        .profile-bio {
          margin: 10px 0 0 0;
          color: #ccc;
          line-height: 1.5;
        }

        .profile-about {
          margin: 10px 0 0 0;
          color: #aaa;
          line-height: 1.6;
          font-size: 14px;
        }

        .profile-gender,
        .profile-dob {
          margin: 8px 0 0 0;
          color: #999;
          font-size: 13px;
        }

        .profile-stats {
          display: flex;
          gap: 30px;
          margin-top: 15px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
        }

        .stat-label {
          font-size: 12px;
          color: #999;
          margin-top: 2px;
        }

        .profile-share {
          margin-top: 10px;
        }

        .profile-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 30px;
          flex-wrap: wrap;
          align-items: center;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #4CAF50;
          color: white;
        }

        .btn-primary:hover {
          background: #45a049;
        }

        .btn-primary:disabled {
          background: #666;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-icon {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          font-size: 16px;
        }

        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .profile-loading,
        .profile-notfound {
          text-align: center;
          padding: 60px 20px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 20px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: #4CAF50;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .notification {
          transition: opacity 0.3s ease-out;
        }

        .profile-content {
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        .profile-status-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        /* Chip styles for status and badges */
        .chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid;
        }

        .chip.status {
          padding: 5px 12px;
        }

        .chip .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-right: 6px;
          background: currentColor;
        }

        /* Status colors */
        .status--admin {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #fca5a5;
        }

        .status--mod {
          background: rgba(59, 130, 246, 0.2);
          border-color: #3b82f6;
          color: #93c5fd;
        }

        .status--dev {
          background: rgba(139, 92, 246, 0.2);
          border-color: #8b5cf6;
          color: #c4b5fd;
        }

        .status--verified {
          background: rgba(34, 197, 94, 0.2);
          border-color: #22c55e;
          color: #86efac;
        }

        .status--premium {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.2));
          border-color: #f59e0b;
          color: #fcd34d;
        }

        .status--active {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.4);
          color: #86efac;
        }

        /* Badge colors */
        .badge--ok {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.4);
          color: #86efac;
        }

        .badge--verified {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
          color: #93c5fd;
        }

        .badge--dev {
          background: rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.4);
          color: #c4b5fd;
        }

        .badge--premium {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15));
          border-color: #f59e0b;
          color: #fcd34d;
        }

        .badge--info {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
          color: #93c5fd;
        }

        .badge--beta {
          background: rgba(168, 85, 247, 0.15);
          border-color: rgba(168, 85, 247, 0.4);
          color: #d8b4fe;
        }

        @media (max-width: 600px) {
          .profile-header {
            flex-direction: column;
          }

          .profile-avatar,
          .profile-avatar-placeholder {
            width: 100px;
            height: 100px;
          }

          .profile-details h1 {
            font-size: 22px;
          }

          .profile-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
            text-align: center;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  return {
    renderProfile,
    addFriendAction: async function (username) {
      const button = event.target;
      button.disabled = true;
      button.textContent = 'Добавление...';

      const success = await addFriend(username);

      if (success) {
        button.textContent = '⏳ Запрос на добавление отправлен';
        showNotification('Запрос на добавление отправлен');
      } else {
        button.disabled = false;
        button.textContent = '➕ Добавить в друзья';
        showNotification('Ошибка при добавлении в друзья');
      }
    },
    removeFriendAction: async function (friendId) {
      if (!confirm('Вы уверены?')) return;

      const success = await removeFriend(friendId);

      if (success) {
        location.reload();
      } else {
        showNotification('Ошибка при удалении из друзей');
      }
    },
    sendMessage: function (friendId, username) {
      // Сохраняем данные для автоматического открытия чата
      sessionStorage.setItem('openChatWith', JSON.stringify({ friendId, username }));
      // Редирект на страницу сообщений
      CybRouter.navigate('account-messages');
    },
    shareProfile,
  };
})();
