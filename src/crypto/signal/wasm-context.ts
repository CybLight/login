import {
  WasmIdentityKeyPair,
  WasmInMemIdentityKeyStore,
  WasmInMemKyberPreKeyStore,
  WasmInMemPreKeyStore,
  WasmInMemSessionStore,
  WasmInMemSignedPreKeyStore,
  WasmPrivateKey,
  WasmProtocolAddress,
} from '@getmaapp/signal-wasm';
import { arrayBufferToBase64, base64ToArrayBuffer, bytesToArrayBuffer } from './buffer';
import { ensureLibsignalInitialized } from './libsignal-init';

const DB_NAME = 'cyblight-signal-store';
const DB_VERSION = 2;
const STORE_NAME = 'kv';

export const DEVICE_ID = 1;

type StoredRecord = {
  userId: string;
  key: string;
  value: unknown;
};

export type PreKeyUploadMeta = {
  keyId: number;
  publicKey: string;
  signature: string;
};

export type StoreManifest = {
  registrationId: number;
  identitySerialized: string;
  preKeyIds: number[];
  signedPreKeyIds: number[];
  kyberPreKeyIds: number[];
  sessionKeys: string[];
  latestSignedPreKeyId?: number;
  latestKyberPreKeyId?: number;
  latestSignedPreKeyUpload?: PreKeyUploadMeta;
  latestKyberPreKeyUpload?: PreKeyUploadMeta;
};

export type WasmSignalContext = {
  userId: string;
  registrationId: number;
  identityKeyPair: WasmIdentityKeyPair;
  localAddress: WasmProtocolAddress;
  identityStore: WasmInMemIdentityKeyStore;
  preKeyStore: WasmInMemPreKeyStore;
  signedPreKeyStore: WasmInMemSignedPreKeyStore;
  kyberPreKeyStore: WasmInMemKyberPreKeyStore;
  sessionStore: WasmInMemSessionStore;
  manifest: StoreManifest;
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

async function readAllValuesForUser(userId: string): Promise<Map<string, unknown>> {
  const db = await openDb();
  const values = new Map<string, unknown>();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      for (const row of (req.result as StoredRecord[]) || []) {
        if (row.userId === userId) {
          values.set(row.key, row.value);
        }
      }
    };
    req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('indexeddb_read_failed'));
  });

  db.close();
  return values;
}

async function writeValuesBatch(userId: string, entries: Array<[string, unknown]>): Promise<void> {
  if (entries.length === 0) return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const [key, value] of entries) {
      store.put({ userId, key, value } satisfies StoredRecord);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('indexeddb_write_failed'));
  });
  db.close();
}

export function sessionKey(address: WasmProtocolAddress): string {
  return `${address.name}:${address.deviceId}`;
}

export function peerAddress(peerUserId: string): WasmProtocolAddress {
  return new WasmProtocolAddress(peerUserId, DEVICE_ID);
}

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

export async function loadWasmContext(userId: string): Promise<WasmSignalContext | null> {
  await ensureLibsignalInitialized();

  const storedValues = await readAllValuesForUser(userId);
  const rawManifest = storedValues.get('wasmManifest');
  if (!rawManifest || typeof rawManifest !== 'object') {
    return null;
  }

  const manifest = rawManifest as StoreManifest;
  if (!manifest.identitySerialized || !manifest.registrationId) {
    return null;
  }

  const identityKeyPair = WasmIdentityKeyPair.deserialize(
    toUint8Array(base64ToArrayBuffer(manifest.identitySerialized)),
  );
  const localAddress = new WasmProtocolAddress(userId, DEVICE_ID);

  const identityStore = new WasmInMemIdentityKeyStore(identityKeyPair, manifest.registrationId);
  const preKeyStore = new WasmInMemPreKeyStore();
  const signedPreKeyStore = new WasmInMemSignedPreKeyStore();
  const kyberPreKeyStore = new WasmInMemKyberPreKeyStore();
  const sessionStore = new WasmInMemSessionStore();

  for (const keyId of manifest.preKeyIds) {
    const raw = storedValues.get(`wasmPreKey:${keyId}`);
    if (typeof raw === 'string') {
      await preKeyStore.import_pre_key(keyId, toUint8Array(base64ToArrayBuffer(raw)));
    }
  }

  for (const keyId of manifest.signedPreKeyIds) {
    const raw = storedValues.get(`wasmSignedPreKey:${keyId}`);
    if (typeof raw === 'string') {
      await signedPreKeyStore.import_signed_pre_key(keyId, toUint8Array(base64ToArrayBuffer(raw)));
    }
  }

  for (const keyId of manifest.kyberPreKeyIds) {
    const raw = storedValues.get(`wasmKyberPreKey:${keyId}`);
    if (typeof raw === 'string') {
      await kyberPreKeyStore.import_kyber_pre_key(keyId, toUint8Array(base64ToArrayBuffer(raw)));
    }
  }

  for (const key of manifest.sessionKeys) {
    const raw = storedValues.get(`wasmSession:${key}`);
    if (typeof raw !== 'string') continue;
    const [name, deviceIdRaw] = key.split(':');
    const deviceId = Number(deviceIdRaw);
    if (!name || !Number.isFinite(deviceId)) continue;
    const address = new WasmProtocolAddress(name, deviceId);
    await sessionStore.import_session(address, toUint8Array(base64ToArrayBuffer(raw)));
  }

  if (manifest.latestSignedPreKeyId !== undefined) {
    const signed = await signedPreKeyStore.export_signed_pre_key(manifest.latestSignedPreKeyId);
    if (!signed) return null;
  }
  if (manifest.latestKyberPreKeyId !== undefined) {
    const kyber = await kyberPreKeyStore.export_kyber_pre_key(manifest.latestKyberPreKeyId);
    if (!kyber) return null;
  }

  return {
    userId,
    registrationId: manifest.registrationId,
    identityKeyPair,
    localAddress,
    identityStore,
    preKeyStore,
    signedPreKeyStore,
    kyberPreKeyStore,
    sessionStore,
    manifest,
  };
}

