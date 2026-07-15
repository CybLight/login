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

export function showSettingsUsernameModal(opts: {
  currentUsername: string;
  onSave: (newUsername: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsUsernameModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsUsernameModal';
    wrap.className = 'account-notice-modal';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div
        class="account-notice-card"
        style="width: min(92vw, 480px) !important; padding: 28px !important; border-radius: 20px !important;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stgUsernameTitle"
      >
        <div id="stgUsernameTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 20px !important; display: flex; align-items: center; gap: 8px;">🪪 ${t('Имя пользователя')}</div>
        
        <div class="sec-form-row" style="margin-bottom: 20px !important;">
          <label class="label" for="stgUsernameInp" style="margin-bottom: 8px !important; display: block !important;">${t('Введите новое имя пользователя')}</label>
          <input class="input" id="stgUsernameInp" type="text" value="${escapeHtml(opts.currentUsername)}" autocomplete="off" style="padding: 12px 16px !important; font-size: 15px !important;" />
          <div id="stgUsernameError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; display: none;"></div>
        </div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important;">
          <button type="button" class="btn btn-outline" id="stgUsernameCancelBtn" style="padding: 10px 20px !important;">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgUsernameSaveBtn" style="padding: 10px 20px !important;">${t('Сохранить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const close = createModalCloser(wrap, dialogEl);

    const input = wrap.querySelector('#stgUsernameInp') as HTMLInputElement;
    const saveBtn = wrap.querySelector('#stgUsernameSaveBtn') as HTMLButtonElement;
    const cancelBtn = wrap.querySelector('#stgUsernameCancelBtn') as HTMLButtonElement;
    const errorDiv = wrap.querySelector('#stgUsernameError') as HTMLDivElement;

    const handleSave = async () => {
      const val = input.value.trim();
      if (!val) {
        input.classList.add('input--invalid');
        errorDiv.textContent = t('Имя пользователя не может быть пустым');
        errorDiv.style.display = 'block';
        return;
      }

      input.classList.remove('input--invalid');
      errorDiv.style.display = 'none';
      saveBtn.disabled = true;
      const oldText = saveBtn.textContent;
      saveBtn.textContent = t('Сохранение…');

      try {
        const res = await opts.onSave(val);
        if (res.ok) {
          close();
          resolve();
        } else {
          input.classList.add('input--invalid');
          errorDiv.textContent = res.error || t('Ошибка сохранения');
          errorDiv.style.display = 'block';
          saveBtn.disabled = false;
          saveBtn.textContent = oldText;
        }
      } catch (err) {
        input.classList.add('input--invalid');
        errorDiv.textContent = t('Ошибка при отправке запроса');
        errorDiv.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = oldText;
      }
    };

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => { close(); resolve(); });
    cancelBtn.addEventListener('click', () => { close(); resolve(); });
    saveBtn.addEventListener('click', handleSave);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSave();
    });

    setTimeout(() => {
      input.focus();
      input.select();
    }, 120);
  });
}

