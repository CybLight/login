import { escapeHtml } from '@/utils';

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

export function getAvatarEmoji(avatarId: string): string {
  return AVATAR_EMOJI_MAP[avatarId] || '';
}

export function isAvatarUrl(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('data:image/')
  );
}

export function getAvatarInnerHtml(avatarRaw: string | undefined, login: string): string {
  const avatarValue = String(avatarRaw || '').trim();

  if (!avatarValue) {
    return `<span>${escapeHtml(String(login).slice(0, 1).toUpperCase())}</span>`;
  }

  const mappedEmoji = getAvatarEmoji(avatarValue);
  if (mappedEmoji) {
    return `<span>${mappedEmoji}</span>`;
  }

  if (isAvatarUrl(avatarValue)) {
    return `<img class="profile-avatar__img" src="${escapeHtml(avatarValue)}" alt="Аватар ${escapeHtml(login)}" />`;
  }

  return `<span>${escapeHtml(avatarValue)}</span>`;
}

export function getAvatarListHtml(avatarRaw: string | undefined, usernameRaw: string): string {
  const avatarValue = String(avatarRaw || '').trim();
  const username = String(usernameRaw || '').trim();

  if (!avatarValue) {
    return `<span>${escapeHtml(username.slice(0, 1).toUpperCase() || 'U')}</span>`;
  }

  const mappedEmoji = getAvatarEmoji(avatarValue);
  if (mappedEmoji) {
    return `<span>${mappedEmoji}</span>`;
  }

  if (isAvatarUrl(avatarValue)) {
    return `<img class="avatar-img" src="${escapeHtml(avatarValue)}" alt="" />`;
  }

  return `<span>${escapeHtml(avatarValue)}</span>`;
}
