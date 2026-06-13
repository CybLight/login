import {
  DeviceType,
  KeyHelper,
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript';
import { apiCall } from '@/utils';
import { ensureLibsignalInitialized } from './libsignal-init';
import { SignalProtocolStore } from './store';
import {
  arrayBufferToBase64,
  arrayBufferToUtf8,
  base64ToArrayBuffer,
  utf8ToArrayBuffer,
} from './buffer';

const DEVICE_ID = 1;
const ONE_TIME_PREKEY_BATCH = 100;
const REPLENISH_THRESHOLD = 20;

export type EncryptedMessagePayload = {
  content: string;
  signalType: number;
  registrationId: number;
  encryption: 'signal_v1';
};

export type WireMessage = {
  content: string;
  encryption?: string | null;
  signalType?: number | null;
  registrationId?: number | null;
  senderId: string;
};

type KeyBundleResponse = {
  ok: boolean;
  bundle?: {
    userId: string;
    deviceId: number;
    registrationId: number;
    identityKey: string;
    signedPreKey: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
    oneTimePreKey?: {
      keyId: number;
      publicKey: string;
    } | null;
  };
  error?: string;
};

type KeyStatusResponse = {
  ok: boolean;
  registered?: boolean;
  unusedOneTimePreKeys?: number;
};

let activeUserId: string | null = null;
let activeStore: SignalProtocolStore | null = null;
let nextPreKeyId = Math.floor(Date.now() / 1000);

async function ensureLibsignalReady(): Promise<void> {
  await ensureLibsignalInitialized();
}

function makeKeyId(): number {
  nextPreKeyId += 1;
  return nextPreKeyId;
}

function getStore(userId: string): SignalProtocolStore {
  if (!activeStore || activeUserId !== userId) {
    activeStore = new SignalProtocolStore(userId);
    activeUserId = userId;
  }
  return activeStore;
}

function peerAddress(peerUserId: string): SignalProtocolAddress {
  return new SignalProtocolAddress(peerUserId, DEVICE_ID);
}

function bundleToDevice(bundle: NonNullable<KeyBundleResponse['bundle']>): DeviceType {
  return {
    identityKey: base64ToArrayBuffer(bundle.identityKey),
    registrationId: bundle.registrationId,
    signedPreKey: {
      keyId: bundle.signedPreKey.keyId,
      publicKey: base64ToArrayBuffer(bundle.signedPreKey.publicKey),
      signature: base64ToArrayBuffer(bundle.signedPreKey.signature),
    },
    preKey: bundle.oneTimePreKey
      ? {
          keyId: bundle.oneTimePreKey.keyId,
          publicKey: base64ToArrayBuffer(bundle.oneTimePreKey.publicKey),
        }
      : undefined,
  };
}

async function fetchKeyBundle(peerUserId: string): Promise<DeviceType> {
  const response = await apiCall(`/crypto/keys/bundle/${encodeURIComponent(peerUserId)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = (await response.json().catch(() => ({}))) as KeyBundleResponse;
  if (!response.ok || !data.ok || !data.bundle) {
    throw new Error(data.error || 'key_bundle_failed');
  }
  return bundleToDevice(data.bundle);
}

async function uploadKeyRegistration(
  registrationId: number,
  identityKeyPair: Awaited<ReturnType<typeof KeyHelper.generateIdentityKeyPair>>,
  signedPreKey: Awaited<ReturnType<typeof KeyHelper.generateSignedPreKey>>,
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>,
): Promise<void> {
  const response = await apiCall('/crypto/keys/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registrationId,
      identityKey: arrayBufferToBase64(identityKeyPair.pubKey),
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
        signature: arrayBufferToBase64(signedPreKey.signature),
      },
      oneTimePreKeys,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'key_register_failed');
  }
}

async function uploadOneTimePreKeys(oneTimePreKeys: Array<{ keyId: number; publicKey: string }>): Promise<void> {
  const response = await apiCall('/crypto/keys/prekeys', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oneTimePreKeys }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'prekeys_replenish_failed');
  }
}

async function generateOneTimePreKeyBatch(
  store: SignalProtocolStore,
  count: number,
): Promise<Array<{ keyId: number; publicKey: string }>> {
  const out: Array<{ keyId: number; publicKey: string }> = [];
  for (let i = 0; i < count; i++) {
    const keyId = makeKeyId();
    const preKey = await KeyHelper.generatePreKey(keyId);
    await store.storePreKey(keyId, preKey.keyPair);
    out.push({
      keyId,
      publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
    });
  }
  return out;
}

export async function ensureSignalKeysRegistered(userId: string): Promise<void> {
  await ensureLibsignalReady();
  const store = getStore(userId);

  const statusRes = await apiCall('/crypto/keys/status', {
    method: 'GET',
    credentials: 'include',
  });
  const status = (await statusRes.json().catch(() => ({}))) as KeyStatusResponse;

  const localRegistrationId = await store.getLocalRegistrationId();
  const localIdentity = await store.getIdentityKeyPair();

  if (status.registered && localRegistrationId && localIdentity) {
    const unused = Number(status.unusedOneTimePreKeys || 0);
    if (unused < REPLENISH_THRESHOLD) {
      const batch = await generateOneTimePreKeyBatch(store, ONE_TIME_PREKEY_BATCH);
      await uploadOneTimePreKeys(batch);
    }
    return;
  }

  const registrationId = KeyHelper.generateRegistrationId();
  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  await store.writeIdentityMeta(registrationId, identityKeyPair);

  const signedPreKeyId = makeKeyId();
  const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);
  await store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

  const oneTimePreKeys = await generateOneTimePreKeyBatch(store, ONE_TIME_PREKEY_BATCH);
  await uploadKeyRegistration(registrationId, identityKeyPair, signedPreKey, oneTimePreKeys);
}

function binaryBodyToBase64(body: string | ArrayBuffer): string {
  if (body instanceof ArrayBuffer) {
    return arrayBufferToBase64(body);
  }
  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) {
    bytes[i] = body.charCodeAt(i) & 0xff;
  }
  return arrayBufferToBase64(bytes.buffer);
}

async function ensureSession(userId: string, peerUserId: string): Promise<SessionCipher> {
  const store = getStore(userId);
  const address = peerAddress(peerUserId);
  const sessionCipher = new SessionCipher(store, address);
  if (await sessionCipher.hasOpenSession()) {
    return sessionCipher;
  }

  const bundle = await fetchKeyBundle(peerUserId);
  const sessionBuilder = new SessionBuilder(store, address);
  await sessionBuilder.processPreKey(bundle);
  return sessionCipher;
}

export async function encryptOutgoingMessage(
  userId: string,
  recipientId: string,
  plaintext: string,
): Promise<EncryptedMessagePayload> {
  await ensureSignalKeysRegistered(userId);
  const sessionCipher = await ensureSession(userId, recipientId);
  const ciphertext = await sessionCipher.encrypt(utf8ToArrayBuffer(plaintext));

  if (!ciphertext.body || typeof ciphertext.type !== 'number') {
    throw new Error('encrypt_failed');
  }

  const registrationId =
    ciphertext.registrationId ?? (await getStore(userId).getLocalRegistrationId()) ?? 0;
  if (!registrationId) {
    throw new Error('registration_id_missing');
  }

  return {
    content: binaryBodyToBase64(ciphertext.body),
    signalType: ciphertext.type,
    registrationId,
    encryption: 'signal_v1',
  };
}

export async function decryptIncomingMessage(userId: string, message: WireMessage): Promise<string> {
  if (!message.encryption || message.encryption === 'plaintext') {
    return message.content;
  }

  await ensureLibsignalReady();
  const store = getStore(userId);
  const address = peerAddress(message.senderId);
  const sessionCipher = new SessionCipher(store, address);
  const body = base64ToArrayBuffer(message.content);
  const signalType = Number(message.signalType);

  let plaintext: ArrayBuffer;
  if (signalType === 3) {
    plaintext = await sessionCipher.decryptPreKeyWhisperMessage(body, 'binary');
  } else if (signalType === 1) {
    plaintext = await sessionCipher.decryptWhisperMessage(body, 'binary');
  } else {
    throw new Error('unsupported_signal_type');
  }

  return arrayBufferToUtf8(plaintext);
}

export async function decryptMessageList<T extends WireMessage>(
  userId: string,
  messages: T[],
): Promise<Array<T & { content: string }>> {
  const out: Array<T & { content: string }> = [];
  for (const message of messages) {
    try {
      const content = await decryptIncomingMessage(userId, message);
      out.push({ ...message, content });
    } catch (error) {
      console.error('[Signal] decrypt failed:', error);
      out.push({ ...message, content: '🔒 Не удалось расшифровать сообщение' });
    }
  }
  return out;
}
