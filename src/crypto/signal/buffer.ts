export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

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
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function utf8ToArrayBuffer(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
}

export function arrayBufferToUtf8(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(new Uint8Array(buffer));
}

export function serializeStoreValue(value: unknown): unknown {
  if (value instanceof ArrayBuffer) {
    return { __type: 'ArrayBuffer', data: arrayBufferToBase64(value) };
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeStoreValue(item));
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
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(obj)) {
      out[key] = serializeStoreValue(nested);
    }
    return out;
  }
  return value;
}

export function deserializeStoreValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => deserializeStoreValue(item));
  }
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
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(obj)) {
    out[key] = deserializeStoreValue(nested);
  }
  return out;
}
