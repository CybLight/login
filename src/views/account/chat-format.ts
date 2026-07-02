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

type QuoteChunk = {
  quoted: boolean;
  text: string;
};

function splitQuoteChunks(text: string): QuoteChunk[] {
  const lines = text.split('\n');
  const chunks: QuoteChunk[] = [];
  let current: { quoted: boolean; lines: string[] } | null = null;

  for (const line of lines) {
    const quoted = line.startsWith('> ');
    const content = quoted ? line.slice(2) : line;

    if (!current || current.quoted !== quoted) {
      if (current) {
        chunks.push({ quoted: current.quoted, text: current.lines.join('\n') });
      }
      current = { quoted, lines: [content] };
      continue;
    }

    current.lines.push(content);
  }

  if (current) {
    chunks.push({ quoted: current.quoted, text: current.lines.join('\n') });
  }

  return chunks;
}

function applyInlineFormatting(html: string): string {
  let next = html;
  next = next.replace(/`([^`]+)`/g, '<code>$1</code>');
  next = next.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  next = next.replace(/__([^_]+)__/g, '<u>$1</u>');
  next = next.replace(/_([^_]+)_/g, '<em>$1</em>');
  next = next.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  next = next.replace(/\|\|([^|]+)\|\|/g, '<span class="spoiler">$1</span>');
  next = next.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) =>
    chatLinkHtml(String(href), String(label)),
  );
  next = next.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (match, prefix, href) => {
    const linked = chatLinkHtml(String(href), String(href));
    if (linked === String(href)) return match;
    return `${prefix}${linked}`;
  });
  return next;
}

function renderPlainBlock(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_match, lang, code) => {
    const safeLang = String(lang || '').replace(/[^\w-]/g, '');
    return `<pre><code class="language-${safeLang}">${code}</code></pre>`;
  });

  html = applyInlineFormatting(html);
  return html.replace(/\n/g, '<br>');
}

function renderQuotedBlock(text: string): string {
  const html = applyInlineFormatting(escapeHtml(text));
  return `<blockquote class="chat-blockquote">${html.replace(/\n/g, '<br>')}</blockquote>`;
}

export function parseFormattedChatText(text: string): string {
  if (!text) return '';

  const cleanText = stripNoPreviewTokens(text);
  const chunks = splitQuoteChunks(cleanText);

  return chunks
    .map((chunk) => (chunk.quoted ? renderQuotedBlock(chunk.text) : renderPlainBlock(chunk.text)))
    .join('<br>');
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>\*\_~\|\[\]()]+/i);
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

export const SPOILER_PREVIEW_MARKER = '[[spoiler]]';

export function maskSpoilersForPreview(content: string): string {
  return content.replace(/\|\|([^|]+)\|\|/g, SPOILER_PREVIEW_MARKER);
}

export function stripPreviewFormatting(content: string): string {
  return maskSpoilersForPreview(content)
    .replace(/\[reply:[^\]]+\]/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^>\s?/gm, '');
}

export function truncatePreviewText(content: string, maxLen = 120): string {
  const plain = stripPreviewFormatting(content).replace(/\s+/g, ' ').trim();

  if (!plain) return 'Новое сообщение';
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}

export function renderChatListPreviewHtml(text: string): string {
  const normalized = maskSpoilersForPreview(text);
  const parts = normalized.split(SPOILER_PREVIEW_MARKER);

  return parts
    .map((part, index) => {
      const segment = escapeHtml(part);
      if (index < parts.length - 1) {
        return `${segment}<span class="spoiler chat-list-preview-spoiler" aria-hidden="true"></span>`;
      }
      return segment;
    })
    .join('');
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
