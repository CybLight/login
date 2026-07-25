import { t } from '@/i18n';
import { escapeHtml, apiCall } from '@/utils';
import { setupAccessibleModal } from '@/utils/keyboard';
import { STANDARD_AVATARS, EXCLUSIVE_AVATARS, canUseExclusiveAvatar } from '../edit-profile';

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
  canChangeUsername?: boolean;
  usernameChangedAt?: number | null;
  onSave: (newUsername: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsUsernameModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsUsernameModal';
    wrap.className = 'account-notice-modal';

    const canChange = opts.canChangeUsername !== false;

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
          <input 
            class="input" 
            id="stgUsernameInp" 
            type="text" 
            value="${escapeHtml(opts.currentUsername)}" 
            autocomplete="off" 
            style="padding: 12px 16px !important; font-size: 15px !important;" 
            ${canChange ? '' : 'disabled'}
          />
          <div id="stgUsernameError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; ${canChange ? 'display: none;' : 'display: block;' }">
            ${
              canChange
                ? ''
                : opts.usernameChangedAt
                  ? t('Можно изменить через {days} дней', {
                      days: Math.ceil(
                        (30 * 24 * 60 * 60 * 1000 - (Date.now() - Number(opts.usernameChangedAt))) /
                          (24 * 60 * 60 * 1000)
                      ),
                    })
                  : t('Изменение временно недоступно')
            }
          </div>
          <div id="stgUsernameHints" style="margin-top: 10px; ${canChange ? '' : 'display: none;'}"></div>
          <div class="username-limit-warning" style="font-size: 12px; color: #ff9800; background: rgba(255, 152, 0, 0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 152, 0, 0.2); margin-top: 12px; line-height: 1.4;">
            ⚠️ ${t('Имя пользователя можно менять не чаще одного раза в 30 дней.')}
          </div>
        </div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important;">
          <button type="button" class="btn btn-outline" id="stgUsernameCancelBtn" style="padding: 10px 20px !important;">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgUsernameSaveBtn" style="padding: 10px 20px !important;" ${canChange ? '' : 'disabled'}>${t('Сохранить')}</button>
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
    const hintsContainer = wrap.querySelector('#stgUsernameHints') as HTMLDivElement;

    // If change is not allowed, just bind cancel/close listeners and return
    if (!canChange) {
      const handleClose = () => {
        close();
        resolve();
      };
      cancelBtn.addEventListener('click', handleClose);
      wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', handleClose);
      return;
    }

    // Attach username hints and live check logic
    const rules = {
      len: (v: string) => v.length >= 3 && v.length <= 20,
      chars: (v: string) => /^[a-zA-Z0-9_-]+$/.test(v),
    };

    hintsContainer.innerHTML = `
      <div class="pass-hints">
        <div class="pass-hints__title">${t('Имя пользователя должно содержать:')}</div>
        <ul class="pass-hints__list">
          <li data-rule="len"><span class="icon" aria-hidden="true"></span> ${t('От 3 до 20 символов')}</li>
          <li data-rule="chars"><span class="icon" aria-hidden="true"></span> ${t('Только латиница, цифры, _ и -')}</li>
          <li data-rule="available"><span class="icon" aria-hidden="true"></span> ${t('Имя пользователя свободно')}</li>
        </ul>
      </div>
    `;

    let checkTimeout: number | undefined;
    let isAvailable = false;
    let lastCheckedVal = '';

    const updateHints = () => {
      const v = input.value;
      let syncOk = true;

      // Check synchronous rules
      hintsContainer.querySelectorAll('[data-rule]').forEach((li) => {
        const key = li.getAttribute('data-rule');
        if (key === 'len' || key === 'chars') {
          const ok = rules[key] ? rules[key](v) : false;
          li.classList.toggle('ok', ok);
          if (!ok) syncOk = false;
        }
      });

      const availableLi = hintsContainer.querySelector('[data-rule="available"]') as HTMLLIElement;

      // Handle availability status synchronously if it matches current username or format is invalid
      if (v === opts.currentUsername) {
        isAvailable = true;
        if (availableLi) availableLi.classList.add('ok');
        saveBtn.disabled = !syncOk;
        errorDiv.style.display = 'none';
      } else if (!syncOk) {
        isAvailable = false;
        if (availableLi) availableLi.classList.remove('ok');
        saveBtn.disabled = true;
        errorDiv.style.display = 'none';
        if (checkTimeout) {
          clearTimeout(checkTimeout);
          checkTimeout = undefined;
        }
      } else {
        // If synchronous rules pass and value changed, trigger debounced check
        if (v !== lastCheckedVal) {
          saveBtn.disabled = true; // disable save while checking
          if (availableLi) availableLi.classList.remove('ok');
          errorDiv.style.display = 'none';
          
          if (checkTimeout) clearTimeout(checkTimeout);
          checkTimeout = window.setTimeout(async () => {
            lastCheckedVal = v;
            try {
              const res = await apiCall(`/profile/check-username/${encodeURIComponent(v)}`, {
                credentials: 'include'
              });
              const data = await res.json();
              if (input.value === v) { // check if input value hasn't changed in the meantime
                isAvailable = data.ok && data.available;
                if (availableLi) {
                  availableLi.classList.toggle('ok', isAvailable);
                }
                saveBtn.disabled = !isAvailable;
                
                // Update highlight
                if (isAvailable) {
                  input.classList.add('input--valid');
                  input.classList.remove('input--invalid');
                  errorDiv.style.display = 'none';
                } else {
                  input.classList.add('input--invalid');
                  input.classList.remove('input--valid');
                  errorDiv.textContent = t('Имя пользователя занято');
                  errorDiv.style.display = 'block';
                }
              }
            } catch (err) {
              console.error('Error checking username availability:', err);
            }
          }, 400);
        } else {
          // Keep previous availability result
          if (availableLi) availableLi.classList.toggle('ok', isAvailable);
          saveBtn.disabled = !isAvailable;
          if (isAvailable) {
            errorDiv.style.display = 'none';
          } else {
            errorDiv.textContent = t('Имя пользователя занято');
            errorDiv.style.display = 'block';
          }
        }
      }

      // Update highlighting based on current status
      if (!v.trim()) {
        input.classList.remove('input--valid');
        input.classList.remove('input--invalid');
        errorDiv.style.display = 'none';
      } else if (v === opts.currentUsername) {
        input.classList.add('input--valid');
        input.classList.remove('input--invalid');
        errorDiv.style.display = 'none';
      } else if (!syncOk) {
        input.classList.add('input--invalid');
        input.classList.remove('input--valid');
        errorDiv.style.display = 'none';
      } else {
        // If checking async, keep previous color or neutral until complete
        if (isAvailable && lastCheckedVal === v) {
          input.classList.add('input--valid');
          input.classList.remove('input--invalid');
          errorDiv.style.display = 'none';
        } else {
          input.classList.remove('input--valid');
        }
      }
    };

    input.addEventListener('input', updateHints);
    input.addEventListener('focus', updateHints);
    input.addEventListener('blur', updateHints);

    // Initial check
    updateHints();

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

export function showSettingsAvatarModal(opts: {
  profile: { avatar?: string; role?: string; flags?: string[] };
  onSave: (selectedAvatar: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsAvatarModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsAvatarModal';
    wrap.className = 'account-notice-modal';

    const currentAvatar = opts.profile.avatar || 'avatar-cat';

    const standardHtml = STANDARD_AVATARS.map(
      (a) => `
      <div class="avatar-option ${currentAvatar === a.id ? 'selected' : ''}" data-avatar="${a.id}" title="${t(a.label)}">
        <div class="avatar-badge">${a.emoji}</div>
      </div>
    `
    ).join('');

    const exclusiveHtml = EXCLUSIVE_AVATARS.map((a) => {
      const isUnlocked = canUseExclusiveAvatar(opts.profile, a.id);
      const isSelected = currentAvatar === a.id;
      const lockTitle = isUnlocked ? t(a.label) : `${t(a.label)} (${t('Доступно только для специальных ролей')})`;
      return `
        <div class="avatar-option ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}" data-avatar="${a.id}" title="${escapeHtml(lockTitle)}">
          <div class="avatar-badge">${a.emoji}</div>
          ${!isUnlocked ? `<div class="avatar-lock-icon">🔒</div>` : ''}
        </div>
      `;
    }).join('');

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(92vw, 540px) !important; padding: 24px !important; border-radius: 20px !important; max-height: 85vh; overflow-y: auto;" role="dialog" aria-modal="true" aria-labelledby="stgAvatarTitle">
        <div id="stgAvatarTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 16px !important;">🎨 ${t('Аватар')}</div>
        
        <div class="avatar-section">
          <h3 class="avatar-section-title">${t('Стандартные')}</h3>
          <div class="avatar-grid">
            ${standardHtml}
          </div>
        </div>

        <div class="avatar-section" style="margin-top: 16px;">
          <h3 class="avatar-section-title">${t('Эксклюзивные')}</h3>
          <p class="avatar-section-subtitle">${t('Эти аватары доступны только администраторам, VIP и разработчикам.')}</p>
          <div class="avatar-grid">
            ${exclusiveHtml}
          </div>
        </div>

        <div id="stgAvatarError" class="input-error-msg" style="color: #f87171; font-size: 13px; margin-top: 8px; display: none;"></div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 20px !important;">
          <button type="button" class="btn btn-outline" id="stgAvatarCancelBtn">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgAvatarSaveBtn">${t('Сохранить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#stgAvatarCancelBtn') as HTMLButtonElement;
    const saveBtn = wrap.querySelector('#stgAvatarSaveBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#stgAvatarError') as HTMLDivElement;
    const avatarOptions = wrap.querySelectorAll('.avatar-option');

    let selectedId = currentAvatar;

    avatarOptions.forEach((option) => {
      option.addEventListener('click', () => {
        if (option.classList.contains('locked')) return;
        avatarOptions.forEach((opt) => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedId = (option as HTMLElement).dataset.avatar || selectedId;
      });
    });

    const close = createModalCloser(wrap, dialogEl, resolve);

    cancelBtn.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      errorEl.style.display = 'none';
      const res = await opts.onSave(selectedId);
      saveBtn.disabled = false;
      if (res.ok) {
        close();
      } else if (res.error) {
        errorEl.textContent = res.error;
        errorEl.style.display = 'block';
      }
    });
  });
}

