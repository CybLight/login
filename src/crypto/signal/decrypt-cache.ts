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
  const batch = await readDecryptCacheBatch(userId, [messageId]);
  return batch.get(messageId) ?? null;
}

export async function readDecryptCacheBatch(
  userId: string,
  messageIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (messageIds.length === 0) return result;

  const wanted = new Set(messageIds.map((id) => cacheKey(id)));
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      for (const row of (req.result as StoredRecord[]) || []) {
        if (row.userId !== userId || typeof row.value !== 'string') continue;
        if (!wanted.has(row.key)) continue;
        result.set(row.key.slice('decryptCache:'.length), row.value);
      }
    };
    req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('indexeddb_read_failed'));
  });

  db.close();
  return result;
}

export async function writeDecryptCache(
  userId: string,
  messageId: string,
  plaintext: string,
): Promise<void> {
  await writeDecryptCacheBatch(userId, new Map([[messageId, plaintext]]));
}

export async function writeDecryptCacheBatch(
  userId: string,
  entries: Map<string, string>,
): Promise<void> {
  if (entries.size === 0) return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const [messageId, plaintext] of entries) {
      store.put({
        userId,
        key: cacheKey(messageId),
        value: plaintext,
      } satisfies StoredRecord);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('indexeddb_write_failed'));
  });
  db.close();
}
