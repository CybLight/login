import { t } from '@/i18n';
import { escapeHtml, apiCall } from '@/utils';
import { sendEasterLog } from '@/utils/easter-logger';
import { backupErrorMessage, hasLocalBackupKeys } from '@/crypto/backup';
import {
  fetchDriveBackupMetadata,
  hasGoogleDriveSession,
  isGoogleDriveConfigured,
  restoreBackupFromGoogleDrive,
} from '@/integrations/google-drive';
import { resetActiveSignalContext } from '@/crypto/signal/manager';
import { initPasswordEyes } from '@/components/password/password-helpers';
import { showAccountNoticeModal } from './modals';
import { showQrSyncModal } from './security-qr-sync';
import type { ConversationPreviewEntry } from './unread';

const PROMPT_DISMISSED_KEY = 'cyb_drive_restore_prompt_dismissed';

let promptInFlight = false;

export type DriveRestorePromptOptions = {
  conversationPreviews?: Record<string, ConversationPreviewEntry>;
  onRestored?: () => void | Promise<void>;
  api?: {
    showMsg: (type: string, text: string, persist?: boolean) => void;
    clearMsg: () => void;
  };
};

type DriveRestoreProgressModal = {
  update: (label: string, percent: number) => void;
  close: () => void;
};

function showDriveRestoreProgressModal(): DriveRestoreProgressModal {
  const wrap = document.createElement('div');
  wrap.className = 'account-notice-modal';
  wrap.innerHTML = `
    <div class="account-notice-backdrop"></div>
    <div class="account-notice-card" role="dialog" aria-modal="true" aria-busy="true">
      <div class="account-notice-head">${escapeHtml(t('Восстановление из Google Drive'))}</div>
      <div class="sec-backup-progress sec-backup-progress--drive" aria-live="polite">
        <div class="sec-backup-progress__head">
          <span class="sec-backup-progress__label" id="driveRestorePromptProgressLabel">${escapeHtml(t('Подготовка…'))}</span>
          <span class="sec-backup-progress__percent" id="driveRestorePromptProgressPercent">0%</span>
        </div>
        <div class="sec-backup-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="driveRestorePromptProgressTrack">
          <div class="sec-backup-progress__bar" id="driveRestorePromptProgressBar" style="width: 0%"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const labelEl = wrap.querySelector('#driveRestorePromptProgressLabel') as HTMLElement;
  const percentEl = wrap.querySelector('#driveRestorePromptProgressPercent') as HTMLElement;
  const track = wrap.querySelector('#driveRestorePromptProgressTrack') as HTMLElement;
  const bar = wrap.querySelector('#driveRestorePromptProgressBar') as HTMLElement;

  return {
    update(label: string, percent: number) {
      const value = Math.min(100, Math.max(0, Math.round(percent)));
      labelEl.textContent = label;
      bar.style.width = `${value}%`;
      percentEl.textContent = `${value}%`;
      track.setAttribute('aria-valuenow', String(value));
    },
    close() {
      wrap.remove();
    },
  };
}

function showBackupPasswordModal(title: string, hint: string): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'account-notice-modal';
    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" role="dialog" aria-modal="true">
        <div class="account-notice-head">${escapeHtml(title)}</div>
        <p class="account-notice-text">${escapeHtml(hint)}</p>
        <div class="pass-wrap">
          <input class="input" id="driveRestorePasswordInput" type="password" autocomplete="current-password" />
          <button type="button" class="pass-eye" data-target="driveRestorePasswordInput" aria-label="${escapeHtml(t('Показать пароль'))}"></button>
        </div>
        <div class="account-notice-actions">
          <button type="button" class="btn btn-outline" id="driveRestoreCancelBtn">${escapeHtml(t('Отмена'))}</button>
          <button type="button" class="btn btn-primary" id="driveRestoreOkBtn">${escapeHtml(t('Восстановить'))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    initPasswordEyes(wrap);

    const input = wrap.querySelector('#driveRestorePasswordInput') as HTMLInputElement;
    const close = (value: string | null) => {
      wrap.remove();
      resolve(value);
    };

    wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', () => close(null));
    wrap.querySelector('#driveRestoreCancelBtn')?.addEventListener('click', () => close(null));
    wrap.querySelector('#driveRestoreOkBtn')?.addEventListener('click', () => {
      close(input?.value?.trim() || null);
    });
    input?.focus();
  });
}

function isRestorePromptDismissed(): boolean {
  try {
    return sessionStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissRestorePrompt(): void {
  try {
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
}

function showRestoreChoiceModal(): Promise<'drive' | 'qr' | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'account-notice-modal';
    wrap.innerHTML = `
      <div class="account-notice-backdrop"></div>
      <div class="account-notice-card" role="dialog" aria-modal="true" style="max-width: 500px;">
        <div class="account-notice-head">🔑 ${escapeHtml(t('Настройка шифрования'))}</div>
        <p class="account-notice-text" style="margin-bottom: 20px; line-height: 1.5; color: var(--color-text-secondary, #ccc);">
          ${escapeHtml(t('Ключи шифрования не найдены в этом браузере. Выберите способ восстановления доступа к вашим чатам:'))}
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; width: 100%;">
          <button type="button" class="btn btn-outline" id="restoreChoiceQrBtn" style="justify-content: flex-start; padding: 16px; text-align: left; height: auto; width: 100%; border-radius: 8px; cursor: pointer; display: flex; align-items: center; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); background: transparent;">
            <div style="font-size: 24px; margin-right: 16px;">📱</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px; color: var(--color-text-primary, #fff);">${escapeHtml(t('Связать с мобильным приложением'))}</div>
              <div style="font-size: 13px; opacity: 0.7; color: var(--color-text-secondary, #ccc); line-height: 1.4;">
                ${t('Отсканируйте QR-код через {appLink} для мгновенного переноса чатов и ключей.', {
      appLink: `<a href="https://cyblight.org/ru/downloads/" target="_blank" rel="noopener noreferrer" style="color: #6c5ce7; text-decoration: underline; font-weight: bold; cursor: pointer;">${t('мобильное приложение')}</a>`
    })}
              </div>
            </div>
          </button>

          <button type="button" class="btn btn-outline" id="restoreChoiceDriveBtn" style="justify-content: flex-start; padding: 16px; text-align: left; height: auto; width: 100%; border-radius: 8px; cursor: pointer; display: flex; align-items: center; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); background: transparent;">
            <div style="font-size: 24px; margin-right: 16px;">☁️</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px; color: var(--color-text-primary, #fff);">${escapeHtml(t('Восстановить из Google Drive'))}</div>
              <div style="font-size: 13px; opacity: 0.7; color: var(--color-text-secondary, #ccc); line-height: 1.4;">
                ${escapeHtml(t('Используйте зашифрованную резервную копию, сохраненную в вашем облаке.'))}
              </div>
            </div>
          </button>
        </div>

        <div class="account-notice-actions" style="justify-content: flex-end;">
          <button type="button" class="btn btn-outline" id="restoreChoiceCancelBtn">${escapeHtml(t('Пропустить'))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const close = (value: 'drive' | 'qr' | null) => {
      window.removeEventListener('keydown', onKeyDown);
      wrap.remove();
      resolve(value);
    };

    let hoverCount = 0;
    const cancelBtn = wrap.querySelector('#restoreChoiceCancelBtn') as HTMLElement;

    // Detect mobile or touch device to disable the runaway easter egg there
    const isMobile = window.matchMedia('(max-width: 768px)').matches || ('ontouchstart' in window);

    if (!isMobile) {
      const triggerRunaway = (e: Event) => {
        if (hoverCount < 7) {
          hoverCount++;
          const x = (Math.random() - 0.5) * 320;
          const y = (Math.random() - 0.5) * 160;
          cancelBtn.style.transform = `translate(${x}px, ${y}px)`;
          e.preventDefault();
          e.stopPropagation();
        } else {
          crumbleButton(cancelBtn, () => close(null));
        }
      };

      cancelBtn?.addEventListener('mouseenter', triggerRunaway);

      cancelBtn?.addEventListener('click', (e) => {
        if (hoverCount < 7) {
          e.preventDefault();
          e.stopPropagation();

          // Unlock on server
          apiCall('/auth/easter/skip-catcher', { method: 'POST', credentials: 'include' }).catch(() => { });
          // Save in local storage
          localStorage.setItem('cyb_skip_catcher_unlocked', '1');

          // Fetch username & log to CybLight Logger
          apiCall('/auth/me')
            .then(async (res) => {
              const data = await res.json() as { user?: { login?: string } };
              const userName = data?.user?.login || 'unknown';
              sendEasterLog({
                type: 'skip_catcher',
                userName,
                alex: 13,
              });
            })
            .catch(() => {
              sendEasterLog({
                type: 'skip_catcher',
                userName: 'unknown',
                alex: 13,
              });
            });

          showCongratsModal(() => close(null));
        } else {
          crumbleButton(cancelBtn, () => close(null));
        }
      });
    } else {
      // On mobile, just close the modal normally without runaway or unlocking the easter egg
      cancelBtn?.addEventListener('click', () => close(null));
    }

    wrap.querySelector('#restoreChoiceQrBtn')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'A') return;
      close('qr');
    });
    wrap.querySelector('#restoreChoiceDriveBtn')?.addEventListener('click', () => close('drive'));
  });
}