export function showSettingsEmailModal(opts: {
  currentEmail: string;
  requiresPassword: boolean;
  requires2fa: boolean;
  onSave: (email: string, password?: string, totpCode?: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsEmailModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsEmailModal';
    wrap.className = 'account-notice-modal';

    const passFieldHtml = opts.requiresPassword
      ? `
        <div class="sec-form-row" style="margin-bottom: 16px !important;">
          <label class="label" for="stgEmailPassInp" style="margin-bottom: 6px !important; display: block !important;">${t('Текущий пароль')}</label>
          <div class="pass-wrap">
            <input class="input" id="stgEmailPassInp" type="password" autocomplete="current-password" placeholder="${t('Пароль для подтверждения')}" style="padding: 12px 16px !important; font-size: 15px !important;" />
            <button type="button" class="pass-eye" data-target="stgEmailPassInp" aria-label="${t('Показать пароль')}"></button>
          </div>
        </div>
      `
      : '';

    const totpFieldHtml = opts.requires2fa
      ? `
        <div class="sec-form-row" style="margin-bottom: 20px !important;">
          <label class="label" for="stgEmailTotpInp" style="margin-bottom: 6px !important; display: block !important;">${t('Код двухфакторной аутентификации')}</label>
          <input class="input" id="stgEmailTotpInp" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="000000" maxlength="8" autocomplete="one-time-code" style="padding: 12px 16px !important; font-size: 15px !important;" />
        </div>
      `
      : '';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div
        class="account-notice-card"
        style="width: min(92vw, 480px) !important; padding: 28px !important; border-radius: 20px !important;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stgEmailTitle"
      >
        <div id="stgEmailTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 20px !important; display: flex; align-items: center; gap: 8px;">✉️ ${t('Электронная почта')}</div>
        
        <div class="sec-form-row" style="margin-bottom: 16px !important;">
          <label class="label" for="stgEmailInp" style="margin-bottom: 6px !important; display: block !important;">${t('Новый адрес почты')}</label>
          <input class="input" id="stgEmailInp" type="email" value="${escapeHtml(opts.currentEmail)}" autocomplete="email" style="padding: 12px 16px !important; font-size: 15px !important;" />
        </div>

        ${passFieldHtml}
        ${totpFieldHtml}

        <div id="stgEmailError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; margin-bottom: 16px; display: none;"></div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important;">
          <button type="button" class="btn btn-outline" id="stgEmailCancelBtn" style="padding: 10px 20px !important;">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgEmailSaveBtn" style="padding: 10px 20px !important;">${t('Сохранить')}</button>
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
      console.warn('Failed to init password eyes in email modal', e);
    }

    const emailInp = wrap.querySelector('#stgEmailInp') as HTMLInputElement;
    const passInp = wrap.querySelector('#stgEmailPassInp') as HTMLInputElement | null;
    const totpInp = wrap.querySelector('#stgEmailTotpInp') as HTMLInputElement | null;
    const saveBtn = wrap.querySelector('#stgEmailSaveBtn') as HTMLButtonElement;
    const cancelBtn = wrap.querySelector('#stgEmailCancelBtn') as HTMLButtonElement;
    const errorDiv = wrap.querySelector('#stgEmailError') as HTMLDivElement;

    const handleSave = async () => {
      const emailVal = emailInp.value.trim();
      const passVal = passInp?.value || '';
      const totpVal = totpInp?.value.trim() || '';

      if (!emailVal || !emailVal.includes('@')) {
        emailInp.classList.add('input--invalid');
        errorDiv.textContent = t('Введите корректный адрес электронной почты');
        errorDiv.style.display = 'block';
        return;
      }

      if (opts.requiresPassword && !passVal) {
        passInp?.classList.add('input--invalid');
        errorDiv.textContent = t('Введите текущий пароль');
        errorDiv.style.display = 'block';
        return;
      }

      emailInp.classList.remove('input--invalid');
      passInp?.classList.remove('input--invalid');
      totpInp?.classList.remove('input--invalid');
      errorDiv.style.display = 'none';

      saveBtn.disabled = true;
      const oldText = saveBtn.textContent;
      saveBtn.textContent = t('Сохранение…');

      try {
        const res = await opts.onSave(emailVal, passVal, totpVal);
        if (res.ok) {
          close();
          resolve();
        } else {
          errorDiv.textContent = res.error || t('Ошибка сохранения');
          errorDiv.style.display = 'block';
          saveBtn.disabled = false;
          saveBtn.textContent = oldText;
        }
      } catch (err) {
        errorDiv.textContent = t('Ошибка при отправке запроса');
        errorDiv.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = oldText;
      }
    };

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => { close(); resolve(); });
    cancelBtn.addEventListener('click', () => { close(); resolve(); });
    saveBtn.addEventListener('click', handleSave);

    emailInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSave();
    });
    passInp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSave();
    });
    totpInp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSave();
    });

    setTimeout(() => {
      emailInp.focus();
    }, 120);
  });
}

