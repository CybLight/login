/**
 * String utilities
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Shorten string with specified left and right lengths
 * Example: shortId('1234567890', 3, 3) => '123...890'
 */
export function shortId(s: string, left: number = 6, right: number = 6): string {
  if (s.length <= left + right) return s;
  return s.substring(0, left) + '...' + s.substring(s.length - right);
}

/**
 * Format public ID (short display)
 */
export function formatPublicId(publicId: string): string {
  return shortId(publicId, 6, 6);
}

/**
 * Format timestamp
 */
export function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days < 7) return `${days} д назад`;

  return date.toLocaleDateString('ru-RU');
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Clipboard copy error:', error);
    return false;
  }
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
