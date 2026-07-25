import { t } from '@/i18n';
import { apiCall } from './api';
import { escapeHtml } from './string';
import { setupAccessibleModal } from './keyboard';
import { getRoleDescription, getRoleDisplayName, getRoleNoticeIcon } from './roles';

const KNOWN_ROLES = ['owner', 'admin', 'moderator', 'support', 'registrar', 'tester', 'user'];

export async function showPendingRoleNotice(roleNotice?: string | null): Promise<void> {
  if (!roleNotice) return;

  const rawNotice = roleNotice.trim();
  const lowerNotice = rawNotice.toLowerCase();
  const isRoleAssignment = KNOWN_ROLES.includes(lowerNotice);

  let titleHtml = '';
  let badgeHtml = '';
  let leadTextHtml = '';
  let descHtml = '';
  let cardClass = 'account-notice-card--role';

  if (isRoleAssignment) {
    const roleKey = lowerNotice;
    const roleLabel = getRoleDisplayName(roleNotice);
    const roleDescription = getRoleDescription(roleNotice);
    const roleIcon = getRoleNoticeIcon(roleNotice);

    titleHtml = `${roleIcon} ${escapeHtml(t('Новая роль'))}`;
    badgeHtml = `<span class="chip chip-role chip-${escapeHtml(roleKey)}">${escapeHtml(roleLabel)}</span>`;
    leadTextHtml = escapeHtml(t('Вам назначена роль: {role}', { role: roleLabel }));
    descHtml = roleDescription
      ? `<p id="roleNoticeDesc" class="account-notice-desc">${escapeHtml(roleDescription)}</p>`
      : '<p id="roleNoticeDesc" class="account-notice-desc is-hidden"></p>';
  } else {
    cardClass = 'account-notice-card--system';

    let headerTitle = t('Сообщение от администрации');
    let bodyText = rawNotice;

    // Поддержка разделения "Заголовок|Текст сообщения" или "Заголовок\nТекст сообщения"
    if (rawNotice.includes('|')) {
      const parts = rawNotice.split('|');
      headerTitle = parts[0].trim() || headerTitle;
      bodyText = parts.slice(1).join('|').trim();
    } else if (rawNotice.includes('\n')) {
      const lines = rawNotice.split(/\r?\n/);
      headerTitle = lines[0].trim() || headerTitle;
      bodyText = lines.slice(1).join('\n').trim();
    }

    // Clean title: avoid prepending duplicate emoji if title already has one
    const hasEmojiPrefix = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(headerTitle);
    const cleanTitle = hasEmojiPrefix ? headerTitle : `📢 ${headerTitle}`;

    titleHtml = escapeHtml(cleanTitle);
    badgeHtml = `<span class="chip-sys-badge">📢 ${escapeHtml(t('Системное объявление'))}</span>`;

    // Separate main message from admin note if present
    let mainMessage = bodyText;
    let adminNote = '';

    const noteMarkerRegex = /(?:Примечание администратора|Admin note|Примітка адміністратора)\s*:\s*(.*)/i;
    const match = bodyText.match(noteMarkerRegex);
    if (match) {
      mainMessage = bodyText.substring(0, match.index).trim();
      adminNote = match[1].trim();
    }

    leadTextHtml = `
      <div class="account-notice-main-text">${escapeHtml(mainMessage)}</div>
      ${
        adminNote
          ? `
            <div class="account-notice-admin-box">
              <div class="account-notice-admin-box__title">💬 ${escapeHtml(t('Примечание администратора'))}</div>
              <div class="account-notice-admin-box__text">${escapeHtml(adminNote)}</div>
            </div>
          `
          : ''
      }
    `;
    descHtml = '<p id="roleNoticeDesc" class="account-notice-desc is-hidden"></p>';
  }

  document.getElementById('roleNoticeModal')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'roleNoticeModal';
  wrap.className = 'account-notice-modal';

  wrap.innerHTML = `
    <div class="account-notice-backdrop" aria-hidden="true"></div>
    <div
      class="account-notice-card ${cardClass}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roleNoticeTitle"
      aria-describedby="roleNoticeDesc"
    >
      <div id="roleNoticeTitle" class="account-notice-head">
        ${titleHtml}
      </div>
      <div class="account-notice-role">
        ${badgeHtml}
      </div>
      <div class="account-notice-content">
        ${leadTextHtml}
      </div>
      ${descHtml}
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
