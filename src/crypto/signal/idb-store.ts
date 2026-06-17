const DB_NAME = 'cyblight-signal-store';
const DB_VERSION = 5;
const STORE_NAME = 'kv';

export type SignalStoredRecord = {
  userId: string;
  key: string;
  value: unknown;
};

export const SIGNAL_IDB = {
  dbName: DB_NAME,
  dbVersion: DB_VERSION,
  storeName: STORE_NAME,
} as const;

function ensureObjectStore(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'key'] });
  }
}

function openSignalDbAtVersion(version: number, allowRetry: boolean): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);

    request.onupgradeneeded = () => {
      ensureObjectStore(request.result);
    };

    request.onsuccess = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        resolve(db);
        return;
      }

      db.close();
      if (!allowRetry) {
        reject(new Error('indexeddb_store_missing'));
        return;
      }

      void openSignalDbAtVersion(db.version + 1, true).then(resolve).catch(reject);
    };

    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
  });
}

export function openSignalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const probe = indexedDB.open(DB_NAME);

    probe.onsuccess = () => {
      const currentVersion = probe.result.version;
      probe.result.close();
      const targetVersion = Math.max(DB_VERSION, currentVersion);
      void openSignalDbAtVersion(targetVersion, true).then(resolve).catch(reject);
    };

    probe.onerror = () => {
      void openSignalDbAtVersion(DB_VERSION, true).then(resolve).catch(reject);
    };
  });
}

export async function withSignalDb<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openSignalDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);

      let output: T | undefined;
      let runError: unknown;

      void Promise.resolve(run(store))
        .then((value) => {
          output = value;
        })
        .catch((error) => {
          runError = error;
        });

      tx.oncomplete = () => {
        if (runError) reject(runError);
        else resolve(output as T);
      };
      tx.onerror = () => reject(tx.error || new Error('indexeddb_tx_failed'));
    });
  } finally {
    db.close();
  }
}

export async function readSignalDbSafely<T>(
  fallback: T,
  run: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  try {
    return await withSignalDb('readonly', run);
  } catch (error) {
    console.warn('[SignalIDB] read failed:', error);
    return fallback;
  }
}
