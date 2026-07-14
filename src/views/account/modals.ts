import { t } from '@/i18n';
import { escapeHtml } from '@/utils';
import { setupAccessibleModal } from '@/utils/keyboard';

function createModalCloser(
  wrap: HTMLElement,
  dialogEl: HTMLElement,
  onClosed?: () => void
): () => void {
  let cleanedUp = false;
  let close = () => { };

  const cleanupKeyboard = setupAccessibleModal(wrap, {
    trapFocusRoot: dialogEl,
    onClose: () => close(),
  });

  close = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    cleanupKeyboard();
    wrap.remove();
    onClosed?.();
  };

  return close;
}

export function showAccountNoticeModal(type: 'warn' | 'error' | 'success', text: string): void {
  const old = document.getElementById('accountNoticeModal');
  old?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'accountNoticeModal';
  wrap.className = 'account-notice-modal';

  const title =
    type === 'error' ? t('Ошибка') : type === 'success' ? t('Готово') : t('Внимание');
  const icon = type === 'error' ? '⛔' : type === 'success' ? '✅' : '⚠️';
  const headClass =
    type === 'error' ? 'is-error' : type === 'success' ? 'is-success' : 'is-warn';

  wrap.innerHTML = `
    <div class="account-notice-backdrop"></div>
    <div
      class="account-notice-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accountNoticeTitle"
      aria-describedby="accountNoticeText"
    >
      <div id="accountNoticeTitle" class="account-notice-head ${headClass}">${icon} ${title}</div>
      <div id="accountNoticeText" class="account-notice-text">${escapeHtml(text)}</div>
      <div class="account-notice-actions">
        <button type="button" class="btn btn-primary" id="accountNoticeOkBtn" aria-label="${t('Понятно')}">${t('Понятно')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
  const close = createModalCloser(wrap, dialogEl);

  wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', close);
  wrap.querySelector('#accountNoticeOkBtn')?.addEventListener('click', close);
}

export function showAccountConfirmModal(opts: {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  const old = document.getElementById('accountConfirmModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'accountConfirmModal';
    wrap.className = 'account-notice-modal';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div
        class="account-notice-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountConfirmTitle"
        aria-describedby="accountConfirmText"
      >
        <div id="accountConfirmTitle" class="account-notice-head is-warn">⚠️ ${escapeHtml(opts.title)}</div>
        <div id="accountConfirmText" class="account-notice-text">${escapeHtml(opts.text)}</div>
        <div class="account-notice-actions account-notice-actions--end">
          <button type="button" class="btn btn-outline" id="accountConfirmCancelBtn" aria-label="${escapeHtml(opts.cancelText || t('Отмена'))}">${escapeHtml(opts.cancelText || t('Отмена'))}</button>
          <button type="button" class="btn btn-danger-soft" id="accountConfirmOkBtn" aria-label="${escapeHtml(opts.confirmText || t('Удалить'))}">${escapeHtml(opts.confirmText || t('Удалить'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const close = createModalCloser(wrap, dialogEl);

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => {
      close();
      resolve(false);
    });
    wrap.querySelector('#accountConfirmCancelBtn')?.addEventListener('click', () => {
      close();
      resolve(false);
    });
    wrap.querySelector('#accountConfirmOkBtn')?.addEventListener('click', () => {
      close();
      resolve(true);
    });
  });
}

export function showAccountDeleteConfirmModal(opts: {
  title: string;
  text: string;
  passwordPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<{ confirmed: boolean; password?: string }> {
  const old = document.getElementById('accountDeleteConfirmModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'accountDeleteConfirmModal';
    wrap.className = 'account-notice-modal';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div
        class="account-notice-card"
        style="width: min(92vw, 600px) !important; padding: 28px !important; border-radius: 20px !important;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountDeleteTitle"
        aria-describedby="accountDeleteText"
      >
        <div id="accountDeleteTitle" class="account-notice-head is-error" style="font-size: 24px !important; font-weight: 800 !important; text-align: center !important; margin-bottom: 24px !important; color: #ff8a80 !important; display: flex; align-items: center; justify-content: center; gap: 8px;">🔥 ${escapeHtml(opts.title)}</div>
        <div id="accountDeleteText" class="account-notice-text" style="margin-bottom: 24px !important;">${opts.text}</div>

        <div class="sec-form-row sec-mt-12" style="margin-bottom: 20px !important;">
          <label class="label" for="accountDeletePassInp" style="margin-bottom: 8px !important; display: block !important;">${t('Введите текущий пароль для подтверждения')}</label>
          <div class="pass-wrap">
            <input class="input" id="accountDeletePassInp" type="password" autocomplete="current-password" placeholder="${escapeHtml(opts.passwordPlaceholder || t('Действующий пароль'))}" style="padding: 12px 16px !important; font-size: 15px !important;" />
            <button type="button" class="pass-eye" data-target="accountDeletePassInp" aria-label="${t('Показать пароль')}"></button>
          </div>
        </div>

        <div class="account-notice-actions account-notice-actions--end account-notice-actions--spaced" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 24px !important;">
          <button type="button" class="btn btn-outline" id="accountDeleteCancelBtn" aria-label="${escapeHtml(opts.cancelText || t('Отмена'))}" style="padding: 10px 20px !important; font-weight: 600 !important;">${escapeHtml(opts.cancelText || t('Отмена'))}</button>
          <button type="button" class="btn btn-danger" id="accountDeleteConfirmBtn" aria-label="${escapeHtml(opts.confirmText || t('Удалить аккаунт'))}" style="padding: 10px 20px !important; font-weight: 600 !important;">${escapeHtml(opts.confirmText || t('Удалить аккаунт'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const close = createModalCloser(wrap, dialogEl);

    // Initialize password eyes for the new modal
    try {
      const { initPasswordEyes } = require('@/components/password/password-helpers');
      initPasswordEyes(wrap);
    } catch (e) {
      console.warn('Failed to init password eyes in delete modal', e);
    }

    const passInp = wrap.querySelector('#accountDeletePassInp') as HTMLInputElement;

    const finish = (confirmed: boolean) => {
      const password = passInp?.value || '';
      close();
      resolve({ confirmed, password });
    };

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => finish(false));
    wrap.querySelector('#accountDeleteCancelBtn')?.addEventListener('click', () => finish(false));
    wrap.querySelector('#accountDeleteConfirmBtn')?.addEventListener('click', () => {
      if (!passInp.value) {
        passInp.classList.add('input--invalid');
        passInp.focus();
        return;
      }
      finish(true);
    });

    passInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        wrap.querySelector<HTMLButtonElement>('#accountDeleteConfirmBtn')?.click();
      }
    });

    setTimeout(() => passInp?.focus(), 100);
  });
}

export function showAccountRadioModal<T>(opts: {
  title: string;
  options: Array<{ value: T; label: string }>;
  currentValue?: T;
  confirmText?: string;
  cancelText?: string;
}): Promise<T | null> {
  const old = document.getElementById('accountRadioModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'accountRadioModal';
    wrap.className = 'account-notice-modal';

    const optionsHtml = opts.options
      .map(
        (opt) => `
      <label class="account-radio-item">
        <input type="radio" name="accountRadioOption" value="${escapeHtml(String(opt.value))}" ${opt.value === opts.currentValue ? 'checked' : ''
          } />
        <span class="account-radio-item__label">${escapeHtml(opt.label)}</span>
      </label>
    `
      )
      .join('');

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div
        class="account-notice-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountRadioTitle"
      >
        <div id="accountRadioTitle" class="account-notice-head">${escapeHtml(opts.title)}</div>
        <div class="account-radio-list">${optionsHtml}</div>
        <div class="account-notice-actions account-notice-actions--end account-notice-actions--spaced">
          <button type="button" class="btn btn-outline" id="accountRadioCancelBtn" aria-label="${escapeHtml(opts.cancelText || t('Отмена'))}">${escapeHtml(opts.cancelText || t('Отмена'))}</button>
          <button type="button" class="btn btn-primary" id="accountRadioOkBtn" aria-label="${escapeHtml(opts.confirmText || t('Готово'))}">${escapeHtml(opts.confirmText || t('Готово'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const close = createModalCloser(wrap, dialogEl);

    const finish = (confirmed: boolean) => {
      let result: T | null = null;
      if (confirmed) {
        const selected = wrap.querySelector('input[name="accountRadioOption"]:checked') as HTMLInputElement;
        if (selected) {
          // Find original value by comparing stringified versions or using index
          const index = Array.from(wrap.querySelectorAll('input[name="accountRadioOption"]')).indexOf(selected);
          result = opts.options[index].value;
        }
      }
      close();
      resolve(result);
    };

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => finish(false));
    wrap.querySelector('#accountRadioCancelBtn')?.addEventListener('click', () => finish(false));
    wrap.querySelector('#accountRadioOkBtn')?.addEventListener('click', () => finish(true));
  });
}

export function showAccountPinScopeModal(opts: {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
  checkboxText?: string;
  defaultChecked?: boolean;
}): Promise<{ confirmed: boolean; forBoth: boolean }> {
  const old = document.getElementById('accountPinScopeModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'accountPinScopeModal';
    wrap.className = 'account-notice-modal';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div
        class="account-notice-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountPinScopeTitle"
        aria-describedby="accountPinScopeText"
      >
        <div id="accountPinScopeTitle" class="account-notice-head is-warn">📌 ${escapeHtml(opts.title)}</div>
        <div id="accountPinScopeText" class="account-notice-text">${escapeHtml(opts.text)}</div>
        <label class="account-pin-scope-label">
          <input id="accountPinScopeCheckbox" type="checkbox" ${opts.defaultChecked ? 'checked' : ''} />
          <span>${escapeHtml(opts.checkboxText || t('Также закрепить для собеседника'))}</span>
        </label>
        <div class="account-notice-actions account-notice-actions--end account-notice-actions--spaced">
          <button type="button" class="btn btn-outline" id="accountPinScopeCancelBtn" aria-label="${escapeHtml(opts.cancelText || t('Отмена'))}">${escapeHtml(opts.cancelText || t('Отмена'))}</button>
          <button type="button" class="btn btn-primary" id="accountPinScopeOkBtn" aria-label="${escapeHtml(opts.confirmText || t('Закрепить'))}">${escapeHtml(opts.confirmText || t('Закрепить'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const close = createModalCloser(wrap, dialogEl);

    const finish = (confirmed: boolean) => {
      const checkbox = document.getElementById(
        'accountPinScopeCheckbox'
      ) as HTMLInputElement | null;
      const forBoth = Boolean(checkbox?.checked);
      close();
      resolve({ confirmed, forBoth });
    };

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => finish(false));
    wrap.querySelector('#accountPinScopeCancelBtn')?.addEventListener('click', () => finish(false));
    wrap.querySelector('#accountPinScopeOkBtn')?.addEventListener('click', () => finish(true));
  });
}
