/**
 * Profile service
 */

import { apiCall } from '@/utils';
import { UserProfile, EditableProfile, ApiResponse } from '@/types';

export const profileService = {
  /**
   * Load user profile by username
   */
  async loadProfile(username: string): Promise<UserProfile | null> {
    try {
      console.log('[PROFILE] Loading:', username);
      const response = await apiCall(`/api/profile/${encodeURIComponent(username)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      const data: ApiResponse<{ profile: UserProfile }> = await response.json();
      console.log('[PROFILE] Loaded:', data);

      return data.data?.profile || null;
    } catch (error) {
      console.error('[PROFILE] Load error:', error);
      return null;
    }
  },

  /**
   * Check if username is available
   */
  async checkUsernameAvailability(
    username: string
  ): Promise<{ available: boolean; reason?: string }> {
    try {
      const response = await apiCall(
        `/api/profile/check-username/${encodeURIComponent(username)}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        return { available: false, reason: 'Ошибка проверки' };
      }

      const data = (await response.json()) as { available?: boolean; reason?: string } | null;
      return {
        available: data?.available ?? false,
        reason: data?.reason,
      };
    } catch (error) {
      console.error('[PROFILE] Username check error:', error);
      return { available: false, reason: 'Ошибка сети' };
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(updates: EditableProfile): Promise<ApiResponse> {
    try {
      const response = await apiCall('/api/profile/update', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const data: ApiResponse = await response.json();
      console.log('[PROFILE] Update response:', data);

      return data;
    } catch (error) {
      console.error('[PROFILE] Update error:', error);
      return {
        ok: false,
        error: 'Ошибка сети. Попробуйте еще раз.',
      };
    }
  },

  /**
   * Get avatar emoji by ID
   */
  getAvatarEmoji(avatarId: string): string {
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

    return AVATAR_EMOJI_MAP[avatarId] || '👤';
  },
};
