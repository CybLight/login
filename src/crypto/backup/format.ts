import type { StoreManifest } from '../signal/wasm-context';

export const BACKUP_FILE_FORMAT = 'cyblight-backup' as const;
export const BACKUP_PAYLOAD_FORMAT = 'cyblight-backup-payload' as const;
export const BACKUP_VERSION = 1;
export const BACKUP_KDF = 'pbkdf2-sha256' as const;
export const BACKUP_ITERATIONS = 310_000;
export const BACKUP_FILE_EXTENSION = '.cyblight-backup';

export type CyblightBackupRecords = {
  preKeys: Record<string, string>;
  signedPreKeys: Record<string, string>;
  kyberPreKeys: Record<string, string>;
  sessions: Record<string, string>;
};

export type CyblightBackupPayloadV1 = {
  format: typeof BACKUP_PAYLOAD_FORMAT;
  version: typeof BACKUP_VERSION;
  userId: string;
  createdAt: number;
  signal: {
    manifest: StoreManifest;
  };
  records: CyblightBackupRecords;
  decryptCache: Record<string, string>;
};

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
