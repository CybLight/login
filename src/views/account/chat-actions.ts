import { apiCall } from '@/utils';

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
  reloadChat: () => Promise<void>
): Promise<void> {
  const confirmed = await confirmModal({
    title: 'Удалить сообщение',
    text: 'Удалить это сообщение?',
    confirmText: 'Удалить',
    cancelText: 'Отмена',
  });
  if (!confirmed) return;

  const response = await apiCall(`/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (response.ok) {
    await reloadChat();
  } else {
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
