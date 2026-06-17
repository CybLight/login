import { apiCall } from '@/utils';
import type { CyblightChatsExportPayload } from './format';

export async function fetchChatsForBackup(): Promise<CyblightChatsExportPayload | null> {
  try {
    const response = await apiCall('/messages/export', {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) return null;

    const raw = (data.export && typeof data.export === 'object' ? data.export : data) as Record<
      string,
      unknown
    >;
    if (raw.format !== 'cyblight-chats' || Number(raw.version) !== 1) return null;
    if (!Array.isArray(raw.chats)) return null;

    return raw as unknown as CyblightChatsExportPayload;
  } catch {
    return null;
  }
}

export async function importChatsPayload(
  exportData: CyblightChatsExportPayload,
): Promise<{ imported: number; skipped: number; errors: number }> {
  const response = await apiCall('/messages/import', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ export: exportData }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    throw new Error(String(data?.error || 'chats_import_failed'));
  }

  return {
    imported: Number(data.imported || 0),
    skipped: Number(data.skipped || 0),
    errors: Number(data.errors || 0),
  };
}
