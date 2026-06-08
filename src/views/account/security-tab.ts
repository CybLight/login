/**
 * Security tab handlers - управление вкладкой Безопасность
 */

import { initPasswordEyes } from '@/components/password/password-helpers';
import type { User as AppUser } from '@/types';
import { apiCall } from '@/utils';
import { fmtTs } from './device-utils';
import { createSecurityCore } from './security-core';
import { updateSecurityIndicator, attachPasswordHints } from './security-ui';
import { loadLoginHistory, loadTrustedDevices } from './security-extras';
import { showAccountConfirmModal } from './modals';

type SecurityUser = AppUser & {
  email_verified?: boolean | number | string;
  email_verified_at?: string | number | null;
};

type SecurityTabDeps = {
  user: SecurityUser;
  api: { showMsg: (type: string, text: string, persist?: boolean) => void; clearMsg: () => void };
  // State refs - must be mutable objects to track state changes
  state: {
    twoFAEnabled: boolean;
    passkeyCount: number;
    emailVerified: boolean;
  };
  // Callbacks for state updates
  onTwoFAChanged?: (value: boolean) => void;
  onPasskeyCountChanged?: (value: number) => void;
  onEmailVerifiedChanged?: (value: boolean) => void;
  onUserUpdated?: (partial: Partial<SecurityUser>) => void;
  isEmailVerified: (user: AppUser) => boolean;
};

