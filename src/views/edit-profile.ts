/**
 * Edit Profile View - страница редактирования профиля
 */

import { t, localeTag, getLocale } from '@/i18n';
import { buildAuthFooter } from '@/ui/auth-footer';
import { apiCall, escapeHtml } from '@/utils';
import { Router } from '@/router/Router';

interface EditableProfile {
  id?: string;
  username?: string;
  avatar?: string;
  avatarUrl?: string;
  bio?: string;
  aboutMe?: string;
  gender?: string;
  dateOfBirth?: string;
  canChangeUsername?: boolean;
  usernameChangedAt?: number;
  role?: string;
  flags?: string[];
  privacy?: {
    avatar?: string;
    bio?: string;
    about?: string;
    gender?: string;
    dob?: string;
  };
}

// Доступные аватары
const STANDARD_AVATARS = [
  { id: 'avatar-cat', emoji: '🐱', label: 'Кот' },
  { id: 'avatar-dog', emoji: '🐶', label: 'Пёс' },
  { id: 'avatar-fox', emoji: '🦊', label: 'Лиса' },
  { id: 'avatar-bear', emoji: '🐻', label: 'Медведь' },
  { id: 'avatar-panda', emoji: '🐼', label: 'Панда' },
  { id: 'avatar-rabbit', emoji: '🐰', label: 'Кролик' },
  { id: 'avatar-owl', emoji: '🦉', label: 'Сова' },
  { id: 'avatar-penguin', emoji: '🐧', label: 'Пингвин' },
  { id: 'avatar-koala', emoji: '🐨', label: 'Коала' },
  { id: 'avatar-tiger', emoji: '🐯', label: 'Тигр' },
];

const EXCLUSIVE_AVATARS = [
  { id: 'avatar-crown', emoji: '👑', label: 'Корона' },
  { id: 'avatar-shield', emoji: '🛡️', label: 'Щит' },
  { id: 'avatar-code', emoji: '💻', label: 'Код' },
  { id: 'avatar-verified', emoji: '✔️', label: 'Верифицирован' },
  { id: 'avatar-fire', emoji: '🔥', label: 'Огонь' },
  { id: 'avatar-star', emoji: '⭐', label: 'Звезда' },
  { id: 'avatar-robot', emoji: '🤖', label: 'Робот' },
  { id: 'avatar-diamond', emoji: '💎', label: 'Алмаз' },
];

/**
 * Загрузить профиль для редактирования
 */
async function loadEditableProfile(): Promise<EditableProfile | null> {
  try {
    let response = await apiCall('/profile/me');

    // Если эндпоинт не найден, используем fallback
    if (response.status === 404) {
      const meResponse = await apiCall('/auth/me');
      if (!meResponse.ok) {
        return null;
      }
      const meData = await meResponse.json();
      if (!meData.ok || !meData.user?.login) {
        return null;
      }

      const username = meData.user.login;
      response = await apiCall(`/profile/${username}`);
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.ok) {
      console.log('Profile loaded:', {
        canChangeUsername: data.profile?.canChangeUsername,
        usernameChangedAt: data.profile?.usernameChangedAt,
        username: data.profile?.username,
      });
      return data.profile;
    }
    return null;
  } catch (error) {
    console.error('Error loading profile for editing:', error);
    return null;
  }
}

/**
 * Проверить доступность username
 */
async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  try {
    const response = await apiCall(`/profile/check-username/${encodeURIComponent(username)}`);
    const data = await response.json();
    return {
      available: data.ok && data.available,
      reason: data.reason,
    };
  } catch (error) {
    console.error('Error checking username:', error);
    return { available: false, reason: t('Ошибка проверки') };
  }
}

/**
 * Обновить профиль
 */
async function updateProfile(
  updateData: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await apiCall('/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();
    return {
      ok: response.ok && data.ok,
      error: data.error,
    };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { ok: false, error: t('Ошибка при обновлении профиля') };
  }
}

