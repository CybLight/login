/**
 * Friends service
 */

import { apiCall } from '@/utils';
import { Friend, FriendshipStatus, ApiResponse } from '@/types';

export const friendsService = {
  async getFriends(): Promise<Friend[]> {
    try {
      const response = await apiCall('/friends/list', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ friends: Friend[] }> = await response.json();
      return data.data?.friends || [];
    } catch (error) {
      console.error('[FRIENDS] Get friends error:', error);
      return [];
    }
  },

  async getFriendRequests(): Promise<Friend[]> {
    try {
      const response = await apiCall('/friends/pending', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ requests: Friend[] }> = await response.json();
      return data.data?.requests || [];
    } catch (error) {
      console.error('[FRIENDS] Get requests error:', error);
      return [];
    }
  },

  async getStatus(friendId: string): Promise<FriendshipStatus | null> {
    try {
      const response = await apiCall(`/friends/status/${encodeURIComponent(friendId)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data: ApiResponse<FriendshipStatus> = await response.json();
      return data.data || null;
    } catch (error) {
      console.error('[FRIENDS] Get status error:', error);
      return null;
    }
  },

  async addFriend(friendUsername: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/friends/add', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ friendUsername }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[FRIENDS] Add error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async acceptRequest(friendId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/friends/accept', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ friendId }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[FRIENDS] Accept error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async rejectRequest(friendId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/friends/reject', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ friendId }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[FRIENDS] Reject error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async removeFriend(friendId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/friends/remove', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ friendId }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[FRIENDS] Remove error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async cancelRequest(friendId: string): Promise<ApiResponse> {
    return this.removeFriend(friendId);
  },

  async searchUsers(query: string): Promise<Friend[]> {
    try {
      const response = await apiCall(`/search/users?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return Array.isArray(data?.users) ? data.users : [];
    } catch (error) {
      console.error('[FRIENDS] Search error:', error);
      return [];
    }
  },
};
