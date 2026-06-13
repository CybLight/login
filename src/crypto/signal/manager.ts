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
import { readDecryptCache, writeDecryptCache } from './decrypt-cache';
import {
  auditLocalKeys,
  hasLocalPreKeyId,
  isServerLocalKeySync,
  peekPreKeyMessageIds,
  serverHasPrekeysOutsideLocal,
} from './key-sync';

const ONE_TIME_PREKEY_BATCH = 100;
const REPLENISH_THRESHOLD = 20;

export type EncryptedMessagePayload = {
  content: string;
  signalType: number;
  registrationId: number;
  encryption: 'signal_v1';
};

export type WireMessage = {
  id?: string;
  content: string;
  encryption?: string | null;
  signalType?: number | null;
  registrationId?: number | null;
  senderId: string;
  createdAt?: number | null;
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
  registrationId?: number | null;
  identityKeyPublic?: string | null;
  signedPreKeyId?: number | null;
  kyberPreKeyId?: number | null;
  oldestUnusedPreKeyId?: number | null;
  newestUnusedPreKeyId?: number | null;
  unusedOneTimePreKeys?: number;
};

let activeUserId: string | null = null;
let activeContext: WasmSignalContext | null = null;

export function resetActiveSignalContext(): void {
  activeUserId = null;
  activeContext = null;
}
let nextPreKeyId = Math.floor(Date.now() / 1000);
let ensureKeysInflight: Promise<void> | null = null;
let ensureKeysForUser: string | null = null;
let prekeysAlignedForUser: string | null = null;

export type SignalKeyIssue = 'local_missing' | 'identity_conflict';
let lastSignalKeyIssue: SignalKeyIssue | null = null;

export function getSignalKeyIssue(): SignalKeyIssue | null {
  return lastSignalKeyIssue;
}

export function getSignalKeyIssueMessage(issue: SignalKeyIssue | null = lastSignalKeyIssue): string {
  if (issue === 'local_missing') {
    return 'Ключи шифрования сохранены на другом устройстве. Откройте чат в приложении или в том же браузере, где уже входили.';
  }
  if (issue === 'identity_conflict') {
    return 'Конфликт ключей шифрования в этом браузере. Очистите данные сайта или сбросьте ключи в настройках.';
  }
  return '';
}

function setSignalKeyIssue(issue: SignalKeyIssue | null): void {
  lastSignalKeyIssue = issue;
}

function throwSignalKeyIssue(issue: SignalKeyIssue, code: string): never {
  setSignalKeyIssue(issue);
  throw new Error(code);
}

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
  if (records.length > 0) {
    nextPreKeyId = Math.max(nextPreKeyId, records[records.length - 1].id);
  }
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

async function replenishOneTimePreKeys(ctx: WasmSignalContext): Promise<void> {
  const batch = await generateOneTimePreKeyBatch(ctx, ONE_TIME_PREKEY_BATCH);
  await uploadOneTimePreKeys(batch);
  await persistWasmContext(ctx);
}

async function publishRegistrationKeys(ctx: WasmSignalContext): Promise<void> {
  const signedPreKey = await resolveSignedPreKeyForUpload(ctx);
  const kyberPreKey = await resolveKyberPreKeyForUpload(ctx);
  const oneTimePreKeys = await generateOneTimePreKeyBatch(ctx, ONE_TIME_PREKEY_BATCH);
  await uploadKeyRegistration(ctx, signedPreKey, kyberPreKey, oneTimePreKeys);
  await persistWasmContext(ctx);
  prekeysAlignedForUser = ctx.userId;
}

async function ensureSignalKeysRegisteredInner(userId: string): Promise<void> {
  await ensureLibsignalInitialized();
  setSignalKeyIssue(null);

  const statusRes = await apiCall('/crypto/keys/status', {
    method: 'GET',
    credentials: 'include',
  });
  const status = (await statusRes.json().catch(() => ({}))) as KeyStatusResponse;

  let ctx = await getContext(userId);

  if (!ctx) {
    if (status.ok && status.registered) {
      throwSignalKeyIssue('local_missing', 'signal_keys_local_missing');
    }

    const registrationId = generateRegistrationId();
    ctx = await createWasmContext(userId, registrationId);
    activeUserId = userId;
    activeContext = ctx;
    await publishRegistrationKeys(ctx);
    return;
  }

  const localAudit = await auditLocalKeys(ctx);

  if (
    status.ok &&
    status.registered &&
    status.identityKeyPublic &&
    status.identityKeyPublic !== localAudit.identityKeyPublic
  ) {
    throwSignalKeyIssue('identity_conflict', 'signal_keys_identity_conflict');
  }

  const synced = isServerLocalKeySync(status, localAudit);

  if (!localAudit.signedPreKeyPresent || !localAudit.kyberPreKeyPresent || !synced) {
    await publishRegistrationKeys(ctx);
    return;
  }

  if (prekeysAlignedForUser !== userId) {
    await replenishOneTimePreKeys(ctx);
    prekeysAlignedForUser = userId;
    return;
  }

  const unused = Number(status.unusedOneTimePreKeys || 0);
  const oldestUnused = status.oldestUnusedPreKeyId;
  const oldestMissingLocally =
    oldestUnused != null && !(await hasLocalPreKeyId(ctx, oldestUnused));
  const serverHasUnknownPrekeys = await serverHasPrekeysOutsideLocal(ctx, status);

  if (unused < REPLENISH_THRESHOLD || serverHasUnknownPrekeys || oldestMissingLocally) {
    await replenishOneTimePreKeys(ctx);
  }
}

