/**
 * Notification component
 */

import type { NotificationOptions } from '@/types';

export class NotificationManager {
  /**
   * Show top notification
   */
  static show(options: NotificationOptions | string): void {
    const opts: NotificationOptions =
      typeof options === 'string' ? { type: 'info', message: options } : options;

    // Remove existing notifications
    const existing = document.querySelectorAll('.top-notification');
    existing.forEach((el) => el.remove());

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `top-notification top-notification--${opts.type}`;
    // Set live region attributes so screen readers announce notifications
    // Установите атрибуты активной области, чтобы программы чтения с экрана озвучивали уведомления
    if (opts.type === 'error') {
      notification.setAttribute('role', 'alert');
      notification.setAttribute('aria-live', 'assertive');
    } else {
      notification.setAttribute('role', 'status');
      notification.setAttribute('aria-live', 'polite');
    }
    notification.setAttribute('aria-atomic', 'true');

    notification.innerHTML = `
      <div class="top-notification__content">
        <span class="top-notification__icon" aria-hidden="true">${this.getIcon(opts.type)}</span>
        <span class="top-notification__message">${opts.message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    // Announce to hidden live region for SR users
    // Уведомление в скрытой зоне реального времени для пользователей SR
    try {
      const liveId = opts.type === 'error' ? 'a11y-errors' : 'a11y-notifications';
      const liveEl = document.getElementById(liveId);
      if (liveEl) {
        liveEl.textContent = opts.message;
      }
    } catch {
      // ignore
    }

    // Auto-remove after duration
    const duration = opts.duration || 5000;
    setTimeout(() => {
      notification.style.animation = 'slideDown 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  static success(message: string, duration?: number): void {
    this.show({ type: 'success', message, duration });
  }

  static error(message: string, duration?: number): void {
    this.show({ type: 'error', message, duration });
  }

  static warn(message: string, duration?: number): void {
    this.show({ type: 'warn', message, duration });
  }

  static info(message: string, duration?: number): void {
    this.show({ type: 'info', message, duration });
  }

  private static getIcon(type: string): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warn':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  }
}
