import { escapeHtml } from '@/utils';
import { sanitizeHttpUrl } from '@/utils/sanitize-url';

type ReplyMeta = {
  messageId: string;
  author: string;
  text: string;
};

function decodeChatToken(value: string): string {
  if (!value) return '';
  const normalized = value.replace(/\+/g, '%20');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

function chatLinkHtml(href: string, label: string): string {
  const safeHref = sanitizeHttpUrl(href);
  if (!safeHref) return label;
  return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

export function parseFormattedChatText(text: string): string {
  if (!text) return '';

  const cleanText = stripNoPreviewTokens(text);

  let html = escapeHtml(cleanText);

  html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_match, lang, code) => {
    const safeLang = String(lang || '').replace(/[^\w-]/g, '');
    return `<pre><code class="language-${safeLang}">${code}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/\|\|([^|]+)\|\|/g, '<span class="spoiler">$1</span>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) =>
    chatLinkHtml(String(href), String(label)),
  );
  html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (match, prefix, href) => {
    const linked = chatLinkHtml(String(href), String(href));
    if (linked === String(href)) return match;
    return `${prefix}${linked}`;
  });

  return html.replace(/\n/g, '<br>');
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<]+/i);
  if (!match) return null;
  const raw = match[0].replace(/[),.!?]+$/, '');
  return sanitizeHttpUrl(raw);
}

export function extractNoPreviewUrls(text: string): string[] {
  const urls: string[] = [];
  const regex = /\[\[CYBLIGHT_NO_PREVIEW:([^\]]+)\]\]/g;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const encoded = String(match[1] || '').trim();
    if (encoded) {
      urls.push(decodeChatToken(encoded));
    }
    match = regex.exec(text);
  }
  return urls;
}

export function extractReplyMeta(text: string): ReplyMeta | null {
  const newFormat = text.match(/\[\[CYBLIGHT_REPLY:([^:\]]+):([^:\]]*):([^\]]*)\]\]/);
  if (newFormat) {
    const messageId = String(newFormat[1] || '').trim();
    if (!messageId) return null;
    return {
      messageId,
      author: decodeChatToken(String(newFormat[2] || '').trim()) || 'Собеседник',
      text: decodeChatToken(String(newFormat[3] || '').trim()),
    };
  }

  const oldFormat = text.match(/\[\[CYBLIGHT_REPLY:([^:\]]+):([^\]]*)\]\]/);
  if (!oldFormat) return null;

  const messageId = String(oldFormat[1] || '').trim();
  if (!messageId) return null;

  return {
    messageId,
    author: 'Собеседник',
    text: decodeChatToken(String(oldFormat[2] || '').trim()),
  };
}

export function stripNoPreviewTokens(text: string): string {
  return text
    .replace(/\n?\[\[CYBLIGHT_NO_PREVIEW:[^\]]+\]\]/g, '')
    .replace(/\n?\[\[CYBLIGHT_REPLY:[^\]]+\]\]/g, '')
    .trimEnd();
}

export function isPreviewSuppressedForUrl(text: string, url: string): boolean {
  const normalize = (value: string): string => {
    try {
      const parsed = new URL(value);
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return value.trim();
    }
  };

  const target = normalize(url);
  return extractNoPreviewUrls(text).some((item) => normalize(item) === target);
}

export function buildChatLinkPreview(text: string): string {
  const url = extractFirstUrl(text);
  if (!url) return '';
  if (isPreviewSuppressedForUrl(text, url)) return '';

  return `
    <div class="chat-link-preview is-loading" data-link-preview-url="${escapeHtml(url)}">
      <div class="chat-link-preview-loading">Загрузка превью...</div>
    </div>
  `;
}