function showCongratsModal(onClose: () => void) {
  const wrap = document.createElement('div');
  wrap.className = 'account-notice-modal congrats-modal';
  wrap.style.zIndex = '100000';

  const text1 = t('Ого! Вы смогли нажать на эту кнопку! Ваша реакция и скорость клика просто невероятны! 🚀');
  const text2_1 = t('Либо... Либо... Ты просто нажал кнопку TAB — ну и сообразительный однако! Возьмёшь меня в ученики?');
  const text2_2 = t('Или... Или... Ты научился пользоваться консолью разработчика?');

  wrap.innerHTML = `
    <div class="account-notice-backdrop" style="background: rgba(0,0,0,0.4);"></div>
    <div class="account-notice-card" role="dialog" aria-modal="true" style="width: min(92vw, 480px) !important; border: 2px solid #ffd700; box-shadow: 0 0 25px rgba(255, 215, 0, 0.5); text-align: center; background: #18191a; border-radius: 16px; padding: 28px;">
      <div class="account-notice-head" style="color: #ffd700; font-size: 26px; font-weight: 800; margin-bottom: 18px;">🎉 ${escapeHtml(t('Победа!'))}</div>
      <p id="congratsText1" style="color: #e4e6eb; font-size: 15.5px; line-height: 1.6; margin-bottom: 16px; min-height: 48px; text-align: center;"></p>
      <div style="color: #a29bfe; font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: center; font-style: italic; font-weight: 500;">
        <div id="congratsText2_1" style="margin-bottom: 10px; min-height: 22px;"></div>
        <div id="congratsText2_2" style="min-height: 22px; color: #81ecec;"></div>
      </div>
      <button type="button" class="btn btn-primary" id="congratsCloseBtn" style="background: #ffd700; color: #000; font-weight: bold; border: none; padding: 10px 28px; border-radius: 8px; box-shadow: 0 0 10px rgba(255, 215, 0, 0.4); margin: 0 auto; display: none; cursor: pointer; transition: transform 0.2s ease;">
        ${escapeHtml(t('Круто!'))}
      </button>
    </div>
  `;
  document.body.appendChild(wrap);

  const closeCongrats = () => {
    wrap.remove();
    onClose();
  };

  wrap.querySelector('#congratsCloseBtn')?.addEventListener('click', closeCongrats);
  wrap.querySelector('.account-notice-backdrop')?.addEventListener('click', closeCongrats);

  const el1 = wrap.querySelector('#congratsText1') as HTMLElement;
  const el2_1 = wrap.querySelector('#congratsText2_1') as HTMLElement;
  const el2_2 = wrap.querySelector('#congratsText2_2') as HTMLElement;
  const closeBtn = wrap.querySelector('#congratsCloseBtn') as HTMLElement;

  typeText(el1, text1, 30, () => {
    setTimeout(() => {
      typeText(el2_1, text2_1, 50, () => {
        setTimeout(() => {
          typeText(el2_2, text2_2, 60, () => {
            closeBtn.style.display = 'block';
          });
        }, 1500); // 1.5 second pause before "Или... Или..."
      });
    }, 1500); // 1.5 second pause before the first "Либо... Либо..."
  });
}