export async function ensureSignalKeysRegistered(userId: string): Promise<void> {
  if (ensureKeysInflight && ensureKeysForUser === userId) {
    return ensureKeysInflight;
  }
  ensureKeysForUser = userId;
  ensureKeysInflight = ensureSignalKeysRegisteredInner(userId).finally(() => {
    ensureKeysInflight = null;
  });
  return ensureKeysInflight;
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

export async function cacheSentPlaintext(
  userId: string,
  messageId: string,
  plaintext: string,
): Promise<void> {
  if (!messageId) return;
  await writeDecryptCache(userId, messageId, plaintext);
}

export async function decryptIncomingMessage(userId: string, message: WireMessage): Promise<string> {
  if (!message.encryption || message.encryption === 'plaintext') {
    return message.content;
  }

  if (message.senderId === userId) {
    if (message.id) {
      const cached = await readDecryptCache(userId, message.id);
      if (cached !== null) {
        return cached;
      }
    }
    return '🔒 Сообщение отправлено';
  }

  if (message.id) {
    const cached = await readDecryptCache(userId, message.id);
    if (cached !== null) {
      return cached;
    }
  }

  await ensureSignalKeysRegistered(userId);
  const ctx = await requireContext(userId);
  const sender = peerAddress(message.senderId);
  const body = new Uint8Array(base64ToArrayBuffer(message.content));
  const signalType = Number(message.signalType);

  if (signalType !== message_type_pre_key() && signalType !== message_type_signal()) {
    throw new Error('unsupported_signal_type');
  }

  let plaintext: Uint8Array;
  try {
    plaintext = await decryptMessage(
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
  } catch (error) {
    const hasSession = await ctx.sessionStore.has_session(sender);
    const preKeyIds =
      signalType === message_type_pre_key() ? peekPreKeyMessageIds(body) : {};
    const preKeyPresent =
      preKeyIds.preKeyId !== undefined
        ? await hasLocalPreKeyId(ctx, preKeyIds.preKeyId)
        : null;

    console.warn('[Signal] decrypt failed:', {
      error: String(error),
      signalType,
      hasSession,
      senderId: message.senderId,
      messageId: message.id ?? null,
      preKeyIds,
      preKeyPresent,
    });
    throw error;
  }

  await trackSession(ctx, sender);
  await persistWasmContext(ctx);

  const text = arrayBufferToUtf8(bytesToArrayBuffer(plaintext));
  if (message.id) {
    await writeDecryptCache(userId, message.id, text);
  }
  return text;
}

function messageSortKey(message: WireMessage): number {
  const raw = Number(message.createdAt ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 10_000_000_000 ? raw : raw * 1000;
}

export async function decryptMessageList<T extends WireMessage>(
  userId: string,
  messages: T[],
): Promise<Array<T & { content: string }>> {
  const decryptOrder = [...messages].sort((a, b) => messageSortKey(a) - messageSortKey(b));
  const decryptedById = new Map<string, string>();

  for (const message of decryptOrder) {
    const key = message.id ?? `${message.senderId}:${message.content}`;
    if (decryptedById.has(key)) continue;
    try {
      const content = await decryptIncomingMessage(userId, message);
      decryptedById.set(key, content);
    } catch (error) {
      const issue = getSignalKeyIssue();
      const issueMessage = getSignalKeyIssueMessage(issue);
      if (issueMessage && message.encryption === 'signal_v1' && message.senderId !== userId) {
        decryptedById.set(key, `🔒 ${issueMessage}`);
      } else {
        decryptedById.set(key, '🔒 Не удалось расшифровать сообщение');
      }
      if (issue) {
        console.warn('[Signal] decrypt skipped:', issue, message.id ?? null);
      } else {
        console.warn('[Signal] decrypt failed:', error, message.id ?? null);
      }
    }
  }

  return messages.map((message) => {
    const key = message.id ?? `${message.senderId}:${message.content}`;
    return {
      ...message,
      content: decryptedById.get(key) ?? '🔒 Не удалось расшифровать сообщение',
    };
  });
}
