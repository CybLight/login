import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  bytesToArrayBuffer,
  utf8ToArrayBuffer,
} from '../signal/buffer';
import {
  BACKUP_FILE_FORMAT,
  BACKUP_ITERATIONS,
  BACKUP_KDF,
  BACKUP_VERSION,
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

async function compress(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(data).body!.pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

async function decompress(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(data).body!.pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

export async function encryptBackupPayload(
  payload: CyblightBackupPayload,
  password: string,
): Promise<CyblightBackupFileV1> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, BACKUP_ITERATIONS);

  const jsonBytes = utf8ToArrayBuffer(JSON.stringify(payload));
  const plaintext = await compress(jsonBytes);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
    key,
    plaintext,
  );

  return {
    format: BACKUP_FILE_FORMAT,
    version: BACKUP_VERSION, // Version 2 includes GZIP compression
    kdf: BACKUP_KDF,
    iterations: BACKUP_ITERATIONS,
    salt: arrayBufferToBase64(bytesToArrayBuffer(salt)),
    iv: arrayBufferToBase64(bytesToArrayBuffer(iv)),
    ciphertext: arrayBufferToBase64(encrypted),
  };
}

export async function decryptBackupPayload(
  file: any,
  password: string,
): Promise<CyblightBackupPayload> {
  const format = file.format || BACKUP_FILE_FORMAT;
  const kdf = file.kdf || BACKUP_KDF;
  const iterations = file.iterations || BACKUP_ITERATIONS;
  const version = file.version || 1;
  const saltStr = file.salt || file.saltBase64;
  const ivStr = file.iv || file.ivBase64;

  if (format !== BACKUP_FILE_FORMAT) {
    throw new Error('backup_format_unsupported');
  }
  if (kdf !== BACKUP_KDF) {
    throw new Error('backup_kdf_unsupported');
  }
  if (!saltStr || !ivStr || !file.ciphertext) {
    throw new Error('backup_file_invalid');
  }

  const salt = new Uint8Array(base64ToArrayBuffer(saltStr));
  const iv = new Uint8Array(base64ToArrayBuffer(ivStr));
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = base64ToArrayBuffer(file.ciphertext);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesToArrayBuffer(iv) },
      key,
      ciphertext,
    );
  } catch (err) {
    console.error('[Backup] Decrypt failed:', err);
    throw new Error('backup_password_invalid');
  }

  let decompressed: ArrayBuffer;
  if (version >= 2) {
    try {
      decompressed = await decompress(decrypted);
    } catch (err) {
      console.error('[Backup] GZIP decompression failed:', err);
      throw new Error('backup_payload_invalid');
    }
  } else {
    decompressed = decrypted;
  }

  let decryptedText: string;
  try {
    decryptedText = new TextDecoder().decode(decompressed);
  } catch (err) {
    console.error('[Backup] Utf8 decode failed:', err);
    throw new Error('backup_payload_invalid');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(decryptedText);
  } catch (err) {
    console.error('[Backup] JSON parse failed:', err);
    throw new Error('backup_payload_invalid');
  }

  if (parsed.format !== 'cyblight-backup-payload') {
    throw new Error('backup_payload_invalid');
  }

  // Handle Android versioning or legacy field mappings if needed
  if (parsed.version === undefined) {
      (parsed as any).version = 1;
  }

  return parsed as CyblightBackupPayload;
}

export function serializeBackupFile(file: CyblightBackupFileV1): string {
  return JSON.stringify(file);
}

export function parseBackupFile(raw: string): any {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.format && parsed.format !== BACKUP_FILE_FORMAT)) {
      // Some old backups might not have format field at top level
      if (!parsed.ciphertext || (!parsed.salt && !parsed.saltBase64)) {
        throw new Error('backup_file_invalid');
      }
    }
    return parsed;
  } catch (err) {
    console.error('[Backup] File parse failed:', err);
    throw new Error('backup_file_invalid');
  }
}
