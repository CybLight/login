/**
 * Banner positioning and zoom helpers
 */

export interface BannerPositionData {
  x: number;
  y: number;
  zoom: number;
}

export function parseBannerPosition(raw?: string | null): BannerPositionData {
  let x = 50;
  let y = 50;
  let zoom = 100;
  if (!raw || typeof raw !== 'string') return { x, y, zoom };

  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    const xParsed = parseInt(parts[0].replace(/[^0-9-]/g, ''), 10);
    if (!isNaN(xParsed)) x = Math.max(0, Math.min(100, xParsed));
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

  return { x, y, zoom };
}

export function formatBannerPosition(x: number = 50, y: number = 50, zoom: number = 100): string {
  const safeX = Math.max(0, Math.min(100, Math.round(x)));
  const safeY = Math.max(0, Math.min(100, Math.round(y)));
  const safeZoom = Math.max(50, Math.min(300, Math.round(zoom)));
  return `${safeX}% ${safeY}% ${safeZoom}%`;
}

export function getBannerImgStyle(raw?: string | null): string {
  const { x, y, zoom } = parseBannerPosition(raw);
  const scaleVal = (zoom / 100).toFixed(2);
  return `object-position: ${x}% ${y}%; transform: scale(${scaleVal}); transform-origin: ${x}% ${y}%;`;
}

export function applyBannerImgStyle(el: HTMLElement | null, raw?: string | null): void {
  if (!el) return;
  const { x, y, zoom } = parseBannerPosition(raw);
  el.style.objectPosition = `${x}% ${y}%`;
  el.style.transform = `scale(${(zoom / 100).toFixed(2)})`;
  el.style.transformOrigin = `${x}% ${y}%`;
}


