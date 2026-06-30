import { t } from '@/i18n';
import type { LoginHistoryItem, TrustedDeviceItem } from '@/types';
import { apiCall, escapeHtml } from '@/utils';
import { fmtTs } from './device-utils';

type ApiMessage = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
};

type ConfirmModalFn = (opts: {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
}) => Promise<boolean>;

export async function loadTrustedDevices(
  container: HTMLElement,
  api: ApiMessage,
  confirmModal: ConfirmModalFn
): Promise<void> {
  try {
    const r = await apiCall('/auth/trusted-devices', {
      credentials: 'include',
    });
    const d = await r.json().catch(() => ({}));

    if (!r.ok || !d.ok) {
      container.innerHTML = `<div class="sec-error-text">${t('Ошибка загрузки устройств')}</div>`;
      return;
    }

    const devices = d.devices || [];
    if (devices.length === 0) {
      container.innerHTML = `<div class="sec-empty-text">${t('Нет доверенных устройств')}</div>`;
      return;
    }

    const html = devices
      .map((device: TrustedDeviceItem) => {
        const created = fmtTs(device.createdAt);
        const lastUsed = device.lastUsedAt ? fmtTs(device.lastUsedAt) : t('Не использовалось');
        const ip = device.ipAddress || '—';
        const ua = device.userAgent || '—';

        return `
          <div class="sec-card-item">
            <div class="sec-row-between sec-row-start sec-wrap">
              <div class="sec-col-flex">
                <div class="sec-item-title">📱 ${t('Доверенное устройство')}</div>
                <div class="sec-item-subtitle">${t('Добавлено:')} ${escapeHtml(created)}</div>
                <div class="sec-item-subtitle">${t('Последний вход:')} ${escapeHtml(lastUsed)}</div>
              </div>
              <div class="sec-col-flex sec-meta-col">
                <div><b>IP:</b> ${escapeHtml(ip)}</div>
                <div class="sec-break-all"><b>${t('Устройство:')}</b> ${escapeHtml(ua)}</div>
                <button class="btn btn-outline sec-btn-compact sec-mt-8" data-remove-device="${escapeHtml(device.id)}" aria-label="${t('Удалить')}">
                  ${t('Удалить')}
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = html;

    document.querySelectorAll('[data-remove-device]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const deviceId = btn.getAttribute('data-remove-device');
        if (!deviceId) return;

        const isConfirmed = await confirmModal({
          title: t('Удаление доверенного устройства'),
          text: t('Удалить это доверенное устройство?'),
          confirmText: t('Удалить'),
          cancelText: t('Отмена'),
        });
        if (!isConfirmed) return;

        try {
          const r = await apiCall(`/auth/trusted-devices/${deviceId}`, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (r.ok) {
            api.showMsg('ok', t('Устройство удалено'));
            void loadTrustedDevices(container, api, confirmModal);
            setTimeout(api.clearMsg, 1800);
          } else {
            api.showMsg('error', t('Ошибка удаления'));
            setTimeout(api.clearMsg, 2200);
          }
        } catch {
          api.showMsg('error', t('Ошибка сети'));
          setTimeout(api.clearMsg, 2200);
        }
      });
    });
  } catch (e) {
    console.error('Error loading trusted devices:', e);
    container.innerHTML = `<div class="sec-error-text">${t('Ошибка сети')}</div>`;
  }
}

export async function loadLoginHistory(container: HTMLElement): Promise<void> {
  try {
    const r = await apiCall('/auth/login-history?limit=50', {
      credentials: 'include',
    });
    const d = await r.json().catch(() => ({}));

    if (!r.ok || !d.ok) {
      container.innerHTML = `<div class="sec-error-text">${t('Ошибка загрузки истории')}</div>`;
      return;
    }

    const history = d.history || [];
    if (history.length === 0) {
      container.innerHTML = `<div class="sec-empty-text">${t('История входов пуста')}</div>`;
      return;
    }

    const actionLabels: Record<string, string> = {
      login_success: t('✅ Успешный вход'),
      login_failed: t('❌ Неудачный вход'),
      login_2fa: t('🔐 Вход с 2FA'),
      logout: t('🚪 Выход'),
      password_changed: t('🔑 Смена пароля'),
      'auth.password.change': t('🔑 Смена пароля'),
      '2fa_enabled': t('🛡️ 2FA включена'),
      '2fa_disabled': t('🔓 2FA отключена'),
      session_revoked: t('🔌 Сессия отозвана'),
      passkey_added: t('➕ Passkey добавлен'),
      passkey_removed: t('➖ Passkey удалён'),
      passkey_login: t('🔑 Вход через passkey'),
      account_created: t('🆕 Аккаунт создан'),
      trusted_device_added: t('📱+ Устройство добавлено'),
      trusted_device_removed: t('📱- Устройство удалено'),
    };

    const html = history
      .map((item: LoginHistoryItem) => {
        const date = fmtTs(item.createdAt);
        const label = actionLabels[item.action ?? ''] || item.action;
        const ip = item.ip || '—';
        const ua = item.userAgent || '—';

        return `
          <div class="sec-card-item">
            <div class="sec-row-between sec-row-start sec-wrap">
              <div class="sec-col-flex">
                <div class="sec-item-title">${escapeHtml(String(label ?? ''))}</div>
                <div class="sec-item-subtitle">${escapeHtml(date)}</div>
              </div>
              <div class="sec-col-flex sec-meta-col">
                <div><b>IP:</b> ${escapeHtml(ip)}</div>
                <div class="sec-break-all"><b>${t('Устройство:')}</b> ${escapeHtml(ua)}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = html;
  } catch (e) {
    console.error('Error loading login history:', e);
    container.innerHTML = `<div class="sec-error-text">${t('Ошибка сети')}</div>`;
  }
}