export async function createWasmContext(userId: string, registrationId: number): Promise<WasmSignalContext> {
  await ensureLibsignalInitialized();

  const privateKey = WasmPrivateKey.generate();
  const publicKey = privateKey.getPublicKey();
  const identityKeyPair = new WasmIdentityKeyPair(publicKey, privateKey);
  const localAddress = new WasmProtocolAddress(userId, DEVICE_ID);

  const manifest: StoreManifest = {
    registrationId,
    identitySerialized: arrayBufferToBase64(bytesToArrayBuffer(identityKeyPair.serialize())),
    preKeyIds: [],
    signedPreKeyIds: [],
    kyberPreKeyIds: [],
    sessionKeys: [],
  };

  const ctx: WasmSignalContext = {
    userId,
    registrationId,
    identityKeyPair,
    localAddress,
    identityStore: new WasmInMemIdentityKeyStore(identityKeyPair, registrationId),
    preKeyStore: new WasmInMemPreKeyStore(),
    signedPreKeyStore: new WasmInMemSignedPreKeyStore(),
    kyberPreKeyStore: new WasmInMemKyberPreKeyStore(),
    sessionStore: new WasmInMemSessionStore(),
    manifest,
  };

  await persistWasmContext(ctx);
  return ctx;
}

export async function persistWasmContext(ctx: WasmSignalContext): Promise<void> {
  const { userId, manifest, preKeyStore, signedPreKeyStore, kyberPreKeyStore, sessionStore } = ctx;
  const writes: Array<[string, unknown]> = [];

  const nextPreKeyIds: number[] = [];
  for (const keyId of manifest.preKeyIds) {
    const exported = await preKeyStore.export_pre_key(keyId);
    if (!exported) continue;
    nextPreKeyIds.push(keyId);
    writes.push([
      `wasmPreKey:${keyId}`,
      arrayBufferToBase64(bytesToArrayBuffer(exported)),
    ]);
  }
  manifest.preKeyIds = nextPreKeyIds;

  const nextSignedPreKeyIds: number[] = [];
  for (const keyId of manifest.signedPreKeyIds) {
    const exported = await signedPreKeyStore.export_signed_pre_key(keyId);
    if (!exported) continue;
    nextSignedPreKeyIds.push(keyId);
    writes.push([
      `wasmSignedPreKey:${keyId}`,
      arrayBufferToBase64(bytesToArrayBuffer(exported)),
    ]);
  }
  manifest.signedPreKeyIds = nextSignedPreKeyIds;

  const nextKyberPreKeyIds: number[] = [];
  for (const keyId of manifest.kyberPreKeyIds) {
    const exported = await kyberPreKeyStore.export_kyber_pre_key(keyId);
    if (!exported) continue;
    nextKyberPreKeyIds.push(keyId);
    writes.push([
      `wasmKyberPreKey:${keyId}`,
      arrayBufferToBase64(bytesToArrayBuffer(exported)),
    ]);
  }
  manifest.kyberPreKeyIds = nextKyberPreKeyIds;

  const nextSessionKeys: string[] = [];
  for (const key of manifest.sessionKeys) {
    const [name, deviceIdRaw] = key.split(':');
    const deviceId = Number(deviceIdRaw);
    if (!name || !Number.isFinite(deviceId)) continue;
    const address = new WasmProtocolAddress(name, deviceId);
    const exported = await sessionStore.export_session(address);
    if (!exported) continue;
    nextSessionKeys.push(key);
    writes.push([
      `wasmSession:${key}`,
      arrayBufferToBase64(bytesToArrayBuffer(exported)),
    ]);
  }
  manifest.sessionKeys = nextSessionKeys;

  writes.push(['wasmManifest', manifest]);
  await writeValuesBatch(userId, writes);
}

export function trackPreKey(ctx: WasmSignalContext, keyId: number): void {
  if (!ctx.manifest.preKeyIds.includes(keyId)) {
    ctx.manifest.preKeyIds.push(keyId);
  }
}

export function trackSignedPreKey(ctx: WasmSignalContext, keyId: number): void {
  if (!ctx.manifest.signedPreKeyIds.includes(keyId)) {
    ctx.manifest.signedPreKeyIds.push(keyId);
  }
  ctx.manifest.latestSignedPreKeyId = keyId;
}

export function trackKyberPreKey(ctx: WasmSignalContext, keyId: number): void {
  if (!ctx.manifest.kyberPreKeyIds.includes(keyId)) {
    ctx.manifest.kyberPreKeyIds.push(keyId);
  }
  ctx.manifest.latestKyberPreKeyId = keyId;
}

export async function trackSession(ctx: WasmSignalContext, address: WasmProtocolAddress): Promise<void> {
  const key = sessionKey(address);
  if (!ctx.manifest.sessionKeys.includes(key)) {
    ctx.manifest.sessionKeys.push(key);
  }
  if (!(await ctx.sessionStore.has_session(address))) {
    const idx = ctx.manifest.sessionKeys.indexOf(key);
    if (idx >= 0) ctx.manifest.sessionKeys.splice(idx, 1);
  }
}
