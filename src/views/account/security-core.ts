import { t, getLocale, localeTag } from '@/i18n';
import type { PasskeyItem, WebAuthnCredentialDescriptorInput } from '@/types';
import { showAppConfirm, showAppPrompt } from '@/ui';
import { apiCall, escapeHtml } from '@/utils';
import { ensureQRCodeLoaded } from '@/utils/load-qrcode';
import { fmtTs } from './device-utils';

type ApiMessage = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
};

type SecurityCoreDeps = {
  updateSecurityIndicator: () => void;
  setTwoFAEnabled: (value: boolean) => void;
  setPasskeyCount: (value: number) => void;
  setEmailVerified: (value: boolean) => void;
};

export function createSecurityCore(deps: SecurityCoreDeps) {
  async function loadTwoFAStatus(container: HTMLElement, api: ApiMessage): Promise<void> {
    const status2FA = document.getElementById('sec2FAStatus');
    const date2FA = document.getElementById('sec2FADate');

    const render2FAContent = (enabled: boolean, totpEnabledAt: string | number | null | undefined) => {
      if (enabled) {
        container.innerHTML = `
          <div class="sec-status">✅ ${t('Двухфакторная аутентификация активна')}</div>
          <div class="sec-note-muted sec-my-8">${t('Включена:')} ${escapeHtml(fmtTs(totpEnabledAt))}</div>
          <p class="sec-note-muted sec-my-10">
            ${t('При входе потребуется код из приложения аутентификатора.')}
          </p>
          <button class="btn btn-outline" id="disable2FABtn" type="button" aria-label="${t('Отключить 2FA')}">${t('Отключить 2FA')}</button>
        `;

        const disableBtn = document.getElementById('disable2FABtn') as HTMLButtonElement | null;
        disableBtn?.addEventListener('click', async () => {
          container.innerHTML = `
            <div class="sec-status">${t('Отключение 2FA')}</div>
            <p class="sec-note-muted sec-my-10">${t('Для отключения введи пароль и текущий 2FA код.')}</p>
            <div class="sec-form-row">
              <label class="label">${t('Пароль')}</label>
              <input class="input" id="disable2FAPass" type="password" autocomplete="current-password" />
            </div>
            <div class="sec-form-row sec-mt-10">
              <label class="label">${t('2FA код')}</label>
              <input class="input sec-otp-input" id="disable2FACode" type="text" inputmode="numeric" placeholder="000000" maxlength="6" />
            </div>
            <div class="sec-actions sec-mt-12">
              <button class="btn btn-outline" id="cancelDisable2FABtn" type="button" aria-label="${t('Отменить')}">${t('Отменить')}</button>
              <button class="btn btn-danger" id="confirmDisable2FABtn" type="button" aria-label="${t('Отключить 2FA')}">${t('Отключить 2FA')}</button>
            </div>
            <div class="sec-hint is-hidden" id="hintDisable2FA"></div>
          `;

          const cancelBtn = document.getElementById(
            'cancelDisable2FABtn'
          ) as HTMLButtonElement | null;
          const confirmBtn = document.getElementById(
            'confirmDisable2FABtn'
          ) as HTMLButtonElement | null;
          const hint = document.getElementById('hintDisable2FA') as HTMLElement | null;

          cancelBtn?.addEventListener('click', () => render2FAContent(true, totpEnabledAt));
          confirmBtn?.addEventListener('click', async () => {
            const passInput = document.getElementById('disable2FAPass') as HTMLInputElement | null;
            const codeInput = document.getElementById('disable2FACode') as HTMLInputElement | null;
            passInput?.classList.remove('input--invalid');
            codeInput?.classList.remove('input--invalid');

            const password = passInput?.value.trim();
            const code = codeInput?.value.trim();

            if (!password || !code || code.length !== 6) {
              if (hint) {
                hint.style.display = '';
                hint.className = 'sec-hint sec-hint--warn';
                hint.textContent = t('Введи пароль и 6-значный код');
              }
              if (!password) passInput?.classList.add('input--invalid');
              if (!code || code.length !== 6) codeInput?.classList.add('input--invalid');
              return;
            }

            if (!confirmBtn) return;
            confirmBtn.disabled = true;
            const oldText = confirmBtn.textContent;
            confirmBtn.textContent = t('Отключаю...');

            try {
              const r = await apiCall('/auth/2fa/disable', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, code }),
              });
              const d = await r.json().catch(() => ({}));

              if (!r.ok) {
                if (hint) {
                  hint.style.display = '';
                  hint.className = 'sec-hint sec-hint--error';
                  hint.textContent =
                    d.error === 'invalid_password'
                      ? t('Неверный пароль')
                      : d.error === 'invalid_code'
                        ? t('Неверный 2FA код')
                        : `${t('Ошибка:')} ${d.error || 'unknown'}`;
                }
                if (d.error === 'invalid_password') passInput?.classList.add('input--invalid');
                if (d.error === 'invalid_code') codeInput?.classList.add('input--invalid');
                return;
              }

              deps.setTwoFAEnabled(false);
              api.showMsg('ok', t('2FA отключена'));
              await loadTwoFAStatus(container, api);
            } catch {
              if (hint) {
                hint.style.display = '';
                hint.className = 'sec-hint sec-hint--error';
                hint.textContent = t('Ошибка сети');
              }
            } finally {
              confirmBtn.disabled = false;
              if (oldText) confirmBtn.textContent = oldText;
            }
          });
        });
        return;
      }

      container.innerHTML = `
        <div class="sec-status">${t('Двухфакторная аутентификация не активна')}</div>
        <p class="sec-note-muted sec-my-10">
          ${t('Добавь дополнительный уровень защиты для своего аккаунта.')}
        </p>
        <button class="btn btn-primary" id="enable2FABtn" type="button" aria-label="${t('Включить 2FA')}">${t('Включить 2FA')}</button>
      `;

      const enableBtn = document.getElementById('enable2FABtn') as HTMLButtonElement | null;
      enableBtn?.addEventListener('click', async () => {
        api.clearMsg();
        container.innerHTML = `<div class="sec-loading">${t('Загрузка...')}</div>`;

        try {
          const setupResp = await apiCall('/auth/2fa/setup', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          const setupDataRaw = await setupResp.json().catch(() => ({}));

          if (!setupResp.ok) {
            container.innerHTML = `<div class="sec-status">${t('Ошибка:')} ${setupDataRaw.error || t('Неизвестная ошибка')}</div>`;
            return;
          }

          const setupData = setupDataRaw.data || setupDataRaw;
          const qrData = setupData.uri || setupData.qrData;
          const secretKey = setupData.secret || t('Не получен');

          container.innerHTML = `
            <div class="sec-status">${t('Шаг 1: Отсканируй QR-код')}</div>
            <p class="sec-note-muted sec-my-10 sec-text-center">${t('Используй приложение Proton , Google , Microsoft Authenticator или Authy.')}</p>
            <div class="sec-text-center sec-my-20">
              <div class="sec-qr-wrap"><div id="qrcode"></div></div>
            </div>
            <div class="sec-my-20 sec-text-center">
              <p class="sec-note-muted sec-note-small sec-mb-8">${t('Секретный ключ:')}</p>
              <div class="sec-secret-wrap">
                <code id="secretKeyCode" class="sec-secret-code">${escapeHtml(secretKey)}</code>
              </div>
              <div class="sec-mt-8"><button class="btn btn-outline sec-btn-compact" id="copySecretBtn" type="button" aria-label="${t('📋 Скопировать ключ')}">${t('📋 Скопировать ключ')}</button></div>
            </div>
            <div class="sec-form-row sec-mt-16">
              <label class="label">${t('Шаг 2: Введи код из приложения')}</label>
              <input class="input sec-otp-input" id="confirm2FACode" type="text" inputmode="numeric" placeholder="000000" maxlength="6" />
            </div>
            <div class="sec-actions sec-mt-12">
              <button class="btn btn-outline" id="cancel2FABtn" type="button" aria-label="${t('Отменить')}">${t('Отменить')}</button>
              <button class="btn btn-primary" id="confirm2FABtn" type="button" aria-label="${t('Подтвердить')}">${t('Подтвердить')}</button>
            </div>
            <div class="sec-hint is-hidden" id="hint2FA"></div>
          `;

          const qrEl = document.getElementById('qrcode');
          try {
            await ensureQRCodeLoaded();
            const qrCtor = window.QRCode;
            if (qrCtor && qrData && qrEl) {
              new qrCtor(qrEl, { text: qrData, width: 200, height: 200 });
            } else if (qrEl) {
              throw new Error('QRCode unavailable');
            }
          } catch {
            if (qrEl) {
              qrEl.innerHTML =
                `<p class="sec-fallback-note">${t('QR библиотека не загружена. Используй секретный ключ.')}</p>`;
            }
          }

          const copySecret = async () => {
            try {
              await navigator.clipboard.writeText(secretKey);
              api.showMsg('ok', t('Ключ скопирован ✅'));
            } catch {
              api.showMsg('warn', t('Не удалось скопировать. Выдели текст вручную.'));
            }
          };
          document.getElementById('copySecretBtn')?.addEventListener('click', copySecret);
          document.getElementById('secretKeyCode')?.addEventListener('click', copySecret);

          document.getElementById('cancel2FABtn')?.addEventListener('click', async () => {
            await loadTwoFAStatus(container, api);
          });

          const confirmBtn = document.getElementById('confirm2FABtn') as HTMLButtonElement | null;
          const hint = document.getElementById('hint2FA') as HTMLElement | null;
          confirmBtn?.addEventListener('click', async () => {
            const codeInput = document.getElementById('confirm2FACode') as HTMLInputElement | null;
            codeInput?.classList.remove('input--invalid');
            const code = codeInput?.value.trim();
            if (!code || code.length !== 6) {
              if (hint) {
                hint.style.display = '';
                hint.className = 'sec-hint sec-hint--warn';
                hint.textContent = t('Введи 6-значный код');
              }
              codeInput?.classList.add('input--invalid');
              return;
            }

            if (!confirmBtn) return;
            confirmBtn.disabled = true;
            const oldText = confirmBtn.textContent;
            confirmBtn.textContent = t('Проверяю...');

            try {
              const enableResp = await apiCall('/auth/2fa/enable', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
              });
              const enableDataRaw = await enableResp.json().catch(() => ({}));

              if (!enableResp.ok) {
                if (hint) {
                  hint.style.display = '';
                  hint.className = 'sec-hint sec-hint--error';
                  hint.textContent =
                    enableDataRaw.error === 'invalid_code'
                      ? t('Неверный код')
                      : `${t('Ошибка:')} ${enableDataRaw.error || 'unknown'}`;
                }
                codeInput?.classList.add('input--invalid');
                return;
              }

              const enableData = enableDataRaw.data || enableDataRaw;
              const backupCodes = Array.isArray(enableData.backupCodes)
                ? enableData.backupCodes
                : [];

              container.innerHTML = `
                <div class="sec-status">✅ ${t('2FA успешно активирована!')}</div>
                <p class="sec-note-muted sec-my-10 sec-text-center">
                  ${t('Сохрани эти резервные коды в безопасном месте. Каждый можно использовать только один раз.')}
                </p>
                <div class="sec-codes-wrap sec-my-16">
                  <div id="backupCodesGrid" class="sec-codes-grid">
                    ${backupCodes.map((backupCode: string) => `<div class="sec-codes-item">${escapeHtml(backupCode)}</div>`).join('')}
                  </div>
                </div>
                <div class="sec-inline-actions sec-mb-12">
                  <button class="btn btn-outline sec-flex-1" id="copyCodesBtn" type="button" aria-label="${t('📋 Копировать все коды')}">${t('📋 Копировать все коды')}</button>
                  <button class="btn btn-outline sec-flex-1" id="downloadCodesBtn" type="button" aria-label="${t('💾 Скачать')}">${t('💾 Скачать')}</button>
                </div>
                <button class="btn btn-primary" id="done2FABtn" type="button" aria-label="${t('Готово')}">${t('Готово')}</button>
              `;

              document.getElementById('copyCodesBtn')?.addEventListener('click', async () => {
                try {
                  await navigator.clipboard.writeText(backupCodes.join('\n'));
                  api.showMsg('ok', t('Коды скопированы ✅'));
                } catch {
                  api.showMsg('warn', t('Не удалось скопировать. Выдели коды вручную.'));
                }
              });

              document.getElementById('downloadCodesBtn')?.addEventListener('click', () => {
                const login =
                  (document.getElementById('accLogin')?.textContent || '').trim() || 'user';
                const date = new Date().toISOString().split('T')[0];
                const filename = `CybLight_2FA_BackupCodes_${login}_${date}.txt`;

                const content = `${t('CybLight - Резервные коды двухфакторной аутентификации')}\n${t('Пользователь:')} ${login}\n${t('Дата создания:')} ${new Date().toLocaleString(localeTag(getLocale()))}\n\n${t('ВАЖНО: Храните эти коды в безопасном месте!')}\n${t('Каждый код можно использовать только один раз для входа без доступа к приложению аутентификации.')}\n\n${t('Резервные коды:')}\n${backupCodes.map((backupCode: string, index: number) => `${index + 1}. ${backupCode}`).join('\n')}\n\n---\n© ${new Date().getFullYear()} CybLight\n`;

                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              });

              document.getElementById('done2FABtn')?.addEventListener('click', async () => {
                deps.setTwoFAEnabled(true);
                api.showMsg('ok', t('2FA включена ✅'));
                await loadTwoFAStatus(container, api);
              });
            } catch {
              if (hint) {
                hint.style.display = '';
                hint.className = 'sec-hint sec-hint--error';
                hint.textContent = t('Ошибка сети');
              }
            } finally {
              confirmBtn.disabled = false;
              if (oldText) confirmBtn.textContent = oldText;
            }
          });
        } catch {
          container.innerHTML = `<div class="sec-status">${t('Ошибка сети')}</div>`;
        }
      });
    };

    try {
      const r = await apiCall('/auth/me', { credentials: 'include' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.user) {
        if (status2FA) status2FA.textContent = t('Ошибка загрузки');
        container.innerHTML = `<div class="sec-error-text">${t('Ошибка загрузки')}</div>`;
        return;
      }

      const enabled = Boolean(data.user.totpEnabled || data.user.totp_enabled);
      const totpEnabledAt = data.user.totp_enabled_at || data.user.totpEnabledAt || null;
      deps.setTwoFAEnabled(enabled);
      deps.setEmailVerified(
        Boolean(
          data.user.emailVerified ||
          data.user.email_verified ||
          data.user.email_verified_at ||
          data.user.emailVerifiedAt
        )
      );

      if (status2FA) status2FA.textContent = enabled ? t('✅ Включена') : t('Отключена');
      if (date2FA) {
        if (enabled && totpEnabledAt) {
          date2FA.textContent = `${fmtTs(totpEnabledAt)}`;
          date2FA.classList.remove('is-hidden');
        } else {
          date2FA.classList.add('is-hidden');
        }
      }

      render2FAContent(enabled, totpEnabledAt);
      deps.updateSecurityIndicator();
    } catch {
      if (status2FA) status2FA.textContent = t('Ошибка загрузки');
      container.innerHTML = `<div class="sec-error-text">${t('Ошибка сети')}</div>`;
    }
  }

  async function loadPasskeys(container: HTMLElement, api: ApiMessage): Promise<void> {
    container.innerHTML = `<div class="sec-loading">${t('Загрузка...')}</div>`;

    try {
      const r = await apiCall('/auth/passkey/list', { credentials: 'include' });
      const d = await r.json().catch(() => ({}));

      if (r.ok && d.ok) {
        const passkeys = d.passkeys || [];
        const count = passkeys.length;

        deps.setPasskeyCount(count);

        console.log('loadPasskeys: passkeys count =', count);

        const statusPasskeys = document.getElementById('secPasskeysStatus');
        if (statusPasskeys) {
          statusPasskeys.textContent =
            count > 0 ? t('Зарегистрировано ключей: {count}', { count }) : t('Ключи не добавлены');
        }

        if (passkeys.length === 0) {
          container.innerHTML = `
            <div class="sec-status">${t('Ключи доступа не добавлены')}</div>
            <p class="sec-note-muted sec-my-10">
              ${t('Ключи доступа (passkeys) позволяют входить в аккаунт без пароля, используя биометрию или PIN-код устройства.')}
            </p>
            <button class="btn btn-primary sec-mt-12" id="addPasskeyBtn" type="button" aria-label="${t('➕ Добавить ключ доступа')}">
              ${t('➕ Добавить ключ доступа')}
            </button>
          `;
        } else {
          const listHtml = passkeys
            .map(
              (pk: PasskeyItem) => `
            <div class="passkey-item sec-card-item">
              <div class="sec-row-between sec-row-center">
                <div>
                  <div class="sec-item-title">${escapeHtml(pk.name)}</div>
                  <div class="sec-item-subtitle">
                    ${t('Создан:')} ${escapeHtml(fmtTs(pk.createdAt))}
                    ${pk.lastUsedAt ? ` • ${t('Использован:')} ${escapeHtml(fmtTs(pk.lastUsedAt))}` : ''}
                  </div>
                </div>
                <button class="btn btn-outline sec-btn-compact" data-delete-passkey="${escapeHtml(pk.id)}" type="button" aria-label="${t('Удалить')}">
                  ${t('Удалить')}
                </button>
              </div>
            </div>
          `
            )
            .join('');

          container.innerHTML = `
            <div class="sec-status">${t('Ваши ключи доступа')}</div>
            <div class="sec-my-12">
              ${listHtml}
            </div>
            <button class="btn btn-primary" id="addPasskeyBtn" type="button" aria-label="${t('➕ Добавить ключ доступа')}">
              ${t('➕ Добавить ключ доступа')}
            </button>
          `;

          document.querySelectorAll('[data-delete-passkey]').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const passkeyId = btn.getAttribute('data-delete-passkey');
              if (
                !passkeyId ||
                !(await showAppConfirm(t('Удалить этот ключ доступа?'), {
                  tone: 'warn',
                  destructive: true,
                  confirmLabel: t('Удалить'),
                }))
              ) {
                return;
              }

              try {
                const r = await apiCall(`/auth/passkey/${passkeyId}`, {
                  method: 'DELETE',
                  credentials: 'include',
                });

                if (r.ok) {
                  api.showMsg('ok', t('Ключ доступа удалён'));
                  void loadPasskeys(container, api);
                } else {
                  api.showMsg('error', t('Ошибка удаления ключа'));
                }
              } catch {
                api.showMsg('error', t('Ошибка сети'));
              }
            });
          });
        }

        const fromBase64Url = (input: string): ArrayBuffer => {
          const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
          const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
          const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        };

        const toBase64Url = (buffer: ArrayBuffer): string => {
          return btoa(String.fromCharCode(...new Uint8Array(buffer)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        };

        const registerPasskey = async () => {
          try {
            if (!window.PublicKeyCredential) {
              api.showMsg('error', t('Ваш браузер не поддерживает ключи доступа'));
              return;
            }

            const r1 = await apiCall('/auth/passkey/register/options', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            });
            const d1 = await r1.json().catch(() => ({}));
            if (!r1.ok || !d1.ok) {
              api.showMsg('error', t('Ошибка получения параметров регистрации'));
              return;
            }

            const options = d1.options;
            const publicKey: PublicKeyCredentialCreationOptions = {
              challenge: fromBase64Url(options.challenge),
              rp: options.rp,
              user: {
                id: fromBase64Url(options.user.id),
                name: options.user.name,
                displayName: options.user.displayName,
              },
              pubKeyCredParams: options.pubKeyCredParams,
              timeout: options.timeout,
              excludeCredentials: (options.excludeCredentials || []).map(
                (c: WebAuthnCredentialDescriptorInput) => ({
                  ...c,
                  id: fromBase64Url(c.id),
                })
              ),
              authenticatorSelection: options.authenticatorSelection,
              attestation: options.attestation,
            };

            const credential = (await navigator.credentials.create({
              publicKey,
            })) as PublicKeyCredential | null;

            if (!credential) {
              api.showMsg('warn', t('Регистрация ключа отменена'));
              return;
            }

            const responseAny = credential.response as AuthenticatorAttestationResponse;
            const credentialData = {
              id: credential.id,
              rawId: toBase64Url(credential.rawId),
              response: {
                clientDataJSON: toBase64Url(responseAny.clientDataJSON),
                attestationObject: toBase64Url(responseAny.attestationObject),
              },
              type: credential.type,
              transports: responseAny.getTransports?.() || [],
            };

            const name = await showAppPrompt(t('Введите название для этого ключа доступа:'), t('Мой ключ'), {
              title: t('Ключ доступа'),
            });
            if (name === null) {
              api.showMsg('warn', t('Регистрация ключа отменена'));
              return;
            }
            const r2 = await apiCall('/auth/passkey/register', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                credential: credentialData,
                name: name || t('Ключ доступа'),
              }),
            });
            const d2 = await r2.json().catch(() => ({}));

            if (r2.ok && d2.ok) {
              api.showMsg('ok', t('Ключ доступа успешно добавлен! ✅'));
              await loadPasskeys(container, api);
            } else {
              api.showMsg('error', `${t('Ошибка сохранения ключа:')} ${d2.error || 'unknown'}`);
            }
          } catch (err) {
            const error = err as Error;
            if (error?.name === 'NotAllowedError')
              api.showMsg('warn', t('Регистрация ключа отменена'));
            else api.showMsg('error', `${t('Ошибка:')} ${error?.message || 'unknown'}`);
          }
        };

        document.getElementById('addPasskeyBtn')?.addEventListener('click', registerPasskey);
      } else {
        container.innerHTML = `<div class="sec-error-text">${t('Ошибка загрузки')}</div>`;
      }
    } catch {
      container.innerHTML = `<div class="sec-error-text">${t('Ошибка сети')}</div>`;
    }
  }

  return {
    loadTwoFAStatus,
    loadPasskeys,
  };
}
