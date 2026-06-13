import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import type { KeyPairType } from '@privacyresearch/libsignal-protocol-typescript';
import { ensureLibsignalInitialized } from './libsignal-init';
import { arrayBufferToBase64 } from './buffer';

/** libsignal KEMKeyType::Kyber1024 */
const LIBSIGNAL_KYBER1024_TYPE = 0x08;
const KYBER_PUBLIC_KEY_LENGTH = 1568;

export type KyberPreKeyUpload = {
  keyId: number;
  publicKey: string;
  signature: string;
};

export type KyberPreKeyRecord = {
  keyId: number;
  serializedPublic: ArrayBuffer;
  secretKey: ArrayBuffer;
  signature: ArrayBuffer;
  timestamp: number;
};

export async function generateKyberPreKeyForUpload(
  identityKeyPair: KeyPairType,
  keyId: number,
): Promise<{ upload: KyberPreKeyUpload; record: KyberPreKeyRecord }> {
  await ensureLibsignalInitialized();
  const { crypto } = await import('@privacyresearch/libsignal-protocol-typescript/lib/internal/crypto.js');

  const seed = new Uint8Array(crypto.getRandomBytes(64));
  const { publicKey, secretKey } = ml_kem1024.keygen(seed);
  if (publicKey.length !== KYBER_PUBLIC_KEY_LENGTH) {
    throw new Error('unexpected_kyber_pubkey_length');
  }

  const serialized = new Uint8Array(KYBER_PUBLIC_KEY_LENGTH + 1);
  serialized[0] = LIBSIGNAL_KYBER1024_TYPE;
  serialized.set(publicKey, 1);

  const signature = await crypto.Ed25519Sign(identityKeyPair.privKey, serialized.buffer);

  return {
    upload: {
      keyId,
      publicKey: arrayBufferToBase64(serialized.buffer),
      signature: arrayBufferToBase64(signature),
    },
    record: {
      keyId,
      serializedPublic: serialized.buffer,
      secretKey: secretKey.buffer.slice(secretKey.byteOffset, secretKey.byteOffset + secretKey.byteLength),
      signature,
      timestamp: Date.now(),
    },
  };
}
