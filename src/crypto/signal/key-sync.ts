import type { WasmSignalContext } from './wasm-context';
import { bytesToArrayBuffer, arrayBufferToBase64 } from './buffer';

export type KeyStatusSnapshot = {
  deviceId?: number | null;
  registered?: boolean;
  registrationId?: number | null;
  identityKeyPublic?: string | null;
  signedPreKeyId?: number | null;
  kyberPreKeyId?: number | null;
  unusedOneTimePreKeys?: number;
  oldestUnusedPreKeyId?: number | null;
  newestUnusedPreKeyId?: number | null;
};

export type LocalKeyAudit = {
  registrationId: number;
  deviceId: number;
  identityKeyPublic: string;
  signedPreKeyId: number | null;
  signedPreKeyPresent: boolean;
  kyberPreKeyId: number | null;
  kyberPreKeyPresent: boolean;
  preKeyCount: number;
};

export async function auditLocalKeys(ctx: WasmSignalContext): Promise<LocalKeyAudit> {
  const signedId = ctx.manifest.latestSignedPreKeyId ?? null;
  const kyberId = ctx.manifest.latestKyberPreKeyId ?? null;

  let signedPresent = false;
  if (signedId !== null) {
    signedPresent = !!(await ctx.signedPreKeyStore.export_signed_pre_key(signedId));
  }

  let kyberPresent = false;
  if (kyberId !== null) {
    kyberPresent = !!(await ctx.kyberPreKeyStore.export_kyber_pre_key(kyberId));
  }

  let preKeyCount = 0;
  for (const keyId of ctx.manifest.preKeyIds) {
    if (await ctx.preKeyStore.export_pre_key(keyId)) {
      preKeyCount += 1;
    }
  }

  return {
    registrationId: ctx.registrationId,
    deviceId: ctx.deviceId,
    identityKeyPublic: arrayBufferToBase64(bytesToArrayBuffer(ctx.identityKeyPair.public_key.serialize())),
    signedPreKeyId: signedId,
    signedPreKeyPresent: signedPresent,
    kyberPreKeyId: kyberId,
    kyberPreKeyPresent: kyberPresent,
    preKeyCount,
  };
}

export function isServerLocalKeySync(
  status: KeyStatusSnapshot,
  local: LocalKeyAudit,
): boolean {
  if (!status.registered) return false;
  if (status.deviceId !== undefined && status.deviceId !== null && status.deviceId !== local.deviceId) return false;
  if (!status.registrationId || status.registrationId !== local.registrationId) return false;
  if (status.identityKeyPublic && status.identityKeyPublic !== local.identityKeyPublic) return false;
  if (status.signedPreKeyId && status.signedPreKeyId !== local.signedPreKeyId) return false;
  if (status.kyberPreKeyId && status.kyberPreKeyId !== local.kyberPreKeyId) return false;
  if (!local.signedPreKeyPresent || !local.kyberPreKeyPresent) return false;
  return true;
}

/** Best-effort protobuf scan for PreKeySignalMessage uint32 fields. */
export function peekPreKeyMessageIds(ciphertext: Uint8Array): {
  preKeyId?: number;
  signedPreKeyId?: number;
  kyberPreKeyId?: number;
} {
  if (ciphertext.length < 2) return {};

  const out: { preKeyId?: number; signedPreKeyId?: number; kyberPreKeyId?: number } = {};
  let offset = 1;

  while (offset < ciphertext.length) {
    const tag = ciphertext[offset++];
    if (tag === 0) break;

    const field = tag >> 3;
    const wire = tag & 0x7;

    if (wire === 0) {
      let value = 0;
      let shift = 0;
      while (offset < ciphertext.length) {
        const byte = ciphertext[offset++];
        value |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      if (field === 1 || field === 2) out.preKeyId = value;
      if (field === 3 || field === 10) out.signedPreKeyId = value;
      if (field === 11) out.kyberPreKeyId = value;
      continue;
    }

    if (wire === 2) {
      let length = 0;
      let shift = 0;
      while (offset < ciphertext.length) {
        const byte = ciphertext[offset++];
        length |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }
      offset += length;
      continue;
    }

    if (wire === 1) {
      offset += 8;
      continue;
    }

    if (wire === 5) {
      offset += 4;
      continue;
    }

    break;
  }

  return out;
}

export async function serverHasPrekeysOutsideLocal(
  ctx: WasmSignalContext,
  status: KeyStatusSnapshot,
): Promise<boolean> {
  const unused = Number(status.unusedOneTimePreKeys || 0);
  if (unused <= 0) return false;

  const oldest = status.oldestUnusedPreKeyId;
  const newest = status.newestUnusedPreKeyId;
  if (oldest == null || newest == null) return false;

  const oldestPresent = await hasLocalPreKeyId(ctx, oldest);
  const newestPresent = await hasLocalPreKeyId(ctx, newest);
  return !oldestPresent || !newestPresent;
}

export async function hasLocalPreKeyId(ctx: WasmSignalContext, keyId: number): Promise<boolean> {
  return !!(await ctx.preKeyStore.export_pre_key(keyId));
}
