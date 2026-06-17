import { arrayBufferToBase64, base64ToArrayBuffer, bytesToArrayBuffer } from './buffer';
import { type SignalStoredRecord, withSignalDb } from './idb-store';

const SYNC_KEY_STORAGE_KEY = 'plaintextSyncKey';
const SYNC_KEY_BYTES = 32;

function getRecord(
  store: IDBObjectStore,
  userId: string,
  key: string,
): Promise<SignalStoredRecord | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get([userId, key]);
    req.onsuccess = () => resolve(req.result as SignalStoredRecord | undefined);
    req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
  });
}

export function exportSyncKeyBase64(key: Uint8Array): string {
  return arrayBufferToBase64(bytesToArrayBuffer(key));
}

export async function readPlaintextSyncKey(userId: string): Promise<Uint8Array | null> {
  return withSignalDb('readonly', async (store) => {
    const row = await getRecord(store, userId, SYNC_KEY_STORAGE_KEY);
    if (!row || typeof row.value !== 'string') return null;
    const key = new Uint8Array(base64ToArrayBuffer(row.value));
    return key.length === SYNC_KEY_BYTES ? key : null;
  });
}

export async function writePlaintextSyncKey(userId: string, key: Uint8Array): Promise<void> {
  if (key.length !== SYNC_KEY_BYTES) {
    throw new Error('sync_key_invalid');
  }

  await withSignalDb('readwrite', async (store) => {
    store.put({
      userId,
      key: SYNC_KEY_STORAGE_KEY,
      value: exportSyncKeyBase64(key),
    } satisfies SignalStoredRecord);
  });
}

export async function getOrCreatePlaintextSyncKey(userId: string): Promise<Uint8Array> {
  const existing = await readPlaintextSyncKey(userId);
  if (existing) return existing;

  const key = new Uint8Array(SYNC_KEY_BYTES);
  crypto.getRandomValues(key);
  await writePlaintextSyncKey(userId, key);
  return key;
}

export async function restorePlaintextSyncKeyFromBackup(
  userId: string,
  backupKeyBase64?: string,
): Promise<void> {
  const trimmed = String(backupKeyBase64 || '').trim();
  if (!trimmed) return;
  const key = new Uint8Array(base64ToArrayBuffer(trimmed));
  if (key.length !== SYNC_KEY_BYTES) {
    throw new Error('sync_key_invalid');
  }
  await writePlaintextSyncKey(userId, key);
}

export async function readPlaintextSyncKeyForBackup(userId: string): Promise<string | undefined> {
  const key = await readPlaintextSyncKey(userId);
  return key ? exportSyncKeyBase64(key) : undefined;
}
