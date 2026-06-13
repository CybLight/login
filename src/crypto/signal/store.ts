import type { Direction, KeyPairType, SessionRecordType, StorageType } from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolAddress } from '@privacyresearch/libsignal-protocol-typescript';
import { deserializeStoreValue, serializeStoreValue } from './buffer';
import type { KyberPreKeyRecord } from './kyber-prekey';

export type SignedPreKeyRecord = {
  keyId: number;
  keyPair: KeyPairType;
  signature: ArrayBuffer;
};

const DB_NAME = 'cyblight-signal-store';
const DB_VERSION = 1;
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

export class SignalProtocolStore implements StorageType {
  private readonly userId: string;
  private cache = new Map<string, unknown>();

  constructor(userId: string) {
    this.userId = userId;
  }

  private scopedKey(key: string): string {
    return key;
  }

  private async read(key: string): Promise<unknown> {
    const scoped = this.scopedKey(key);
    if (this.cache.has(scoped)) {
      return this.cache.get(scoped);
    }

    const db = await openDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get([this.userId, scoped]);
      req.onsuccess = () => {
        const row = req.result as StoredRecord | undefined;
        resolve(row ? deserializeStoreValue(row.value) : undefined);
      };
      req.onerror = () => reject(req.error || new Error('indexeddb_read_failed'));
    });
    db.close();

    if (value !== undefined) {
      this.cache.set(scoped, value);
    }
    return value;
  }

  private async write(key: string, value: unknown): Promise<void> {
    const scoped = this.scopedKey(key);
    this.cache.set(scoped, value);

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        userId: this.userId,
        key: scoped,
        value: serializeStoreValue(value),
      } satisfies StoredRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('indexeddb_write_failed'));
    });
    db.close();
  }

  private async remove(key: string): Promise<void> {
    const scoped = this.scopedKey(key);
    this.cache.delete(scoped);

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete([this.userId, scoped]);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('indexeddb_delete_failed'));
    });
    db.close();
  }

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    const kp = await this.read('identityKey');
    if (!kp || typeof kp !== 'object') return undefined;
    const pair = kp as KeyPairType;
    if (pair.pubKey && pair.privKey) return pair;
    return undefined;
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    const rid = await this.read('registrationId');
    return typeof rid === 'number' ? rid : undefined;
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction,
  ): Promise<boolean> {
    const trusted = await this.read(`identityKey${identifier}`);
    if (!(trusted instanceof ArrayBuffer)) return true;
    return arrayBuffersEqual(trusted, identityKey);
  }

  async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    const address = SignalProtocolAddress.fromString(identifier);
    const name = address.getName();
    const existing = await this.read(`identityKey${name}`);
    await this.write(`identityKey${name}`, identityKey);
    if (existing instanceof ArrayBuffer && !arrayBuffersEqual(existing, identityKey)) {
      return true;
    }
    return false;
  }

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    const res = await this.read(`25519KeypreKey${keyId}`);
    if (res && typeof res === 'object' && 'pubKey' in (res as KeyPairType)) {
      return res as KeyPairType;
    }
    return undefined;
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await this.write(`25519KeypreKey${keyId}`, keyPair);
  }

  async removePreKey(keyId: number | string): Promise<void> {
    await this.remove(`25519KeypreKey${keyId}`);
  }

  async loadSession(identifier: string): Promise<SessionRecordType | undefined> {
    const rec = await this.read(`session${identifier}`);
    return typeof rec === 'string' ? rec : undefined;
  }

  async storeSession(identifier: string, record: SessionRecordType): Promise<void> {
    await this.write(`session${identifier}`, record);
  }

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const record = await this.loadSignedPreKeyRecord(keyId);
    if (record?.keyPair) return record.keyPair;

    const res = await this.read(`25519KeysignedKey${keyId}`);
    if (!res || typeof res !== 'object') return undefined;

    const wrapped = res as Partial<SignedPreKeyRecord>;
    if (wrapped.keyPair && 'pubKey' in wrapped.keyPair) {
      return wrapped.keyPair;
    }
    if ('pubKey' in (res as KeyPairType)) {
      return res as KeyPairType;
    }
    return undefined;
  }

  async loadSignedPreKeyRecord(keyId: number | string): Promise<SignedPreKeyRecord | undefined> {
    const res = await this.read(`25519KeysignedKey${keyId}`);
    if (!res || typeof res !== 'object') return undefined;

    const record = res as Partial<SignedPreKeyRecord>;
    if (record.keyPair && record.signature instanceof ArrayBuffer && typeof record.keyId === 'number') {
      return record as SignedPreKeyRecord;
    }
    if (record.keyPair && typeof record.keyId === 'number') {
      return undefined;
    }

    return undefined;
  }

  async storeSignedPreKeyRecord(record: SignedPreKeyRecord): Promise<void> {
    await this.write(`25519KeysignedKey${record.keyId}`, record);
    await this.write('latestSignedPreKeyId', record.keyId);
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const existing = await this.loadSignedPreKeyRecord(keyId);
    if (existing) {
      await this.storeSignedPreKeyRecord({ ...existing, keyPair });
      return;
    }
    await this.write(`25519KeysignedKey${keyId}`, { keyId: Number(keyId), keyPair });
    await this.write('latestSignedPreKeyId', Number(keyId));
  }

  async getLatestSignedPreKeyId(): Promise<number | undefined> {
    const keyId = await this.read('latestSignedPreKeyId');
    return typeof keyId === 'number' ? keyId : undefined;
  }

  async getLatestSignedPreKeyRecord(): Promise<SignedPreKeyRecord | undefined> {
    const keyId = await this.getLatestSignedPreKeyId();
    if (keyId === undefined) return undefined;
    return this.loadSignedPreKeyRecord(keyId);
  }

  async hasSignedPreKey(): Promise<boolean> {
    const record = await this.getLatestSignedPreKeyRecord();
    return !!(record?.keyPair && record.signature);
  }

  async loadKyberPreKey(keyId: number | string): Promise<KyberPreKeyRecord | undefined> {
    const res = await this.read(`kyberPreKey${keyId}`);
    if (res && typeof res === 'object' && 'serializedPublic' in (res as KyberPreKeyRecord)) {
      return res as KyberPreKeyRecord;
    }
    return undefined;
  }

  async storeKyberPreKey(keyId: number | string, record: KyberPreKeyRecord): Promise<void> {
    await this.write(`kyberPreKey${keyId}`, record);
    await this.write('latestKyberPreKeyId', keyId);
  }

  async getLatestKyberPreKeyId(): Promise<number | undefined> {
    const keyId = await this.read('latestKyberPreKeyId');
    return typeof keyId === 'number' ? keyId : undefined;
  }

  async hasKyberPreKey(): Promise<boolean> {
    const keyId = await this.getLatestKyberPreKeyId();
    if (keyId === undefined) return false;
    return !!(await this.loadKyberPreKey(keyId));
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    await this.remove(`25519KeysignedKey${keyId}`);
  }

  async writeIdentityMeta(
    registrationId: number,
    identityKeyPair: KeyPairType,
  ): Promise<void> {
    await this.write('registrationId', registrationId);
    await this.write('identityKey', identityKeyPair);
  }
}

function arrayBuffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  for (let i = 0; i < av.length; i++) {
    if (av[i] !== bv[i]) return false;
  }
  return true;
}
