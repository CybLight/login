import type { StoreManifest } from '../signal/wasm-context';

export const BACKUP_FILE_FORMAT = 'cyblight-backup' as const;
export const BACKUP_PAYLOAD_FORMAT = 'cyblight-backup-payload' as const;
export const BACKUP_PAYLOAD_VERSION_V1 = 1 as const;
export const BACKUP_PAYLOAD_VERSION_V2 = 2 as const;
export const BACKUP_VERSION = 1;
export const BACKUP_KDF = 'pbkdf2-sha256' as const;
export const BACKUP_ITERATIONS = 310_000;
export const BACKUP_FILE_EXTENSION = '.cyblight-backup';

export type CyblightBackupRecords = {
  preKeys: Record<string, string>;
  signedPreKeys: Record<string, string>;
  kyberPreKeys: Record<string, string>;
  sessions: Record<string, string>;
  // Android compatibility fields
  pre_keys?: Record<string, string>;
  signed_pre_keys?: Record<string, string>;
  kyber_pre_keys?: Record<string, string>;
};

export type CyblightChatsExportPayload = {
  format: 'cyblight-chats';
  version: 1;
  exportedAt: number;
  ownerUserId: string;
  chats: Array<{
    friendId: string;
    friendUsername: string;
    messages: Array<Record<string, unknown>>;
  }>;
};

export type CyblightBackupPayloadBase = {
  format: typeof BACKUP_PAYLOAD_FORMAT;
  userId: string;
  createdAt: number;
  signal?: {
    manifest: StoreManifest;
  };
  // Android/Legacy compatibility
  manifest?: StoreManifest;
  records: CyblightBackupRecords;
  decryptCache: Record<string, string>;
  /** Base64-encoded 32-byte AES key for cross-device plaintext sync */
  plaintextSyncKey?: string;
};

export type CyblightBackupPayloadV1 = CyblightBackupPayloadBase & {
  version: typeof BACKUP_PAYLOAD_VERSION_V1;
};

export type CyblightBackupPayloadV2 = CyblightBackupPayloadBase & {
  version: typeof BACKUP_PAYLOAD_VERSION_V2;
  chats?: CyblightChatsExportPayload;
};

export type CyblightBackupPayload = CyblightBackupPayloadV1 | CyblightBackupPayloadV2;

export type CyblightBackupFileV1 = {
  format: typeof BACKUP_FILE_FORMAT;
  version: typeof BACKUP_VERSION;
  kdf: typeof BACKUP_KDF;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export function defaultBackupRecords(): CyblightBackupRecords {
  return {
    preKeys: {},
    signedPreKeys: {},
    kyberPreKeys: {},
    sessions: {},
  };
}

export function isBackupPayloadVersion(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2;
}

export function isBackupPayloadV2(payload: CyblightBackupPayload): payload is CyblightBackupPayloadV2 {
  return payload.version === BACKUP_PAYLOAD_VERSION_V2;
}
