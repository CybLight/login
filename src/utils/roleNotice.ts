import { t } from '@/i18n';
import { apiCall } from './api';
import { escapeHtml } from './string';
import { setupAccessibleModal } from './keyboard';
import { getRoleDescription, getRoleDisplayName, getRoleNoticeIcon } from './roles';

export async function showPendingRoleNotice(roleNotice?: string | null): Promise<void> {
  if (!roleNotice) return;

  const roleKey = roleNotice.toLowerCase();
  const roleLabel = getRoleDisplayName(roleNotice);
  const roleDescription = getRoleDescription(roleNotice);
  const roleIcon = getRoleNoticeIcon(roleNotice);

  document.getElementById('roleNoticeModal')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'roleNoticeModal';
  wrap.className = 'account-notice-modal';

  wrap.innerHTML = `
    <div class="account-notice-backdrop" aria-hidden="true"></div>
    <div
      class="account-notice-card account-notice-card--role"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roleNoticeTitle"
      aria-describedby="roleNoticeDesc"
    >
      <div id="roleNoticeTitle" class="account-notice-head is-success">
        ${roleIcon} ${escapeHtml(t('Новая роль'))}
      </div>
      <div class="account-notice-role">
        <span class="chip chip-role chip-${escapeHtml(roleKey)}">${escapeHtml(roleLabel)}</span>
      </div>
      <p class="account-notice-lead">
        ${escapeHtml(t('Вам назначена роль: {role}', { role: roleLabel }))}
      </p>
      ${
        roleDescription
          ? `<p id="roleNoticeDesc" class="account-notice-desc">${escapeHtml(roleDescription)}</p>`
          : '<p id="roleNoticeDesc" class="account-notice-desc is-hidden"></p>'
      }
      <div class="account-notice-actions">
        <button type="button" class="btn btn-primary" id="roleNoticeOkBtn">
          ${escapeHtml(t('Понятно'))}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const dialogEl = wrap.querySelector('.account-notice-card') as HTMLElement;
  let cleanedUp = false;

  const dismissOnServer = async () => {
    try {
      await apiCall('/auth/role-notice/dismiss', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[ROLE] Failed to dismiss role notice:', error);
    }
  };

  const close = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    cleanupKeyboard();
    wrap.remove();
    void dismissOnServer();
  };

  const cleanupKeyboard = setupAccessibleModal(wrap, {
    trapFocusRoot: dialogEl,
    onClose: close,
  });

  wrap.querySelector('#roleNoticeOkBtn')?.addEventListener('click', close);

  const okBtn = wrap.querySelector('#roleNoticeOkBtn') as HTMLButtonElement | null;
  okBtn?.focus();
}
