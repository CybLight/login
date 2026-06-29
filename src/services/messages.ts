/**
 * Messages service
 */

import { apiCall } from '@/utils';
import { ChatMessage, ApiResponse } from '@/types';

export const messagesService = {
  async loadMessages(friendId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const response = await apiCall(`/messages/${encodeURIComponent(friendId)}?limit=${limit}`, {
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

  async sendMessage(recipientId: string, content: string): Promise<ApiResponse> {
    try {
      const response = await apiCall('/messages/send', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          recipientId,
          content,
        }),
      });

      const data: ApiResponse = await response.json();

      // Touch format mirror if message has formatting
      if (data.ok && this.hasFormatting(content)) {
        apiCall('/auth/easter/touch-format-web', { method: 'POST', credentials: 'include' })
          .catch(err => console.warn('[EASTER] Touch web failed:', err));
      }

      return data;
    } catch (error) {
      console.error('[MESSAGES] Send error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  hasFormatting(text: string): boolean {
    const plain = text.trim();
    if (!plain) return false;
    return (
      /\*\*.+?\*\*/.test(plain) ||
      /__.+?__/.test(plain) ||
      /(?<![\w\\])_.+?_(?![\w])/.test(plain) ||
      /~~.+?~~/.test(plain) ||
      /\|\|.+?\|\|/.test(plain) ||
      /`.+?`/.test(plain) ||
      /```[\s\S]+?```/.test(plain) ||
      /^>\s/m.test(plain) ||
      /\[[^\]]+\]\([^)]+\)/.test(plain)
    );
  },

  async deleteMessage(messageId: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/messages/${encodeURIComponent(messageId)}`, {
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

  async editMessage(messageId: string, content: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      const data: ApiResponse = await response.json();

      // Touch format mirror if message has formatting
      if (data.ok && this.hasFormatting(content)) {
        apiCall('/auth/easter/touch-format-web', { method: 'POST', credentials: 'include' })
          .catch(err => console.warn('[EASTER] Touch web failed:', err));
      }

      return data;
    } catch (error) {
      console.error('[MESSAGES] Edit error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async toggleReaction(messageId: string, emoji: string): Promise<ApiResponse> {
    try {
      const response = await apiCall(`/messages/${encodeURIComponent(messageId)}/react`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      const data: ApiResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[MESSAGES] Reaction error:', error);
      return {
        ok: false,
        error: 'Ошибка сети',
      };
    }
  },

  async getUnreadSummary(): Promise<Record<string, unknown>> {
    try {
      const response = await apiCall('/messages/unread-summary', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return {};
      }

      const data: ApiResponse<Record<string, unknown>> = await response.json();
      return data.data || {};
    } catch (error) {
      console.error('[MESSAGES] Unread summary error:', error);
      return {};
    }
  },
};
