/**
 * Application configuration constants
 */

import { t } from '@/i18n';

// In development, use proxy to avoid CORS issues
// In production, use full API URL
export const API_BASE = ((import.meta as unknown) as { env?: { DEV?: boolean } }).env?.DEV ? '/api' : 'https://api.cyblight.org';

// Storage keys
export const EASTER_KEY = 'cyb_strawberry_unlocked';
export const DARK_TRIGGER_KEY = 'cyb_dark_trigger_unlocked';
export const PROFILE_MIRROR_KEY = 'cyb_profile_mirror_unlocked';
export const LIGHT_CATCHER_KEY = 'cyb_light_catcher_unlocked';
export const HISTORY_FROM_KEY = 'cyb_history_from';

// API configuration
export const API_TIMEOUT_MS = 10000;
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Error handling
export const MAX_ERRORS_PER_MINUTE = 10;
export const ERROR_CACHE_DURATION = 60000; // 1 minute

// Messaging
export const EDIT_TIME_LIMIT = 15 * 60 * 1000; // 15 minutes
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏'];

// Turnstile CAPTCHA
export const TURNSTILE_SITEKEY = '0x4AAAAAACIMk1fcGPcs3NLf';

// Password validation
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT_REGEX = {
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
  numbers: /\d/,
  special: /[^\w\s]/,
  length: /.{8,}/,
};

export function getPasswordHints() {
  return {
    lowercase: { regex: PASSWORD_HINT_REGEX.lowercase, text: t('Маленькие буквы (a-z)') },
    uppercase: { regex: PASSWORD_HINT_REGEX.uppercase, text: t('Большие буквы (A-Z)') },
    numbers: { regex: PASSWORD_HINT_REGEX.numbers, text: t('Цифры (0-9)') },
    special: { regex: PASSWORD_HINT_REGEX.special, text: t('Спецсимволы') },
    length: {
      regex: PASSWORD_HINT_REGEX.length,
      text: t('Длина минимум {min} символов', { min: PASSWORD_MIN_LENGTH }),
    },
  };
}

// Session list limits
export const MAX_SESSION_LIST_SIZE = 20;

// Username validation
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

// Avatar configuration
export const AVAILABLE_AVATARS = [
  'avatar-cat',
  'avatar-dog',
  'avatar-fox',
  'avatar-bear',
  'avatar-panda',
  'avatar-rabbit',
  'avatar-owl',
  'avatar-penguin',
  'avatar-koala',
  'avatar-tiger',
];

export const EXCLUSIVE_AVATARS = [
  'avatar-crown',
  'avatar-shield',
  'avatar-code',
  'avatar-verified',
  'avatar-fire',
  'avatar-star',
  'avatar-robot',
  'avatar-diamond',
];
