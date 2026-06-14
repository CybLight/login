import type { CyblightBackupPayloadV1 } from './format';

const DB_NAME = 'cyblight-signal-store';
const STORE_NAME = 'kv';

type StoredRecord = {
  userId: string;
  key: string;
  value: unknown;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
  });
}

async function writeValue(userId: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ userId, key, value } satisfies StoredRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('indexeddb_write_failed'));
  });
  db.close();
}

async function deleteUserRecords(userId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as StoredRecord[]) || [];
      for (const row of rows) {
        if (row.userId === userId) {
          store.delete([row.userId, row.key]);
        }
      }
    };
    req.onerror = () => reject(req.error || new Error('indexeddb_delete_failed'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('indexeddb_delete_failed'));
  });
  db.close();
}

export async function restoreBackupPayload(
  expectedUserId: string,
  payload: CyblightBackupPayloadV1,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (payload.userId !== expectedUserId) {
    throw new Error('backup_user_mismatch');
  }

  const writeEntries: Array<[string, unknown]> = [
    ['wasmManifest', payload.signal.manifest],
    ...Object.entries(payload.records.preKeys).map(
      ([keyId, value]) => [`wasmPreKey:${keyId}`, value] as [string, unknown],
    ),
    ...Object.entries(payload.records.signedPreKeys).map(
      ([keyId, value]) => [`wasmSignedPreKey:${keyId}`, value] as [string, unknown],
    ),
    ...Object.entries(payload.records.kyberPreKeys).map(
      ([keyId, value]) => [`wasmKyberPreKey:${keyId}`, value] as [string, unknown],
    ),
    ...Object.entries(payload.records.sessions).map(
      ([sessionKey, value]) => [`wasmSession:${sessionKey}`, value] as [string, unknown],
    ),
    ...Object.entries(payload.decryptCache).map(
      ([messageId, plaintext]) => [`decryptCache:${messageId}`, plaintext] as [string, unknown],
    ),
  ];

  const totalSteps = 1 + writeEntries.length;
  let completedSteps = 0;

  const report = async (): Promise<void> => {
    onProgress?.(Math.min(100, Math.round((completedSteps / totalSteps) * 100)));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  };

  await report();
  await deleteUserRecords(expectedUserId);
  completedSteps += 1;
  await report();

  for (const [key, value] of writeEntries) {
    await writeValue(expectedUserId, key, value);
    completedSteps += 1;
    await report();
  }
}
