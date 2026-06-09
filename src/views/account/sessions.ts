import { Router } from '@/router/Router';
import type { SessionListItem } from '@/types';
import { apiCall, escapeHtml } from '@/utils';
import { countryFull, fmtTs, getDeviceIconSvg, parseUA } from './device-utils';

type ApiMessage = {
  showMsg: (type: string, text: string, persist?: boolean) => void;
  clearMsg: () => void;
};

export function bindSessionsHandlers(api: ApiMessage): void {
  const sessionsList = document.getElementById('sessionsList');
  if (!sessionsList) return;

  void loadSessions(sessionsList, api);
}

async function loadSessions(container: HTMLElement, api: ApiMessage): Promise<void> {
  try {
    const r = await apiCall('/auth/sessions', {
      credentials: 'include',
    });
    const { data: meData } = await apiCall('/auth/me', {
      credentials: 'include',
    })
      .then((r) => r.json())
      .catch(() => ({ data: {} }));

    const response = await r.json().catch(() => ({}));

    if (!r.ok || !response.ok) {
      container.innerHTML = '<div class="sec-error-text">Ошибка загрузки устройств</div>';
      return;
    }

    const sessions = response.data?.sessions || [];
    const currentSessionId = response.data?.current;
    const sessionsCount = meData?.sessionsCount || sessions.length || 0;

    if (sessions.length === 0) {
      container.innerHTML = '<div class="sec-empty-text">Нет активных сессий</div>';
      return;
    }

    const rows = sessions
      .map((s: SessionListItem) => {
        const ua = parseUA(s.user_agent || '');
        const isCur = s.id === currentSessionId;

        const deviceIconSvg = getDeviceIconSvg(s.user_agent || '', ua);
        const browser = s.browser || ua.browser || 'Browser';
        const os = s.os || ua.os || 'Unknown OS';

        let line1 = '';
        let line2 = '';

        if (ua.isApp) {
          const devName = String(s.device_name || s.device || '').trim();
          line1 = devName && devName.toLowerCase() !== 'pc' ? devName : 'CybLight App';
          line2 = String(s.model || ua.model || '').trim();
        } else {
          line1 = browser;
          line2 = ua.version ? `${browser} ${ua.version}` : '';
        }

        const loc = [s.city, s.region, countryFull(s.country)].filter(Boolean).join(', ') || '—';
        const lastLogin = s.created_at;
        const lastSeen = s.last_seen_at || s.created_at;

        return `
        <tr class="${isCur ? 'is-current' : ''}">
          <td data-label="Device">
            <div class="dev">
              <div class="dev-top">
                <span class="dev-ico" aria-hidden="true">
                  ${deviceIconSvg}
                </span>

                <div class="dev-text">
                  <div class="dev-name-row">
                    <span class="dev-name">${escapeHtml(line1)}</span>
                    ${isCur ? '<span class="pill">Текущая</span>' : ''}
                  </div>
              
                  ${line2 ? `<div class="dev-sub mono">${escapeHtml(line2 || '—')}</div>` : ''}
                </div>
              </div>
            </div>
          </td>

          <td data-label="ОС">${escapeHtml(os)}</td>
          <td data-label="Местоположение" title="Edge: ${s.colo || '—'}">${escapeHtml(loc)}</td>
          <td data-label="Последний вход">${escapeHtml(fmtTs(lastLogin))}</td>
          <td data-label="Последняя активность">${escapeHtml(fmtTs(lastSeen))}</td>

          <td class="td-action td-action--right" data-label="Action">
            <button class="icon-btn" type="button" title="Завершить" data-revoke="${escapeHtml(
              s.id
            )}" aria-label="Завершить">
              ⎋
            </button>
          </td>
        </tr>
      `;
      })
      .join('');

    container.innerHTML = `
    <div class="sessions-head">
      <div class="sessions-count">Активных сессий: <b>${sessionsCount}</b></div>
      <button class="btn btn-outline${sessionsCount <= 1 ? ' is-disabled' : ''}" id="logoutOthersBtn" type="button" ${
        sessionsCount <= 1 ? 'disabled' : ''
      } aria-label="Выход из всех, кроме текущей">
        Выход из всех, кроме текущей
      </button>
    </div>

    <div class="sessions-table-wrap">
      <table class="sessions-table">
        <thead>
          <tr>
            <th>Device</th>
            <th>OS</th>
            <th>Location</th>
            <th>Last Login</th>
            <th>Last Seen</th>
            <th class="th-action">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6" class="td-empty">Нет сессий</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

    container.querySelectorAll('[data-revoke]').forEach((b) => {
      const btn = b as HTMLButtonElement;
      btn.onclick = async () => {
        api.clearMsg();
        const sid = btn.getAttribute('data-revoke');
        if (!sid) return;

        btn.disabled = true;

        try {
          const r2 = await apiCall('/auth/sessions/revoke', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sid }),
          });
          const d = await r2.json().catch(() => ({}));

          if (!r2.ok) {
            api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось завершить сессию.');
          } else {
            api.showMsg('ok', 'Сессия завершена ✅');
            if (d.loggedOut) {
              document.body.classList.remove('no-strawberries');
              Router.navigate('username');
              return;
            }
            setTimeout(() => Router.navigate('account-sessions'), 300);
          }
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          btn.disabled = false;
        }
      };
    });

    const lo = document.getElementById('logoutOthersBtn') as HTMLButtonElement;
    if (lo && !lo.disabled) {
      lo.onclick = async () => {
        api.clearMsg();
        lo.disabled = true;

        try {
          const r2 = await apiCall('/auth/logout-others', {
            method: 'POST',
            credentials: 'include',
          });
          const d = await r2.json().catch(() => ({}));
          if (!r2.ok) api.showMsg('error', d?.error ? `Ошибка: ${d.error}` : 'Не удалось.');
          else api.showMsg('ok', `Готово ✅ Завершено: ${d.removed ?? 0}`);
          setTimeout(() => Router.navigate('account-sessions'), 350);
        } catch {
          api.showMsg('error', 'Ошибка сети.');
        } finally {
          lo.disabled = false;
        }
      };
    }
  } catch (e) {
    console.error('Error loading sessions:', e);
    container.innerHTML = '<div class="sec-error-text">Ошибка сети</div>';
  }
}