export function showSettingsBioModal(opts: {
  currentBio: string;
  onSave: (newBio: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsBioModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsBioModal';
    wrap.className = 'account-notice-modal';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(92vw, 480px) !important; padding: 28px !important; border-radius: 20px !important;" role="dialog" aria-modal="true" aria-labelledby="stgBioTitle">
        <div id="stgBioTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 16px !important;">✍️ ${t('О себе (кратко)')}</div>
        
        <div class="sec-form-row">
          <label class="label" for="stgBioInp" style="margin-bottom: 8px !important; display: block !important;">${t('Краткое описание профиля')}</label>
          <textarea class="input" id="stgBioInp" rows="3" maxlength="500" placeholder="${t('Расскажите о себе кратко...')}" style="width: 100%; font-size: 14px !important; resize: vertical;">${escapeHtml(opts.currentBio)}</textarea>
          <div class="field-hint" style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">${t('До 500 символов')}</div>
          <div id="stgBioError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; display: none;"></div>
        </div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 20px !important;">
          <button type="button" class="btn btn-outline" id="stgBioCancelBtn">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgBioSaveBtn">${t('Сохранить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#stgBioCancelBtn') as HTMLButtonElement;
    const saveBtn = wrap.querySelector('#stgBioSaveBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#stgBioError') as HTMLDivElement;
    const bioInp = wrap.querySelector('#stgBioInp') as HTMLTextAreaElement;

    const close = createModalCloser(wrap, dialogEl, resolve);

    cancelBtn.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      errorEl.style.display = 'none';
      const res = await opts.onSave(bioInp.value.trim());
      saveBtn.disabled = false;
      if (res.ok) {
        close();
      } else if (res.error) {
        errorEl.textContent = res.error;
        errorEl.style.display = 'block';
      }
    });
  });
}

