/**
 * Banner positioning and zoom helpers
 */

export interface BannerPositionData {
  y: number;
  zoom: number;
}

export function parseBannerPosition(raw?: string | null): BannerPositionData {
  let y = 50;
  let zoom = 100;
  if (!raw || typeof raw !== 'string') return { y, zoom };

  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    const yParsed = parseInt(parts[1].replace(/[^0-9-]/g, ''), 10);
    if (!isNaN(yParsed)) y = Math.max(0, Math.min(100, yParsed));
  } else if (parts.length === 1 && parts[0]) {
    const yParsed = parseInt(parts[0].replace(/[^0-9-]/g, ''), 10);
    if (!isNaN(yParsed)) y = Math.max(0, Math.min(100, yParsed));
  }

  if (parts.length >= 3) {
    const zoomParsed = parseInt(parts[2].replace(/[^0-9]/g, ''), 10);
    if (!isNaN(zoomParsed) && zoomParsed >= 50 && zoomParsed <= 300) {
      zoom = zoomParsed;
    }
  } else if (raw.includes('scale(')) {
    const match = raw.match(/scale\(([\d.]+)\)/);
    if (match) {
      const parsedScale = parseFloat(match[1]);
      if (!isNaN(parsedScale)) zoom = Math.max(50, Math.min(300, Math.round(parsedScale * 100)));
    }
  }

  return { y, zoom };
}

export function formatBannerPosition(y: number, zoom: number = 100): string {
  const safeY = Math.max(0, Math.min(100, Math.round(y)));
  const safeZoom = Math.max(50, Math.min(300, Math.round(zoom)));
  return `50% ${safeY}% ${safeZoom}%`;
}

export function getBannerImgStyle(raw?: string | null): string {
  const { y, zoom } = parseBannerPosition(raw);
  const scaleVal = (zoom / 100).toFixed(2);
  return `object-position: 50% ${y}%; transform: scale(${scaleVal}); transform-origin: 50% ${y}%;`;
}

export function applyBannerImgStyle(el: HTMLElement | null, raw?: string | null): void {
  if (!el) return;
  const { y, zoom } = parseBannerPosition(raw);
  el.style.objectPosition = `50% ${y}%`;
  el.style.transform = `scale(${(zoom / 100).toFixed(2)})`;
  el.style.transformOrigin = `50% ${y}%`;
}

