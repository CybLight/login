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
      <p class="loading-spinner__text">Загрузка...</p>
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
      container.innerHTML = '<div class="sec-error-text">Не удалось загрузить друзей</div>';
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
        <input type="text" id="friendSearchInput" placeholder="🔍 Поиск пользователей..." />
        <button id="friendSearchBtn" type="button" aria-label="Поиск пользователей">🔍</button>
      </div>

      <div id="searchResults"></div>

      <div class="friends-section">
        <div class="friends-section-title"><span>👥</span><span>Мои друзья (${friends.length})</span></div>
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
                    <button class="btn-friend btn-friend-message" data-action="message" data-id="${escapeHtml(String(friend.id || ''))}" data-username="${escapeHtml(String(friend.username || ''))}" type="button" aria-label="💬 Написать">💬 Написать</button>
                    <button class="btn-friend btn-friend-profile" data-action="profile" data-username="${escapeHtml(String(friend.username || ''))}" type="button" aria-label="👤 Профиль">👤 Профиль</button>
                    <button class="btn-friend btn-friend-remove" data-action="remove" data-id="${escapeHtml(String(friend.id || ''))}" data-username="${escapeHtml(String(friend.username || ''))}" type="button" aria-label="❌ Удалить">❌ Удалить</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : `<div class="empty-state"><div class="empty-state-icon">👥</div><p>У вас пока нет друзей</p><p class="empty-state-sub">Найдите пользователей и добавьте их в друзья</p></div>`
        }
      </div>

      <div class="friends-section">
        <div class="friends-section-title"><span>📥</span><span>Входящие запросы (${pendingRequests.length})</span></div>
        ${
          pendingRequests.length > 0
            ? `<div class="friends-list">${pendingRequests
                .map(
                  (request: FriendListItem) => `
                <div class="friend-card">
                  <div class="friend-avatar">${avatarHtml(request)}</div>
                  <div class="friend-info">
                    <div class="friend-username">${escapeHtml(String(request.username || 'Unknown'))}</div>
                    <div class="friend-meta">📬 Запрос в друзья ${escapeHtml(
                      new Date(request.createdAt || Date.now()).toLocaleDateString('ru-RU')
                    )}</div>
                  </div>
                  <div class="friend-actions">
                    <button class="btn-friend btn-friend-accept" data-action="accept" data-id="${escapeHtml(String(request.id || ''))}" data-username="${escapeHtml(String(request.username || ''))}" type="button" aria-label="✅ Принять">✅ Принять</button>
                    <button class="btn-friend btn-friend-reject" data-action="reject" data-id="${escapeHtml(String(request.id || ''))}" data-username="${escapeHtml(String(request.username || ''))}" type="button" aria-label="❌ Отклонить">❌ Отклонить</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : `<div class="empty-state"><div class="empty-state-icon">📭</div><p>Нет новых запросов</p><p class="empty-state-sub">Когда кто-то захочет добавить вас в друзья, запрос появится здесь</p></div>`
        }
      </div>

      <div class="friends-section friends-section--tight">
        <div class="friends-section-title"><span>📤</span><span>Отправленные запросы (${sentRequests.length})</span></div>
        ${
          sentRequests.length > 0
            ? `<div class="friends-list">${sentRequests
                .map(
                  (request: FriendListItem) => `
                <div class="friend-card">
                  <div class="friend-avatar">${avatarHtml(request)}</div>
                  <div class="friend-info">
                    <div class="friend-username">${escapeHtml(String(request.username || 'Unknown'))}</div>
                    <div class="friend-meta">⏳ Ожидание ответа ${escapeHtml(
                      new Date(request.createdAt || Date.now()).toLocaleDateString('ru-RU')
                    )}</div>
                  </div>
                  <div class="friend-actions">
                    <button class="btn-friend btn-friend-profile" data-action="profile" data-username="${escapeHtml(String(request.username || ''))}" type="button" aria-label="👤 Профиль">👤 Профиль</button>
                    <button class="btn-friend btn-friend-cancel" data-action="cancel" data-id="${escapeHtml(String(request.id || ''))}" type="button" aria-label="❌ Отменить">❌ Отменить</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : `<div class="empty-state"><div class="empty-state-icon">📨</div><p>Нет отправленных запросов</p><p class="empty-state-sub">Найдите пользователей и отправьте им запрос в друзья</p></div>`
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
        const res = await apiCall(`/api/search/users?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        searchResults.classList.add('active');

        if (!data?.ok || !Array.isArray(data.users) || data.users.length === 0) {
          searchResults.innerHTML = `
            <div class="search-empty">
              🔍 Пользователи не найдены<br />
              <small class="search-empty-sub">Попробуйте изменить запрос</small>
            </div>
          `;
          return;
        }

        searchResults.innerHTML = `
          <div class="search-count">📋 Найдено: ${data.users.length}</div>
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
                <button class="btn-friend btn-friend-add" data-action="add" data-username="${escapeHtml(String(foundUser.username || ''))}" type="button" aria-label="➕ Добавить">➕ Добавить</button>
                <button class="btn-friend btn-friend-profile" data-action="profile" data-username="${escapeHtml(String(foundUser.username || ''))}" type="button" aria-label="👤 Профиль">👤 Профиль</button>
              </div>
            </div>
          `
            )
            .join('')}
        `;
      } catch (error) {
        const searchMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        searchResults.classList.add('active');
        searchResults.innerHTML = `
          <div class="search-error">
            ⚠️ Ошибка при поиске<br />
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
            api.showMsg('ok', `✅ Запрос отправлен пользователю ${username}!`);
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', data?.error || 'Ошибка при отправке запроса');
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
            api.showMsg('ok', `✅ ${username} добавлен в друзья!`);
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', 'Ошибка при принятии запроса');
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
            api.showMsg('ok', `❌ Запрос от ${username} отклонён`);
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', 'Ошибка при отклонении запроса');
          }
          return;
        }

        if (action === 'remove') {
          if (!id) return;
          const isConfirmed = await deps.confirmModal({
            title: 'Удаление друга',
            text: `Вы уверены, что хотите удалить ${username || 'пользователя'}?`,
            confirmText: 'Удалить',
            cancelText: 'Отмена',
          });
          if (!isConfirmed) return;

          const res = await apiCall('/friends/remove', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId: id }),
          });
          if (res.ok) {
            api.showMsg('ok', `${username || 'Пользователь'} удалён из друзей`);
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', 'Ошибка при удалении друга');
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
            api.showMsg('ok', 'Запрос отменён');
            await loadFriendsTab(api, deps);
          } else {
            api.showMsg('error', 'Ошибка при отмене запроса');
          }
        }
      };

      void handle();
    });
  } catch (error) {
    console.error('Error loading friends:', error);
    container.innerHTML = '<div class="sec-error-text">Ошибка загрузки. Попробуйте обновить страницу.</div>';
  }
}
