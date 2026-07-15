/**
 * Account handlers - обработчики событий для вкладок аккаунта
 */

import { Router } from '@/router/Router';
import { apiCall, escapeHtml } from '@/utils';
import { t } from '@/i18n';
import type { User as AppUser } from '@/types';
import { copyText } from '@/utils/clipboard';
import { bindSecurityHandlers } from './security-tab';
import { bindSessionsHandlers } from './sessions';
import { bindFriendsHandlers } from './friends';
import { bindMessagesHandlers, loadMessagesTab as loadMessagesListTab } from './messages-list';
import type { ChatLoadOptions } from './chat-core';
import { openChatInMessagesTab } from './messages-tab';
import {
  showAccountConfirmModal,
  showAccountDeleteConfirmModal,
  showAccountNoticeModal,
  showSettingsUsernameModal,
  showSettingsEmailModal,
} from './modals';
import { updateNavBadges, setNavBadge, updateChatUnreadBadges, fetchUnreadSummaryData } from './unread';
import { isEmailVerified } from './account-utils';

interface ApiMessage {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
}

// Use application `User` type where appropriate

/**
 * Мобильное burger-меню аккаунта
 */
function bindAccountMobileNav(): void {
  const menuToggle = document.getElementById('accountMenuToggle');
  const overlay = document.getElementById('accountNavOverlay');
  if (!menuToggle) return;

  const closeNav = () => {
    document.body.classList.remove('account-nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Открыть меню');
    overlay?.setAttribute('aria-hidden', 'true');
  };

  const openNav = () => {
    document.body.classList.add('account-nav-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Закрыть меню');
    overlay?.setAttribute('aria-hidden', 'false');
  };

  menuToggle.addEventListener('click', () => {
    if (document.body.classList.contains('account-nav-open')) {
      closeNav();
    } else {
      openNav();
    }
  });

  overlay?.addEventListener('click', closeNav);

  document.querySelectorAll('.account-nav button, #adminPanelBtn, #logoutBtn').forEach((btn) => {
    btn.addEventListener('click', closeNav);
  });
}

/**
 * Выпадающие меню шапки: язык и аватар пользователя
 */
function bindAccountHeaderMenus(): void {
  const langBtn = document.getElementById('accountLangBtn');
  const langMenu = document.getElementById('accountLangMenu');
  const avatarBtn = document.getElementById('accountAvatarBtn');
  const userMenu = document.getElementById('accountUserMenu');

  const closeMenus = () => {
    langMenu?.setAttribute('hidden', '');
    userMenu?.setAttribute('hidden', '');
    langBtn?.setAttribute('aria-expanded', 'false');
    avatarBtn?.setAttribute('aria-expanded', 'false');
  };

  const toggleMenu = (btn: HTMLElement | null, menu: HTMLElement | null) => {
    if (!btn || !menu) return;
    const willOpen = menu.hasAttribute('hidden');
    closeMenus();
    if (willOpen) {
      menu.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
    }
  };

  langBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu(langBtn, langMenu);
  });

  avatarBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu(avatarBtn, userMenu);
  });

  langMenu?.addEventListener('click', (event) => event.stopPropagation());
  userMenu?.addEventListener('click', (event) => event.stopPropagation());

  document.getElementById('headerEditAccountBtn')?.addEventListener('click', () => {
    closeMenus();
    Router.navigate('edit-profile');
  });

  document.addEventListener('click', closeMenus);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
}

/**
 * Bind copy buttons (data-copybtn)
 */
