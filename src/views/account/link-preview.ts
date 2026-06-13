import type { MicrolinkData } from '@/types';
import { escapeHtml } from '@/utils';
import { allowsUsageConsent } from '@/utils/privacy-guard';
import { sanitizeHttpUrl } from '@/utils/sanitize-url';

type RichLinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};

const accountLinkPreviewCache = new Map<string, RichLinkPreview | null>();
const accountLinkPreviewLoading = new Map<string, Promise<RichLinkPreview | null>>();

export function renderRichLinkPreview(url: string, preview: RichLinkPreview | null): string {
  const safeUrl = sanitizeHttpUrl(url) || '#';
  if (!preview) {
    let fallbackHost = url;
    let fallbackDisplay = url;
    try {
      const parsed = new URL(url);
      fallbackHost = parsed.hostname;
      fallbackDisplay = `${parsed.hostname}${parsed.pathname}${parsed.search}`;
    } catch {
      // fallback to raw URL
    }

    return `
      <a class="chat-link-preview" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">
        <div class="chat-link-preview-main">
          <div class="chat-link-preview-title">${escapeHtml(fallbackHost)}</div>
          <div class="chat-link-preview-url">${escapeHtml(fallbackDisplay)}</div>
        </div>
      </a>
    `;
  }

  const previewUrl = sanitizeHttpUrl(preview.url || url) || safeUrl;
  const displayUrl = (() => {
    try {
      const parsed = new URL(previewUrl);
      return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
    } catch {
      return previewUrl;
    }
  })();

  return `
    <a class="chat-link-preview" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer">
      <div class="chat-link-preview-main">
        <div class="chat-link-preview-title">${escapeHtml(
          preview.title || preview.siteName || 'Ссылка'
        )}</div>
        ${preview.description ? `<div class="chat-link-preview-desc">${escapeHtml(preview.description)}</div>` : ''}
        <div class="chat-link-preview-url">${escapeHtml(displayUrl)}</div>
      </div>
      ${preview.image ? `<img class="chat-link-preview-thumb" src="${escapeHtml(preview.image)}" alt="preview" loading="lazy" />` : ''}
    </a>
  `;
}

export function renderCachedChatLinkPreview(url: string): string {
  const cached = accountLinkPreviewCache.has(url) ? accountLinkPreviewCache.get(url) || null : null;
  return renderRichLinkPreview(url, cached);
}

async function fetchRichLinkPreview(url: string): Promise<RichLinkPreview | null> {
  if (!allowsUsageConsent()) return null;

  if (accountLinkPreviewCache.has(url)) {
    return accountLinkPreviewCache.get(url) || null;
  }

  const pending = accountLinkPreviewLoading.get(url);
  if (pending) return pending;

  const request = (async () => {
    try {
      const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true&screenshot=false`;
      const response = await fetch(endpoint);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || payload.status !== 'success' || !payload.data) {
        accountLinkPreviewCache.set(url, null);
        return null;
      }

      const data = payload.data as MicrolinkData;
      const preview: RichLinkPreview = {
        url: String(data.url || url),
        title: String(data.title || '').trim(),
        description: String(data.description || '').trim(),
        image: String(data.image?.url || data.logo?.url || '').trim(),
        siteName: String(data.publisher || data.author || '').trim(),
      };

      accountLinkPreviewCache.set(url, preview);
      return preview;
    } catch {
      accountLinkPreviewCache.set(url, null);
      return null;
    } finally {
      accountLinkPreviewLoading.delete(url);
    }
  })();

  accountLinkPreviewLoading.set(url, request);
  return request;
}

export async function hydrateChatLinkPreviews(container: HTMLElement): Promise<void> {
  if (!allowsUsageConsent()) return;

  const placeholders = Array.from(
    container.querySelectorAll<HTMLElement>('[data-link-preview-url]')
  );
  if (placeholders.length === 0) return;

  await Promise.all(
    placeholders.map(async (placeholder) => {
      const url = String(placeholder.dataset.linkPreviewUrl || '').trim();
      if (!url) return;

      const preview = await fetchRichLinkPreview(url);
      placeholder.outerHTML = renderRichLinkPreview(url, preview);
    })
  );
}