export function bindSecurityHandlers(deps: SecurityTabDeps): void {
  const { user, api, state, onTwoFAChanged, onPasskeyCountChanged, onEmailVerifiedChanged, onUserUpdated, isEmailVerified } = deps;

  // Wrapper для обновления индикатора безопасности с текущими значениями
  const refreshSecurityIndicator = () => {
    updateSecurityIndicator(state.twoFAEnabled, state.passkeyCount, state.emailVerified);
  };

  const { loadTwoFAStatus, loadPasskeys } = createSecurityCore({
    updateSecurityIndicator: refreshSecurityIndicator,
    setTwoFAEnabled: (value) => {
      state.twoFAEnabled = value;
      onTwoFAChanged?.(value);
    },
    setPasskeyCount: (value) => {
      state.passkeyCount = value;
      onPasskeyCountChanged?.(value);
    },
    setEmailVerified: (value) => {
      state.emailVerified = value;
      onEmailVerifiedChanged?.(value);
    },
  });

  // Инициализируем password eyes для всех полей паролей в security tab
  try {
    initPasswordEyes(document.getElementById('accBody') || document);
  } catch (error) {
    console.error('[SECURITY] initPasswordEyes error:', error);
  }

  // ==================== SECURITY CHECK ====================
  const itemSecurityCheck = document.getElementById('secSecurityCheckItem');
  const panelSecurityCheck = document.getElementById('secSecurityCheckPanel');

  if (itemSecurityCheck && panelSecurityCheck) {
    panelSecurityCheck.style.display = 'none';
    itemSecurityCheck.onclick = () => {
      const isClosed = panelSecurityCheck.style.display === 'none';
      panelSecurityCheck.style.display = isClosed ? 'block' : 'none';
    };
  }

  // ==================== EMAIL ====================
  const emailItem = document.getElementById('secEmailItem');
  const emailPanel = document.getElementById('secEmailPanel');
  const emailInp = document.getElementById('secEmailInp') as HTMLInputElement;
  const emailSaveBtn = document.getElementById('secEmailSaveBtn');
  const emailCancelBtn = document.getElementById('secEmailCancelBtn');
  const emailHint = document.getElementById('secEmailHint');
  const emailStatusEl = document.getElementById('secEmailStatus');

  const markInvalid = (input: HTMLInputElement | null, invalid: boolean) => {
    if (!input) return;
    input.classList.toggle('input--invalid', invalid);
  };

  const refreshEmailSecurityUi = () => {
    if (emailStatusEl) {
      emailStatusEl.textContent = state.emailVerified
        ? '✅ Email подтверждён'
        : user.email
          ? '⚠️ Email не подтверждён'
          : '— Email не указан';
    }

    if (emailItem) {
      const sub = emailItem.querySelector('.sec-sub');
      if (sub) sub.textContent = user.email || '—';

      const badge = emailItem.querySelector('.sec-badge');
      if (badge) {
        if (state.emailVerified) {
          badge.className = 'sec-badge sec-badge--ok';
          badge.textContent = 'Подтверждён';
        } else if (user.email) {
          badge.className = 'sec-badge sec-badge--warn';
          badge.textContent = 'Не подтверждён';
        } else {
          badge.className = 'sec-badge';
          badge.textContent = '—';
        }
      }
    }
  };

  if (emailItem && emailPanel) {
    emailPanel.style.display = 'none';
    emailItem.onclick = () => {
      const isClosed = emailPanel.style.display === 'none';
      emailPanel.style.display = isClosed ? 'block' : 'none';
    };
  }

  emailCancelBtn?.addEventListener('click', () => {
    if (emailPanel) emailPanel.style.display = 'none';
    if (emailInp) emailInp.value = user.email || '';
    markInvalid(emailInp, false);
    if (emailHint) {
      emailHint.style.display = 'none';
      emailHint.textContent = '';
    }
  });

  emailSaveBtn?.addEventListener('click', async () => {
    api.clearMsg();
    if (!emailInp) return;

    const email = emailInp.value.trim();
    markInvalid(emailInp, false);
    if (!email) {
      api.showMsg('warn', 'Введите email.');
      markInvalid(emailInp, true);
      return;
    }

    const cur = (user.email || '').trim().toLowerCase();
    const next = email.toLowerCase();

    if (cur && cur === next) {
      api.showMsg('warn', 'Это текущий email. Введите другой адрес.');
      markInvalid(emailInp, true);
      return;
    }

    (emailSaveBtn as HTMLButtonElement).disabled = true;
    const oldText = emailSaveBtn.textContent;
    emailSaveBtn.textContent = 'Сохраняю…';

    try {
      const r = await apiCall('/auth/email/set', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось сохранить email.');
        markInvalid(emailInp, true);
      } else {
        api.showMsg(
          'ok',
          d?.cooldown
            ? 'Email сохранён ✅ Письмо уже отправляли недавно.'
            : 'Email сохранён ✅ Письмо отправлено.'
        );
        user.email = email;
        if (emailPanel) emailPanel.style.display = 'none';

        const meResp = await apiCall('/auth/me', { credentials: 'include' });
        const meData = await meResp.json().catch(() => ({}));
        if (meResp.ok && meData?.user) {
          user.email = meData.user.email || user.email;
          user.email_verified = meData.user.email_verified;
          user.email_verified_at = meData.user.email_verified_at;
          state.emailVerified = isEmailVerified(user);
          onEmailVerifiedChanged?.(state.emailVerified);
          onUserUpdated?.(meData.user);
          refreshEmailSecurityUi();
          refreshSecurityIndicator();
        }
      }
    } catch {
      api.showMsg('error', 'Ошибка сети.');
    } finally {
      (emailSaveBtn as HTMLButtonElement).disabled = false;
      if (oldText) emailSaveBtn.textContent = oldText;
    }
  });

  const resendBtn = document.getElementById('secEmailResendBtn') as HTMLButtonElement | null;
  resendBtn?.addEventListener('click', async () => {
    api.clearMsg();
    resendBtn.disabled = true;
    const old = resendBtn.textContent;
    resendBtn.textContent = 'Отправляю…';

    try {
      const r = await apiCall('/auth/email/resend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось отправить письмо.');
      } else if (d?.alreadyVerified) {
        api.showMsg('ok', 'Email уже подтверждён ✅');
        user.email_verified = true;
        state.emailVerified = true;
        onEmailVerifiedChanged?.(true);
        refreshEmailSecurityUi();
        refreshSecurityIndicator();
      } else if (d?.cooldown) {
        api.showMsg('warn', 'Письмо уже отправляли недавно. Подожди минутку и попробуй снова.');
      } else {
        api.showMsg('ok', 'Письмо отправлено ✅ Проверь почту (и Спам).');
      }
    } catch {
      api.showMsg('error', 'Ошибка сети.');
    } finally {
      resendBtn.disabled = false;
      if (old) resendBtn.textContent = old;
    }
  });

  // ==================== PASSWORD ====================
  const passItem = document.getElementById('secPassItem');
  const passPanel = document.getElementById('secPassPanel');
  const passCurInp = document.getElementById('secPassCur') as HTMLInputElement;
  const passNewInp = document.getElementById('secPassNew') as HTMLInputElement;
  const passNew2Inp = document.getElementById('secPassNew2') as HTMLInputElement;
  const passSaveBtn = document.getElementById('secPassSaveBtn');
  const passCancelBtn = document.getElementById('secPassCancelBtn');
  const passStatusEl = document.getElementById('secPassStatus');
  const passHintEl = document.getElementById('secPassHint');
  const hintsChange = document.getElementById('passHintsChange');

  attachPasswordHints(passNewInp, hintsChange as HTMLElement | null, {
    minLen: 8,
    requireUpper: true,
    requireLower: true,
  });

  const setPassHint = (type: 'ok' | 'warn' | 'error', text: string) => {
    if (!passHintEl) return;
    passHintEl.style.display = '';
    passHintEl.className = `sec-hint sec-hint--${type}`;
    passHintEl.textContent = text;
  };

  const clearPassInvalid = () => {
    markInvalid(passCurInp, false);
    markInvalid(passNewInp, false);
    markInvalid(passNew2Inp, false);
  };

  const clearPassHint = () => {
    if (!passHintEl) return;
    passHintEl.style.display = 'none';
    passHintEl.textContent = '';
  };

  const openPassPanel = () => {
    if (!passPanel) return;
    passPanel.style.display = 'block';
    api.clearMsg();
    clearPassHint();
    clearPassInvalid();
    if (passStatusEl) passStatusEl.textContent = 'Введите текущий пароль и новый пароль.';
    setTimeout(() => passCurInp?.focus(), 0);
  };

  const closePassPanel = () => {
    if (!passPanel) return;
    passPanel.style.display = 'none';
    api.clearMsg();
    clearPassHint();
    if (passCurInp) passCurInp.value = '';
    if (passNewInp) passNewInp.value = '';
    if (passNew2Inp) passNew2Inp.value = '';
    if (passCurInp) passCurInp.type = 'password';
    if (passNewInp) passNewInp.type = 'password';
    if (passNew2Inp) passNew2Inp.type = 'password';
    clearPassInvalid();
  };

  if (passItem && passPanel) {
    passPanel.style.display = 'none';
    passItem.onclick = () => {
      const isClosed = passPanel.style.display === 'none';
      if (isClosed) openPassPanel();
      else closePassPanel();
    };
  }

  passCancelBtn?.addEventListener('click', closePassPanel);

  passSaveBtn?.addEventListener('click', async () => {
    api.clearMsg();
    clearPassHint();
    clearPassInvalid();

    const cur = String(passCurInp?.value || '');

    if (!cur) {
      setPassHint('warn', 'Введите действующий пароль.');
      api.showMsg('warn', 'Введите действующий пароль.', true);
      markInvalid(passCurInp, true);
      passCurInp?.focus();
      return;
    }

    const n1 = passNewInp?.value || '';
    const n2 = passNew2Inp?.value || '';

    if (!/^[\x20-\x7E]*$/.test(n1)) {
      setPassHint('warn', 'Нельзя использовать рус/укр буквы и любые не-ASCII символы.');
      api.showMsg('warn', 'Новый пароль должен быть только латиницей (ASCII).', true);
      markInvalid(passNewInp, true);
      passNewInp?.focus();
      return;
    }

    if (n1.length < 8) {
      setPassHint('warn', 'Новый пароль должен быть минимум 8 символов.');
      api.showMsg('warn', 'Новый пароль должен быть минимум 8 символов.', true);
      markInvalid(passNewInp, true);
      passNewInp?.focus();
      return;
    }

    if (n1 !== n2) {
      setPassHint('error', 'Новые пароли не совпадают.');
      api.showMsg('error', 'Новые пароли не совпадают.', true);
      markInvalid(passNewInp, true);
      markInvalid(passNew2Inp, true);
      passNew2Inp?.focus();
      return;
    }

    const curTrimmed = cur.trim();
    const n1Trimmed = n1.trim();
    if (cur === n1 || (curTrimmed && curTrimmed === n1Trimmed)) {
      setPassHint('warn', 'Новый пароль должен отличаться от текущего.');
      api.showMsg('warn', 'Новый пароль должен отличаться от текущего.', true);
      markInvalid(passNewInp, true);
      passNewInp?.focus();
      return;
    }

    (passSaveBtn as HTMLButtonElement).disabled = true;
    const oldText = passSaveBtn.textContent;
    passSaveBtn.textContent = 'Сохраняю…';

    try {
      const r = await apiCall('/auth/password/change', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passCurInp.value,
          newPassword: n1,
        }),
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        const err = String(d?.error || '');
        if (/same|identical|unchanged|reuse|password_same/i.test(err)) {
          setPassHint('warn', 'Новый пароль должен отличаться от текущего.');
          api.showMsg('warn', 'Новый пароль должен отличаться от текущего.', true);
          markInvalid(passNewInp, true);
        } else if (r.status === 401 || err.includes('invalid')) {
          setPassHint('error', 'Неверный действующий пароль.');
          api.showMsg('error', 'Неверный действующий пароль.', true);
          markInvalid(passCurInp, true);
        } else if (r.status === 429) {
          setPassHint('warn', 'Слишком много попыток. Подожди и попробуй снова.');
          api.showMsg('warn', 'Слишком много попыток. Подожди и попробуй снова.', true);
        } else {
          setPassHint('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось изменить пароль.');
          api.showMsg(
            'error',
            d?.error ? `Ошибка: ${d.error}` : 'Не удалось изменить пароль.',
            true
          );
        }
      } else {
        api.showMsg('ok', 'Пароль успешно изменён ✅');
        setPassHint('ok', 'Пароль изменён ✅');
        closePassPanel();

        const passSubEl = passItem?.querySelector('.sec-sub');
        const meResp = await apiCall('/auth/me', { credentials: 'include' });
        const meData = await meResp.json().catch(() => ({}));
        if (passSubEl && meResp.ok && meData?.user) {
          const passChanged =
            meData.user.password_changed_at ||
            meData.user.passwordChangedAt ||
            meData.user.passChangedAt ||
            meData.user.pass_changed_at ||
            null;
          passSubEl.textContent = `Последний раз был изменён: ${fmtTs(passChanged)}`;
        }
      }
    } catch {
      setPassHint('error', 'Ошибка сети.');
      api.showMsg('error', 'Ошибка сети.', true);
    } finally {
      (passSaveBtn as HTMLButtonElement).disabled = false;
      if (oldText) passSaveBtn.textContent = oldText;
    }
  });

  // ==================== 2FA ====================
  const twoFAItem = document.getElementById('sec2FAItem');
  const twoFAPanel = document.getElementById('sec2FAPanel');
  const twoFAContent = document.getElementById('sec2FAContent');

  if (twoFAItem && twoFAPanel) {
    twoFAPanel.style.display = 'none';
    twoFAItem.onclick = () => {
      const isClosed = twoFAPanel.style.display === 'none';
      twoFAPanel.style.display = isClosed ? 'block' : 'none';
    };
  }

  // ==================== PASSKEYS ====================
  const itemPasskeys = document.getElementById('secPasskeysItem');
  const panelPasskeys = document.getElementById('secPasskeysPanel');
  const contentPasskeys = document.getElementById('secPasskeysContent');

  if (itemPasskeys && panelPasskeys) {
    panelPasskeys.style.display = 'none';
    itemPasskeys.onclick = () => {
      const isClosed = panelPasskeys.style.display === 'none';
      panelPasskeys.style.display = isClosed ? 'block' : 'none';
    };
  }

  // ==================== TRUSTED DEVICES ====================
  const itemDevices = document.getElementById('secDevicesItem');
  const panelDevices = document.getElementById('secDevicesPanel');
  const listDevices = document.getElementById('trustedDevicesList');

  if (itemDevices && panelDevices) {
    panelDevices.style.display = 'none';
    itemDevices.onclick = () => {
      const isClosed = panelDevices.style.display === 'none';
      panelDevices.style.display = isClosed ? 'block' : 'none';
      if (isClosed && listDevices) {
        loadTrustedDevices(listDevices, api, showAccountConfirmModal);
      }
    };
  }

  // ==================== LOGIN HISTORY ====================
  const itemHistory = document.getElementById('secHistoryItem');
  const panelHistory = document.getElementById('secHistoryPanel');
  const listHistory = document.getElementById('loginHistoryList');

  if (itemHistory && panelHistory) {
    panelHistory.style.display = 'none';
    itemHistory.onclick = () => {
      const isClosed = panelHistory.style.display === 'none';
      panelHistory.style.display = isClosed ? 'block' : 'none';
      if (isClosed && listHistory) {
        loadLoginHistory(listHistory);
      }
    };
  }

  // Initial refresh
  state.emailVerified = isEmailVerified(user);
  refreshEmailSecurityUi();
  refreshSecurityIndicator();
  if (twoFAContent) {
    loadTwoFAStatus(twoFAContent, api);
  }
  if (contentPasskeys) {
    loadPasskeys(contentPasskeys, api);
  }
}