export function showSettingsAboutModal(opts: {
  currentAbout: string;
  onSave: (newAbout: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsAboutModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsAboutModal';
    wrap.className = 'account-notice-modal';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(92vw, 480px) !important; padding: 28px !important; border-radius: 20px !important;" role="dialog" aria-modal="true" aria-labelledby="stgAboutTitle">
        <div id="stgAboutTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 16px !important;">📖 ${t('О себе (подробно)')}</div>
        
        <div class="sec-form-row">
          <label class="label" for="stgAboutInp" style="margin-bottom: 8px !important; display: block !important;">${t('Подробная информация о себе')}</label>
          <textarea class="input" id="stgAboutInp" rows="5" maxlength="1000" placeholder="${t('Расскажите о себе подробнее...')}" style="width: 100%; font-size: 14px !important; resize: vertical;">${escapeHtml(opts.currentAbout)}</textarea>
          <div class="field-hint" style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">${t('До 1000 символов')}</div>
          <div id="stgAboutError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; display: none;"></div>
        </div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 20px !important;">
          <button type="button" class="btn btn-outline" id="stgAboutCancelBtn">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgAboutSaveBtn">${t('Сохранить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#stgAboutCancelBtn') as HTMLButtonElement;
    const saveBtn = wrap.querySelector('#stgAboutSaveBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#stgAboutError') as HTMLDivElement;
    const aboutInp = wrap.querySelector('#stgAboutInp') as HTMLTextAreaElement;

    const close = createModalCloser(wrap, dialogEl, resolve);

    cancelBtn.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      errorEl.style.display = 'none';
      const res = await opts.onSave(aboutInp.value.trim());
      saveBtn.disabled = false;
      if (res.ok) {
        close();
      } else if (res.error) {
        errorEl.textContent = res.error;
        errorEl.style.display = 'block';
      }
    });
  });
}

