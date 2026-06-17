import { apiCall } from '@/utils/api';
import {
  arrayBufferToBase64,
  arrayBufferToUtf8,
  base64ToArrayBuffer,
  bytesToArrayBuffer,
  utf8ToArrayBuffer,
} from './buffer';
import { getOrCreatePlaintextSyncKey, readPlaintextSyncKey } from './sync-key';

const MAX_BATCH = 200;

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bytesToArrayBuffer(raw),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPlaintextForSync(
  userId: string,
  plaintext: string,
): Promise<{ iv: string; ciphertext: string } | null> {
  const rawKey = (await readPlaintextSyncKey(userId)) ?? (await getOrCreatePlaintextSyncKey(userId));
  const key = await importAesKey(rawKey);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
    key,
    utf8ToArrayBuffer(plaintext),
  );

  return {
    iv: arrayBufferToBase64(bytesToArrayBuffer(iv)),
    ciphertext: arrayBufferToBase64(encrypted),
  };
}

async function decryptPlaintextFromSync(
  rawKey: Uint8Array,
  iv: string,
  ciphertext: string,
): Promise<string | null> {
  try {
    const key = await importAesKey(rawKey);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(iv)) },
      key,
      base64ToArrayBuffer(ciphertext),
    );
    return arrayBufferToUtf8(decrypted);
  } catch {
    return null;
  }
}

export async function pushPlaintextSync(
  userId: string,
  messageId: string,
  plaintext: string,
): Promise<void> {
  if (!messageId || !plaintext) return;

  const encrypted = await encryptPlaintextForSync(userId, plaintext);
  if (!encrypted) return;

  try {
    await apiCall('/messages/sync-plaintext', {
      method: 'POST',
      body: JSON.stringify({
        entries: [
          {
            messageId,
            iv: encrypted.iv,
            ciphertext: encrypted.ciphertext,
          },
        ],
      }),
    });
  } catch {
    // best effort
  }
}

export async function pushPlaintextSyncBatch(
  userId: string,
  entries: Map<string, string>,
): Promise<void> {
  if (entries.size === 0) return;

  const payload: Array<{ messageId: string; iv: string; ciphertext: string }> = [];
  for (const [messageId, plaintext] of entries) {
    if (!messageId || !plaintext) continue;
    const encrypted = await encryptPlaintextForSync(userId, plaintext);
    if (!encrypted) continue;
    payload.push({
      messageId,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
    });
    if (payload.length >= MAX_BATCH) break;
  }

  if (payload.length === 0) return;

  try {
    await apiCall('/messages/sync-plaintext', {
      method: 'POST',
      body: JSON.stringify({ entries: payload }),
    });
  } catch {
    // best effort
  }
}

export async function fetchPlaintextSyncBatch(
  userId: string,
  messageIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (messageIds.length === 0) return result;

  const rawKey = await readPlaintextSyncKey(userId);
  if (!rawKey) return result;

  const uniqueIds = [...new Set(messageIds.filter(Boolean))].slice(0, MAX_BATCH);
  if (uniqueIds.length === 0) return result;

  try {
    const response = await apiCall('/messages/sync-plaintext/fetch', {
      method: 'POST',
      body: JSON.stringify({ messageIds: uniqueIds }),
    });
    if (!response.ok) return result;

    const data = (await response.json()) as {
      entries?: Array<{ messageId?: string; iv?: string; ciphertext?: string }>;
    };

    for (const entry of data.entries || []) {
      const messageId = String(entry.messageId || '').trim();
      const iv = String(entry.iv || '').trim();
      const ciphertext = String(entry.ciphertext || '').trim();
      if (!messageId || !iv || !ciphertext) continue;

      const text = await decryptPlaintextFromSync(rawKey, iv, ciphertext);
      if (text !== null) {
        result.set(messageId, text);
      }
    }
  } catch {
    // best effort
  }

  return result;
}
