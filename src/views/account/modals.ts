import { escapeHtml } from '@/utils';
import { setupAccessibleModal } from '@/utils/keyboard';

function createModalCloser(
  wrap: HTMLElement,
  dialogEl: HTMLElement,
  onClosed?: () => void
): () => void {
  let cleanedUp = false;
  let close = () => {};

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

export function showAccountNoticeModal(type: 'warn' | 'error', text: string): void {
  const old = document.getElementById('accountNoticeModal');
  old?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'accountNoticeModal';
  wrap.className = 'account-notice-modal';

  const title = type === 'error' ? 'Ошибка' : 'Внимание';
  const icon = type === 'error' ? '⛔' : '⚠️';

  wrap.innerHTML = `
    <div class="account-notice-backdrop"></div>
    <div
      class="account-notice-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accountNoticeTitle"
      aria-describedby="accountNoticeText"
    >
      <div id="accountNoticeTitle" class="account-notice-head ${type === 'error' ? 'is-error' : 'is-warn'}">${icon} ${title}</div>
      <div id="accountNoticeText" class="account-notice-text">${escapeHtml(text)}</div>
      <div class="account-notice-actions">
        <button type="button" class="btn btn-primary" id="accountNoticeOkBtn" aria-label="Понятно">Понятно</button>
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
          <button type="button" class="btn btn-outline" id="accountConfirmCancelBtn" aria-label="${escapeHtml(opts.cancelText || 'Отмена')}">${escapeHtml(opts.cancelText || 'Отмена')}</button>
          <button type="button" class="btn btn-danger-soft" id="accountConfirmOkBtn" aria-label="${escapeHtml(opts.confirmText || 'Удалить')}">${escapeHtml(opts.confirmText || 'Удалить')}</button>
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
          <span>${escapeHtml(opts.checkboxText || 'Также закрепить для собеседника')}</span>
        </label>
        <div class="account-notice-actions account-notice-actions--end account-notice-actions--spaced">
          <button type="button" class="btn btn-outline" id="accountPinScopeCancelBtn" aria-label="${escapeHtml(opts.cancelText || 'Отмена')}">${escapeHtml(opts.cancelText || 'Отмена')}</button>
          <button type="button" class="btn btn-primary" id="accountPinScopeOkBtn" aria-label="${escapeHtml(opts.confirmText || 'Закрепить')}">${escapeHtml(opts.confirmText || 'Закрепить')}</button>
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
