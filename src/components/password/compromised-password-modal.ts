/**
 * Compromised Password Modal - информационное окно о скомпрометированном пароле
 */

import { t } from '@/i18n';
import { escapeHtml } from '@/utils';
import { setupAccessibleModal } from '@/utils/keyboard';

export interface CompromisedPasswordModalOptions {
  message?: string;
  count?: number;
  onClose?: () => void;
}

const MODAL_ID = 'compromisedPasswordModal';
const STYLES_ID = 'compromisedPasswordStyles';

function ensureStyles(): void {
  if (document.getElementById(STYLES_ID)) return;

  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = `
    .compromised-modal-wrap {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease-out;
    }

    .compromised-modal-wrap.is-visible {
      opacity: 1;
      pointer-events: auto;
    }

    .compromised-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(4, 7, 18, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .compromised-modal-card {
      position: relative;
      width: 100%;
      max-width: 480px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      background: linear-gradient(155deg, rgba(23, 29, 48, 0.96) 0%, rgba(13, 17, 30, 0.98) 100%);
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65), 0 0 40px rgba(239, 68, 68, 0.15);
      color: #e2e8f0;
      transform: scale(0.94) translateY(12px);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }

    .compromised-modal-wrap.is-visible .compromised-modal-card {
      transform: scale(1) translateY(0);
    }

    .compromised-modal-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 20px;
    }

    .compromised-icon-glow {
      position: relative;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0.04) 70%);
      border: 1px solid rgba(239, 68, 68, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 0 24px rgba(239, 68, 68, 0.25);
    }

    .compromised-icon-glow svg {
      animation: pulse-shield 2.2s infinite ease-in-out;
    }

    @keyframes pulse-shield {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.4)); }
      50% { transform: scale(1.06); filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.7)); }
    }

    .compromised-modal-title {
      font-size: 20px;
      font-weight: 750;
      color: #ffffff;
      margin: 0 0 6px;
      letter-spacing: -0.01em;
    }

    .compromised-modal-subtitle {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0;
    }

    .compromised-alert-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 18px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 13px;
      line-height: 1.45;
      color: #fca5a5;
    }

    .compromised-alert-icon {
      flex-shrink: 0;
      font-size: 16px;
      line-height: 1;
      margin-top: 1px;
    }

    .compromised-info-block {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 22px;
      font-size: 13px;
      line-height: 1.55;
      color: #cbd5e1;
    }

    .compromised-info-row {
      margin-bottom: 12px;
    }

    .compromised-info-row:last-child {
      margin-bottom: 0;
    }

    .compromised-info-heading {
      font-weight: 650;
      color: #f1f5f9;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }

    .compromised-info-list {
      margin: 6px 0 0 18px;
      padding: 0;
      list-style-type: disc;
      color: #94a3b8;
    }

    .compromised-info-list li {
      margin-bottom: 4px;
    }

    .compromised-info-list li:last-child {
      margin-bottom: 0;
    }

    .compromised-modal-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .compromised-btn-primary {
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      font-size: 14px;
      font-weight: 650;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(234, 88, 12, 0.35);
      transition: all 0.18s ease;
      text-align: center;
    }

    .compromised-btn-primary:hover {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      box-shadow: 0 6px 20px rgba(234, 88, 12, 0.5);
      transform: translateY(-1px);
    }

    .compromised-btn-primary:active {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Открывает красивое кастомное модальное окно с подробным пояснением,
 * почему пароль был отклонён системой безопасности.
 */
export function showCompromisedPasswordModal(opts: CompromisedPasswordModalOptions = {}): void {
  ensureStyles();

  // Удаляем старое окно, если есть
  document.getElementById(MODAL_ID)?.remove();

  const wrap = document.createElement('div');
  wrap.id = MODAL_ID;
  wrap.className = 'compromised-modal-wrap';

  let alertMessage = '';
  if (opts.message && opts.message.trim() && !opts.message.includes('password_compromised')) {
    alertMessage = escapeHtml(opts.message);
  } else if (opts.count && opts.count > 0) {
    alertMessage = t('Этот пароль был скомпрометирован {count} раз.', {
      count: opts.count.toLocaleString(),
    });
  } else {
    alertMessage = t('Этот пароль найден в глобальных базах известных утечек учётных записей.');
  }

  wrap.innerHTML = `
    <div class="compromised-modal-backdrop" data-close></div>
    <div class="compromised-modal-card" role="dialog" aria-modal="true" aria-labelledby="compPwdTitle" aria-describedby="compPwdDesc">
      <div class="compromised-modal-head">
        <div class="compromised-icon-glow">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(239, 68, 68, 0.16)" stroke="#ef4444"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" stroke-width="2.5"/>
            <circle cx="12" cy="16" r="1.25" fill="#ef4444"/>
          </svg>
        </div>
        <h3 id="compPwdTitle" class="compromised-modal-title">${t('Пароль скомпрометирован')}</h3>
        <p id="compPwdDesc" class="compromised-modal-subtitle">${t('Система безопасности отклонила данный пароль')}</p>
      </div>

      <div class="compromised-alert-box">
        <span class="compromised-alert-icon">⚠️</span>
        <div>${alertMessage}</div>
      </div>

      <div class="compromised-info-block">
        <div class="compromised-info-row">
          <div class="compromised-info-heading">
            🛡️ ${t('Защита безопасности CybLight')}
          </div>
          <div>${t('В целях защиты вашей учетной записи система запрещает установку скомпрометированных паролей. Злоумышленники используют базы утечек для автоматических атак.')}</div>
        </div>

        <div class="compromised-info-row">
          <div class="compromised-info-heading">
            💡 ${t('Рекомендации по выбору пароля')}
          </div>
          <ul class="compromised-info-list">
            <li>${t('Используйте от 10-12 символов')}</li>
            <li>${t('Комбинируйте заглавные и строчные буквы, цифры и символы')}</li>
            <li>${t('Не используйте этот пароль на других сайтах')}</li>
          </ul>
        </div>
      </div>

      <div class="compromised-modal-actions">
        <button type="button" class="compromised-btn-primary" data-close>
          ${t('Понятно, придумать другой пароль')}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  // Плавное открытие
  requestAnimationFrame(() => {
    wrap.classList.add('is-visible');
  });

  const card = wrap.querySelector('.compromised-modal-card') as HTMLElement;
  const primaryBtn = wrap.querySelector('.compromised-btn-primary') as HTMLButtonElement;

  const cleanupKeyboard = setupAccessibleModal(wrap, {
    trapFocusRoot: card,
    onClose: closeModal,
  });

  function closeModal(): void {
    cleanupKeyboard();
    wrap.classList.remove('is-visible');
    setTimeout(() => {
      wrap.remove();
      opts.onClose?.();
    }, 220);
  }

  wrap.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  });

  // Фокусируемся на кнопке подтверждения
  primaryBtn?.focus();
}
