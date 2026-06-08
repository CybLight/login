/**
 * Turnstile CAPTCHA service
 */

import { TURNSTILE_SITEKEY } from '@/config/constants';
import { logger } from '@/utils';

export const captchaService = {
  widgetId: null as string | null | undefined,
  token: '',
  isReady: false,
  retryCount: 0,

  /**
   * Initialize Turnstile widget
   */
  async init(containerId: string = 'turnstile-container'): Promise<boolean> {
    const container = document.getElementById(containerId);
    if (!container) {
      logger.error('Turnstile container not found', { containerId });
      return false;
    }

    // Wait for Turnstile API to be loaded
    if (!this.isReady) {
      if (this.retryCount > 80) {
        logger.warn('Turnstile not loaded after max retries');
        return false;
      }

      if (!window.turnstile) {
        this.retryCount++;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return this.init(containerId);
      }

      this.isReady = true;
      this.retryCount = 0;
    }

    // Remove old widget if exists
    if (this.widgetId && this.widgetId !== null) {
      try {
        window.turnstile?.remove(this.widgetId as string);
      } catch {
        console.warn('Error removing old Turnstile widget');
      }
      this.widgetId = null;
    }

    // Clear container
    container.innerHTML = '';

    // Render new widget
    try {
      this.widgetId = window.turnstile?.render(container, {
        sitekey: TURNSTILE_SITEKEY,
        theme: document.body.classList.contains('light') ? 'light' : 'dark',
        callback: (token: string) => this.onSuccess(token),
        'expired-callback': () => this.onExpired(),
        'error-callback': () => this.onError(),
      });

      this.token = '';
      logger.info('Turnstile initialized');
      return true;
    } catch (error) {
      logger.error('Turnstile init error', { error });
      return false;
    }
  },

  /**
   * Get current token
   */
  getToken(): string {
    return this.token;
  },

  /**
   * Check if token is valid
   */
  isTokenValid(): boolean {
    return this.token.length > 0;
  },

  /**
   * Reset widget
   */
  reset(): void {
    if (this.widgetId && this.widgetId !== null) {
      try {
        window.turnstile?.reset(this.widgetId as string);
      } catch {
        console.warn('Error resetting Turnstile');
      }
    }
    this.token = '';
  },

  /**
   * Callbacks
   */
  onSuccess(token: string): void {
    this.token = token;
    logger.info('Turnstile token received');
    window.dispatchEvent(new CustomEvent('captcha:success', { detail: { token } }));
  },

  onExpired(): void {
    this.token = '';
    logger.warn('Turnstile token expired');
    window.dispatchEvent(new CustomEvent('captcha:expired'));
  },

  onError(): void {
    this.token = '';
    logger.error('Turnstile error');
    window.dispatchEvent(new CustomEvent('captcha:error'));
  },
};

// Add Turnstile type to window
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    onTurnstileOk?: (token: string) => void;
    onTurnstileExpired?: () => void;
    onTurnstileError?: () => void;
  }
}