export function showSettingsGenderModal(opts: {
  currentGender: string;
  onSave: (newGender: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsGenderModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsGenderModal';
    wrap.className = 'account-notice-modal';

    const g = opts.currentGender || 'not_specified';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(92vw, 420px) !important; padding: 28px !important; border-radius: 20px !important;" role="dialog" aria-modal="true" aria-labelledby="stgGenderTitle">
        <div id="stgGenderTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 16px !important;">⚥️ ${t('Пол')}</div>
        
        <div class="sec-form-row">
          <label class="label" for="stgGenderInp" style="margin-bottom: 8px !important; display: block !important;">${t('Укажите ваш пол')}</label>
          <select class="input" id="stgGenderInp" style="width: 100%; font-size: 15px !important; padding: 12px 16px !important; cursor: pointer;">
            <option value="not_specified" ${g === 'not_specified' || !g ? 'selected' : ''}>${t('Не указано')}</option>
            <option value="male" ${g === 'male' ? 'selected' : ''}>${t('Мужской')}</option>
            <option value="female" ${g === 'female' ? 'selected' : ''}>${t('Женский')}</option>
          </select>
          <div id="stgGenderError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; display: none;"></div>
        </div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 20px !important;">
          <button type="button" class="btn btn-outline" id="stgGenderCancelBtn">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgGenderSaveBtn">${t('Сохранить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#stgGenderCancelBtn') as HTMLButtonElement;
    const saveBtn = wrap.querySelector('#stgGenderSaveBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#stgGenderError') as HTMLDivElement;
    const genderInp = wrap.querySelector('#stgGenderInp') as HTMLSelectElement;

    const close = createModalCloser(wrap, dialogEl, resolve);

    cancelBtn.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      errorEl.style.display = 'none';
      const res = await opts.onSave(genderInp.value);
      saveBtn.disabled = false;
      if (res.ok) {
        close();
      } else if (res.error) {
        errorEl.textContent = res.error;
        errorEl.style.display = 'block';
      }
    });
  });
}

export function showSettingsDobModal(opts: {
  currentDob: string;
  onSave: (newDob: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsDobModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsDobModal';
    wrap.className = 'account-notice-modal';

    let formattedDob = '';
    if (opts.currentDob) {
      try {
        const d = new Date(opts.currentDob);
        if (!isNaN(d.getTime())) {
          formattedDob = d.toISOString().split('T')[0];
        }
      } catch {
        formattedDob = opts.currentDob;
      }
    }

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(92vw, 420px) !important; padding: 28px !important; border-radius: 20px !important;" role="dialog" aria-modal="true" aria-labelledby="stgDobTitle">
        <div id="stgDobTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 16px !important; display: flex !important; align-items: center !important; gap: 10px !important;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="18" rx="4" stroke="url(#modalDobIconGrad)" stroke-width="2"/>
            <path d="M16 2v4M8 2v4M3 10h18" stroke="url(#modalDobIconGrad)" stroke-width="2" stroke-linecap="round"/>
            <circle cx="8" cy="14" r="1" fill="#38bdf8"/>
            <circle cx="12" cy="14" r="1" fill="#38bdf8"/>
            <circle cx="16" cy="14" r="1" fill="#38bdf8"/>
            <circle cx="8" cy="18" r="1" fill="#38bdf8"/>
            <circle cx="12" cy="18" r="1" fill="#38bdf8"/>
            <defs>
              <linearGradient id="modalDobIconGrad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                <stop stop-color="#818cf8"/>
                <stop offset="1" stop-color="#38bdf8"/>
              </linearGradient>
            </defs>
          </svg>
          <span>${t('Дата рождения')}</span>
        </div>
        
        <div class="sec-form-row">
          <label class="label" for="stgDobInp" style="margin-bottom: 8px !important; display: block !important;">${t('Выберите дату рождения')}</label>
          <input type="date" class="input" id="stgDobInp" value="${escapeHtml(formattedDob)}" style="width: 100%; font-size: 15px !important; padding: 12px 16px !important;" />
          <div id="stgDobError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; display: none;"></div>
        </div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 20px !important;">
          <button type="button" class="btn btn-outline" id="stgDobCancelBtn">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgDobSaveBtn">${t('Сохранить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#stgDobCancelBtn') as HTMLButtonElement;
    const saveBtn = wrap.querySelector('#stgDobSaveBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#stgDobError') as HTMLDivElement;
    const dobInp = wrap.querySelector('#stgDobInp') as HTMLInputElement;

    const close = createModalCloser(wrap, dialogEl, resolve);

    cancelBtn.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      errorEl.style.display = 'none';
      const res = await opts.onSave(dobInp.value);
      saveBtn.disabled = false;
      if (res.ok) {
        close();
      } else if (res.error) {
        errorEl.textContent = res.error;
        errorEl.style.display = 'block';
      }
    });
  });
}

