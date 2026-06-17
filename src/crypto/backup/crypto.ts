import {
  arrayBufferToBase64,
  arrayBufferToUtf8,
  base64ToArrayBuffer,
  bytesToArrayBuffer,
  utf8ToArrayBuffer,
} from '../signal/buffer';
import {
  BACKUP_FILE_FORMAT,
  BACKUP_ITERATIONS,
  BACKUP_KDF,
  BACKUP_VERSION,
  isBackupPayloadVersion,
  type CyblightBackupFileV1,
  type CyblightBackupPayload,
} from './format';

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    utf8ToArrayBuffer(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: bytesToArrayBuffer(salt) as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackupPayload(
  payload: CyblightBackupPayload,
  password: string,
): Promise<CyblightBackupFileV1> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, BACKUP_ITERATIONS);
  const plaintext = utf8ToArrayBuffer(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
    key,
    plaintext,
  );

  return {
    format: BACKUP_FILE_FORMAT,
    version: BACKUP_VERSION,
    kdf: BACKUP_KDF,
    iterations: BACKUP_ITERATIONS,
    salt: arrayBufferToBase64(bytesToArrayBuffer(salt)),
    iv: arrayBufferToBase64(bytesToArrayBuffer(iv)),
    ciphertext: arrayBufferToBase64(encrypted),
  };
}

export async function decryptBackupPayload(
  file: CyblightBackupFileV1,
  password: string,
): Promise<CyblightBackupPayload> {
  if (file.format !== BACKUP_FILE_FORMAT || file.version !== BACKUP_VERSION) {
    throw new Error('backup_format_unsupported');
  }
  if (file.kdf !== BACKUP_KDF) {
    throw new Error('backup_kdf_unsupported');
  }

  const salt = new Uint8Array(base64ToArrayBuffer(file.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(file.iv));
  const key = await deriveKey(password, salt, file.iterations);
  const ciphertext = base64ToArrayBuffer(file.ciphertext);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
      key,
      ciphertext,
    );
  } catch {
    throw new Error('backup_password_invalid');
  }

  const parsed = JSON.parse(arrayBufferToUtf8(decrypted)) as CyblightBackupPayload;
  if (
    parsed.format !== 'cyblight-backup-payload' ||
    !isBackupPayloadVersion(parsed.version)
  ) {
    throw new Error('backup_payload_invalid');
  }
  return parsed;
}

export function serializeBackupFile(file: CyblightBackupFileV1): string {
  return JSON.stringify(file);
}

export function parseBackupFile(raw: string): CyblightBackupFileV1 {
  const parsed = JSON.parse(raw) as CyblightBackupFileV1;
  if (!parsed || parsed.format !== BACKUP_FILE_FORMAT) {
    throw new Error('backup_file_invalid');
  }
  return parsed;
}