/**
 * Проверить доступность эксклюзивного аватара
 */
function canUseExclusiveAvatar(profile: EditableProfile, avatarId: string): boolean {
  const flags = profile.flags || [];
  const role = profile.role || '';

  // Корона - для админов
  if (avatarId === 'avatar-crown') {
    return role === 'admin' || flags.includes('admin');
  }

  // Щит - для модераторов
  if (avatarId === 'avatar-shield') {
    return role === 'moderator' || flags.includes('moderator');
  }

  // Код - для разработчиков
  if (avatarId === 'avatar-code') {
    return role === 'developer' || flags.includes('developer') || flags.includes('dev');
  }

  // Верифицирован - для верифицированных
  if (avatarId === 'avatar-verified') {
    return flags.includes('verified');
  }

  // Огонь - для VIP
  if (avatarId === 'avatar-fire') {
    return role === 'vip' || flags.includes('vip');
  }

  // Звезда - для выдающихся
  if (avatarId === 'avatar-star') {
    return flags.includes('outstanding');
  }

  // Робот - для ботов
  if (avatarId === 'avatar-robot') {
    return flags.includes('bot');
  }

  // Алмаз - для premium
  if (avatarId === 'avatar-diamond') {
    return role === 'premium' || flags.includes('premium') || flags.includes('sponsor');
  }

  return false;
}

/**
 * Отрисовать страницу редактирования профиля
 */
