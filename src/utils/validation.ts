/**
 * Validation utilities
 */

import { PASSWORD_MIN_LENGTH, USERNAME_REGEX, PASSWORD_HINTS } from '@/config/constants';
import type { PasswordStrength, ValidationResult } from '@/types';

export const validators = {
  email: (email: string): ValidationResult => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Некорректный email-адрес' };
    }
    return { valid: true };
  },

  username: (username: string): ValidationResult => {
    if (!USERNAME_REGEX.test(username)) {
      return {
        valid: false,
        message: 'Имя пользователя: 3-20 символов, латиница, цифры, _ или -',
      };
    }
    return { valid: true };
  },

  password: (password: string): ValidationResult => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return {
        valid: false,
        message: `Пароль должен быть минимум ${PASSWORD_MIN_LENGTH} символов`,
      };
    }
    return { valid: true };
  },

  passwordStrength: (password: string): PasswordStrength => {
    return {
      lowercase: PASSWORD_HINTS.lowercase.regex.test(password),
      uppercase: PASSWORD_HINTS.uppercase.regex.test(password),
      numbers: PASSWORD_HINTS.numbers.regex.test(password),
      special: PASSWORD_HINTS.special.regex.test(password),
      length: PASSWORD_HINTS.length.regex.test(password),
      score: calculatePasswordScore(password),
    };
  },

  passwordMatch: (password: string, confirm: string): ValidationResult => {
    if (password !== confirm) {
      return { valid: false, message: 'Пароли не совпадают' };
    }
    return { valid: true };
  },
};

export function calculatePasswordScore(password: string): number {
  let score = 0;
  if (PASSWORD_HINTS.lowercase.regex.test(password)) score++;
  if (PASSWORD_HINTS.uppercase.regex.test(password)) score++;
  if (PASSWORD_HINTS.numbers.regex.test(password)) score++;
  if (PASSWORD_HINTS.special.regex.test(password)) score++;
  if (PASSWORD_HINTS.length.regex.test(password)) score++;
  return score;
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Очень слабый';
    case 2:
      return 'Слабый';
    case 3:
      return 'Средний';
    case 4:
      return 'Хороший';
    case 5:
      return 'Отличный';
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
