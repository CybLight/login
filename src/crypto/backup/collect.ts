import type { StoreManifest } from '../signal/wasm-context';
import {
  BACKUP_PAYLOAD_FORMAT,
  BACKUP_VERSION,
  defaultBackupRecords,
  type CyblightBackupPayloadV1,
} from './format';

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

async function listUserRecords(userId: string): Promise<StoredRecord[]> {
  const db = await openDb();
  const rows = await new Promise<StoredRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as StoredRecord[]) || [];
      resolve(all.filter((row) => row.userId === userId));
    };
    req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
  });
  db.close();
  return rows;
}

export async function collectBackupPayload(userId: string): Promise<CyblightBackupPayloadV1 | null> {
  const rows = await listUserRecords(userId);
  const manifestRow = rows.find((row) => row.key === 'wasmManifest');
  if (!manifestRow || typeof manifestRow.value !== 'object' || manifestRow.value === null) {
    return null;
  }

  const manifest = manifestRow.value as StoreManifest;
  const records = defaultBackupRecords();
  const decryptCache: Record<string, string> = {};

  for (const row of rows) {
    if (row.key.startsWith('wasmPreKey:')) {
      const id = row.key.slice('wasmPreKey:'.length);
      if (typeof row.value === 'string') records.preKeys[id] = row.value;
      continue;
    }
    if (row.key.startsWith('wasmSignedPreKey:')) {
      const id = row.key.slice('wasmSignedPreKey:'.length);
      if (typeof row.value === 'string') records.signedPreKeys[id] = row.value;
      continue;
    }
    if (row.key.startsWith('wasmKyberPreKey:')) {
      const id = row.key.slice('wasmKyberPreKey:'.length);
      if (typeof row.value === 'string') records.kyberPreKeys[id] = row.value;
      continue;
    }
    if (row.key.startsWith('wasmSession:')) {
      const id = row.key.slice('wasmSession:'.length);
      if (typeof row.value === 'string') records.sessions[id] = row.value;
      continue;
    }
    if (row.key.startsWith('decryptCache:')) {
      const id = row.key.slice('decryptCache:'.length);
      if (typeof row.value === 'string') decryptCache[id] = row.value;
    }
  }

  return {
    format: BACKUP_PAYLOAD_FORMAT,
    version: BACKUP_VERSION,
    userId,
    createdAt: Date.now(),
    signal: { manifest },
    records,
    decryptCache,
  };
}
