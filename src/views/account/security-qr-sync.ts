import { t } from '@/i18n';
import { ensureQRCodeLoaded } from '@/utils/load-qrcode';
import { restoreBackupPayload } from '@/crypto/backup/restore';
import { resetActiveSignalContext } from '@/crypto/signal/manager';
import { showAccountNoticeModal } from './modals';
import { apiCall } from '@/utils';

type QrSyncDeps = {
  userId: string;
  api: {
    showMsg: (type: string, text: string, persist?: boolean) => void;
    clearMsg: () => void;
  };
};

export function bindQrSyncHandlers(deps: QrSyncDeps): void {
  const { api } = deps;
  const startBtn = document.getElementById('secQrSyncStartBtn') as HTMLButtonElement | null;
  const container = document.getElementById('secQrSyncContainer');

  startBtn?.addEventListener('click', async () => {
    if (!container) return;

    if (startBtn) startBtn.disabled = true;
    api.clearMsg();

    try {
      await startQrSyncFlow(container, deps);
    } catch (err) {
      console.error('[QR Sync] Init failed:', err);
      api.showMsg('error', t('Не удалось инициализировать синхронизацию.'));
      if (startBtn) startBtn.disabled = false;
    }
  });
}

export async function showQrSyncModal(userId: string, api: QrSyncDeps['api']): Promise<void> {
  const old = document.getElementById('qrSyncModal');
  old?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'qrSyncModal';
  wrap.className = 'account-notice-modal';

  wrap.innerHTML = `
    <div class="account-notice-backdrop"></div>
    <div
      class="account-notice-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qrSyncModalTitle"
    >
      <div id="qrSyncModalTitle" class="account-notice-head is-success">📱 ${t('Привязать устройство')}</div>
      <div id="qrSyncModalContainer" class="sec-qr-sync-modal-body">
        <p class="sec-status">${t('Инициализация...')}</p>
      </div>
      <div class="account-notice-actions">
        <button type="button" class="btn btn-outline" id="qrSyncModalCloseBtn" aria-label="${t('Закрыть')}">${t('Закрыть')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const container = wrap.querySelector('#qrSyncModalContainer') as HTMLElement;
  const closeBtn = wrap.querySelector('#qrSyncModalCloseBtn') as HTMLButtonElement;
  const backdrop = wrap.querySelector('.account-notice-backdrop') as HTMLElement;

  let isPolling = true;
  const close = () => {
    isPolling = false;
    wrap.remove();
  };

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  try {
    await startQrSyncFlow(container, { userId, api }, () => isPolling);
  } catch (err) {
    container.innerHTML = `<p class="sec-error-text">${t('Ошибка инициализации')}</p>`;
  }
}

async function startQrSyncFlow(
  container: HTMLElement,
  deps: QrSyncDeps,
  checkActive?: () => boolean
): Promise<void> {
  // 1. Request a sync session from the relay server
  const resp = await apiCall('/crypto/sync/init', { method: 'POST' });
  if (!resp.ok) throw new Error('sync_init_failed');
  const { sessionId, secret } = await resp.json();

  if (checkActive && !checkActive()) return;

  // 2. Generate QR Data: cyblight-sync:sessionId:secret
  const qrData = `cyblight-sync:${sessionId}:${secret}`;

  // 3. Render UI
  container.innerHTML = `
    <div class="sec-qr-sync-active">
      <div class="sec-qr-wrap"><div id="sync-qrcode"></div></div>
      <p class="sec-hint sec-mt-8" style="display: block;">${t('Откройте приложение на телефоне -> Настройки -> Устройства -> Привязать устройство и отсканируйте этот код.')}</p>
      ${container.id === 'secQrSyncContainer' ? `<button class="btn btn-outline btn-full sec-mt-12" id="secQrSyncCancelBtn">${t('Отмена')}</button>` : ''}
    </div>
  `;

  await ensureQRCodeLoaded();
  const qrCtor = (window as any).QRCode;
  if (qrCtor) {
    new qrCtor(document.getElementById('sync-qrcode'), {
      text: qrData,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
    });
  }

  document.getElementById('secQrSyncCancelBtn')?.addEventListener('click', () => {
    location.reload();
  });

  // 4. Start polling for the payload
  pollForSyncPayload(sessionId, secret, deps, container, checkActive);
}

async function pollForSyncPayload(
  sessionId: string,
  secret: string,
  deps: QrSyncDeps,
  container: HTMLElement,
  checkActive?: () => boolean
) {
  const { userId, api } = deps;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes

  const poll = async () => {
    if (checkActive && !checkActive()) return;

    if (attempts >= maxAttempts) {
      api.showMsg('error', t('Время ожидания синхронизации истекло.'));
      return;
    }
    attempts++;

    try {
      const resp = await apiCall(`/crypto/sync/poll?sessionId=${sessionId}&secret=${secret}`);
      if (resp.status === 204) {
        setTimeout(poll, 5000);
        return;
      }

      if (resp.ok) {
        const { payload, deviceId } = await resp.json();
        if (container) container.innerHTML = `<p class="sec-status">${t('Данные получены, применяем…')}</p>`;

        await restoreBackupPayload(userId, payload, undefined, {
          skipDecryptCache: true,
          assignedDeviceId: deviceId
        });
        resetActiveSignalContext();

        showAccountNoticeModal('success', t('Устройство успешно привязано! Ключи шифрования синхронизированы.'));
        setTimeout(() => location.reload(), 2000);
      } else {
        throw new Error('poll_failed');
      }
    } catch (err) {
      console.error('[QR Sync] Polling error:', err);
      if (checkActive && checkActive()) {
        api.showMsg('error', t('Ошибка при получении данных.'));
      }
    }
  };

  poll();
}
