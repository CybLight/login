import { type SignalStoredRecord, readSignalDbSafely } from '../signal/idb-store';
import { readPlaintextSyncKeyForBackup } from '../signal/sync-key';
import {
  BACKUP_PAYLOAD_FORMAT,
  BACKUP_PAYLOAD_VERSION_V1,
  BACKUP_PAYLOAD_VERSION_V2,
  defaultBackupRecords,
  type CyblightBackupPayload,
  type CyblightBackupPayloadV2,
  type CyblightChatsExportPayload,
} from './format';

async function listUserRecords(userId: string): Promise<SignalStoredRecord[]> {
  return readSignalDbSafely([], async (store) => {
    return new Promise<SignalStoredRecord[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as SignalStoredRecord[]) || [];
        resolve(all.filter((row) => row.userId === userId));
      };
      req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
    });
  });
}

export async function hasLocalBackupKeys(userId: string): Promise<boolean> {
  try {
    const payload = await collectBackupPayload(userId);
    return payload !== null;
  } catch {
    return false;
  }
}

export async function collectBackupPayload(
  userId: string,
  chats?: CyblightChatsExportPayload | null,
): Promise<CyblightBackupPayload | null> {
  const rows = await listUserRecords(userId);
  const manifestRow = rows.find((row) => row.key === 'wasmManifest');
  if (!manifestRow || typeof manifestRow.value !== 'object' || manifestRow.value === null) {
    return null;
  }

  const manifest = manifestRow.value as CyblightBackupPayload['signal']['manifest'];
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

  const base = {
    format: BACKUP_PAYLOAD_FORMAT,
    userId,
    createdAt: Date.now(),
    signal: { manifest },
    records,
    decryptCache,
    plaintextSyncKey: await readPlaintextSyncKeyForBackup(userId),
  };

  if (chats) {
    const payload: CyblightBackupPayloadV2 = {
      ...base,
      version: BACKUP_PAYLOAD_VERSION_V2,
      chats,
    };
    return payload;
  }

  return {
    ...base,
    version: BACKUP_PAYLOAD_VERSION_V1,
  };
}
