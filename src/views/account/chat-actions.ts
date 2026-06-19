import { apiCall } from '@/utils';
import { animateChatMessageRemoval } from './chat-message-animate-remove';

type ApiMessage = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
};

type ConfirmModalFn = (opts: {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
}) => Promise<boolean>;

export async function deleteMessageInAccount(
  messageId: string,
  api: ApiMessage,
  confirmModal: ConfirmModalFn,
  reloadChat: () => Promise<void>,
  options?: {
    messagesContainer?: HTMLElement | null;
    onSuccess?: (messageId: string) => void;
  },
): Promise<void> {
  const confirmed = await confirmModal({
    title: 'Удалить сообщение',
    text: 'Удалить это сообщение?',
    confirmText: 'Удалить',
    cancelText: 'Отмена',
  });
  if (!confirmed) return;

  const container = options?.messagesContainer ?? document.getElementById('chatMessages');
  const removalAnimation = animateChatMessageRemoval(container, messageId);

  const response = await apiCall(`/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (response.ok) {
    await removalAnimation;
    options?.onSuccess?.(messageId);
  } else {
    await reloadChat();
    api.showMsg('error', 'Не удалось удалить сообщение');
  }
}

export async function addReactionToMessageInAccount(
  messageId: string,
  emoji: string,
  reloadChat: () => Promise<void>
): Promise<void> {
  if (!emoji) return;

  try {
    const response = await apiCall(`/messages/${encodeURIComponent(messageId)}/react`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });

    if (response.ok) {
      await reloadChat();
    }
  } catch (error) {
    console.error('Error adding reaction:', error);
  }
}
