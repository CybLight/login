import { apiCall } from './api';

export function messageHasFormatting(content: string): boolean {
  const text = content.trim();
  if (!text) return false;
  return (
    /\*\*.+?\*\*/.test(text) ||
    /__.+__/.test(text) ||
    /(?<![\w\\])_.+?_(?![\w])/.test(text) ||
    /~~.+?~~/.test(text) ||
    /\|\|.+?\|\|/.test(text) ||
    /`.+?`/.test(text) ||
    /```[\s\S]+?```/.test(text) ||
    /^>\s/m.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text)
  );
}

export async function touchFormatMirrorWeb(outgoingContent: string): Promise<void> {
  if (!messageHasFormatting(outgoingContent)) return;
  try {
    await apiCall('/auth/easter/touch-format-web', {
      method: 'POST',
      credentials: 'include',
      body: '{}',
    });
  } catch {
    // ignore
  }
}