export async function renderEditProfile(): Promise<void> {
  // Показываем фон без клубники
  document.body.classList.add('no-strawberries');

  const app = document.getElementById('app') || document.body;

  // Показываем загрузку
  app.innerHTML = `
    <div class="profile-loading">
      <div class="spinner"></div>
      <p>${t('Загрузка...')}</p>
    </div>
  `;

  const profile = await loadEditableProfile();

  if (!profile) {
    app.innerHTML = `
      <div class="profile-notfound">
        <h1>${t('Ошибка загрузки')}</h1>
        <p>${t('Не удалось загрузить профиль для редактирования')}</p>
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
          <button class="btn btn-primary" type="button" data-reload aria-label="${t('Обновить страницу')}">${t('Обновить страницу')}</button>
          <button class="btn btn-secondary" type="button" data-route="account-profile" aria-label="${t('Вернуться в профиль')}">${t('Вернуться в профиль')}</button>
        </div>
      </div>
    `;
    return;
  }

  // Убедимся, что все поля есть
  if (!profile.privacy) {
    profile.privacy = {
      gender: 'friends',
      dob: 'friends',
      about: 'everyone',
      avatar: 'everyone',
      bio: 'everyone',
    };
  }

  // Определяем доступные аватары
  const availableExclusiveAvatars = EXCLUSIVE_AVATARS.filter((avatar) =>
    canUseExclusiveAvatar(profile, avatar.id)
  );

  const allAvatars = [...STANDARD_AVATARS, ...availableExclusiveAvatars];

  const avatarOptionsHtml = allAvatars
    .map(
      (avatar) => `
    <div class="avatar-option ${profile.avatar === avatar.id ? 'selected' : ''}" 
         data-avatar="${avatar.id}"
         title="${t(avatar.label)}">
      <div class="avatar-badge">${avatar.emoji}</div>
    </div>
  `
    )
    .join('');

  let selectedAvatar = profile.avatar || 'avatar-cat';

  // Получаем текущие значения для отображения
  const currentAvatar = allAvatars.find((a) => a.id === profile.avatar);
  const currentAvatarEmoji = currentAvatar?.emoji || '👤';
  const currentBio = profile.bio
    ? profile.bio.length > 40
      ? profile.bio.substring(0, 40) + '...'
      : profile.bio
    : t('Не указано');
  const currentAboutMe = profile.aboutMe
    ? profile.aboutMe.length > 40
      ? profile.aboutMe.substring(0, 40) + '...'
      : profile.aboutMe
    : t('Не указано');
  const currentGender =
    profile.gender === 'male'
      ? t('Мужской')
      : profile.gender === 'female'
        ? t('Женский')
        : t('Не указано');
  const currentDob = profile.dateOfBirth
    ? new Date(profile.dateOfBirth).toLocaleDateString(localeTag(getLocale()))
    : t('Не указано');

  app.innerHTML = `
    <div class="edit-profile-page">
    <div class="edit-profile-container">
      <div class="edit-profile-header">
        <button class="btn-back" type="button" data-route="account-profile" aria-label="${t('← Назад')}">${t('← Назад')}</button>
        <h1>✏️ ${t('Редактирование профиля')}</h1>
      </div>
      
      <div class="edit-profile-content">
        <div id="editProfileMsg" class="msg" style="display:none;"></div>
        
        <!-- Username Section -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <h2>👤 ${t('Имя пользователя')}</h2>
              <span class="current-value">${escapeHtml(profile.username || '')}</span>
            </div>
            <button class="btn-accordion" data-section="username" aria-label="${t('Изменить')}">${t('Изменить')}</button>
          </div>
          <div class="accordion-content" id="section-username" style="display:none;">
            <div class="username-field">
              <input 
                type="text" 
                id="usernameInput" 
                class="input username-input" 
                value="${escapeHtml(profile.username || '')}" 
                ${profile.canChangeUsername ? '' : 'disabled'}
                placeholder="${t('Введите новое имя пользователя')}"
              />
              <button id="checkUsernameBtn" class="btn btn-secondary btn-check-username" ${profile.canChangeUsername ? '' : 'disabled'} aria-label="${t('Проверить')}">
                ${t('Проверить')}
              </button>
            </div>
            <div id="usernameHint" class="field-hint">
              ${
                profile.canChangeUsername
                  ? t('3-20 символов: буквы, цифры, _ или -')
                  : profile.usernameChangedAt
                    ? t('Можно изменить через {days} дней', {
                        days: Math.ceil(
                          (30 * 24 * 60 * 60 * 1000 - (Date.now() - profile.usernameChangedAt)) /
                            (24 * 60 * 60 * 1000)
                        ),
                      })
                    : t('Изменение временно недоступно')
              }
            </div>
          </div>
        </div>
        
        <!-- Avatar Section -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <h2>🎨 ${t('Аватар')}</h2>
              <span class="current-value">${currentAvatarEmoji}</span>
            </div>
            <button class="btn-accordion" data-section="avatar" aria-label="${t('Изменить')}">${t('Изменить')}</button>
          </div>
          <div class="accordion-content" id="section-avatar" style="display:none;">
            <div class="avatar-grid">
              ${avatarOptionsHtml}
            </div>
            <div class="privacy-setting">
              <label>${t('Кому видно:')}</label>
              <select id="privacyAvatar" class="input">
                <option value="everyone" ${profile.privacy.avatar === 'everyone' ? 'selected' : ''}>${t('Всем')}</option>
                <option value="friends" ${profile.privacy.avatar === 'friends' ? 'selected' : ''}>${t('Только друзьям')}</option>
                <option value="nobody" ${profile.privacy.avatar === 'nobody' ? 'selected' : ''}>${t('Никому')}</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Bio Section -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <h2>✍️ ${t('О себе (кратко)')}</h2>
              <span class="current-value">${escapeHtml(currentBio)}</span>
            </div>
            <button class="btn-accordion" data-section="bio" aria-label="${t('Изменить')}">${t('Изменить')}</button>
          </div>
          <div class="accordion-content" id="section-bio" style="display:none;">
            <textarea 
              id="bioInput" 
              class="input" 
              maxlength="500" 
              rows="3" 
              placeholder="${t('Расскажите о себе кратко...')}"
            >${profile.bio || ''}</textarea>
            <div class="field-hint">${t('До 500 символов')}</div>
            <div class="privacy-setting">
              <label>${t('Кому видно:')}</label>
              <select id="privacyBio" class="input">
                <option value="everyone" ${profile.privacy.bio === 'everyone' ? 'selected' : ''}>${t('Всем')}</option>
                <option value="friends" ${profile.privacy.bio === 'friends' ? 'selected' : ''}>${t('Только друзьям')}</option>
                <option value="nobody" ${profile.privacy.bio === 'nobody' ? 'selected' : ''}>${t('Никому')}</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- About Me Section -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <h2>📖 ${t('О себе (подробно)')}</h2>
              <span class="current-value">${escapeHtml(currentAboutMe)}</span>
            </div>
            <button class="btn-accordion" data-section="about" aria-label="${t('Изменить')}">${t('Изменить')}</button>
          </div>
          <div class="accordion-content" id="section-about" style="display:none;">
            <textarea 
              id="aboutMeInput" 
              class="input" 
              maxlength="1000" 
              rows="5" 
              placeholder="${t('Расскажите о себе подробнее...')}"
            >${profile.aboutMe || ''}</textarea>
            <div class="field-hint">${t('До 1000 символов')}</div>
            <div class="privacy-setting">
              <label>${t('Кому видно:')}</label>
              <select id="privacyAbout" class="input">
                <option value="everyone" ${profile.privacy.about === 'everyone' ? 'selected' : ''}>${t('Всем')}</option>
                <option value="friends" ${profile.privacy.about === 'friends' ? 'selected' : ''}>${t('Только друзьям')}</option>
                <option value="nobody" ${profile.privacy.about === 'nobody' ? 'selected' : ''}>${t('Никому')}</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Gender Section -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <h2>⚥️ ${t('Пол')}</h2>
              <span class="current-value">${escapeHtml(currentGender)}</span>
            </div>
            <button class="btn-accordion" data-section="gender" aria-label="${t('Изменить')}">${t('Изменить')}</button>
          </div>
          <div class="accordion-content" id="section-gender" style="display:none;">
            <select id="genderInput" class="input">
              <option value="not_specified" ${profile.gender === 'not_specified' || !profile.gender ? 'selected' : ''}>${t('Не указано')}</option>
              <option value="male" ${profile.gender === 'male' ? 'selected' : ''}>${t('Мужской')}</option>
              <option value="female" ${profile.gender === 'female' ? 'selected' : ''}>${t('Женский')}</option>
            </select>
            <div class="privacy-setting">
              <label>${t('Кому видно:')}</label>
              <select id="privacyGender" class="input">
                <option value="everyone" ${profile.privacy.gender === 'everyone' ? 'selected' : ''}>${t('Всем')}</option>
                <option value="friends" ${profile.privacy.gender === 'friends' ? 'selected' : ''}>${t('Только друзьям')}</option>
                <option value="nobody" ${profile.privacy.gender === 'nobody' ? 'selected' : ''}>${t('Никому')}</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Date of Birth Section -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <h2>🎂 ${t('Дата рождения')}</h2>
              <span class="current-value">${escapeHtml(currentDob)}</span>
            </div>
            <button class="btn-accordion" data-section="dob" aria-label="${t('Изменить')}">${t('Изменить')}</button>
          </div>
          <div class="accordion-content" id="section-dob" style="display:none;">
            <input 
              type="date" 
              id="dobInput" 
              class="input" 
              value="${profile.dateOfBirth || ''}"
            />
            <div class="privacy-setting">
              <label>${t('Кому видно:')}</label>
              <select id="privacyDob" class="input">
                <option value="everyone" ${profile.privacy.dob === 'everyone' ? 'selected' : ''}>${t('Всем')}</option>
                <option value="friends" ${profile.privacy.dob === 'friends' ? 'selected' : ''}>${t('Только друзьям')}</option>
                <option value="nobody" ${profile.privacy.dob === 'nobody' ? 'selected' : ''}>${t('Никому')}</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="edit-actions">
          <button id="saveProfileBtn" class="btn btn-primary" aria-label="${t('💾 Сохранить изменения')}">${t('💾 Сохранить изменения')}</button>
          <button class="btn btn-secondary" type="button" data-route="account-profile" aria-label="${t('Отмена')}">${t('Отмена')}</button>
        </div>
      </div>
    </div>
    ${buildAuthFooter({ showLangSwitcher: false })}
    </div>
  `;

  // Добавляем стили
  addEditProfileStyles();

  // Инициализируем обработчики
  initAccordions();

  // Создаем замыкание для выбора аватара
  const getSelectedAvatar = () => selectedAvatar;
  const setSelectedAvatar = (avatarId: string) => {
    selectedAvatar = avatarId;
  };

  initAvatarSelection(setSelectedAvatar);
  initUsernameCheck(profile);
  initSaveProfile(profile, getSelectedAvatar);
}

