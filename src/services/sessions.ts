/**
 * Sessions service
 */

import { apiCall } from '@/utils';
import { LoginSession, ApiResponse } from '@/types';

export const sessionsService = {
  async getSessions(): Promise<LoginSession[]> {
    try {
      const response = await apiCall('/auth/sessions', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ sessions: LoginSession[] }> = await response.json();
      return data.data?.sessions || [];
    } catch (error) {
      console.error('[SESSIONS] Get sessions error:', error);
      return [];
    }
  },

  async getLoginHistory(tab: string = 'active', limit: number = 20): Promise<LoginSession[]> {
    try {
      const response = await apiCall(`/auth/login-history?tab=${tab}&limit=${limit}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ sessions: LoginSession[] }> = await response.json();
      return data.data?.sessions || [];
    } catch (error) {
      console.error('[SESSIONS] Get login history error:', error);
      return [];
    }
  },

  async terminateSession(sessionId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/auth/sessions/revoke', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ id: sessionId }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[SESSIONS] Terminate error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async terminateOthers(): Promise<ApiResponse> {
    try {
      const response = await apiCall('/auth/logout-others', {
        method: 'POST',
        credentials: 'include',
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[SESSIONS] Terminate others error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async getTrustedDevices(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiCall('/auth/trusted-devices', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ devices: Record<string, unknown>[] }> = await response.json();
      return data.data?.devices || [];
    } catch (error) {
      console.error('[SESSIONS] Get trusted devices error:', error);
      return [];
    }
  },

  async removeTrustedDevice(deviceId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/auth/trusted-devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[SESSIONS] Remove device error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },
};
