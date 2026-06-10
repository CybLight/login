/**
 * Validation utilities
 */

import { PASSWORD_MIN_LENGTH, USERNAME_REGEX, PASSWORD_HINT_REGEX } from '@/config/constants';
import { t } from '@/i18n';
import type { PasswordStrength, ValidationResult } from '@/types';

export const validators = {
  email: (email: string): ValidationResult => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: t('Некорректный email-адрес') };
    }
    return { valid: true };
  },

  username: (username: string): ValidationResult => {
    if (!USERNAME_REGEX.test(username)) {
      return {
        valid: false,
        message: t('Имя пользователя: 3-20 символов, латиница, цифры, _ или -'),
      };
    }
    return { valid: true };
  },

  password: (password: string): ValidationResult => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return {
        valid: false,
        message: t('Пароль должен быть минимум {min} символов', { min: PASSWORD_MIN_LENGTH }),
      };
    }
    return { valid: true };
  },

  passwordStrength: (password: string): PasswordStrength => {
    return {
      lowercase: PASSWORD_HINT_REGEX.lowercase.test(password),
      uppercase: PASSWORD_HINT_REGEX.uppercase.test(password),
      numbers: PASSWORD_HINT_REGEX.numbers.test(password),
      special: PASSWORD_HINT_REGEX.special.test(password),
      length: PASSWORD_HINT_REGEX.length.test(password),
      score: calculatePasswordScore(password),
    };
  },

  passwordMatch: (password: string, confirm: string): ValidationResult => {
    if (password !== confirm) {
      return { valid: false, message: t('Пароли не совпадают') };
    }
    return { valid: true };
  },
};

export function calculatePasswordScore(password: string): number {
  let score = 0;
  if (PASSWORD_HINT_REGEX.lowercase.test(password)) score++;
  if (PASSWORD_HINT_REGEX.uppercase.test(password)) score++;
  if (PASSWORD_HINT_REGEX.numbers.test(password)) score++;
  if (PASSWORD_HINT_REGEX.special.test(password)) score++;
  if (PASSWORD_HINT_REGEX.length.test(password)) score++;
  return score;
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return t('Очень слабый');
    case 2:
      return t('Слабый');
    case 3:
      return t('Средний');
    case 4:
      return t('Хороший');
    case 5:
      return t('Отличный');
    default:
      return 'Unknown';
  }
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return '#ef4444';
    case 2:
      return '#f97316';
    case 3:
      return '#eab308';
    case 4:
      return '#84cc16';
    case 5:
      return '#22c55e';
    default:
      return '#666';
  }
}
