/**
 * Messages service
 */

import { apiCall } from '@/utils';
import { ChatMessage, ApiResponse } from '@/types';

export const messagesService = {
  /**
   * Load chat messages with a friend
   */
  async loadMessages(friendId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const response = await apiCall(`/api/messages/chat/${friendId}?limit=${limit}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ messages: ChatMessage[] }> = await response.json();
      return data.data?.messages || [];
    } catch (error) {
      console.error('[MESSAGES] Load error:', error);
      return [];
    }
  },

  /**
   * Send message to friend
   */
  async sendMessage(recipientId: string, content: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/api/messages/send', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          recipientId,
          content,
        }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[MESSAGES] Send error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  /**
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[MESSAGES] Delete error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  /**
   * Edit message
   */
  async editMessage(messageId: string, content: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/api/messages/${messageId}`, {
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[MESSAGES] Edit error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  /**
   * Add reaction to message
   */
  async addReaction(messageId: string, emoji: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[MESSAGES] Add reaction error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  /**
   * Remove reaction from message
   */
  async removeReaction(messageId: string, emoji: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(
        `/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[MESSAGES] Remove reaction error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  /**
   * Get list of conversations
   */
  async getConversations(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiCall('/api/messages/conversations', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return [];
      }

      const data: ApiResponse<{ conversations: Record<string, unknown>[] }> =
        await response.json();
      return data.data?.conversations || [];
    } catch (error) {
      console.error('[MESSAGES] Get conversations error:', error);
      return [];
    }
  },
};
