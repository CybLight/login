import { t, getLocale } from '@/i18n';
import { escapeHtml, apiCall } from '@/utils';
import { setupAccessibleModal } from '@/utils/keyboard';
import { STANDARD_AVATARS, EXCLUSIVE_AVATARS, AVATAR_FRAMES, canUseExclusiveAvatar } from '../edit-profile';
import { getAvatarEmoji, getAvatarFrameClass } from './avatar';
import { initPasswordEyes } from '@/components/password/password-helpers';
import type { User } from '@/types';
import { Router } from '@/router/Router';
import { containsProfanity } from '@/utils/profanityFilter';

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
  role?: string;
  isPremium?: boolean;
  onSave: (newUsername: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsUsernameModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsUsernameModal';
    wrap.className = 'account-notice-modal';

    const role = (opts.role || '').toLowerCase();
    const isPrivileged =
      Boolean(opts.isPremium) ||
      role === 'creator' ||
      role === 'owner' ||
      role === 'admin' ||
      role === 'moderator' ||
      role === 'mod';

    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    const changedAtTime = opts.usernameChangedAt ? Number(opts.usernameChangedAt) : null;
    const timeSinceChange = changedAtTime ? Date.now() - changedAtTime : null;
    const isWithinCooldown = timeSinceChange !== null && timeSinceChange < cooldownMs;

    // Для Premium, Создателя, Администраторов и Модераторов ограничение 30 дней не применяется
    const canChange = isPrivileged || (opts.canChangeUsername !== false && !isWithinCooldown);

    const getCountdownString = (): string => {
      const changedAt = changedAtTime || Date.now();
      const remainingMs = (changedAt + cooldownMs) - Date.now();
      if (remainingMs <= 0) {
        return t('Вы можете сменить имя пользователя сейчас');
      }
      const days = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      return t('Можно изменить через {days} дней', { days });
    };

    const inputStyle = canChange
      ? 'padding: 12px 16px !important; font-size: 15px !important;'
      : 'padding: 12px 40px 12px 16px !important; font-size: 15px !important; opacity: 0.7 !important; background: rgba(255, 255, 255, 0.05) !important; color: #94a3b8 !important; border-color: rgba(255, 255, 255, 0.15) !important; cursor: not-allowed !important;';

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
          <label class="label" for="stgUsernameInp" style="margin-bottom: 8px !important; display: block !important;">${canChange ? t('Введите новое имя пользователя') : t('Текущее имя пользователя')}</label>
          <div style="position: relative;">
            <input 
              class="input ${canChange ? '' : 'input--disabled'}" 
              id="stgUsernameInp" 
              type="text" 
              value="${escapeHtml(opts.currentUsername)}" 
              autocomplete="off" 
              style="${inputStyle}" 
              ${canChange ? '' : 'disabled readonly'}
            />
            ${!canChange ? `<span style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); opacity: 0.6; font-size: 16px; pointer-events: none;">🔒</span>` : ''}
          </div>

          <div id="stgUsernameError" class="input-error-msg" style="${canChange ? 'color: #f87171; font-size: 12px; margin-top: 6px; display: none;' : 'display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 10px 14px; border-radius: 10px; background: rgba(251, 146, 60, 0.12); border: 1px solid rgba(251, 146, 60, 0.3); font-size: 13px; color: #fb923c; font-weight: 500; line-height: 1.4;'}">
            ${
              !canChange
                ? `<span style="flex-shrink:0; font-size: 15px;">⏳</span><span id="stgUsernameCountdownText">${getCountdownString()}</span>`
                : ''
            }
          </div>

          <div id="stgUsernameHints" style="margin-top: 10px; ${canChange ? '' : 'display: none;'}"></div>
          
          ${canChange ? `
          <div class="username-limit-warning" style="font-size: 12px; color: #ff9800; background: rgba(255, 152, 0, 0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 152, 0, 0.2); margin-top: 12px; line-height: 1.4;">
            ${opts.isPremium ? `⭐ <strong>CybLight Premium:</strong> ${t('Для вас смена имени пользователя доступна без ограничений!')}` : `⚠️ ${t('Имя пользователя можно менять не чаще одного раза в 30 дней.')}`}
          </div>` : ''}
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

    if (!canChange) {
      const countdownText = wrap.querySelector('#stgUsernameCountdownText') as HTMLElement | null;
      const updateTimer = () => {
        if (countdownText) {
          countdownText.textContent = getCountdownString();
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 10000); // обновляем каждые 10 секунд

      const handleClose = () => {
        clearInterval(interval);
        close();
        resolve();
      };
      cancelBtn.addEventListener('click', handleClose);
      wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', handleClose);
      return;
    }

    const hintsContainer = wrap.querySelector('#stgUsernameHints') as HTMLDivElement;
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

      hintsContainer.querySelectorAll('[data-rule]').forEach((li) => {
        const key = li.getAttribute('data-rule');
        if (key === 'len' || key === 'chars') {
          const ok = rules[key] ? rules[key](v) : false;
          li.classList.toggle('ok', ok);
          if (!ok) syncOk = false;
        }
      });

      const availableLi = hintsContainer.querySelector('[data-rule="available"]') as HTMLLIElement;

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
        if (checkTimeout) clearTimeout(checkTimeout);
      } else if (v !== lastCheckedVal) {
        saveBtn.disabled = true;
        if (availableLi) availableLi.classList.remove('ok');
        errorDiv.style.display = 'none';
        if (checkTimeout) clearTimeout(checkTimeout);
        checkTimeout = window.setTimeout(async () => {
          lastCheckedVal = v;
          try {
            const res = await apiCall(`/profile/check-username/${encodeURIComponent(v)}`, { credentials: 'include' });
            const data = await res.json();
            if (input.value === v) {
              isAvailable = data.ok && data.available;
              if (availableLi) availableLi.classList.toggle('ok', isAvailable);
              saveBtn.disabled = !isAvailable;
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
          } catch (err) { console.error(err); }
        }, 400);
      } else {
        // Reuse cached availability result
        if (availableLi) availableLi.classList.toggle('ok', isAvailable);
        saveBtn.disabled = !isAvailable;
        if (!isAvailable && lastCheckedVal) {
          errorDiv.textContent = t('Имя пользователя занято');
          errorDiv.style.display = 'block';
        } else {
          errorDiv.style.display = 'none';
        }
      }
    };

    input.addEventListener('input', updateHints);
    input.addEventListener('focus', updateHints);
    input.addEventListener('blur', updateHints);
    updateHints();

    const handleSave = async () => {
      const val = input.value.trim();
      if (!val) return;
      saveBtn.disabled = true;
      const oldText = saveBtn.textContent;
      saveBtn.textContent = t('Сохранение…');
      try {
        const res = await opts.onSave(val);
        if (res.ok) { close(); resolve(); }
        else {
          input.classList.add('input--invalid');
          errorDiv.textContent = res.error || t('Ошибка сохранения');
          errorDiv.style.display = 'block';
          saveBtn.disabled = false;
          saveBtn.textContent = oldText;
        }
      } catch {
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
      } catch {
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

export function showSettingsAvatarFrameModal(opts: {
  profile: { avatar?: string; avatarFrame?: string | null; avatar_frame?: string | null; isPremium?: boolean };
  onSave: (selectedFrame: string) => Promise<{ ok: boolean; error?: string }>;
  onOpenPremium?: () => void;
}): Promise<void> {
  const old = document.getElementById('settingsAvatarFrameModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsAvatarFrameModal';
    wrap.className = 'account-notice-modal';

    const isPremium = Boolean(opts.profile.isPremium);
    const currentFrame = (opts.profile.avatarFrame || opts.profile.avatar_frame || (isPremium ? 'frame-neon-orange' : 'frame-none')).trim();
    let selectedFrameId = currentFrame;

    const avatarEmoji = getAvatarEmoji(opts.profile.avatar || 'avatar-cat') || '🐱';

    const framesHtml = AVATAR_FRAMES.map((frame) => {
      const isLocked = frame.premium && !isPremium;
      const isSelected = selectedFrameId === frame.id;
      const frameClass = getAvatarFrameClass(frame.id, false);
      const lockTooltip = isLocked ? `${t(frame.label)} (${t('Только для Premium')})` : t(frame.label);

      return `
        <div class="frame-option ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}" 
             data-frame="${frame.id}" 
             title="${escapeHtml(lockTooltip)}"
             style="cursor: pointer; position: relative; padding: 12px 8px; border-radius: 14px; background: ${isSelected ? 'rgba(251, 191, 36, 0.12)' : 'rgba(255, 255, 255, 0.03)'}; border: 1.5px solid ${isSelected ? '#fbbf24' : isLocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); user-select: none; -webkit-user-select: none;">
          <div class="profile-avatar ${frameClass}" style="width: 48px; height: 48px; font-size: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06); transition: all 0.2s;">
            ${avatarEmoji}
          </div>
          <div style="font-size: 12px; font-weight: 700; color: ${isSelected ? '#fef08a' : '#cbd5e1'}; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${frame.icon} ${t(frame.label)}
          </div>
          ${isLocked ? `<div style="position: absolute; top: 6px; right: 6px; font-size: 11px; background: rgba(0,0,0,0.6); padding: 2px 5px; border-radius: 6px; color: #fbbf24;">🔒</div>` : ''}
          ${frame.premium ? `<div style="font-size: 10px; font-weight: 800; color: #fbbf24; background: rgba(234, 179, 8, 0.15); padding: 1px 6px; border-radius: 999px;">PREMIUM</div>` : ''}
        </div>
      `;
    }).join('');

    const activeFrameObj = AVATAR_FRAMES.find((f) => f.id === selectedFrameId) || AVATAR_FRAMES[0];
    const initialPreviewClass = getAvatarFrameClass(selectedFrameId, false);

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(94vw, 560px) !important; padding: 26px !important; border-radius: 24px !important; max-height: 88vh; overflow-y: auto; background: #0f172a !important; border: 1px solid rgba(234, 179, 8, 0.3) !important; box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(234, 179, 8, 0.15) !important;" role="dialog" aria-modal="true" aria-labelledby="stgAvatarFrameTitle">
        <div id="stgAvatarFrameTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 800 !important; margin-bottom: 18px !important; display: flex; align-items: center; gap: 8px;">
          <span>✨</span>
          <span>${t('Эксклюзивные рамки аватара')}</span>
        </div>

        <!-- Live Preview Box -->
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 18px; display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">
          <div class="profile-avatar ${initialPreviewClass}" id="stgFrameLivePreview" style="width: 80px; height: 80px; font-size: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06); transition: all 0.25s;">
            ${avatarEmoji}
          </div>
          <div id="stgFramePreviewLabel" style="font-size: 15px; font-weight: 800; color: #fbbf24; margin-top: 12px;">
            ${activeFrameObj.icon} ${t(activeFrameObj.label)}
          </div>
          <div id="stgFramePreviewDesc" style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
            ${t(activeFrameObj.desc)}
          </div>
        </div>

        <div style="font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 10px;">
          ${t('Выберите эффект оформления:')}
        </div>

        <div class="avatar-frames-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; max-height: 260px; overflow-y: auto; padding: 4px;">
          ${framesHtml}
        </div>

        <div id="stgAvatarFrameError" class="input-error-msg" style="color: #f87171; font-size: 13px; margin-top: 10px; display: none;"></div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 22px !important;">
          <button type="button" class="btn btn-outline" id="stgAvatarFrameCancelBtn">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgAvatarFrameSaveBtn" style="background: linear-gradient(135deg, #f59e0b, #eab308); color: #000; font-weight: 800; border: none;">${t('Применить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#stgAvatarFrameCancelBtn') as HTMLButtonElement;
    const saveBtn = wrap.querySelector('#stgAvatarFrameSaveBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#stgAvatarFrameError') as HTMLDivElement;
    const livePreviewEl = wrap.querySelector('#stgFrameLivePreview') as HTMLElement;
    const previewLabelEl = wrap.querySelector('#stgFramePreviewLabel') as HTMLElement;
    const previewDescEl = wrap.querySelector('#stgFramePreviewDesc') as HTMLElement;
    const frameOptions = wrap.querySelectorAll('.frame-option');

    function updateLivePreview(frameId: string) {
      const frameObj = AVATAR_FRAMES.find((f) => f.id === frameId) || AVATAR_FRAMES[0];
      const frameClass = getAvatarFrameClass(frameId, false);

      // Remove all previous avatar-frame-- classes
      livePreviewEl.className = `profile-avatar ${frameClass}`;
      if (previewLabelEl) previewLabelEl.textContent = `${frameObj.icon} ${t(frameObj.label)}`;
      if (previewDescEl) previewDescEl.textContent = t(frameObj.desc);
    }

    frameOptions.forEach((option) => {
      option.addEventListener('click', () => {
        const frameId = (option as HTMLElement).dataset.frame;
        if (!frameId) return;

        if (option.classList.contains('locked')) {
          if (opts.onOpenPremium) {
            close();
            opts.onOpenPremium();
          }
          return;
        }

        frameOptions.forEach((opt) => {
          opt.classList.remove('selected');
          (opt as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.12)';
          (opt as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
        });

        option.classList.add('selected');
        (option as HTMLElement).style.borderColor = '#fbbf24';
        (option as HTMLElement).style.background = 'rgba(251, 191, 36, 0.12)';

        selectedFrameId = frameId;
        updateLivePreview(frameId);
      });
    });

    const close = createModalCloser(wrap, dialogEl, resolve);

    cancelBtn.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      errorEl.style.display = 'none';
      const res = await opts.onSave(selectedFrameId);
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
        <div id="stgBioTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 16px !important;">✍️ ${t('Подпись')}</div>
        
        <div class="sec-form-row">
          <label class="label" for="stgBioInp" style="margin-bottom: 8px !important; display: block !important;">${t('Ваша персональная подпись')}</label>
          <textarea class="input" id="stgBioInp" rows="3" maxlength="500" placeholder="${t('Введите вашу подпись...')}" style="width: 100%; font-size: 14px !important; resize: vertical;">${escapeHtml(opts.currentBio)}</textarea>
          <div class="field-hint" id="stgBioCharCount" style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; text-align: right;">${opts.currentBio.length} / 500</div>
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
    const bioCharCountEl = wrap.querySelector('#stgBioCharCount');

    bioInp.addEventListener('input', () => {
      if (bioCharCountEl) bioCharCountEl.textContent = `${bioInp.value.length} / 500`;
    });

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
        <div id="stgAboutTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 16px !important;">📖 ${t('О себе')}</div>
        
        <div class="sec-form-row">
          <label class="label" for="stgAboutInp" style="margin-bottom: 8px !important; display: block !important;">${t('Подробная информация о себе')}</label>
          <textarea class="input" id="stgAboutInp" rows="5" maxlength="1000" placeholder="${t('Расскажите о себе подробнее (до 1000 символов)...')}" style="width: 100%; font-size: 14px !important; resize: vertical;">${escapeHtml(opts.currentAbout)}</textarea>
          <div class="field-hint" id="stgAboutCharCount" style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; text-align: right;">${opts.currentAbout.length} / 1000</div>
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
    const aboutCharCountEl = wrap.querySelector('#stgAboutCharCount');

    aboutInp.addEventListener('input', () => {
      if (aboutCharCountEl) aboutCharCountEl.textContent = `${aboutInp.value.length} / 1000`;
    });

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

export function showSettingsCustomBadgeModal(opts: {
  currentBadge: string;
  onSave: (newBadge: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<void> {
  const old = document.getElementById('settingsCustomBadgeModal');
  old?.remove();

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'settingsCustomBadgeModal';
    wrap.className = 'account-notice-modal';

    const emojiCategories: { name: string; icon: string; emojis: string[] }[] = [
      {
        name: t('Статус'),
        icon: '👑',
        emojis: ['👑', '⭐', '🌟', '💎', '✨', '🔥', '🏆', '🥇', '🎖️', '⚜️', '🔱', '💫'],
      },
      {
        name: t('Кибер'),
        icon: '⚡',
        emojis: ['⚡', '🛡️', '🚀', '🤖', '💻', '🛰️', '⚙️', '🔋', '🌐', '🛸', '🕹️', '🔮'],
      },
      {
        name: t('Игры'),
        icon: '🎮',
        emojis: ['👾', '🎯', '🎲', '⚔️', '🗡️', '🏹', '💣', '💥', '🃏', '🎪', '🏆', '🎮'],
      },
      {
        name: t('Стиль'),
        icon: '🐺',
        emojis: ['😎', '🐱', '🦊', '🐺', '🦁', '🐉', '🦅', '🦇', '💀', '👻', '🪐', '🌙'],
      },
      {
        name: t('Символы'),
        icon: '💖',
        emojis: ['🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🎵', '🎧', '🍀', '🌌', '☄️'],
      },
    ];

    const presets = [
      '👑 VIP',
      '⚡ Pro Dev',
      '💎 Elite',
      '🛡️ Sentinel',
      '🚀 Cyber',
      '✨ Legend',
      '🔥 Top 1',
      '👾 Gamer',
    ];

    const initialBadge = opts.currentBadge || '';

    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(92vw, 480px) !important; padding: 26px !important; border-radius: 20px !important;" role="dialog" aria-modal="true" aria-labelledby="stgCustomBadgeTitle">
        <div id="stgCustomBadgeTitle" class="account-notice-head" style="font-size: 20px !important; font-weight: 700 !important; margin-bottom: 6px !important;">👑 ${t('Кастомный титул / бейдж')}</div>
        <p style="font-size: 13px; color: var(--text-muted, #94a3b8); margin-bottom: 14px; line-height: 1.4;">${t('Задайте свой персональный титул или бейдж (до 24 символов), который будет отображаться рядом с вашим никнеймом.')}</p>

        <!-- Live Preview -->
        <div style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.04); padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08);">
          <span style="font-size: 12px; color: var(--text-muted, #94a3b8); font-weight: 500;">${t('Предпросмотр')}:</span>
          <span id="stgBadgePreview" class="badge badge--custom" style="padding: 4px 12px; border-radius: 9999px; font-size: 13px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(initialBadge || t('Ваш бейдж'))}</span>
        </div>

        <div class="sec-form-row" style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="label" for="stgCustomBadgeInp" style="margin-bottom: 0 !important; display: block !important;">${t('Текст бейджа')}</label>
            <span style="font-size: 11px; color: var(--text-muted, #94a3b8);"><span id="badgeCharCount">${initialBadge.length}</span> / 24</span>
          </div>
          <div style="position: relative;">
            <input type="text" class="input" id="stgCustomBadgeInp" maxlength="24" placeholder="⚡ Pro Dev, 👑 VIP, 🛡️ Sentinel..." value="${escapeHtml(initialBadge)}" style="width: 100%; font-size: 15px !important; padding-right: 36px !important;" />
            <button type="button" id="stgBadgeClearBtn" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 14px; padding: 4px; display: ${initialBadge ? 'block' : 'none'};" title="${t('Очистить')}">✕</button>
          </div>
          <div id="stgCustomBadgeError" class="input-error-msg" style="color: #f87171; font-size: 12px; margin-top: 6px; display: none;"></div>
        </div>

        <!-- Emoji Picker Section -->
        <div style="margin-bottom: 14px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 10px 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; color: var(--text-muted, #94a3b8); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">✨ ${t('Смайлики для бейджа')}</span>
            <!-- Category Tabs -->
            <div id="stgBadgeCatTabs" style="display: flex; gap: 4px;">
              ${emojiCategories
                .map(
                  (cat, i) =>
                    `<button type="button" class="badge-cat-tab ${i === 0 ? 'active' : ''}" data-cat-index="${i}" style="background: ${i === 0 ? 'rgba(234, 179, 8, 0.2)' : 'transparent'}; border: 1px solid ${i === 0 ? 'rgba(234, 179, 8, 0.4)' : 'transparent'}; color: ${i === 0 ? '#fbbf24' : 'inherit'}; border-radius: 6px; padding: 2px 6px; font-size: 13px; cursor: pointer; transition: all 0.15s ease;" title="${cat.name}">${cat.icon}</button>`
                )
                .join('')}
            </div>
          </div>

          <!-- Emoji Grid -->
          <div id="stgBadgeEmojiGrid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; justify-items: center;">
            ${emojiCategories[0].emojis
              .map(
                (emoji) =>
                  `<button type="button" class="badge-emoji-btn" data-emoji="${emoji}" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; font-size: 18px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;" title="${t('Вставить')} ${emoji}">${emoji}</button>`
              )
              .join('')}
          </div>
        </div>

        <!-- Presets -->
        <div style="margin-bottom: 16px;">
          <span style="font-size: 11px; color: var(--text-muted, #94a3b8); display: block; margin-bottom: 6px; font-weight: 500;">🏷️ ${t('Готовые варианты')}:</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${presets
              .map(
                (p) =>
                  `<button type="button" class="badge-preset-chip" data-preset="${p}" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 3px 8px; font-size: 11px; color: var(--text, #e2e8f0); cursor: pointer; transition: all 0.15s ease;">${p}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="account-notice-actions account-notice-actions--end" style="display: flex !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 16px !important;">
          <button type="button" class="btn btn-outline" id="stgCustomBadgeCancelBtn">${t('Отмена')}</button>
          <button type="button" class="btn btn-primary" id="stgCustomBadgeSaveBtn" style="background: linear-gradient(135deg, #eab308, #ca8a04); border-color: #eab308; color: #000; font-weight: 700; padding: 10px 20px !important;">${t('Сохранить')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const cancelBtn = wrap.querySelector('#stgCustomBadgeCancelBtn') as HTMLButtonElement;
    const saveBtn = wrap.querySelector('#stgCustomBadgeSaveBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#stgCustomBadgeError') as HTMLDivElement;
    const inp = wrap.querySelector('#stgCustomBadgeInp') as HTMLInputElement;
    const countEl = wrap.querySelector('#badgeCharCount');
    const previewEl = wrap.querySelector('#stgBadgePreview') as HTMLSpanElement;
    const clearBtn = wrap.querySelector('#stgBadgeClearBtn') as HTMLButtonElement;
    const emojiGrid = wrap.querySelector('#stgBadgeEmojiGrid') as HTMLDivElement;
    const catTabs = wrap.querySelectorAll('.badge-cat-tab') as NodeListOf<HTMLButtonElement>;

    const updatePreview = () => {
      const val = inp.value;
      if (countEl) countEl.textContent = `${val.length}`;
      if (previewEl) {
        previewEl.textContent = val.trim() || t('Ваш бейдж');
      }
      if (clearBtn) {
        clearBtn.style.display = val.length > 0 ? 'block' : 'none';
      }
    };

    inp.addEventListener('input', updatePreview);

    clearBtn?.addEventListener('click', () => {
      inp.value = '';
      updatePreview();
      inp.focus();
    });

    // Helper to insert text at current cursor or append
    const insertAtCursor = (text: string) => {
      const start = inp.selectionStart ?? inp.value.length;
      const end = inp.selectionEnd ?? inp.value.length;
      const current = inp.value;
      
      let next = current.slice(0, start) + text + current.slice(end);
      if (next.length > 24) {
        next = next.slice(0, 24);
      }
      inp.value = next;
      updatePreview();
      inp.focus();
      const newPos = Math.min(start + text.length, 24);
      inp.setSelectionRange(newPos, newPos);
    };

    // Render emojis for active category
    const renderCategoryEmojis = (catIndex: number) => {
      const category = emojiCategories[catIndex];
      if (!category || !emojiGrid) return;

      emojiGrid.innerHTML = category.emojis
        .map(
          (emoji) =>
            `<button type="button" class="badge-emoji-btn" data-emoji="${emoji}" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; font-size: 18px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;" title="${t('Вставить')} ${emoji}">${emoji}</button>`
        )
        .join('');

      // Bind clicks to new emoji buttons
      emojiGrid.querySelectorAll('.badge-emoji-btn').forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
          (btn as HTMLElement).style.background = 'rgba(234, 179, 8, 0.15)';
          (btn as HTMLElement).style.borderColor = 'rgba(234, 179, 8, 0.3)';
          (btn as HTMLElement).style.transform = 'scale(1.15)';
        });
        btn.addEventListener('mouseleave', () => {
          (btn as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
          (btn as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.08)';
          (btn as HTMLElement).style.transform = 'scale(1)';
        });
        btn.addEventListener('click', () => {
          const emoji = btn.getAttribute('data-emoji');
          if (!emoji) return;

          // If input is empty, add emoji + space
          if (!inp.value) {
            insertAtCursor(`${emoji} `);
          } else {
            // If text starts without emoji and cursor is at 0, add with space
            const pos = inp.selectionStart ?? inp.value.length;
            if (pos === 0 || pos === inp.value.length) {
              insertAtCursor(`${emoji} `);
            } else {
              insertAtCursor(emoji);
            }
          }
        });
      });
    };

    // Category tabs switching
    catTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        catTabs.forEach((t) => {
          t.style.background = 'transparent';
          t.style.borderColor = 'transparent';
          t.style.color = 'inherit';
        });
        tab.style.background = 'rgba(234, 179, 8, 0.2)';
        tab.style.borderColor = 'rgba(234, 179, 8, 0.4)';
        tab.style.color = '#fbbf24';

        const idx = Number(tab.getAttribute('data-cat-index') || 0);
        renderCategoryEmojis(idx);
      });
    });

    // Initial binding for first category emojis
    renderCategoryEmojis(0);

    // Preset chips
    wrap.querySelectorAll('.badge-preset-chip').forEach((chip) => {
      chip.addEventListener('mouseenter', () => {
        (chip as HTMLElement).style.background = 'rgba(234, 179, 8, 0.2)';
        (chip as HTMLElement).style.borderColor = 'rgba(234, 179, 8, 0.4)';
        (chip as HTMLElement).style.color = '#fbbf24';
      });
      chip.addEventListener('mouseleave', () => {
        (chip as HTMLElement).style.background = 'rgba(255, 255, 255, 0.06)';
        (chip as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.1)';
        (chip as HTMLElement).style.color = 'var(--text, #e2e8f0)';
      });
      chip.addEventListener('click', () => {
        const preset = chip.getAttribute('data-preset');
        if (preset) {
          inp.value = preset;
          updatePreview();
          inp.focus();
        }
      });
    });

    const close = createModalCloser(wrap, dialogEl, resolve);

    cancelBtn.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    saveBtn.addEventListener('click', async () => {
      errorEl.style.display = 'none';
      const val = inp.value.trim();
      if (val && containsProfanity(val)) {
        errorEl.textContent = t('Текст бейджа содержит недопустимые или 18+ выражения');
        errorEl.style.display = 'block';
        return;
      }
      saveBtn.disabled = true;
      const res = await opts.onSave(val);
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

/**
 * Detects user's default currency based on:
 * 1. Saved preference (localStorage)
 * 2. Interface language (uk -> UAH)
 * 3. Browser timezone / region (Ukraine -> UAH, EU -> EUR, other -> USD)
 */
export function detectUserCurrency(): 'USD' | 'EUR' | 'UAH' {
  // 1. Saved user preference
  try {
    const saved = localStorage.getItem('cyb_preferred_currency') as 'USD' | 'EUR' | 'UAH' | null;
    if (saved && (saved === 'USD' || saved === 'EUR' || saved === 'UAH')) {
      return saved;
    }
  } catch {}

  // 2. Language check (if user is on Ukrainian locale -> default to UAH)
  try {
    const currentLocale = getLocale();
    if (currentLocale === 'uk') {
      return 'UAH';
    }
  } catch {}

  // 3. Timezone detection
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (
      tz.includes('Kyiv') ||
      tz.includes('Kiev') ||
      tz.includes('Uzhgorod') ||
      tz.includes('Zaporozhye') ||
      tz.includes('Simferopol')
    ) {
      return 'UAH';
    }

    // Eurozone countries/cities
    const euroZones = [
      'Europe/Berlin', 'Europe/Paris', 'Europe/Rome', 'Europe/Madrid',
      'Europe/Vienna', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Dublin',
      'Europe/Helsinki', 'Europe/Lisbon', 'Europe/Athens', 'Europe/Tallinn',
      'Europe/Riga', 'Europe/Vilnius', 'Europe/Bratislava', 'Europe/Ljubljana',
      'Europe/Nicosia', 'Europe/Valletta', 'Europe/Luxembourg', 'Europe/Warsaw',
      'Europe/Prague', 'Europe/Budapest', 'Europe/Bucharest', 'Europe/Sofia'
    ];
    if (euroZones.some((ez) => tz.startsWith(ez) || tz === ez)) {
      return 'EUR';
    }
  } catch {}

  // 4. Browser languages
  try {
    const lang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    if (lang.startsWith('uk')) return 'UAH';
    if (['de', 'fr', 'it', 'es', 'nl', 'pt', 'el', 'fi', 'et', 'lv', 'lt', 'sk', 'sl'].some((l) => lang.startsWith(l))) {
      return 'EUR';
    }
  } catch {}

  return 'USD';
}

export function openPremiumModal(user: Partial<User> | Record<string, unknown>, onUpdated?: () => void): void {
  const old = document.getElementById('cyblightPremiumModal');
  old?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'cyblightPremiumModal';
  wrap.className = 'account-notice-modal';

  let selectedCurrency: 'USD' | 'EUR' | 'UAH' = detectUserCurrency();
  let selectedPlanId = 'year_1';

  const plans = [
    {
      id: 'month_1',
      title: t('1 Месяц'),
      prices: { USD: '$4.99', EUR: '€4.59', UAH: '199 ₴' },
      badge: '',
      desc: t('Базовый период'),
    },
    {
      id: 'month_6',
      title: t('6 Месяцев'),
      prices: { USD: '$24.99', EUR: '€22.99', UAH: '999 ₴' },
      badge: '-16%',
      desc: t('Популярный выбор'),
    },
    {
      id: 'year_1',
      title: t('1 Год'),
      prices: { USD: '$39.99', EUR: '€36.99', UAH: '1599 ₴' },
      badge: t('-33% Хит'),
      popular: true,
      desc: t('Максимальная выгода'),
    },
    {
      id: 'lifetime',
      title: t('Навсегда'),
      prices: { USD: '$79.99', EUR: '€74.99', UAH: '3199 ₴' },
      badge: 'VIP ∞',
      desc: t('Бессрочный доступ'),
    },
  ];

  const benefits = [
    { icon: '⭐', title: t('Золотой статус Premium'), desc: t('Эксклюзивный значок в профиле, чатах и SmartHome Hub') },
    { icon: '🏠', title: t('Безлимитный SmartHome Hub'), desc: t('Неограниченные комнаты, устройства Tapo и Wake-on-LAN') },
    { icon: '🎨', title: t('Эксклюзивные темы и аватары'), desc: t('Доступ ко всем премиум-темам, стилям оформления и градиентам') },
    { icon: '⚡', title: t('Приоритетная E2EE-синхронизация'), desc: t('Мгновенная доставка сигналов и облачных бэкапов') },
    { icon: '🛡️', title: t('Приоритетная поддержка'), desc: t('Прямой доступ к разработчикам 24/7') },
  ];

  const now = Date.now();
  const isPremium = Boolean(user.isPremium || (user.premiumUntil && Number(user.premiumUntil) > now));
  let statusHtml = '';

  if (isPremium && user.premiumUntil) {
    const daysLeft = Math.max(1, Math.ceil((Number(user.premiumUntil) - now) / 86400000));
    const expDate = new Date(Number(user.premiumUntil)).toLocaleDateString();
    statusHtml = `
      <div style="background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.4); border-radius: 14px; padding: 12px 16px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">⭐</span>
          <div>
            <div style="font-weight: 700; color: #eab308; font-size: 14px;">${t('Подписка активна')}</div>
            <div style="font-size: 12px; color: #94a3b8;">${t('Действует до')} ${expDate} (${daysLeft} ${t('дн.')})</div>
          </div>
        </div>
        <span style="background: #eab308; color: #000; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 20px;">ACTIVE</span>
      </div>
    `;
  }

  function renderModalHtml(): string {
    return `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" style="width: min(94vw, 560px) !important; max-height: 90vh !important; overflow-y: auto !important; padding: 24px !important; border-radius: 24px !important; background: #0f172a !important; border: 1px solid rgba(234, 179, 8, 0.3) !important; box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(234, 179, 8, 0.15) !important;" role="dialog" aria-modal="true">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #f59e0b, #eab308); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.4);">
              👑
            </div>
            <div>
              <h3 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0; background: linear-gradient(90deg, #fff, #fef08a); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">CybLight Premium</h3>
              <p style="font-size: 12px; color: #94a3b8; margin: 2px 0 0;">${t('Максимум возможностей для вашего аккаунта')}</p>
            </div>
          </div>
          <button type="button" id="premiumCloseBtn" style="background: rgba(255,255,255,0.08); border: none; color: #94a3b8; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">✕</button>
        </div>

        ${statusHtml}

        <!-- Currency Selector -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${t('Выберите валюту оплаты')}</div>
          <div style="display: flex; gap: 8px;">
            ${(['USD', 'EUR', 'UAH'] as const).map((curr) => `
              <button type="button" class="premium-curr-btn" data-curr="${curr}" style="flex: 1; padding: 8px 12px; border-radius: 10px; border: 1px solid ${selectedCurrency === curr ? '#eab308' : 'rgba(255,255,255,0.1)'}; background: ${selectedCurrency === curr ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.03)'}; color: ${selectedCurrency === curr ? '#fef08a' : '#cbd5e1'}; font-weight: ${selectedCurrency === curr ? '700' : '500'}; font-size: 13px; cursor: pointer; transition: all 0.2s;">
                ${curr === 'USD' ? 'USD ($)' : curr === 'EUR' ? 'EUR (€)' : 'UAH (₴)'}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Tariff Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
          ${plans.map((p) => {
            const isSel = selectedPlanId === p.id;
            return `
              <div class="premium-plan-card" data-plan="${p.id}" style="position: relative; border-radius: 16px; padding: 14px; border: 2px solid ${isSel ? '#eab308' : 'rgba(255,255,255,0.08)'}; background: ${isSel ? 'linear-gradient(180deg, rgba(234, 179, 8, 0.12), rgba(15, 23, 42, 0.8))' : 'rgba(255,255,255,0.02)'}; cursor: pointer; transition: all 0.2s; box-shadow: ${isSel ? '0 0 15px rgba(234, 179, 8, 0.25)' : 'none'};">
                ${p.badge ? `<span style="position: absolute; top: -8px; right: 10px; background: ${p.popular ? 'linear-gradient(135deg, #eab308, #f59e0b)' : '#3b82f6'}; color: ${p.popular ? '#000' : '#fff'}; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 8px;">${p.badge}</span>` : ''}
                <div style="font-size: 13px; font-weight: 600; color: #94a3b8;">${p.title}</div>
                <div style="font-size: 20px; font-weight: 800; color: #fff; margin: 4px 0 2px;">${p.prices[selectedCurrency]}</div>
                <div style="font-size: 11px; color: #64748b;">${p.desc}</div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Benefits List -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 14px; margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 700; color: #eab308; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">${t('Что входит в подписку:')}</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${benefits.map((b) => `
              <div style="display: flex; align-items: flex-start; gap: 10px;">
                <span style="font-size: 16px; line-height: 1.2;">${b.icon}</span>
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: #f1f5f9;">${b.title}</div>
                  <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">${b.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Payment Badges / Gateway -->
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(234, 179, 8, 0.2); border-radius: 14px; padding: 12px 14px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🐱</span>
            <div style="font-size: 12px; font-weight: 700; color: #f1f5f9;">
              monocheckout <span style="font-size: 11px; color: #94a3b8; font-weight: 400;">(${t('Еквайринг Monobank')})</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #cbd5e1; font-weight: 600;">
            <span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 3px 7px; border-radius: 6px;">🐱 mono</span>
            <span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 3px 7px; border-radius: 6px;">🍏 Apple Pay</span>
            <span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 3px 7px; border-radius: 6px;">🌐 G Pay</span>
            <span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 3px 7px; border-radius: 6px;">💳 Visa/MC</span>
          </div>
        </div>

        <!-- Error Container -->
        <div id="premiumErrorMsg" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #f87171;"></div>

        <!-- Actions -->
        <div style="display: flex; gap: 12px;">
          <button type="button" class="btn btn-outline" id="premiumCancelModalBtn" style="flex: 1; border-radius: 14px; font-weight: 600;">${t('Закрыть')}</button>
          <button type="button" class="btn btn-primary" id="premiumSubscribeSubmitBtn" style="flex: 2; border-radius: 14px; background: linear-gradient(135deg, #f59e0b, #eab308); color: #000; font-weight: 800; font-size: 14px; border: none; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>🐱</span> ${isPremium ? t('Продлить через Monobank') : t('Оплатить через Monobank')}
          </button>
        </div>
      </div>
    `;
  }

  function bindEvents(): void {
    const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
    const close = createModalCloser(wrap, dialogEl);

    wrap.querySelector('#premiumCloseBtn')?.addEventListener('click', () => close());
    wrap.querySelector('#premiumCancelModalBtn')?.addEventListener('click', () => close());
    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close());

    wrap.querySelectorAll('.premium-curr-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const curr = (e.currentTarget as HTMLElement).dataset.curr as 'USD' | 'EUR' | 'UAH' | undefined;
        if (curr) {
          selectedCurrency = curr;
          try {
            localStorage.setItem('cyb_preferred_currency', curr);
          } catch {}
          wrap.innerHTML = renderModalHtml();
          bindEvents();
        }
      });
    });

    wrap.querySelectorAll('.premium-plan-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const plan = (e.currentTarget as HTMLElement).dataset.plan;
        if (plan) {
          selectedPlanId = plan;
          wrap.innerHTML = renderModalHtml();
          bindEvents();
        }
      });
    });

    const submitBtn = wrap.querySelector('#premiumSubscribeSubmitBtn') as HTMLButtonElement;
    const errorEl = wrap.querySelector('#premiumErrorMsg') as HTMLDivElement;

    submitBtn?.addEventListener('click', async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = t('Создание счета Monobank...');
      if (errorEl) errorEl.style.display = 'none';

      try {
        localStorage.setItem('cyb_pending_premium_plan', selectedPlanId);

        const res = await apiCall('/premium/create-mono-invoice', {
          method: 'POST',
          body: JSON.stringify({
            planId: selectedPlanId,
            currency: selectedCurrency,
            redirectUrl: `${window.location.origin}/account-settings?mono_success=true&invoice_id={invoiceId}&plan_id=${selectedPlanId}`,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.ok && data.pageUrl) {
          submitBtn.textContent = t('Переход к оплате Monobank...');
          window.location.href = data.pageUrl;
          return;
        }

        // Fallback for development if Monobank token is not configured yet
        if (data?.error && (data.error.includes('MONOBANK_TOKEN') || data.error.includes('not configured'))) {
          const directRes = await apiCall('/premium/subscribe', {
            method: 'POST',
            body: JSON.stringify({
              planId: selectedPlanId,
              currency: selectedCurrency,
            }),
          });
          const directData = await directRes.json().catch(() => ({}));
          if (directRes.ok && directData.ok) {
            close();
            localStorage.setItem('cyb_golden_touch_unlocked', '1');

            let modalIcon = '👑';
            let modalTitle = t('Золотое прикосновение');
            let modalSubtitle = t('Подписка оформлена & Пасхалка открыта! 🎉');
            let modalDesc = t('Поздравляем! Вы активировали подписку CybLight Premium и разблокировали секретную пасхалку «Золотое прикосновение»!');
            let targetCardId = 'easterCardGoldenTouch';

            if (selectedPlanId === 'month_1') {
              localStorage.setItem('cyb_first_pulse_unlocked', '1');
              modalIcon = '🚀';
              modalTitle = t('Первый импульс');
              modalSubtitle = t('1 Месяц Premium & Пасхалка открыта! 🚀');
              modalDesc = t('Поздравляем! Вы запустили свой первый месяц Premium и открыли секретную пасхалку «Первый импульс»!');
              targetCardId = 'easterCardFirstPulse';
            } else if (selectedPlanId === 'month_6') {
              localStorage.setItem('cyb_season_guardian_unlocked', '1');
              modalIcon = '🛡️';
              modalTitle = t('Сезонный страж');
              modalSubtitle = t('6 Месяцев Premium & Пасхалка открыта! 🛡️');
              modalDesc = t('Поздравляем! Вы активировали 6 месяцев Premium и открыли секретную пасхалку «Сезонный страж»!');
              targetCardId = 'easterCardSeasonGuardian';
            } else if (selectedPlanId === 'year_1') {
              localStorage.setItem('cyb_epoch_keeper_unlocked', '1');
              modalIcon = '⏳';
              modalTitle = t('Хранитель эпохи');
              modalSubtitle = t('1 Год Premium & Пасхалка открыта! ⏳');
              modalDesc = t('Поздравляем! Вы активировали 1 Год Premium и открыли секретную пасхалку «Хранитель эпохи»!');
              targetCardId = 'easterCardEpochKeeper';
            } else if (selectedPlanId === 'lifetime') {
              localStorage.setItem('cyb_infinity_overlord_unlocked', '1');
              modalIcon = '♾️';
              modalTitle = t('Властелин бесконечности');
              modalSubtitle = t('Lifetime VIP & Высшая пасхалка открыта! 🌌👑');
              modalDesc = t('Поздравляем! Вы активировали бессрочный статус Lifetime VIP и разблокировали легендарную пасхалку «Властелин бесконечности»!');
              targetCardId = 'easterCardInfinityOverlord';
            }

            showEasterUnlockCelebrationModal({
              icon: modalIcon,
              title: modalTitle,
              subtitle: modalSubtitle,
              description: modalDesc,
              hint: t('Вам доступны 10x лимиты API, безлимитный SmartHome Hub, эксклюзивные темы, 2.5x монет и кастомный титул.'),
              targetCardId,
              subtab: 'site',
            });
            onUpdated?.();
            return;
          }
        }

        submitBtn.disabled = false;
        submitBtn.textContent = isPremium ? t('Продлить через Monobank') : t('Оплатить через Monobank');
        if (errorEl) {
          errorEl.textContent = data.error || data.message || t('Ошибка оформления подписки');
          errorEl.style.display = 'block';
        }
      } catch (err: unknown) {
        submitBtn.disabled = false;
        submitBtn.textContent = isPremium ? t('Продлить через Monobank') : t('Оплатить через Monobank');
        if (errorEl) {
          errorEl.textContent = err instanceof Error ? err.message : t('Ошибка подключения к серверу');
          errorEl.style.display = 'block';
        }
      }
    });
  }

  wrap.innerHTML = renderModalHtml();
  document.body.appendChild(wrap);
  bindEvents();
}

export interface EasterCelebrationOpts {
  icon: string;
  title: string;
  subtitle?: string;
  description: string;
  hint?: string;
  targetCardId?: string;
  subtab?: string;
  onGoToCollection?: () => void;
}

/**
 * Модальное окно поздравления с открытием пасхалки
 */
export function showEasterUnlockCelebrationModal(opts: EasterCelebrationOpts): void {
  const old = document.getElementById('easterCelebrationModal');
  old?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'easterCelebrationModal';
  wrap.className = 'account-notice-modal easter-celebration-modal';

  wrap.innerHTML = `
    <div class="account-notice-backdrop easter-celebration-backdrop"></div>
    <div
      class="account-notice-card easter-celebration-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="easterCelebrationTitle"
    >
      <div class="easter-celebration-glow"></div>
      
      <div class="easter-celebration-top">
        <div class="easter-celebration-badge-tag">
          <span>🎉 ${t('Секретная пасхалка найдена!')}</span>
        </div>
      </div>

      <div class="easter-celebration-icon-box">
        <span class="easter-celebration-icon">${escapeHtml(opts.icon)}</span>
        <div class="easter-celebration-sparkles">✨</div>
      </div>

      <div class="easter-celebration-content">
        <h2 id="easterCelebrationTitle" class="easter-celebration-title">
          ${escapeHtml(opts.title)}
        </h2>
        ${opts.subtitle ? `<div class="easter-celebration-subtitle">${escapeHtml(opts.subtitle)}</div>` : ''}
        
        <p class="easter-celebration-desc">
          ${escapeHtml(opts.description)}
        </p>

        ${opts.hint ? `
          <div class="easter-celebration-hint">
            <span class="easter-celebration-hint-icon">💡</span>
            <span>${escapeHtml(opts.hint)}</span>
          </div>
        ` : ''}
      </div>

      <div class="easter-celebration-actions">
        <button type="button" class="btn btn-primary easter-celebration-view-btn" id="easterCelebrationViewBtn">
          <span>🍓 ${t('Открыть коллекцию пасхалок')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
        <button type="button" class="btn btn-outline" id="easterCelebrationCloseBtn">
          ${t('Отлично!')}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const dialogEl = wrap.querySelector('.easter-celebration-card') as HTMLElement;
  const close = createModalCloser(wrap, dialogEl);
  const openedAt = Date.now();

  wrap.querySelector('.easter-celebration-backdrop')?.addEventListener('click', () => {
    // Защита от случайного клика при серии быстрых тапов
    if (Date.now() - openedAt < 1000) return;
    close();
  });
  wrap.querySelector('#easterCelebrationCloseBtn')?.addEventListener('click', close);
  wrap.querySelector('#easterCelebrationViewBtn')?.addEventListener('click', () => {
    close();
    if (opts.subtab) {
      sessionStorage.setItem('cyb_easter_subtab', opts.subtab);
    }
    if (opts.targetCardId) {
      sessionStorage.setItem('cyb_easter_target_card', opts.targetCardId);
    }
    if (opts.onGoToCollection) {
      opts.onGoToCollection();
    } else {
      Router.navigate('account-easter-eggs');
    }
  });
}