/**
 * Добавить стили для страницы редактирования
 */
function addEditProfileStyles(): void {
  if (document.getElementById('edit-profile-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'edit-profile-styles';
  style.textContent = `
    .edit-profile-page {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }

    .edit-profile-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      flex: 1 0 auto;
    }
    
    .edit-profile-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 30px;
    }
    
    .edit-profile-header h1 {
      margin: 0;
      font-size: 28px;
    }
    
    .btn-back {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: var(--text, #fff);
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-back:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }
    
    .edit-profile-content {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
    }
    
    .accordion-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      margin-bottom: 15px;
      overflow: hidden;
      transition: all 0.3s;
    }
    
    .accordion-item:hover {
      border-color: rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.05);
    }
    
    .accordion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      gap: 16px;
    }
    
    .accordion-header-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-width: 0;
      padding-right: 16px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .accordion-header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
    }
    
    .current-value {
      color: rgba(255, 255, 255, 0.55);
      font-size: 13px;
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-style: italic;
      padding-left: 2px;
    }
    
    .btn-accordion {
      background: rgba(76, 175, 80, 0.2);
      border: 1px solid rgba(76, 175, 80, 0.4);
      color: #4CAF50;
      padding: 3px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
      font-weight: 500;
    }
    
    .btn-accordion:hover {
      background: rgba(76, 175, 80, 0.3);
      border-color: rgba(76, 175, 80, 0.6);
    }
    
    .btn-accordion.active {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.4);
      color: #ef4444;
    }
    
    .accordion-content {
      padding: 0 16px 16px;
      animation: slideDown 0.3s ease-out;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .username-field {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .username-input {
      width: 100%;
      padding: 12px 14px;
      font-size: 15px;
    }
    
    .btn-check-username {
      width: 100%;
      padding: 10px 14px;
      font-size: 14px;
      background: rgba(59, 130, 246, 0.2) !important;
      border: 1px solid rgba(59, 130, 246, 0.4) !important;
      color: #93c5fd !important;
      font-weight: 500;
    }
    
    .btn-check-username:hover:not(:disabled) {
      background: rgba(59, 130, 246, 0.3) !important;
      border-color: rgba(59, 130, 246, 0.6) !important;
    }
    
    .btn-check-username:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .input {
      width: 100%;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: var(--text, #fff);
      font-size: 14px;
      transition: all 0.2s;
      box-sizing: border-box;
    }
    
    .input:focus {
      outline: none;
      border-color: #4CAF50;
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
    }
    
    .input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
    
    textarea.input {
      resize: vertical;
      min-height: 80px;
      font-family: inherit;
    }

    select.input {
      background-color: rgba(255, 255, 255, 0.08);
      color: var(--text, #fff);
      color-scheme: dark;
    }

    select.input option {
      background: #1f2937;
      color: #f3f4f6;
    }

    select.input option:checked,
    select.input option:hover {
      background: #334155;
      color: #ffffff;
    }
    
    .field-hint {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      transition: color 0.2s;
    }
    
    .avatar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
      gap: 10px;
      margin-bottom: 15px;
    }
    
    .avatar-option {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    
    .avatar-option:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }
    
    .avatar-option.selected {
      background: rgba(76, 175, 80, 0.2);
      border-color: #4CAF50;
    }
    
    .avatar-option.selected::after {
      content: '✓';
      position: absolute;
      top: 4px;
      right: 4px;
      background: #4CAF50;
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    
    .avatar-badge {
      font-size: 28px;
    }
    
    .privacy-setting {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 12px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
    }
    
    .privacy-setting label {
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      min-width: 80px;
    }
    
    .privacy-setting select {
      flex: 1;
      max-width: 200px;
    }
    
    .edit-actions {
      display: flex;
      gap: 15px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .edit-actions .btn {
      flex: 1;
      padding: 10px;
      font-size: 14px;
      font-weight: 500;
    }
    
    .msg {
      padding: 15px 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 15px;
      animation: slideDown 0.3s ease-out;
    }
    
    .msg-success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #86efac;
    }
    
    .msg-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    
    .msg-info {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #93c5fd;
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
    
    .profile-loading,
    .profile-notfound {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      padding: 20px;
    }
    
    @media (max-width: 600px) {
      .edit-profile-container {
        padding: 15px;
      }
      
      .edit-profile-header h1 {
        font-size: 22px;
      }
      
      .accordion-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      
      .accordion-header-left {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-right: 0;
        padding-bottom: 12px;
      }
      
      .current-value {
        font-size: 12px;
        padding-left: 0;
      }
      
      .btn-accordion {
        align-self: center;
        min-width: 120px;
      }
      
      .avatar-grid {
        grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
        gap: 10px;
      }
      
      .avatar-badge {
        font-size: 28px;
      }
      
      .edit-actions {
        flex-direction: column;
      }
      
      .input-with-button {
        flex-direction: column;
      }
      
      .input-with-button .btn {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * Инициализировать аккордеоны
 */
function initAccordions(): void {
  const accordionBtns = document.querySelectorAll('.btn-accordion');

  accordionBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const section = (btn as HTMLElement).dataset.section;
      if (!section) return;

      const content = document.getElementById(`section-${section}`);
      if (!content) return;

      const isOpen = content.style.display !== 'none';

      if (isOpen) {
        content.style.display = 'none';
        btn.textContent = t('Изменить');
        btn.classList.remove('active');
      } else {
        // Закрываем все остальные секции
        document.querySelectorAll('.accordion-content').forEach((c) => {
          (c as HTMLElement).style.display = 'none';
        });
        document.querySelectorAll('.btn-accordion').forEach((b) => {
          b.textContent = t('Изменить');
          b.classList.remove('active');
        });

        // Открываем текущую секцию
        content.style.display = 'block';
        btn.textContent = t('Свернуть');
        btn.classList.add('active');
      }
    });
  });
}

/**
 * Инициализировать выбор аватара
 */
function initAvatarSelection(setSelectedAvatar: (avatarId: string) => void): void {
  const avatarOptions = document.querySelectorAll('.avatar-option');

  avatarOptions.forEach((option) => {
    option.addEventListener('click', () => {
      avatarOptions.forEach((opt) => opt.classList.remove('selected'));
      option.classList.add('selected');

      const avatarId = (option as HTMLElement).dataset.avatar;
      if (avatarId) {
        setSelectedAvatar(avatarId);
      }
    });
  });
}

/**
 * Инициализировать проверку username
 */
function initUsernameCheck(profile: EditableProfile): void {
  const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
  const checkBtn = document.getElementById('checkUsernameBtn') as HTMLButtonElement;
  const hintEl = document.getElementById('usernameHint') as HTMLDivElement;

  if (!checkBtn || !profile.canChangeUsername) {
    return;
  }

  checkBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();

    if (!username || username === profile.username) {
      hintEl.textContent = t('3-20 символов: буквы, цифры, _ или -');
      hintEl.style.color = '';
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      hintEl.textContent = t('❌ Неверный формат. Используйте 3-20 символов: буквы, цифры, _ или -');
      hintEl.style.color = '#ef4444';
      return;
    }

    checkBtn.textContent = t('Проверка...');
    checkBtn.disabled = true;

    const result = await checkUsernameAvailability(username);

    checkBtn.textContent = t('Проверить');
    checkBtn.disabled = false;

    if (result.available) {
      hintEl.textContent = t('✅ Имя доступно!');
      hintEl.style.color = '#22c55e';
    } else {
      hintEl.textContent = `❌ ${result.reason || t('Имя недоступно')}`;
      hintEl.style.color = '#ef4444';
    }
  });
}

/**
 * Инициализировать сохранение профиля
 */
function initSaveProfile(profile: EditableProfile, getSelectedAvatar: () => string): void {
  const saveBtn = document.getElementById('saveProfileBtn') as HTMLButtonElement;
  const msgEl = document.getElementById('editProfileMsg') as HTMLDivElement;

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    msgEl.className = `msg msg-${type}`;
    msgEl.textContent = text;
    msgEl.style.display = 'block';

    // Прокручиваем к сообщению
    msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  saveBtn.addEventListener('click', async () => {
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = t('Сохранение...');

      const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
      const bioInput = document.getElementById('bioInput') as HTMLTextAreaElement;
      const aboutMeInput = document.getElementById('aboutMeInput') as HTMLTextAreaElement;
      const genderInput = document.getElementById('genderInput') as HTMLSelectElement;
      const dobInput = document.getElementById('dobInput') as HTMLInputElement;

      const username = usernameInput.value.trim();
      const bio = bioInput.value.trim();
      const aboutMe = aboutMeInput.value.trim();
      const gender = genderInput.value;
      const dateOfBirth = dobInput.value;

      const privacy = {
        avatar: (document.getElementById('privacyAvatar') as HTMLSelectElement).value,
        bio: (document.getElementById('privacyBio') as HTMLSelectElement).value,
        about: (document.getElementById('privacyAbout') as HTMLSelectElement).value,
        gender: (document.getElementById('privacyGender') as HTMLSelectElement).value,
        dob: (document.getElementById('privacyDob') as HTMLSelectElement).value,
      };

      // Получаем выбранный аватар
      const selectedAvatarEl = document.querySelector('.avatar-option.selected') as HTMLElement;
      const avatar = selectedAvatarEl?.dataset.avatar || getSelectedAvatar();

      const updateData: Record<string, unknown> = {
        avatar: avatar,
        bio: bio || null,
        aboutMe: aboutMe || null,
        gender,
        dateOfBirth: dateOfBirth || null,
        privacy,
      };

      // Добавляем username только если он изменился и можно менять
      if (profile.canChangeUsername && username !== profile.username) {
        updateData.username = username;
      }

      const result = await updateProfile(updateData);

      if (result.ok) {
        if (typeof gender === 'string') {
          localStorage.setItem('cyb_user_gender', gender);
        }
        showMsg('success', t('✅ Профиль успешно обновлен!'));
        setTimeout(() => {
          Router.navigate(
            (typeof updateData.username === 'string' ? updateData.username : undefined) ||
              profile.username ||
              'account-profile'
          );
        }, 1500);
      } else {
        showMsg('error', result.error || t('Ошибка при сохранении профиля'));
      }
    } catch (error) {
      showMsg('error', t('Произошла ошибка при сохранении'));
      console.error('Save error:', error);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = t('💾 Сохранить изменения');
    }
  });
}
