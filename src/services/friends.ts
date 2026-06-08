/**
 * Friends service
 */

import { apiCall } from '@/utils';
import { Friend, FriendshipStatus, ApiResponse } from '@/types';

export const friendsService = {
  /**
   * Get list of friends
   */
  async getFriends(): Promise<Friend[]> {
    try {
      const response = await apiCall('/api/friends', {
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

  /**
   * Get friend requests
   */
  async getFriendRequests(): Promise<Friend[]> {
    try {
      const response = await apiCall('/api/friends/requests', {
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

  /**
   * Check friendship status
   */
  async getStatus(friendId: string): Promise<FriendshipStatus | null> {
    try {
      const response = await apiCall(`/api/friends/status/${friendId}`, {
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

  /**
   * Add friend
   */
  async addFriend(friendUsername: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/api/friends/add', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ friendUsername }),
      });

      const data: ApiResponse = await response.json();
      console.log('[FRIENDS] Add result:', data);

      return data;
    } catch (error) {
      console.error('[FRIENDS] Add error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  /**
   * Accept friend request
   */
  async acceptRequest(friendId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/api/friends/requests/${friendId}/accept`, {
        method: 'POST',
        credentials: 'include',
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

  /**
   * Reject friend request
   */
  async rejectRequest(friendId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/api/friends/requests/${friendId}/reject`, {
        method: 'POST',
        credentials: 'include',
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

  /**
   * Remove friend
   */
  async removeFriend(friendId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/api/friends/${friendId}`, {
        method: 'DELETE',
        credentials: 'include',
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

  /**
   * Cancel friend request
   */
  async cancelRequest(friendshipId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/api/friends/requests/${friendshipId}/cancel`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[FRIENDS] Cancel request error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  /**
   * Search users to add as friend
   */
  async searchUsers(query: string): Promise<Friend[]> {
    try {
      const response = await apiCall(`/api/friends/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ results: Friend[] }> = await response.json();
      return data.data?.results || [];
    } catch (error) {
      console.error('[FRIENDS] Search error:', error);
      return [];
    }
  },
};
