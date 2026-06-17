import type { CyblightBackupPayload } from './format';
import { type SignalStoredRecord, withSignalDb } from '../signal/idb-store';
import { restorePlaintextSyncKeyFromBackup } from '../signal/sync-key';

export async function restoreBackupPayload(
  expectedUserId: string,
  payload: CyblightBackupPayload,
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

  for (const [key, value] of writeEntries) {
    await withSignalDb('readwrite', async (store) => {
      store.put({ userId: expectedUserId, key, value } satisfies SignalStoredRecord);
    });
    completedSteps += 1;
    await report();
  }

  await restorePlaintextSyncKeyFromBackup(expectedUserId, payload.plaintextSyncKey);
}
