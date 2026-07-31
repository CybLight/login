/**
 * External Link Security Guard & Warning Modal
 * Предупреждение о переходе на сторонние ресурсы
 */

import { t } from '@/i18n';
import { escapeHtml } from '@/utils';
import { trapFocus } from '@/utils/focus';

/**
 * Проверяет, является ли URL внутренним для приложения CybLight
 */
export function isInternalUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();

  // Игнорируем якоря, js-схемы, почту, телефон
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return true;
  }

  try {
    const parsed = new URL(trimmed, window.location.href);
    const host = parsed.hostname.toLowerCase();
    const currentHost = window.location.hostname.toLowerCase();

    if (
      host === currentHost ||
      host === 'cyblight.org' ||
      host.endsWith('.cyblight.org') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return true;
    }
  } catch {
    // В случае ошибки парсинга считаем ссылку не заслуживающей доверия внешнего перехода
    return false;
  }

  return false;
}

/**
 * Отобразить модальное окно предупреждения о переходе на сторонний сайт
 */
export function showExternalLinkModal(targetUrl: string): Promise<boolean> {
  const existing = document.getElementById('cybExternalLinkModal');
  existing?.remove();

  return new Promise((resolve) => {
    let hostName = 'сторонний ресурс';
    let cleanHref = targetUrl.trim();
    if (!cleanHref.startsWith('http://') && !cleanHref.startsWith('https://')) {
      cleanHref = `https://${cleanHref}`;
    }

    try {
      const parsed = new URL(cleanHref);
      hostName = parsed.hostname;
    } catch {
      hostName = cleanHref;
    }

    const isTrusted = hostName.toLowerCase() === 'jw.org' || hostName.toLowerCase().endsWith('.jw.org');

    const modalIcon = isTrusted ? '✅' : '⚠️';
    const modalTitle = isTrusted ? t('Переход на проверенный ресурс') : t('Переход по внешней ссылке');
    const borderStyle = isTrusted ? 'border: 1px solid rgba(16, 185, 129, 0.3);' : 'border: 1px solid rgba(255, 255, 255, 0.12);';
    const btnBg = isTrusted ? 'background: linear-gradient(135deg, #059669 0%, #047857 100%);' : 'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);';

    const noticeHtml = isTrusted
      ? `
        <div style="padding: 14px 16px; border-radius: 14px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); font-size: 13px; line-height: 1.5; color: #a7f3d0; margin-bottom: 24px;">
          ✅ <strong>${t('Проверенный ресурс:')}</strong> ${t('Это проверенный ресурс, который заслуживает доверия — здесь можно найти достоверную информацию и ответы на многие жизненные вопросы.')}
        </div>
      `
      : `
        <div style="padding: 12px 14px; border-radius: 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); font-size: 12.5px; line-height: 1.45; color: #fde68a; margin-bottom: 24px;">
          🛡️ <strong>${t('Внимание:')}</strong> ${t('Администрация CybLight не несет ответственности за содержимое, безопасность и политику конфиденциальности сторонних ресурсов.')}
        </div>
      `;

    const wrap = document.createElement('div');
    wrap.id = 'cybExternalLinkModal';
    wrap.className = 'account-notice-modal';
    wrap.style.cssText = 'position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center;';

    wrap.innerHTML = `
      <div class="account-notice-backdrop" style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);"></div>
      <div class="account-notice-card" style="position: relative; z-index: 2; width: min(92vw, 500px); padding: 28px; border-radius: 24px; background: #0f172a; ${borderStyle} box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);" role="dialog" aria-modal="true" aria-labelledby="cybExtLinkTitle">
        
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="font-size: 28px; line-height: 1;">${modalIcon}</div>
          <div id="cybExtLinkTitle" style="font-size: 20px; font-weight: 700; color: #f8fafc;">${modalTitle}</div>
        </div>

        <p style="font-size: 14.5px; line-height: 1.5; color: rgba(241, 245, 249, 0.9); margin-bottom: 16px;">
          ${t('Вы покидаете сайт CybLight и переходите на сторонний ресурс:')}
        </p>

        <div style="padding: 12px 16px; border-radius: 12px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(56, 189, 248, 0.25); margin-bottom: 16px; word-break: break-all;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #38bdf8; font-weight: 700; margin-bottom: 4px;">🌐 ${escapeHtml(hostName)}</div>
          <div style="font-size: 13.5px; color: #cbd5e1; font-family: monospace;">${escapeHtml(cleanHref)}</div>
        </div>

        ${noticeHtml}

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" class="btn btn-outline" id="cybExtLinkCancelBtn" style="padding: 10px 18px; border-radius: 12px;">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="cybExtLinkConfirmBtn" style="padding: 10px 20px; border-radius: 12px; ${btnBg} font-weight: 600;">${t('Перейти на сайт')} ↗</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogCard = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#cybExtLinkCancelBtn') as HTMLButtonElement;
    const confirmBtn = wrap.querySelector('#cybExtLinkConfirmBtn') as HTMLButtonElement;
    const backdrop = wrap.querySelector('.account-notice-backdrop') as HTMLElement;

    const releaseFocus = trapFocus(dialogCard);

    const close = (confirmed: boolean) => {
      releaseFocus();
      wrap.remove();
      if (confirmed) {
        window.open(cleanHref, '_blank', 'noopener,noreferrer');
      }
      resolve(confirmed);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', handleKeyDown);
        close(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    cancelBtn.addEventListener('click', () => close(false));
    backdrop.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
  });
}

/**
 * Инициализирует глобальный перехватчик внешних ссылок для всего сайта
 */
export function initExternalLinkGuard(): void {
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const linkEl = target.closest('a[href], [data-external-url], [data-open-url]') as HTMLElement | null;
      if (!linkEl) return;

      const href = linkEl.getAttribute('href') || linkEl.getAttribute('data-external-url') || linkEl.getAttribute('data-open-url');
      if (!href) return;

      // Если ссылка внешняя — перехватываем клик и показываем модальное окно с предупреждением
      if (!isInternalUrl(href)) {
        event.preventDefault();
        event.stopPropagation();
        showExternalLinkModal(href);
      }
    },
    true
  );
}
