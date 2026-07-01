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
      // 1. Request a sync session from the relay server
      const resp = await apiCall('/crypto/sync/init', { method: 'POST' });
      if (!resp.ok) throw new Error('sync_init_failed');
      const { sessionId, secret } = await resp.json();

      // 2. Generate QR Data: cyblight-sync:sessionId:secret
      const qrData = `cyblight-sync:${sessionId}:${secret}`;

      // 3. Render UI
      container.innerHTML = `
        <div class="sec-qr-sync-active">
          <div class="sec-qr-wrap"><div id="sync-qrcode"></div></div>
          <p class="sec-hint sec-mt-8">${t('Откройте приложение на телефоне -> Настройки -> Устройства -> Привязать устройство и отсканируйте этот код.')}</p>
          <button class="btn btn-outline btn-full sec-mt-12" id="secQrSyncCancelBtn">${t('Отмена')}</button>
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
        location.reload(); // Simple reset
      });

      // 4. Start polling for the payload
      pollForSyncPayload(sessionId, secret, deps);

    } catch (err) {
      console.error('[QR Sync] Init failed:', err);
      api.showMsg('error', t('Не удалось инициализировать синхронизацию.'));
      if (startBtn) startBtn.disabled = false;
    }
  });
}

async function pollForSyncPayload(sessionId: string, secret: string, deps: QrSyncDeps) {
  const { userId, api } = deps;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes

  const poll = async () => {
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
        const { payload } = await resp.json();
        const container = document.getElementById('secQrSyncContainer');
        if (container) container.innerHTML = `<p class="sec-status">${t('Данные получены, применяем…')}</p>`;

        await restoreBackupPayload(userId, payload, undefined, { skipDecryptCache: true });
        resetActiveSignalContext();

        showAccountNoticeModal('success', t('Устройство успешно привязано! Ключи шифрования синхронизированы.'));
        setTimeout(() => location.reload(), 2000);
      } else {
        throw new Error('poll_failed');
      }
    } catch (err) {
      console.error('[QR Sync] Polling error:', err);
      api.showMsg('error', t('Ошибка при получении данных.'));
    }
  };

  poll();
}