function typeText(element: HTMLElement, text: string, speedMs: number, onComplete?: () => void) {
  const chars = Array.from(text);
  let index = 0;
  element.textContent = '';

  const type = () => {
    if (index < chars.length) {
      element.textContent += chars[index];
      index++;
      setTimeout(type, speedMs);
    } else if (onComplete) {
      onComplete();
    }
  };

  type();
}

function crumbleButton(btn: HTMLElement, onClose: () => void) {
  const rect = btn.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const top = rect.top + window.scrollY;
  const left = rect.left + window.scrollX;

  btn.style.visibility = 'hidden';
  btn.style.pointerEvents = 'none';

  const particleCount = 40;
  const particles: HTMLElement[] = [];

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.left = `${left + (Math.random() * width)}px`;
    p.style.top = `${top + (Math.random() * height)}px`;
    p.style.width = `${3 + Math.random() * 4}px`;
    p.style.height = `${3 + Math.random() * 4}px`;
    p.style.backgroundColor = '#ff4757';
    p.style.borderRadius = '50%';
    p.style.pointerEvents = 'none';
    p.style.zIndex = '99999';
    p.style.boxShadow = '0 0 6px #ff4757';

    const vx = (Math.random() - 0.5) * 12;
    const vy = (Math.random() - 0.7) * 14; // pop up

    document.body.appendChild(p);
    particles.push(p);

    let posX = parseFloat(p.style.left);
    let posY = parseFloat(p.style.top);
    let velY = vy;
    let velX = vx;
    const gravity = 0.45;
    const footerY = window.innerHeight + window.scrollY - 30;

    const animate = () => {
      velY += gravity;
      posX += velX;
      posY += velY;

      p.style.left = `${posX}px`;
      p.style.top = `${posY}px`;

      const progress = (posY - top) / (footerY - top);
      p.style.opacity = String(Math.max(0, 1 - progress));

      if (posY < footerY && posX > 0 && posX < window.innerWidth + window.scrollX) {
        requestAnimationFrame(animate);
      } else {
        p.remove();
      }
    };

    requestAnimationFrame(animate);
  }

  setTimeout(onClose, 1500);
}

