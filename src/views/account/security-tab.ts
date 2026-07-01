/**
 * Security tab handlers - управление вкладкой Безопасность
 */

import { t } from '@/i18n';
import { initPasswordEyes } from '@/components/password/password-helpers';
import type { User as AppUser } from '@/types';
import { apiCall } from '@/utils';
import { fmtTs } from './device-utils';
import { createSecurityCore } from './security-core';
import { updateSecurityIndicator, attachPasswordHints } from './security-ui';
import { loadLoginHistory, loadTrustedDevices } from './security-extras';
import { bindBackupHandlers } from './security-backup';
import { openPendingSecuritySection } from './encryption-reminder';
import { showAccountConfirmModal } from './modals';
import {
  formatPendingDate,
  formatRemainingShort,
  getPendingEmailInfo,
  renderPendingCardTextHtml,
  renderPendingStatusHtml,
  renderPendingSubHtml,
} from './account-utils';

type SecurityUser = AppUser & {
  login?: string;
  email_verified?: boolean | number | string;
  email_verified_at?: string | number | null;
  pendingEmail?: string | null;
  pendingEmailVerifiedAt?: number | null;
  pendingEmailCompletesAt?: number | null;
  totp_enabled?: boolean;
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

function setSecPanelOpen(
  item: HTMLElement | null,
  panel: HTMLElement | null,
  open: boolean
): void {
  if (!panel) return;
  panel.style.display = open ? 'block' : 'none';
  item?.classList.toggle('is-open', open);
}

function toggleSecPanel(item: HTMLElement | null, panel: HTMLElement | null): boolean {
  if (!panel) return false;
  const open = panel.style.display === 'none';
  setSecPanelOpen(item, panel, open);
  return open;
}

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
      refreshSecurityIndicator();
    },
    setPasskeyCount: (value) => {
      state.passkeyCount = value;
      onPasskeyCountChanged?.(value);
      refreshSecurityIndicator();
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
      toggleSecPanel(itemSecurityCheck, panelSecurityCheck);
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
  const emailPassInp = document.getElementById('secEmailPass') as HTMLInputElement | null;
  const emailTotpInp = document.getElementById('secEmailTotp') as HTMLInputElement | null;

  const markInvalid = (input: HTMLInputElement | null, invalid: boolean) => {
    if (!input) return;
    input.classList.toggle('input--invalid', invalid);
  };

  let pendingCountdownTimer: number | undefined;

  const stopPendingCountdown = () => {
    if (pendingCountdownTimer) {
      window.clearInterval(pendingCountdownTimer);
      pendingCountdownTimer = undefined;
    }
  };

  const buildPendingTexts = (pending: NonNullable<ReturnType<typeof getPendingEmailInfo>>) => {
    const bannerText =
      pending.pendingVerifiedAt && pending.pendingCompletesAt
        ? t('Новый адрес {email} подтверждён. Смена завершится {date}.', {
            email: pending.pendingEmail,
            date: formatPendingDate(pending.pendingCompletesAt),
          })
        : t('Запрошена смена на {email}. Подтвердите письмо на новом адресе.', {
            email: pending.pendingEmail,
          });

    return {
      statusHtml: renderPendingStatusHtml(pending),
      cardHtml: renderPendingCardTextHtml(pending),
      bannerText,
    };
  };

  const refreshEmailSecurityUi = () => {
    stopPendingCountdown();

    const pending = getPendingEmailInfo(user as unknown as Record<string, unknown>);
    const currentEmail = user.email || '—';

    if (emailStatusEl) {
      if (pending) {
        emailStatusEl.classList.add('sec-status--pending');
        emailStatusEl.innerHTML = buildPendingTexts(pending).statusHtml;
      } else {
        emailStatusEl.classList.remove('sec-status--pending');
        emailStatusEl.textContent = state.emailVerified
          ? t('✅ Email подтверждён')
          : user.email
            ? t('⚠️ Email не подтверждён')
            : t('— Email не указан');
      }
    }

    const subEl = document.getElementById('secEmailSub');
    if (subEl) {
      if (pending && user.email) {
        subEl.classList.add('sec-sub--pending');
        subEl.innerHTML = renderPendingSubHtml(user.email, pending.pendingEmail);
      } else {
        subEl.classList.remove('sec-sub--pending');
        subEl.textContent = currentEmail;
      }
    }

    const badge = document.getElementById('secEmailBadge') || emailItem?.querySelector('.sec-badge');
    if (badge) {
      if (pending) {
        badge.className = 'sec-badge sec-badge--warn';
        badge.textContent = t('Смена запланирована');
      } else if (state.emailVerified) {
        badge.className = 'sec-badge sec-badge--ok';
        badge.textContent = t('Подтверждён');
      } else if (user.email) {
        badge.className = 'sec-badge sec-badge--warn';
        badge.textContent = t('Не подтверждён');
      } else {
        badge.className = 'sec-badge';
        badge.textContent = '—';
      }
    }

    const card = document.getElementById('secEmailPendingCard');
    const titleEl = document.getElementById('secEmailPendingTitle');
    const textEl = document.getElementById('secEmailPendingText');
    const countdownEl = document.getElementById('secEmailPendingCountdown');
    const bannerEl = document.getElementById('secEmailPendingBanner');
    const bannerTextEl = document.getElementById('secEmailPendingBannerText');

    if (pending && card) {
      card.classList.remove('is-hidden');
      card.hidden = false;
      const texts = buildPendingTexts(pending);

      if (titleEl) {
        titleEl.textContent = pending.pendingVerifiedAt
          ? t('Запланирована смена email')
          : t('Подтвердите новый email');
      }
      if (textEl) textEl.innerHTML = texts.cardHtml;
      if (bannerTextEl) bannerTextEl.textContent = texts.bannerText;
      if (bannerEl) bannerEl.style.display = '';

      if (countdownEl) {
        if (pending.pendingVerifiedAt && pending.pendingCompletesAt) {
          countdownEl.style.display = '';
          const updateCountdown = () => {
            const left = formatRemainingShort(pending.pendingCompletesAt);
            countdownEl.textContent = left
              ? t('Осталось: {time}', { time: left })
              : t('Смена email завершится скоро');
            if (emailStatusEl && pending) {
              emailStatusEl.innerHTML = renderPendingStatusHtml(pending);
            }
          };
          updateCountdown();
          pendingCountdownTimer = window.setInterval(updateCountdown, 60_000);
        } else {
          countdownEl.style.display = 'none';
          countdownEl.textContent = '';
        }
      }
    } else if (card) {
      card.classList.add('is-hidden');
      card.hidden = true;
      if (bannerEl) bannerEl.style.display = 'none';
    }

    if (emailInp) {
      emailInp.disabled = !!pending;
      if (!pending) emailInp.value = user.email || '';
    }
    if (emailSaveBtn) {
      (emailSaveBtn as HTMLButtonElement).disabled = !!pending;
    }
  };

  if (emailItem && emailPanel) {
    emailPanel.style.display = 'none';
    emailItem.onclick = () => {
      toggleSecPanel(emailItem, emailPanel);
    };
  }

  emailCancelBtn?.addEventListener('click', () => {
    setSecPanelOpen(emailItem, emailPanel, false);
    if (emailInp) emailInp.value = user.email || '';
    markInvalid(emailInp, false);
    if (emailHint) {
      emailHint.style.display = 'none';
      emailHint.textContent = '';
    }
  });

  const mapEmailSetError = (code?: string): string => {
    if (code === 'bad_password' || code === 'invalid_password') return t('Неверный пароль');
    if (code === 'code_required') return t('Введите код 2FA');
    if (code === 'invalid_code') return t('Неверный 2FA код');
    if (code === 'password_required') return t('Введите текущий пароль');
    if (code === 'same_email') return t('Это текущий email. Введите другой адрес.');
    return code ? `${t('Ошибка:')} ${code}` : t('Не удалось сохранить email.');
  };

  emailSaveBtn?.addEventListener('click', async () => {
    api.clearMsg();
    if (!emailInp) return;

    const email = emailInp.value.trim();
    markInvalid(emailInp, false);
    emailPassInp?.classList.remove('input--invalid');
    emailTotpInp?.classList.remove('input--invalid');

    if (!email) {
      api.showMsg('warn', t('Введите email.'));
      markInvalid(emailInp, true);
      return;
    }

    const cur = (user.email || '').trim().toLowerCase();
    const next = email.toLowerCase();
    const requiresAuth = state.emailVerified && !!cur;

    if (cur && cur === next) {
      api.showMsg('warn', t('Это текущий email. Введите другой адрес.'));
      markInvalid(emailInp, true);
      return;
    }

    const password = emailPassInp?.value || '';
    const totpCode = emailTotpInp?.value.trim() || '';

    if (requiresAuth && !password) {
      api.showMsg('warn', t('Введите текущий пароль'));
      emailPassInp?.classList.add('input--invalid');
      return;
    }

    (emailSaveBtn as HTMLButtonElement).disabled = true;
    const oldText = emailSaveBtn.textContent;
    emailSaveBtn.textContent = t('Сохраняю…');

    try {
      const r = await apiCall('/auth/email/set', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(requiresAuth ? { password, totpCode } : {}),
        }),
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        const msg = mapEmailSetError(d?.error);
        api.showMsg('error', msg);
        markInvalid(emailInp, true);
        if (d?.error === 'bad_password' || d?.error === 'invalid_password') {
          emailPassInp?.classList.add('input--invalid');
        }
        if (d?.error === 'invalid_code' || d?.error === 'code_required') {
          emailTotpInp?.classList.add('input--invalid');
        }
      } else if (d?.pending) {
        api.showMsg(
          'ok',
          d?.cooldown
            ? t('Запрос на смену email принят. Письмо уже отправляли недавно — проверьте почту.')
            : t('Запрос на смену email принят. Подтвердите новый адрес и проверьте текущую почту.')
        );
        setSecPanelOpen(emailItem, emailPanel, false);
        await reloadMeUser();
      } else {
        api.showMsg(
          'ok',
          d?.cooldown
            ? t('Email сохранён ✅ Письмо уже отправляли недавно.')
            : t('Email сохранён ✅ Письмо отправлено.')
        );
        if (!requiresAuth) {
          user.email = email;
        }
        setSecPanelOpen(emailItem, emailPanel, false);
        await reloadMeUser();
      }
    } catch {
      api.showMsg('error', t('Ошибка сети.'));
    } finally {
      (emailSaveBtn as HTMLButtonElement).disabled = false;
      if (oldText) emailSaveBtn.textContent = oldText;
    }
  });

  const reloadMeUser = async () => {
    const meResp = await apiCall('/auth/me', { credentials: 'include' });
    const meData = await meResp.json().catch(() => ({}));
    if (meResp.ok && meData?.user) {
      Object.assign(user, {
        email: meData.user.email || user.email,
        email_verified: meData.user.emailVerified,
        email_verified_at: meData.user.emailVerifiedAt,
        pendingEmail: meData.user.pendingEmail,
        pendingEmailVerifiedAt: meData.user.pendingEmailVerifiedAt,
        pendingEmailCompletesAt: meData.user.pendingEmailCompletesAt,
      });
      state.emailVerified = isEmailVerified(user);
      onEmailVerifiedChanged?.(state.emailVerified);
      onUserUpdated?.(meData.user);
      refreshEmailSecurityUi();
      refreshSecurityIndicator();
    }
  };

  const cancelPendingEmail = async (btn: HTMLButtonElement) => {
    api.clearMsg();
    btn.disabled = true;

    try {
      const r = await apiCall('/auth/email/cancel-pending', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        api.showMsg('error', mapEmailSetError(d?.error));
        return;
      }
      api.showMsg('ok', t('Смена email отменена'));
      user.pendingEmail = null;
      user.pendingEmailVerifiedAt = null;
      user.pendingEmailCompletesAt = null;
      refreshEmailSecurityUi();
      await reloadMeUser();
    } catch {
      api.showMsg('error', t('Ошибка сети.'));
    } finally {
      btn.disabled = false;
    }
  };

  document.getElementById('accBody')?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-cancel-pending-email]');
    if (!btn) return;
    event.preventDefault();
    void cancelPendingEmail(btn);
  });

  void reloadMeUser();

  const resendBtn = document.getElementById('secEmailResendBtn') as HTMLButtonElement | null;
  resendBtn?.addEventListener('click', async () => {
    api.clearMsg();
    resendBtn.disabled = true;
    const old = resendBtn.textContent;
    resendBtn.textContent = t('Отправляю…');

    try {
      const r = await apiCall('/auth/email/resend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        api.showMsg('error', d?.error ? `${t('Ошибка:')} ${d.error}` : t('Не удалось отправить письмо.'));
      } else if (d?.alreadyVerified) {
        api.showMsg('ok', t('Email уже подтверждён ✅'));
        user.email_verified = true;
        state.emailVerified = true;
        onEmailVerifiedChanged?.(true);
        refreshEmailSecurityUi();
        refreshSecurityIndicator();
      } else if (d?.cooldown) {
        api.showMsg('warn', t('Письмо уже отправляли недавно. Подожди минутку и попробуй снова.'));
      } else {
        api.showMsg('ok', t('Письмо отправлено ✅ Проверь почту (и Спам).'));
      }
    } catch {
      api.showMsg('error', t('Ошибка сети.'));
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
    setSecPanelOpen(passItem, passPanel, true);
    api.clearMsg();
    clearPassHint();
    clearPassInvalid();
    if (passStatusEl) passStatusEl.textContent = t('Введите текущий пароль и новый пароль.');
    setTimeout(() => passCurInp?.focus(), 0);
  };

  const closePassPanel = () => {
    if (!passPanel) return;
    setSecPanelOpen(passItem, passPanel, false);
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
      setPassHint('warn', t('Введите действующий пароль.'));
      api.showMsg('warn', t('Введите действующий пароль.'), true);
      markInvalid(passCurInp, true);
      passCurInp?.focus();
      return;
    }

    const n1 = passNewInp?.value || '';
    const n2 = passNew2Inp?.value || '';

    if (!/^[\x20-\x7E]*$/.test(n1)) {
      setPassHint('warn', t('Нельзя использовать рус/укр буквы и любые не-ASCII символы.'));
      api.showMsg('warn', t('Новый пароль должен быть только латиницей (ASCII).'), true);
      markInvalid(passNewInp, true);
      passNewInp?.focus();
      return;
    }

    if (n1.length < 8) {
      setPassHint('warn', t('Новый пароль должен быть минимум 8 символов.'));
      api.showMsg('warn', t('Новый пароль должен быть минимум 8 символов.'), true);
      markInvalid(passNewInp, true);
      passNewInp?.focus();
      return;
    }

    if (n1 !== n2) {
      setPassHint('error', t('Новые пароли не совпадают.'));
      api.showMsg('error', t('Новые пароли не совпадают.'), true);
      markInvalid(passNewInp, true);
      markInvalid(passNew2Inp, true);
      passNew2Inp?.focus();
      return;
    }

    const curTrimmed = cur.trim();
    const n1Trimmed = n1.trim();
    if (cur === n1 || (curTrimmed && curTrimmed === n1Trimmed)) {
      setPassHint('warn', t('Новый пароль должен отличаться от текущего.'));
      api.showMsg('warn', t('Новый пароль должен отличаться от текущего.'), true);
      markInvalid(passNewInp, true);
      passNewInp?.focus();
      return;
    }

    (passSaveBtn as HTMLButtonElement).disabled = true;
    const oldText = passSaveBtn.textContent;
    passSaveBtn.textContent = t('Сохраняю…');

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
          setPassHint('warn', t('Новый пароль должен отличаться от текущего.'));
          api.showMsg('warn', t('Новый пароль должен отличаться от текущего.'), true);
          markInvalid(passNewInp, true);
        } else if (r.status === 401 || err.includes('invalid')) {
          setPassHint('error', t('Неверный действующий пароль.'));
          api.showMsg('error', t('Неверный действующий пароль.'), true);
          markInvalid(passCurInp, true);
        } else if (r.status === 429) {
          setPassHint('warn', t('Слишком много попыток. Подожди и попробуй снова.'));
          api.showMsg('warn', t('Слишком много попыток. Подожди и попробуй снова.'), true);
        } else {
          setPassHint('error', d?.error ? `${t('Ошибка:')} ${d.error}` : t('Не удалось изменить пароль.'));
          api.showMsg(
            'error',
            d?.error ? `${t('Ошибка:')} ${d.error}` : t('Не удалось изменить пароль.'),
            true
          );
        }
      } else {
        api.showMsg('ok', t('Пароль успешно изменён ✅'));
        setPassHint('ok', t('Пароль изменён ✅'));
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
          passSubEl.textContent = `${t('Последний раз был изменён:')} ${fmtTs(passChanged)}`;
        }
      }
    } catch {
      setPassHint('error', t('Ошибка сети.'));
      api.showMsg('error', t('Ошибка сети.'), true);
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
      toggleSecPanel(twoFAItem, twoFAPanel);
    };
  }

  // ==================== PASSKEYS ====================
  const itemPasskeys = document.getElementById('secPasskeysItem');
  const panelPasskeys = document.getElementById('secPasskeysPanel');
  const contentPasskeys = document.getElementById('secPasskeysContent');

  if (itemPasskeys && panelPasskeys) {
    panelPasskeys.style.display = 'none';
    itemPasskeys.onclick = () => {
      const opened = toggleSecPanel(itemPasskeys, panelPasskeys);
      if (opened && contentPasskeys) {
        void loadPasskeys(contentPasskeys, api);
      }
    };
  }

  // ==================== ENCRYPTION BACKUP ====================
  const itemBackup = document.getElementById('secBackupItem');
  const panelBackup = document.getElementById('secBackupPanel');

  if (itemBackup && panelBackup) {
    panelBackup.style.display = 'none';
    itemBackup.onclick = () => {
      toggleSecPanel(itemBackup, panelBackup);
    };
    bindBackupHandlers({
      userId: String(user.id),
      login: user.login || user.username || String(user.id),
      api: {
        ...api,
        fetch: (url, init) => apiCall(url, init),
      },
    });
  }

  // ==================== TRUSTED DEVICES ====================
  const itemDevices = document.getElementById('secDevicesItem');
  const panelDevices = document.getElementById('secDevicesPanel');
  const listDevices = document.getElementById('trustedDevicesList');

  if (itemDevices && panelDevices) {
    panelDevices.style.display = 'none';
    itemDevices.onclick = () => {
      const opened = toggleSecPanel(itemDevices, panelDevices);
      if (opened && listDevices) {
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
      const opened = toggleSecPanel(itemHistory, panelHistory);
      if (opened && listHistory) {
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

  openPendingSecuritySection();
}
