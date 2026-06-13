let loadPromise: Promise<void> | null = null;

/** qrcodejs must load as a classic script (not ESM) — its IIFE uses top-level `this`. */
export function ensureQRCodeLoaded(): Promise<void> {
  if (window.QRCode) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-qrcodejs]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('QRCode script failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = '/vendor/qrcode.min.js';
    script.async = true;
    script.dataset.qrcodejs = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('QRCode script failed'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
