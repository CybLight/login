export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function utf8ToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

export function arrayBufferToUtf8(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(new Uint8Array(buffer));
}

export function serializeStoreValue(value: unknown): unknown {
  if (value instanceof ArrayBuffer) {
    return { __type: 'ArrayBuffer', data: arrayBufferToBase64(value) };
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('pubKey' in obj && 'privKey' in obj) {
      return {
        __type: 'KeyPair',
        pubKey: arrayBufferToBase64(obj.pubKey as ArrayBuffer),
        privKey: arrayBufferToBase64(obj.privKey as ArrayBuffer),
      };
    }
  }
  return value;
}

export function deserializeStoreValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  if (obj.__type === 'ArrayBuffer' && typeof obj.data === 'string') {
    return base64ToArrayBuffer(obj.data);
  }
  if (obj.__type === 'KeyPair' && typeof obj.pubKey === 'string' && typeof obj.privKey === 'string') {
    return {
      pubKey: base64ToArrayBuffer(obj.pubKey),
      privKey: base64ToArrayBuffer(obj.privKey),
    };
  }
  return value;
}
