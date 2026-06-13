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
): Promise<void> {
  if (payload.userId !== expectedUserId) {
    throw new Error('backup_user_mismatch');
  }

  await deleteUserRecords(expectedUserId);

  await writeValue(expectedUserId, 'wasmManifest', payload.signal.manifest);

  for (const [keyId, value] of Object.entries(payload.records.preKeys)) {
    await writeValue(expectedUserId, `wasmPreKey:${keyId}`, value);
  }
  for (const [keyId, value] of Object.entries(payload.records.signedPreKeys)) {
    await writeValue(expectedUserId, `wasmSignedPreKey:${keyId}`, value);
  }
  for (const [keyId, value] of Object.entries(payload.records.kyberPreKeys)) {
    await writeValue(expectedUserId, `wasmKyberPreKey:${keyId}`, value);
  }
  for (const [sessionKey, value] of Object.entries(payload.records.sessions)) {
    await writeValue(expectedUserId, `wasmSession:${sessionKey}`, value);
  }
  for (const [messageId, plaintext] of Object.entries(payload.decryptCache)) {
    await writeValue(expectedUserId, `decryptCache:${messageId}`, plaintext);
  }
}