function bindCopyButtons(api: ApiMessage): void {
  document.querySelectorAll('[data-copybtn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const v = btn.getAttribute('data-copybtn') || '';
      if (!v) return;

      const oldHtml = btn.innerHTML;
      const oldLabel = btn.getAttribute('aria-label') || '';

      const ok = await copyText(v);

      if (ok) {
        api.showMsg('ok', 'Скопировано ✅');

        btn.classList.add('is-copied');
        btn.setAttribute('aria-label', 'Скопировано');

        // ✓ icon
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
          </svg>
        `;

        setTimeout(() => {
          btn.classList.remove('is-copied');
          btn.innerHTML = oldHtml;
          if (oldLabel) btn.setAttribute('aria-label', oldLabel);
          else btn.setAttribute('aria-label', 'Скопировать');
        }, 900);
      } else {
        api.showMsg('error', 'Не удалось скопировать');
      }

      setTimeout(api.clearMsg, 1100);
    });
  });
}

/**
 * Привязать обработчики событий
 */
export function bindAccountHandlers(
  _tab: string,
  user: AppUser,
  state: {
    twoFAEnabled: boolean;
    passkeyCount: number;
    emailVerified: boolean;
    accountChatFriendId: string | null;
    accountChatIntervalId?: number;
    accountChatDocClickHandler: ((event: MouseEvent) => void) | null;
    accountChatMessageMap: Map<string, Record<string, unknown>>;
    accountPinnedMessageByChat: Map<string, { messageId: string; text: string }>;
  },
  callbacks: {
    setTwoFAEnabled: (value: boolean) => void;
    setPasskeyCount: (value: number) => void;
    setEmailVerified: (value: boolean) => void;
    setAccountChatFriendId: (id: string | null) => void;
    setAccountChatIntervalId: (id?: number) => void;
    setAccountChatDocClickHandler: (handler: ((event: MouseEvent) => void) | null) => void;
    stopAccountChatAutoRefresh: () => void;
    loadChatMessagesInAccount: (
      friendId: string,
      container: HTMLElement | null,
      api: ApiMessage,
      chatInput: HTMLTextAreaElement | null,
      chatSendBtn: HTMLButtonElement | null,
      chatEditIndicator: HTMLElement | null,
      chatEditingIdInput: HTMLInputElement | null,
      options?: ChatLoadOptions
    ) => Promise<void>;
  }
): void {
  // Setup message API
  const msgEl = document.getElementById('msg');
  let msgTimeout: number | undefined;

  const showMsg = (type: string, text: string, persist: boolean = false) => {
    if (!msgEl) return;

    // Очищаем предыдущий таймаут если был
    if (msgTimeout) {
      window.clearTimeout(msgTimeout);
      msgTimeout = undefined;
    }

    msgEl.style.display = 'block';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;

    // Автоматически скрываем через 3 секунды (если не persist)
    if (!persist) {
      msgTimeout = window.setTimeout(() => {
        if (msgEl) {
          msgEl.style.display = 'none';
          msgEl.className = 'msg';
          msgEl.textContent = '';
        }
        msgTimeout = undefined;
      }, 3000);
    }

    if (type === 'error' || type === 'warn') {
      showAccountNoticeModal(type, text);
    }
  };
  const clearMsg = () => {
    if (!msgEl) return;

    // Очищаем таймаут если был
    if (msgTimeout) {
      window.clearTimeout(msgTimeout);
      msgTimeout = undefined;
    }

    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  };

  const api: ApiMessage = { showMsg, clearMsg };

  document.body.classList.remove('account-nav-open');
  bindAccountMobileNav();
  bindAccountHeaderMenus();

  // Bind copy buttons (copy to clipboard)
  bindCopyButtons(api);

  // Tab navigation
  document.querySelectorAll('.account-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        // Map tab names to routes
        const tabToRoute: Record<string, string> = {
          easter: 'account-easter-eggs',
        };
        const route = tabToRoute[targetTab] || `account-${targetTab}`;
        Router.navigate(route);
      }
    });
  });

  // Logout handler (кнопка в сайдбаре + в меню аватара)
  document.querySelectorAll('#logoutBtn, #headerLogoutBtn').forEach((logoutBtn) => {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiCall('/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e: unknown) {
        console.error('Logout error:', e);
      }

      document.body.classList.remove('no-strawberries');
      Router.navigate('username');
    });
  });

  // Security tab handlers
  if (_tab === 'security') {
    bindSecurityHandlers({
      user,
      api,
      state: {
        twoFAEnabled: state.twoFAEnabled,
        passkeyCount: state.passkeyCount,
        emailVerified: state.emailVerified,
      },
      onTwoFAChanged: callbacks.setTwoFAEnabled,
      onPasskeyCountChanged: callbacks.setPasskeyCount,
      onEmailVerifiedChanged: callbacks.setEmailVerified,
      onUserUpdated: (data: Record<string, unknown>) => {
        Object.assign(user, data as Record<string, unknown>);
      },
      isEmailVerified,
    });
  }

  // Settings tab handlers
  if (_tab === 'settings') {
    bindProfileTabHandlers(user, api);
    bindSettingsQuickNav();
    bindSettingsNotificationsHandlers(user);
    bindSettingsAccountFieldsHandlers(user, api);
    bindSettingsSecurityTransitions(user);
  }

  // Sessions tab handlers
  if (_tab === 'sessions') {
    bindSessionsHandlers(api);
  }

  // Friends tab handlers
  if (_tab === 'friends') {
    bindFriendsHandlers(api, {
      confirmModal: showAccountConfirmModal,
      setPendingRequestsBadge: (count) => setNavBadge('pending-requests', count),
    });
  }

  // Messages tab handlers
  if (_tab === 'messages') {
    // Wrapper function to provide dependency injection for messages tab
    const openChatWrapper = (friendId: string, friendUsername: string, api: ApiMessage) => {
      openChatInMessagesTab(friendId, friendUsername, {
        api,
        state: {
          accountChatFriendId: state.accountChatFriendId,
          accountChatIntervalId: state.accountChatIntervalId,
          accountChatDocClickHandler: state.accountChatDocClickHandler,
          accountChatMessageMap: state.accountChatMessageMap,
          accountPinnedMessageByChat: state.accountPinnedMessageByChat,
        },
        callbacks: {
          stopAccountChatAutoRefresh: callbacks.stopAccountChatAutoRefresh,
          setAccountChatFriendId: callbacks.setAccountChatFriendId,
          setAccountChatIntervalId: callbacks.setAccountChatIntervalId,
          setAccountChatDocClickHandler: callbacks.setAccountChatDocClickHandler,
          updateChatUnreadBadges,
          loadMessagesListTab: (api, loadOpts) => {
            return loadMessagesListTab(api, loadOpts);
          },
          loadChatMessagesInAccount: callbacks.loadChatMessagesInAccount,
          fetchUnreadSummaryData,
          setNavBadge,
        },
      });
    };

    bindMessagesHandlers(api, {
      stopAccountChatAutoRefresh: callbacks.stopAccountChatAutoRefresh,
      setAccountChatFriendId: callbacks.setAccountChatFriendId,
      openChatInMessagesTab: openChatWrapper,
      updateChatUnreadBadges,
      fetchUnreadSummaryData,
      setNavBadge,
    });
  }

  // Easter tab handlers
  if (_tab === 'easter') {
    bindEasterHandlers();
  }

  // Load badge counts for all tabs so counters stay visible in sidebar
  void updateNavBadges();
}

/**
 * Инициализация tab-переключения быстрой навигации по настройкам
 */
function bindSettingsQuickNav(): void {
  const nav = document.getElementById('stgQuickNav');
  if (!nav) return;

  const sections = Array.from(
    document.querySelectorAll<HTMLElement>('.stg-section[id]')
  );
  const navLinks = Array.from(
    nav.querySelectorAll<HTMLAnchorElement>('.stg-quicknav__item')
  );

  if (!sections.length || !navLinks.length) return;

  const showSection = (activeId: string) => {
    // Update nav active state
    navLinks.forEach(link => {
      link.classList.toggle('is-active', link.dataset.section === activeId);
    });

    const currentVisible = sections.find(s => s.classList.contains('stg-section--visible'));
    const dangerZone = document.querySelector<HTMLElement>('.stg-danger-zone');
    const isDangerZoneVisible = dangerZone && dangerZone.classList.contains('stg-section--visible');

    const fadeOutTasks: Promise<void>[] = [];

    // 1. Fade out current active section
    if (currentVisible && currentVisible.id !== activeId) {
      currentVisible.classList.remove('stg-section--visible');
      currentVisible.classList.add('stg-section--hidden');
      fadeOutTasks.push(new Promise(resolve => setTimeout(resolve, 150)));
    }

    // 1b. Fade out danger zone if it was visible and we are leaving account
    if (isDangerZoneVisible && activeId !== 'settings-account' && dangerZone) {
      dangerZone.classList.remove('stg-section--visible');
      dangerZone.classList.add('stg-section--hidden');
      if (fadeOutTasks.length === 0) {
        fadeOutTasks.push(new Promise(resolve => setTimeout(resolve, 150)));
      }
    }

    // 2. Once fade-out finishes, switch display and fade-in
    Promise.all(fadeOutTasks).then(() => {
      sections.forEach(section => {
        if (section.id === activeId) {
          section.style.display = '';
          // Force layout reflow before starting animation
          section.getBoundingClientRect();
          section.classList.remove('stg-section--hidden');
          section.classList.add('stg-section--visible');
        } else {
          section.style.display = 'none';
          section.classList.add('stg-section--hidden');
          section.classList.remove('stg-section--visible');
        }
      });

      // Handle danger zone display
      if (dangerZone) {
        if (activeId === 'settings-account') {
          dangerZone.style.display = '';
          dangerZone.getBoundingClientRect();
          dangerZone.classList.remove('stg-section--hidden');
          dangerZone.classList.add('stg-section--visible');
        } else {
          dangerZone.style.display = 'none';
          dangerZone.classList.add('stg-section--hidden');
          dangerZone.classList.remove('stg-section--visible');
        }
      }
    });
  };

  // Initialize: show only the first section (account), hide danger zone only if first !== account
  const firstId = navLinks[0]?.dataset.section ?? sections[0]?.id;
  if (firstId) {
    // Hide all sections first
    sections.forEach(s => { s.style.display = 'none'; });
    // Show first section
    const firstSection = document.getElementById(firstId);
    if (firstSection) {
      firstSection.style.display = '';
      firstSection.classList.add('stg-section--visible');
    }
    navLinks[0]?.classList.add('is-active');
    // Hide danger zone if first tab is not account
    const dangerZone = document.querySelector<HTMLElement>('.stg-danger-zone');
    if (dangerZone && firstId !== 'settings-account') {
      dangerZone.style.display = 'none';
    }
  }

  // Click handler
  navLinks.forEach(link => {
    link.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      const targetId = link.dataset.section!;
      showSection(targetId);
      // Scroll nav into view on mobile if needed
      link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });
}

/**
 * Привязать обработчики для настройки email-уведомлений
 */
function bindSettingsNotificationsHandlers(user: AppUser): void {
  const checkbox = document.getElementById('stgNotifSystemEmails') as HTMLInputElement | null;
  if (!checkbox) return;

  checkbox.addEventListener('change', async () => {
    const isChecked = checkbox.checked;
    checkbox.disabled = true;

    try {
      const res = await apiCall('/auth/settings/notifications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemEmailsDisabled: !isChecked,
        }),
      });

      if (res && res.ok) {
        (user as any).systemEmailsDisabled = !isChecked;
      } else {
        checkbox.checked = !isChecked;
        console.error('Failed to update notification settings:', res);
      }
    } catch (err) {
      checkbox.checked = !isChecked;
      console.error('Error updating notification settings:', err);
    } finally {
      checkbox.disabled = false;
    }
  });
}


/**
 * Привязать обработчики для вкладки Профиль (удаление)
 */
function bindProfileTabHandlers(user: AppUser, api: ApiMessage): void {
  const deleteBtn = document.getElementById('profileDeleteAccountBtn');
  if (!deleteBtn) return;

  deleteBtn.addEventListener('click', async () => {
    const login = (user as any).login || user.username || 'User';
    const { confirmed, password } = await showAccountDeleteConfirmModal({
      title: 'Удаление аккаунта',
      text: `
        <div class="delete-warning-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; margin: 15px 0 25px 0;">
          <div class="delete-user-badge" style="font-size: 24px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #ff416c, #ff4b2b); padding: 8px 28px; border-radius: 50px; box-shadow: 0 4px 15px rgba(255, 75, 43, 0.4); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
            ${escapeHtml(login)}
          </div>
          
          <p style="font-size: 16px; color: #ff8a80; font-weight: 600; margin: 0; line-height: 1.5;">
            Вы собираетесь безвозвратно удалить свой аккаунт на сайте CybLight.
          </p>
          
          <p style="font-size: 14px; color: #e0e0e0; margin: 0; line-height: 1.5;">
            Все ваши сообщения, друзья и настройки будут стерты навсегда.
          </p>
          
          <div style="font-size: 13px; color: #ff5252; background: rgba(255, 82, 82, 0.1); padding: 8px 20px; border-radius: 6px; border: 1px solid rgba(255, 82, 82, 0.2); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; margin-top: 4px;">
            ⚠️ Это действие невозможно отменить
          </div>
        </div>
      `,
      confirmText: 'Удалить навсегда',
      cancelText: 'Отмена',
      passwordPlaceholder: 'Введите пароль'
    });

    if (!confirmed || !password) return;

    (deleteBtn as HTMLButtonElement).disabled = true;
    deleteBtn.textContent = 'Удаление...';

    try {
      const r = await apiCall('/auth/me', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (r.ok) {
        api.showMsg('ok', 'Аккаунт успешно удалён');
        localStorage.clear();
        sessionStorage.clear();
        setTimeout(() => {
          Router.navigate('username');
        }, 1500);
      } else {
        const d = await r.json().catch(() => ({}));
        api.showMsg('error', d.error === 'invalid_password' ? 'Неверный пароль' : (d.error ? `Ошибка: ${d.error}` : 'Не удалось удалить аккаунт'));
        (deleteBtn as HTMLButtonElement).disabled = false;
        deleteBtn.innerHTML = '<span class="nav-icon" style="font-size: 18px; margin-right: 8px;">🗑️</span> Удалить аккаунт';
      }
    } catch (err) {
      console.error('Account deletion error:', err);
      api.showMsg('error', 'Ошибка сети');
      (deleteBtn as HTMLButtonElement).disabled = false;
      deleteBtn.innerHTML = '<span class="nav-icon" style="font-size: 18px; margin-right: 8px;">🗑️</span> Удалить аккаунт';
    }
  });
}

/**
 * Привязать обработчики для вкладки Пасхалки
 */
function bindEasterHandlers(): void {
  console.log('[EASTER] Tab loaded');

  bindEasterSubTabs();

  // Кнопка "Открыть стенографию" для Strawberry Hunt
  const toHistoryBtn = document.getElementById('toHistoryBtn') as HTMLButtonElement;
  if (toHistoryBtn && !toHistoryBtn.disabled) {
    toHistoryBtn.onclick = () => {
      // Сохраняем откуда пришли для навигации обратно
      sessionStorage.setItem('cyb_history_from', 'account-easter-eggs');
      Router.navigate('strawberry-history');
    };
  }

  // Scroll to top button
  const old = document.getElementById('scrollTopBtn');
  if (old) old.remove();

  const scrollBtn = document.createElement('div');
  scrollBtn.id = 'scrollTopBtn';
  scrollBtn.textContent = '⬆';
  document.body.appendChild(scrollBtn);

  scrollBtn.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('.account-page')?.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('.account-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Remove old handler if exists
  if (window.__history_scroll_handler) {
    window.removeEventListener('scroll', window.__history_scroll_handler, { capture: true });
    window.removeEventListener('scroll', window.__history_scroll_handler);
  }

  // Robust scroll handler
  window.__history_scroll_handler = () => {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;

    const scrollY = window.scrollY 
      || document.documentElement.scrollTop 
      || document.body.scrollTop
      || document.querySelector('.account-page')?.scrollTop
      || document.querySelector('.account-main')?.scrollTop
      || 0;

    if (scrollY > 300) btn.classList.add('show');
    else btn.classList.remove('show');
  };

  window.addEventListener('scroll', window.__history_scroll_handler, {
    passive: true,
    capture: true,
  });

  // Check immediately
  window.__history_scroll_handler();
}

function bindEasterSubTabs(): void {
  const root = document.querySelector('.easter-page');
  if (!root) return;

  const tabs = root.querySelectorAll<HTMLButtonElement>('[data-easter-tab]');
  const panels = root.querySelectorAll<HTMLElement>('[data-easter-panel]');
  if (!tabs.length || !panels.length) return;

  const activate = (tabId: string) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.easterTab === tabId;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      const active = panel.dataset.easterPanel === tabId;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });

    sessionStorage.setItem('cyb_easter_subtab', tabId);
  };

  const saved = sessionStorage.getItem('cyb_easter_subtab');
  if (saved === 'site' || saved === 'app' || saved === 'bridge') {
    activate(saved);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.easterTab;
      if (tabId) activate(tabId);
    });
  });
}

/**
 * Обработчики кнопок изменения имени и email в настройках
 */
function bindSettingsAccountFieldsHandlers(user: AppUser, api: ApiMessage): void {
  const changeUsernameBtn = document.getElementById('stgChangeUsernameBtn');
  const changeEmailBtn = document.getElementById('stgChangeEmailBtn');

  if (changeUsernameBtn) {
    changeUsernameBtn.addEventListener('click', () => {
      showSettingsUsernameModal({
        currentUsername: user.username || '',
        onSave: async (newUsername) => {
          try {
            const res = await apiCall('/profile/update', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: newUsername }),
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
              user.username = newUsername;
              const valEl = document.getElementById('stgUsernameValue');
              if (valEl) valEl.textContent = newUsername;

              // Если на странице отображается имя пользователя в приветствии, обновим его
              const userNameHeader = document.querySelector('.stg-user-name');
              if (userNameHeader) userNameHeader.textContent = newUsername;

              api.showMsg('ok', t('Имя пользователя успешно изменено'));
              return { ok: true };
            } else {
              let errorMsg = t('Не удалось сохранить имя пользователя');
              if (data.error === 'username_exists' || data.error === 'already_exists') {
                errorMsg = t('Это имя пользователя уже занято');
              } else if (data.error === 'invalid_username') {
                errorMsg = t('Недопустимый формат имени пользователя');
              }
              return { ok: false, error: errorMsg };
            }
          } catch (err) {
            console.error('Error saving username:', err);
            return { ok: false, error: t('Ошибка сети или сервера') };
          }
        },
      });
    });
  }

  if (changeEmailBtn) {
    changeEmailBtn.addEventListener('click', () => {
      const curEmail = user.email || '';
      const emailVerified = !!user.emailVerified;
      const requiresPassword = emailVerified && !!curEmail;
      const requires2fa = !!user.twoFactorEnabled;

      showSettingsEmailModal({
        currentEmail: curEmail,
        requiresPassword,
        requires2fa,
        onSave: async (newEmail, password, totpCode) => {
          try {
            const res = await apiCall('/auth/email/set', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: newEmail,
                ...(requiresPassword ? { password, totpCode } : {}),
              }),
            });

            const d = await res.json().catch(() => ({}));
            if (res.ok && d.ok) {
              if (d.pending) {
                api.showMsg(
                  'ok',
                  d.cooldown
                    ? t('Запрос принят. Письмо с подтверждением уже отправляли недавно — проверьте почту.')
                    : t('На указанный адрес отправлено письмо для подтверждения смены email.')
                );
              } else {
                user.email = newEmail;
                const valEl = document.getElementById('stgEmailValue');
                if (valEl) valEl.textContent = newEmail;
                api.showMsg('ok', t('Электронная почта успешно обновлена'));
              }
              return { ok: true };
            } else {
              const code = d?.error;
              let errorMsg = t('Не удалось сохранить email.');
              if (code === 'bad_password' || code === 'invalid_password') {
                errorMsg = t('Неверный пароль');
              } else if (code === 'code_required') {
                errorMsg = t('Введите код 2FA');
              } else if (code === 'invalid_code') {
                errorMsg = t('Неверный 2FA код');
              } else if (code === 'password_required') {
                errorMsg = t('Введите текущий пароль');
              } else if (code === 'same_email') {
                errorMsg = t('Это текущий email. Введите другой адрес.');
              } else if (code === 'email_exists') {
                errorMsg = t('Этот адрес электронной почты уже используется.');
              } else if (code) {
                errorMsg = `${t('Ошибка:')} ${code}`;
              }
              return { ok: false, error: errorMsg };
            }
          } catch (err) {
            console.error('Error saving email:', err);
            return { ok: false, error: t('Ошибка сети или сервера') };
          }
        },
      });
    });
  }
}

function bindSettingsSecurityTransitions(user: AppUser): void {
  const container = document.getElementById('settings-security');
  if (!container) return;

  container.querySelectorAll('a[data-sec-goto]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-sec-goto');
      if (section) {
        sessionStorage.setItem('cyb_open_security_section', section);
      }
      Router.navigate('account-security');
    });
  });

  // Загружаем количество passkeys в фоне и обновляем шкалу прогресса
  void loadSettingsSecurityScore(user);
}

async function loadSettingsSecurityScore(user: AppUser): Promise<void> {
  try {
    const r = await apiCall('/auth/passkey/list', { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) {
      const passkeys = d.passkeys || [];
      const count = passkeys.length;

      const emailVerified = isEmailVerified(user);
      const twoFAOn = !!user.twoFactorEnabled;

      let securityScore = 0;
      if (emailVerified) securityScore += 30;
      if (twoFAOn) securityScore += 40;
      if (count > 0) securityScore += 30;

      const scoreTexts = document.querySelectorAll('.security-score-text');
      const progressBars = document.querySelectorAll('.security-progress-bar');
      const statusBadges = document.querySelectorAll('.security-status-badge');

      const levelClass =
        securityScore >= 100
          ? "security-level--good"
          : securityScore >= 50
            ? "security-level--medium"
            : "security-level--low";

      const statusText =
        securityScore >= 100
          ? `✓ ${t('Защищён')}`
          : securityScore >= 50
            ? `⚠ ${t('Средняя')}`
            : `⚠ ${t('Низкая')}`;

      scoreTexts.forEach(el => {
        el.textContent = `${securityScore}%`;
        el.className = `security-score-text ${levelClass}`;
      });

      progressBars.forEach(el => {
        (el as HTMLElement).style.width = `${securityScore}%`;
        el.className = `security-progress-bar ${levelClass}`;
      });

      statusBadges.forEach(el => {
        el.textContent = statusText;
        el.className = `security-status-badge ${levelClass}`;
      });
    }
  } catch (err) {
    console.error('Error loading passkeys for settings score:', err);
  }
}

