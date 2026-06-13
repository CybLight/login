const DB_NAME = 'cyblight-signal-store';
const DB_VERSION = 2;
const STORE_NAME = 'kv';

type StoredRecord = {
  userId: string;
  key: string;
  value: unknown;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'key'] });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
  });
}

function cacheKey(messageId: string): string {
  return `decryptCache:${messageId}`;
}

export async function readDecryptCache(userId: string, messageId: string): Promise<string | null> {
  const db = await openDb();
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get([userId, cacheKey(messageId)]);
    req.onsuccess = () => {
      const row = req.result as StoredRecord | undefined;
      resolve(row?.value);
    };
    req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
  });
  db.close();
  return typeof value === 'string' ? value : null;
}

export async function writeDecryptCache(
  userId: string,
  messageId: string,
  plaintext: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({
      userId,
      key: cacheKey(messageId),
      value: plaintext,
    } satisfies StoredRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('indexeddb_write_failed'));
  });
  db.close();
}
