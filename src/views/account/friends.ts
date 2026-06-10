import { t, getLocale, localeTag } from '@/i18n';
import { Router } from '@/router/Router';
import type { FriendListItem } from '@/types';
import { apiCall, escapeHtml, formatPresenceLabel, isUserOnline } from '@/utils';
import { getAvatarListHtml } from './avatar';

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

type FriendsDeps = {
  confirmModal: ConfirmModalFn;
  setPendingRequestsBadge: (count: number) => void;
};

export function bindFriendsHandlers(api: ApiMessage, deps: FriendsDeps): void {
  void loadFriendsTab(api, deps);
}

async function loadFriendsTab(api: ApiMessage, deps: FriendsDeps): Promise<void> {
  const container = document.getElementById('friendsContent');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-spinner loading-spinner--centered">
      <div class="spinner loading-spinner__icon"></div>
      <p class="loading-spinner__text">${t('Загрузка...')}</p>
    </div>
  `;

  try {
    const [friendsRes, pendingRes, sentRes] = await Promise.all([
      apiCall('/friends/list', { credentials: 'include' }),
      apiCall('/friends/pending', { credentials: 'include' }),
      apiCall('/friends/sent', { credentials: 'include' }),
    ]);

    const [friendsData, pendingData, sentData] = await Promise.all([
      friendsRes.json().catch(() => ({})),
      pendingRes.json().catch(() => ({})),
      sentRes.json().catch(() => ({})),
    ]);

    if (!friendsData?.ok) {
      container.innerHTML = `<div class="sec-error-text">${t('Не удалось загрузить друзей')}</div>`;
      return;
    }

    const friends = Array.isArray(friendsData.friends) ? friendsData.friends : [];
    const pendingRequests = Array.isArray(pendingData.pendingRequests)
      ? pendingData.pendingRequests
      : [];
    const sentRequests = Array.isArray(sentData.sentRequests) ? sentData.sentRequests : [];

    deps.setPendingRequestsBadge(pendingRequests.length);

    const avatarHtml = (friend: FriendListItem) =>
      getAvatarListHtml(
        friend.avatar ||
          friend.avatarUrl ||
          friend.avatar_url ||
          friend.avatarId ||
          friend.avatar_id,
        String(friend.username || ''),
        { presence: friend }
      );

    const presenceMetaHtml = (friend: FriendListItem) => {
      if (friend.isOnline || friend.lastSeenAt != null || friend.last_seen_at != null) {
        const online = isUserOnline(friend);
        const label = formatPresenceLabel(friend);
        const metaClass = online ? 'friend-meta friend-meta--online' : 'friend-meta';
        return `<div class="${metaClass}">${escapeHtml(label)}</div>`;
      }
      return '';
    };

    container.innerHTML = `
      <div class="friends-search">
        <input type="text" id="friendSearchInput" placeholder="${t('🔍 Поиск пользователей...')}" />
        <button id="friendSearchBtn" type="button" aria-label="${t('Поиск пользователей')}">🔍</button>
      </div>

      <div id="searchResults"></div>

      <div class="friends-section">
        <div class="friends-section-title"><span>👥</span><span>${t('Мои друзья')} (${friends.length})</span></div>
        ${
          friends.length > 0
            ? `<div class="friends-list">${friends
                .map(
                  (friend: FriendListItem) => `
                <div class="friend-card" data-presence-user-id="${escapeHtml(String(friend.id || ''))}">
                  <div class="friend-avatar">${avatarHtml(friend)}</div>
                  <div class="friend-info">
                    <div class="friend-username">${escapeHtml(String(friend.username || 'Unknown'))}</div>
                    ${presenceMetaHtml(friend)}
                  </div>
                  <div class="friend-actions">
                    <button class="btn-friend btn-friend-message" data-action="message" data-id="${escapeHtml(String(friend.id || ''))}" data-username="${escapeHtml(String(friend.username || ''))}" type="button" aria-label="${t('💬 Написать')}">${t('💬 Написать')}</button>
                    <button class="btn-friend btn-friend-profile" data-action="profile" data-username="${escapeHtml(String(friend.username || ''))}" type="button" aria-label="${t('👤 Профиль')}">${t('👤 Профиль')}</button>
                    <button class="btn-friend btn-friend-remove" data-action="remove" data-id="${escapeHtml(String(friend.id || ''))}" data-username="${escapeHtml(String(friend.username || ''))}" type="button" aria-label="${t('❌ Удалить')}">${t('❌ Удалить')}</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : `<div class="empty-state"><div class="empty-state-icon">👥</div><p>${t('У вас пока нет друзей')}</p><p class="empty-state-sub">${t('Найдите пользователей и добавьте их в друзья')}</p></div>`
        }
      </div>

      <div class="friends-section">
        <div class="friends-section-title"><span>📥</span><span>${t('Входящие запросы')} (${pendingRequests.length})</span></div>
        ${
          pendingRequests.length > 0
            ? `<div class="friends-list">${pendingRequests
                .map(
                  (request: FriendListItem) => `
                <div class="friend-card">
                  <div class="friend-avatar">${avatarHtml(request)}</div>
                  <div class="friend-info">
                    <div class="friend-username">${escapeHtml(String(request.username || 'Unknown'))}</div>
                    <div class="friend-meta">${t('📬 Запрос в друзья')} ${escapeHtml(
                      new Date(request.createdAt || Date.now()).toLocaleDateString(localeTag(getLocale()))
                    )}</div>
                  </div>
                  <div class="friend-actions">
                    <button class="btn-friend btn-friend-accept" data-action="accept" data-id="${escapeHtml(String(request.id || ''))}" data-username="${escapeHtml(String(request.username || ''))}" type="button" aria-label="${t('✅ Принять')}">${t('✅ Принять')}</button>
                    <button class="btn-friend btn-friend-reject" data-action="reject" data-id="${escapeHtml(String(request.id || ''))}" data-username="${escapeHtml(String(request.username || ''))}" type="button" aria-label="${t('❌ Отклонить')}">${t('❌ Отклонить')}</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : `<div class="empty-state"><div class="empty-state-icon">📭</div><p>${t('Нет новых запросов')}</p><p class="empty-state-sub">${t('Когда кто-то захочет добавить вас в друзья, запрос появится здесь')}</p></div>`
        }
      </div>

      <div class="friends-section friends-section--tight">
        <div class="friends-section-title"><span>📤</span><span>${t('Отправленные запросы')} (${sentRequests.length})</span></div>
        ${
          sentRequests.length > 0
            ? `<div class="friends-list">${sentRequests
                .map(
                  (request: FriendListItem) => `
                <div class="friend-card">
                  <div class="friend-avatar">${avatarHtml(request)}</div>
                  <div class="friend-info">
                    <div class="friend-username">${escapeHtml(String(request.username || 'Unknown'))}</div>
                    <div class="friend-meta">${t('⏳ Ожидание ответа')} ${escapeHtml(
                      new Date(request.createdAt || Date.now()).toLocaleDateString(localeTag(getLocale()))
                    )}</div>
                  </div>
                  <div class="friend-actions">
                    <button class="btn-friend btn-friend-profile" data-action="profile" data-username="${escapeHtml(String(request.username || ''))}" type="button" aria-label="${t('👤 Профиль')}">${t('👤 Профиль')}</button>
                    <button class="btn-friend btn-friend-cancel" data-action="cancel" data-id="${escapeHtml(String(request.id || ''))}" type="button" aria-label="${t('❌ Отменить')}">${t('❌ Отменить')}</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : `<div class="empty-state"><div class="empty-state-icon">📨</div><p>${t('Нет отправленных запросов')}</p><p class="empty-state-sub">${t('Найдите пользователей и отправьте им запрос в друзья')}</p></div>`
        }
      </div>
    `;

    const searchInput = document.getElementById('friendSearchInput') as HTMLInputElement | null;
    const searchBtn = document.getElementById('friendSearchBtn') as HTMLButtonElement | null;

    const runSearch = async () => {
      const query = String(searchInput?.value || '').trim();
      const searchResults = document.getElementById('searchResults');
      if (!searchResults) return;

      if (!query) {
        searchResults.classList.remove('active');
        searchResults.innerHTML = '';
        return;
      }

      try {
        const res = await apiCall(`/search/users?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        searchResults.classList.add('active');

        if (!res.ok || data?.ok === false) {
          searchResults.innerHTML = `
            <div class="search-error">
              ⚠️ ${escapeHtml(String(data?.error || t('Не удалось выполнить поиск')))}
            </div>
          `;
          return;
        }

        if (!Array.isArray(data.users) || data.users.length === 0) {
          searchResults.innerHTML = `
            <div class="search-empty">
              ${t('🔍 Пользователи не найдены')}<br />
              <small class="search-empty-sub">${t('Попробуйте изменить запрос')}</small>
            </div>
          `;
          return;
        }

        searchResults.innerHTML = `
          <div class="search-count">${t('📋 Найдено:')} ${data.users.length}</div>
          ${data.users
            .map(
              (foundUser: FriendListItem) => `
            <div class="search-result-item">
              <div class="search-result-avatar">${avatarHtml(foundUser)}</div>
              <div class="search-result-info">
                <div class="search-result-username">${escapeHtml(String(foundUser.username || 'Unknown'))}</div>
                ${presenceMetaHtml(foundUser)}
              </div>
              <div class="search-result-actions">
                <button class="btn-friend btn-friend-add" data-action="add" data-username="${escapeHtml(String(foundUser.username || ''))}" type="button" aria-label="${t('➕ Добавить')}">${t('➕ Добавить')}</button>
                <button class="btn-friend btn-friend-profile" data-action="profile" data-username="${escapeHtml(String(foundUser.username || ''))}" type="button" aria-label="${t('👤 Профиль')}">${t('👤 Профиль')}</button>
              </div>
            </div>
          `
            )
            .join('')}
        `;
      } catch (error) {
        const searchMessage = error instanceof Error ? error.message : t('Неизвестная ошибка');
        searchResults.classList.add('active');
        searchResults.innerHTML = `
          <div class="search-error">
            ${t('⚠️ Ошибка при поиске')}<br />
            <small>${escapeHtml(searchMessage)}</small>
          </div>
        `;
      }
    };

    searchBtn?.addEventListener('click', () => {
      void runSearch();
    });

    searchInput?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void runSearch();
      }
    });

    container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const actionButton = target?.closest('[data-action]') as HTMLElement | null;
      if (!actionButton) return;

      const action = actionButton.getAttribute('data-action') || '';
      const id = actionButton.getAttribute('data-id') || '';
      const username = actionButton.getAttribute('data-username') || '';

      const handle = async () => {
        if (action === 'profile') {
          if (username) Router.navigate(username);
          return;
        }

        if (action === 'message') {
          if (!id || !username) return;
          sessionStorage.setItem('openChatWith', JSON.stringify({ friendId: id, username }));
          Router.navigate('account-messages');
          return;
        }

        if (action === 'add') {
          if (!username) return;
          const res = await apiCall('/friends/add', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendUsername: username }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.ok) {
            api.showMsg('ok', t('✅ Запрос отправлен пользователю {username}!', { username }));
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', data?.error || t('Ошибка при отправке запроса'));
          }
          return;
        }

        if (action === 'accept') {
          if (!id) return;
          const res = await apiCall('/friends/accept', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId: id }),
          });
          if (res.ok) {
            api.showMsg('ok', t('✅ {username} добавлен в друзья!', { username }));
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', t('Ошибка при принятии запроса'));
          }
          return;
        }

        if (action === 'reject') {
          if (!id) return;
          const res = await apiCall('/friends/reject', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId: id }),
          });
          if (res.ok) {
            api.showMsg('ok', t('❌ Запрос от {username} отклонён', { username }));
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', t('Ошибка при отклонении запроса'));
          }
          return;
        }

        if (action === 'remove') {
          if (!id) return;
          const isConfirmed = await deps.confirmModal({
            title: t('Удаление друга'),
            text: t('Вы уверены, что хотите удалить {name}?', { name: username || t('пользователя') }),
            confirmText: t('Удалить'),
            cancelText: t('Отмена'),
          });
          if (!isConfirmed) return;

          const res = await apiCall('/friends/remove', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId: id }),
          });
          if (res.ok) {
            api.showMsg('ok', t('{name} удалён из друзей', { name: username || t('Пользователь') }));
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', t('Ошибка при удалении друга'));
          }
          return;
        }

        if (action === 'cancel') {
          if (!id) return;
          const res = await apiCall('/friends/remove', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId: id }),
          });
          if (res.ok) {
            api.showMsg('ok', t('Запрос отменён'));
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', t('Ошибка при отмене запроса'));
          }
        }
      };

      void handle();
    });
  } catch (error) {
    console.error('Error loading friends:', error);
    container.innerHTML = `<div class="sec-error-text">${t('Ошибка загрузки. Попробуйте обновить страницу.')}</div>`;
  }
}
