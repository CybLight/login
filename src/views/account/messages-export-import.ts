import { t } from '@/i18n';
import { apiCall } from '@/utils';

export const CHATS_EXPORT_EXTENSION = '.cyblight-chats.json';

export type ChatsExportFile = {
  format: 'cyblight-chats';
  version: 1;
  exportedAt: number;
  ownerUserId: string;
  chats: Array<{
    friendId: string;
    friendUsername: string;
    messages: Array<Record<string, unknown>>;
  }>;
};

type MessagesApi = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg?: () => void;
};

function parseExportPayload(raw: unknown): ChatsExportFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const payload = (
    root.export && typeof root.export === 'object' ? root.export : root
  ) as Record<string, unknown>;

  if (payload.format !== 'cyblight-chats' || Number(payload.version) !== 1) {
    return null;
  }

  if (!Array.isArray(payload.chats)) {
    return null;
  }

  return payload as unknown as ChatsExportFile;
}

async function resolveLogin(): Promise<string> {
  try {
    const response = await apiCall('/auth/me', { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    const user = (data?.user || data?.data?.user || data) as Record<string, unknown>;
    return String(user?.login || user?.username || 'user');
  } catch {
    return 'user';
  }
}

export function downloadChatsExportFile(exportData: ChatsExportFile, login: string): void {
  const safeLogin = login.replace(/[^\w.-]+/g, '_') || 'user';
  const stamp = new Date(exportData.exportedAt || Date.now()).toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify({ export: exportData }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cyblight-chats-${safeLogin}-${stamp}${CHATS_EXPORT_EXTENSION}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportChats(api: MessagesApi): Promise<void> {
  api.clearMsg?.();

  const response = await apiCall('/messages/export', {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    api.showMsg('error', t('Не удалось экспортировать чаты.'));
    return;
  }

  const exportData = parseExportPayload(data);
  if (!exportData) {
    api.showMsg('error', t('Некорректный ответ сервера при экспорте чатов.'));
    return;
  }

  const login = await resolveLogin();
  downloadChatsExportFile(exportData, login);

  const totalMessages = exportData.chats.reduce(
    (sum, chat) => sum + (Array.isArray(chat.messages) ? chat.messages.length : 0),
    0,
  );

  api.showMsg(
    'success',
    t('Экспортировано чатов: {chats}, сообщений: {messages}', {
      chats: exportData.chats.length,
      messages: totalMessages,
    }),
  );
}

export async function importChats(file: File, api: MessagesApi): Promise<void> {
  api.clearMsg?.();

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    api.showMsg('error', t('Некорректный файл экспорта чатов.'));
    return;
  }

  const exportData = parseExportPayload(parsed);
  if (!exportData) {
    api.showMsg('error', t('Некорректный файл экспорта чатов.'));
    return;
  }

  const response = await apiCall('/messages/import', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ export: exportData }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    if (data?.error === 'invalid_export_format') {
      api.showMsg('error', t('Некорректный файл экспорта чатов.'));
      return;
    }
    api.showMsg('error', t('Не удалось импортировать чаты.'));
    return;
  }

  api.showMsg(
    'success',
    t('Импорт завершён: добавлено {imported}, пропущено {skipped}, ошибок {errors}', {
      imported: Number(data.imported || 0),
      skipped: Number(data.skipped || 0),
      errors: Number(data.errors || 0),
    }),
  );
}

export function renderMessagesExportImportSettingsHtml(): string {
  return `
        <div class="messages-settings-section">
          <div class="messages-settings-section__title">${t('Экспорт и импорт чатов')}</div>
          <p class="messages-settings-section__hint">${t('Сохраните переписку в файл или восстановите её из резервной копии этого аккаунта.')}</p>
          <div class="messages-settings-actions">
            <button id="messagesExportChatsBtn" class="messages-settings-action-btn" type="button">
              ${t('Экспорт чатов')}
            </button>
            <button id="messagesImportChatsBtn" class="messages-settings-action-btn" type="button">
              ${t('Импорт чатов')}
            </button>
            <input id="messagesImportChatsInput" type="file" accept=".json,application/json" hidden />
          </div>
        </div>`;
}

export function bindMessagesExportImportHandlers(root: ParentNode, api: MessagesApi): void {
  const exportBtn = root.querySelector('#messagesExportChatsBtn') as HTMLButtonElement | null;
  const importBtn = root.querySelector('#messagesImportChatsBtn') as HTMLButtonElement | null;
  const fileInput = root.querySelector('#messagesImportChatsInput') as HTMLInputElement | null;

  exportBtn?.addEventListener('click', () => {
    exportBtn.disabled = true;
    void exportChats(api).finally(() => {
      exportBtn.disabled = false;
    });
  });

  importBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;

    importBtn?.setAttribute('disabled', 'true');
    void importChats(file, api).finally(() => {
      importBtn?.removeAttribute('disabled');
    });
  });
}
