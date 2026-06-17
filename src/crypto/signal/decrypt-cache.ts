import { type SignalStoredRecord, withSignalDb } from './idb-store';

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

  await withSignalDb('readonly', async (store) => {
    const rows = await new Promise<SignalStoredRecord[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as SignalStoredRecord[]) || []);
      req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
    });

    for (const row of rows) {
      if (row.userId !== userId || typeof row.value !== 'string') continue;
      if (!wanted.has(row.key)) continue;
      result.set(row.key.slice('decryptCache:'.length), row.value);
    }
  });

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

  await withSignalDb('readwrite', async (store) => {
    for (const [messageId, plaintext] of entries) {
      store.put({
        userId,
        key: cacheKey(messageId),
        value: plaintext,
      } satisfies SignalStoredRecord);
    }
  });
}