export function hasEncryptedConversationMessages(
  previews: Record<string, ConversationPreviewEntry>,
): boolean {
  return Object.values(previews).some(
    (entry) =>
      entry.lastMessage?.encryption === 'signal_v1' ||
      entry.lastMessage?.encryption === 'signal_v2',
  );
}

export async function promptGoogleDriveRestoreIfNeeded(
  userId: string,
  options: DriveRestorePromptOptions = {},
): Promise<void> {
  if (promptInFlight) return;
  if (!isGoogleDriveConfigured() || isRestorePromptDismissed()) return;

  const hasLocal = await hasLocalBackupKeys(userId);
  if (hasLocal) return;

  const previews = options.conversationPreviews;
  if (previews && !hasEncryptedConversationMessages(previews)) return;

  promptInFlight = true;
  try {
    const choice = await showRestoreChoiceModal();

    if (choice === 'qr') {
      dismissRestorePrompt();
      promptInFlight = false;
      if (options.api) {
        void showQrSyncModal(userId, options.api);
      }
      return;
    }

    if (choice !== 'drive') {
      dismissRestorePrompt();
      promptInFlight = false;
      return;
    }

    let metadata = null;
    if (hasGoogleDriveSession()) {
      try {
        metadata = await fetchDriveBackupMetadata(userId, { interactive: false });
      } catch {
        metadata = null;
      }
    }

    if (!metadata) {
      try {
        metadata = await fetchDriveBackupMetadata(userId, { interactive: true });
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'google_drive_auth_denied' || code === 'google_drive_auth_failed') {
          showAccountNoticeModal('warn', t('Отменено восстановление резервной копии.'));
        }
        dismissRestorePrompt();
        return;
      }
    }

    if (!metadata) {
      showAccountNoticeModal('warn', t('В Google Drive нет резервной копии для этого аккаунта.'));
      dismissRestorePrompt();
      return;
    }

    const password = await showBackupPasswordModal(
      t('Введите пароль резервной копии'),
      t('Пароль, заданный при сохранении копии в Google Drive.'),
    );
    if (!password) {
      dismissRestorePrompt();
      return;
    }

    const restoreLabel = t('Восстановление из Google Drive…');
    const progress = showDriveRestoreProgressModal();
    progress.update(t('Подготовка…'), 0);

    try {
      const result = await restoreBackupFromGoogleDrive(userId, password, (percent) => {
        progress.update(restoreLabel, percent);
      });
      progress.update(restoreLabel, 100);
      resetActiveSignalContext();
      dismissRestorePrompt();
      progress.close();

      const parts = [t('Ключи шифрования восстановлены. Обновите страницу сообщений.')];
      if (result.chatsImported + result.chatsSkipped + result.chatsErrors > 0) {
        parts.push(
          t('Импорт завершён: добавлено {imported}, пропущено {skipped}, ошибок {errors}', {
            imported: result.chatsImported,
            skipped: result.chatsSkipped,
            errors: result.chatsErrors,
          }),
        );
      }
      showAccountNoticeModal('success', parts.join(' '));
      await options.onRestored?.();
    } catch (error) {
      progress.close();
      const code = error instanceof Error ? error.message : 'backup_failed';
      showAccountNoticeModal('error', backupErrorMessage(code));
    }
  } finally {
    promptInFlight = false;
  }
}
