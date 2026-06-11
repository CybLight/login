/**
 * Authentication service
 */

import { apiCall } from '@/utils';
import { User, AuthResponse, SessionCheckResponse } from '@/types';

export const authService = {
  /**
   * Check if user is currently logged in
   */
  async checkSession(): Promise<User | null> {
    try {
      console.log('[AUTH] Checking session...');
      const response = await apiCall('/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data: SessionCheckResponse = await response.json();
        console.log('[AUTH] Session valid:', data);
        return data.user || null;
      }

      console.log('[AUTH] Session check failed:', response.status);
      return null;
    } catch (error) {
      console.error('[AUTH] Session check error:', error);
      return null;
    }
  },

  /**
   * Login with username and password
   */
  async login(username: string, password: string, captchaToken: string): Promise<AuthResponse> {
    try {
      const response = await apiCall('/auth/login', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          login: username, // can be email or username
          password,
          captchaToken,
        }),
      });

      const data: AuthResponse = await response.json();
      console.log('[AUTH] Login response:', { ok: response.ok, message: data.message });

      return data;
    } catch (error) {
      console.error('[AUTH] Login error:', error);
      return {
        ok: false,
        error: 'Ошибка сети. Попробуйте еще раз.',
      };
    }
  },

  /**
   * Register new account
   */
  async register(
    username: string,
    email: string,
    password: string,
    captchaToken: string
  ): Promise<AuthResponse> {
    try {
      const response = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          password,
          captchaToken,
        }),
      });

      const data: AuthResponse = await response.json();
      console.log('[AUTH] Register response:', { ok: response.ok, message: data.message });

      return data;
    } catch (error) {
      console.error('[AUTH] Register error:', error);
      return {
        ok: false,
        error: 'Ошибка сети. Попробуйте еще раз.',
      };
    }
  },

  /**
   * Logout current session
   */
  async logout(): Promise<boolean> {
    try {
      const response = await apiCall('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      console.log('[AUTH] Logout response:', response.ok);
      return response.ok;
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
      return false;
    }
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string, captchaToken: string): Promise<AuthResponse> {
    try {
      const response = await apiCall('/auth/recovery/start', {
        method: 'POST',
        body: JSON.stringify({
          email,
          mode: 'password',
          turnstileToken: captchaToken,
        }),
      });

      const data: AuthResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[AUTH] Password reset request error:', error);
      return {
        ok: false,
        error: 'Ошибка сети. Попробуйте еще раз.',
      };
    }
  },

  /**
   * Complete password reset (token from email link)
   */
  async resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
    try {
      const response = await apiCall('/auth/recovery/finish', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });

      const data: AuthResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[AUTH] Password reset error:', error);
      return {
        ok: false,
        error: 'Ошибка сети. Попробуйте еще раз.',
      };
    }
  },

  /**
   * Clear auth cookie
   */
  clearAuthCookie(): void {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const domain = parts.length >= 2 ? `.${parts.slice(-2).join('.')}` : hostname;

    const cookiesToClear = [
      `cyb_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      `cyb_auth=; Path=/; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      `cyb_auth=; Path=/; Domain=${hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    ];

    cookiesToClear.forEach((cookie) => {
      document.cookie = cookie;
    });

    console.log('[AUTH] Cookie cleared');
  },
};
