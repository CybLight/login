/**
 * Storage utilities - safe localStorage/sessionStorage handling
 */

export function setStorage(key: string, value: unknown, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(key, String(value));
    return true;
  } catch (error: unknown) {
    console.warn(`Storage error [${key}]:`, error);
    return false;
  }
}

export function getStorage<T = string>(
  key: string,
  defaultValue: T | null = null,
  storage: Storage = localStorage
): T | null {
  try {
    const value = storage.getItem(key);
    return value !== null ? (value as T) : defaultValue;
  } catch (error: unknown) {
    console.warn(`Storage error [${key}]:`, error);
    return defaultValue;
  }
}

export function removeStorage(key: string, storage: Storage = localStorage): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch (error: unknown) {
    console.warn(`Storage error [${key}]:`, error);
    return false;
  }
}

export function clearStorage(storage: Storage = localStorage): boolean {
  try {
    storage.clear();
    return true;
  } catch (error: unknown) {
    console.warn('Storage clear error:', error);
    return false;
  }
}
