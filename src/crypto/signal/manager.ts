import {
  encryptMessage,
  decryptMessage,
  generateKyberPreKey,
  generatePreKeys,
  generateRegistrationId,
  generateSignedPreKey,
  message_type_pre_key,
  message_type_signal,
  processPreKeyBundle,
  WasmPublicKey,
} from '@getmaapp/signal-wasm';
import { apiCall } from '@/utils';
import { ensureLibsignalInitialized } from './libsignal-init';
import {
  arrayBufferToBase64,
  arrayBufferToUtf8,
  base64ToArrayBuffer,
  bytesToArrayBuffer,
  utf8ToArrayBuffer,
} from './buffer';
import {
  createWasmContext,
  loadWasmContext,
  peerAddress,
  persistWasmContext,
  trackKyberPreKey,
  trackPreKey,
  trackSession,
  trackSignedPreKey,
  type WasmSignalContext,
} from './wasm-context';

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
    kyberPreKey: {
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
let activeContext: WasmSignalContext | null = null;
let nextPreKeyId = Math.floor(Date.now() / 1000);

function makeKeyId(): number {
  nextPreKeyId += 1;
  return nextPreKeyId;
}

async function getContext(userId: string): Promise<WasmSignalContext | null> {
  if (activeContext && activeUserId === userId) {
    return activeContext;
  }
  const loaded = await loadWasmContext(userId);
  if (loaded) {
    activeUserId = userId;
    activeContext = loaded;
  }
  return loaded;
}

async function requireContext(userId: string): Promise<WasmSignalContext> {
  const ctx = await getContext(userId);
  if (!ctx) {
    throw new Error('local_keys_missing');
  }
  return ctx;
}

async function fetchKeyBundle(peerUserId: string): Promise<NonNullable<KeyBundleResponse['bundle']>> {
  const response = await apiCall(`/crypto/keys/bundle/${encodeURIComponent(peerUserId)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = (await response.json().catch(() => ({}))) as KeyBundleResponse;
  if (!response.ok || !data.ok || !data.bundle) {
    throw new Error(data.error || 'key_bundle_failed');
  }
  if (!data.bundle.kyberPreKey) {
    throw new Error('kyber_prekey_missing');
  }
  return data.bundle;
}

async function uploadKeyRegistration(
  ctx: WasmSignalContext,
  signedPreKey: { keyId: number; publicKey: string; signature: string },
  kyberPreKey: { keyId: number; publicKey: string; signature: string },
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>,
): Promise<void> {
  const response = await apiCall('/crypto/keys/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registrationId: ctx.registrationId,
      identityKey: arrayBufferToBase64(bytesToArrayBuffer(ctx.identityKeyPair.public_key.serialize())),
      signedPreKey,
      kyberPreKey,
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
  ctx: WasmSignalContext,
  count: number,
): Promise<Array<{ keyId: number; publicKey: string }>> {
  const startId = makeKeyId();
  const records = await generatePreKeys(startId, count, ctx.preKeyStore);
  const out: Array<{ keyId: number; publicKey: string }> = [];
  for (const record of records) {
    trackPreKey(ctx, record.id);
    out.push({
      keyId: record.id,
      publicKey: arrayBufferToBase64(bytesToArrayBuffer(record.public_key)),
    });
  }
  return out;
}

async function resolveSignedPreKeyForUpload(
  ctx: WasmSignalContext,
): Promise<{ keyId: number; publicKey: string; signature: string }> {
  const latestId = ctx.manifest.latestSignedPreKeyId;
  if (latestId !== undefined) {
    const exported = await ctx.signedPreKeyStore.export_signed_pre_key(latestId);
    if (exported && ctx.manifest.latestSignedPreKeyUpload) {
      return ctx.manifest.latestSignedPreKeyUpload;
    }
  }

  const keyId = makeKeyId();
  const signed = await generateSignedPreKey(keyId, ctx.identityKeyPair, ctx.signedPreKeyStore);
  trackSignedPreKey(ctx, signed.id);
  const upload = {
    keyId: signed.id,
    publicKey: arrayBufferToBase64(bytesToArrayBuffer(signed.public_key)),
    signature: arrayBufferToBase64(bytesToArrayBuffer(signed.signature)),
  };
  ctx.manifest.latestSignedPreKeyUpload = upload;
  return upload;
}

async function resolveKyberPreKeyForUpload(
  ctx: WasmSignalContext,
): Promise<{ keyId: number; publicKey: string; signature: string }> {
  const latestId = ctx.manifest.latestKyberPreKeyId;
  if (latestId !== undefined) {
    const exported = await ctx.kyberPreKeyStore.export_kyber_pre_key(latestId);
    if (exported && ctx.manifest.latestKyberPreKeyUpload) {
      return ctx.manifest.latestKyberPreKeyUpload;
    }
  }

  const keyId = makeKeyId();
  const kyber = await generateKyberPreKey(keyId, ctx.identityKeyPair, ctx.kyberPreKeyStore);
  trackKyberPreKey(ctx, kyber.id);
  const upload = {
    keyId: kyber.id,
    publicKey: arrayBufferToBase64(bytesToArrayBuffer(kyber.public_key)),
    signature: arrayBufferToBase64(bytesToArrayBuffer(kyber.signature)),
  };
  ctx.manifest.latestKyberPreKeyUpload = upload;
  return upload;
}

async function publishRegistrationKeys(ctx: WasmSignalContext): Promise<void> {
  const signedPreKey = await resolveSignedPreKeyForUpload(ctx);
  const kyberPreKey = await resolveKyberPreKeyForUpload(ctx);
  const oneTimePreKeys = await generateOneTimePreKeyBatch(ctx, ONE_TIME_PREKEY_BATCH);
  await uploadKeyRegistration(ctx, signedPreKey, kyberPreKey, oneTimePreKeys);
  await persistWasmContext(ctx);
}

export async function ensureSignalKeysRegistered(userId: string): Promise<void> {
  await ensureLibsignalInitialized();

  const statusRes = await apiCall('/crypto/keys/status', {
    method: 'GET',
    credentials: 'include',
  });
  const status = (await statusRes.json().catch(() => ({}))) as KeyStatusResponse;

  let ctx = await getContext(userId);

  if (status.registered && ctx) {
    if (!ctx.manifest.latestKyberPreKeyId) {
      await publishRegistrationKeys(ctx);
      return;
    }

    const unused = Number(status.unusedOneTimePreKeys || 0);
    if (unused < REPLENISH_THRESHOLD) {
      const batch = await generateOneTimePreKeyBatch(ctx, ONE_TIME_PREKEY_BATCH);
      await uploadOneTimePreKeys(batch);
      await persistWasmContext(ctx);
    }
    return;
  }

  if (ctx) {
    await publishRegistrationKeys(ctx);
    return;
  }

  const registrationId = generateRegistrationId();
  ctx = await createWasmContext(userId, registrationId);
  activeUserId = userId;
  activeContext = ctx;
  await publishRegistrationKeys(ctx);
}

async function ensureSession(ctx: WasmSignalContext, peerUserId: string): Promise<void> {
  const address = peerAddress(peerUserId);
  if (await ctx.sessionStore.has_session(address)) {
    return;
  }

  const bundle = await fetchKeyBundle(peerUserId);
  const preKeyId = bundle.oneTimePreKey?.keyId ?? null;
  const preKeyBytes = bundle.oneTimePreKey
    ? new Uint8Array(base64ToArrayBuffer(bundle.oneTimePreKey.publicKey))
    : null;

  await processPreKeyBundle(
    address,
    ctx.localAddress,
    bundle.registrationId,
    WasmPublicKey.deserialize(new Uint8Array(base64ToArrayBuffer(bundle.identityKey))),
    bundle.signedPreKey.keyId,
    WasmPublicKey.deserialize(new Uint8Array(base64ToArrayBuffer(bundle.signedPreKey.publicKey))),
    new Uint8Array(base64ToArrayBuffer(bundle.signedPreKey.signature)),
    preKeyId,
    preKeyBytes,
    bundle.kyberPreKey.keyId,
    new Uint8Array(base64ToArrayBuffer(bundle.kyberPreKey.publicKey)),
    new Uint8Array(base64ToArrayBuffer(bundle.kyberPreKey.signature)),
    ctx.sessionStore,
    ctx.identityStore,
  );

  await trackSession(ctx, address);
  await persistWasmContext(ctx);
}

export async function encryptOutgoingMessage(
  userId: string,
  recipientId: string,
  plaintext: string,
): Promise<EncryptedMessagePayload> {
  await ensureSignalKeysRegistered(userId);
  const ctx = await requireContext(userId);
  await ensureSession(ctx, recipientId);

  const ciphertext = await encryptMessage(
    new Uint8Array(utf8ToArrayBuffer(plaintext)),
    peerAddress(recipientId),
    ctx.localAddress,
    ctx.sessionStore,
    ctx.identityStore,
  );

  await trackSession(ctx, peerAddress(recipientId));
  await persistWasmContext(ctx);

  return {
    content: arrayBufferToBase64(bytesToArrayBuffer(ciphertext.body)),
    signalType: ciphertext.message_type,
    registrationId: ctx.registrationId,
    encryption: 'signal_v1',
  };
}

export async function decryptIncomingMessage(userId: string, message: WireMessage): Promise<string> {
  if (!message.encryption || message.encryption === 'plaintext') {
    return message.content;
  }

  await ensureSignalKeysRegistered(userId);
  const ctx = await requireContext(userId);
  const sender = peerAddress(message.senderId);
  const body = new Uint8Array(base64ToArrayBuffer(message.content));
  const signalType = Number(message.signalType);

  if (signalType !== message_type_pre_key() && signalType !== message_type_signal()) {
    throw new Error('unsupported_signal_type');
  }

  const plaintext = await decryptMessage(
    body,
    signalType,
    sender,
    ctx.localAddress,
    ctx.sessionStore,
    ctx.identityStore,
    ctx.preKeyStore,
    ctx.signedPreKeyStore,
    ctx.kyberPreKeyStore,
  );

  await trackSession(ctx, sender);
  await persistWasmContext(ctx);

  return arrayBufferToUtf8(bytesToArrayBuffer(plaintext));
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
