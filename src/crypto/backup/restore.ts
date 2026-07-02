import type { CyblightBackupPayload } from './format';
import { type SignalStoredRecord, withSignalDb } from '../signal/idb-store';
import { restorePlaintextSyncKeyFromBackup } from '../signal/sync-key';

export async function restoreBackupPayload(
  expectedUserId: string,
  payload: CyblightBackupPayload,
  onProgress?: (percent: number) => void,
  options?: { skipDecryptCache?: boolean; assignedDeviceId?: number },
): Promise<void> {
  if (payload.userId !== expectedUserId) {
    throw new Error('backup_user_mismatch');
  }

  // Handle both nested and top-level manifest
  const manifest = payload.manifest || payload.signal?.manifest;
  if (!manifest) {
    throw new Error('backup_payload_invalid');
  }

  if (options?.assignedDeviceId) {
    manifest.deviceId = options.assignedDeviceId;
  }

  // Handle both snake_case (Android) and camelCase (Web) records
  const records = payload.records || {};
  const preKeys = records.preKeys || records.pre_keys || {};
  const signedPreKeys = records.signedPreKeys || records.signed_pre_keys || {};
  const kyberPreKeys = records.kyberPreKeys || records.kyber_pre_keys || {};
  const sessions = records.sessions || {};

  const writeEntries: Array<[string, unknown]> = [
    ['wasmManifest', manifest],
    ...Object.entries(preKeys).map(
      ([keyId, value]) => [`wasmPreKey:${keyId}`, value] as [string, unknown],
    ),
    ...Object.entries(signedPreKeys).map(
      ([keyId, value]) => [`wasmSignedPreKey:${keyId}`, value] as [string, unknown],
    ),
    ...Object.entries(kyberPreKeys).map(
      ([keyId, value]) => [`wasmKyberPreKey:${keyId}`, value] as [string, unknown],
    ),
    ...Object.entries(sessions).map(
      ([sessionKey, value]) => [`wasmSession:${sessionKey}`, value] as [string, unknown],
    ),
  ];

  if (options?.skipDecryptCache !== true) {
    writeEntries.push(
      ...Object.entries(payload.decryptCache || {}).map(
        ([messageId, plaintext]) => [`decryptCache:${messageId}`, plaintext] as [string, unknown],
      ),
    );
  }

  const totalSteps = 1 + writeEntries.length;
  let completedSteps = 0;

  const report = async (): Promise<void> => {
    onProgress?.(Math.min(100, Math.round((completedSteps / totalSteps) * 100)));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  };

  await report();

  await withSignalDb('readwrite', async (store) => {
    const rows = await new Promise<SignalStoredRecord[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as SignalStoredRecord[]) || []);
      req.onerror = () => reject(req.error || new Error('indexeddb_delete_failed'));
    });

    for (const row of rows) {
      if (row.userId === expectedUserId) {
        store.delete([row.userId, row.key]);
      }
    }
  });

  completedSteps += 1;
  await report();

  // BATCH WRITE: Use a single transaction for all entries
  await withSignalDb('readwrite', async (store) => {
    for (const [key, value] of writeEntries) {
      store.put({ userId: expectedUserId, key, value } satisfies SignalStoredRecord);
      completedSteps += 1;
    }
  });

  await report();

  await restorePlaintextSyncKeyFromBackup(expectedUserId, payload.plaintextSyncKey);
}
