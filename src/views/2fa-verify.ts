/**
 * 2FA Verify view - подтверждение двухфакторной аутентификации
 */

import { t } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import { getStorage, apiCall } from '@/utils';

export async function render2FAVerify(): Promise<void> {
  const userId = getStorage('cyb_2fa_userId', '', sessionStorage);
  if (!userId) {
    Router.navigate('username');
    return;
  }

  // Убираем no-strawberries класс
  document.body.classList.remove('no-strawberries');

  setAppContent(
    shell(`
    <section class="auth-card">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Двухфакторная аутентификация')}</h1>
        </div>
      </div>

      <p style="margin:0 0 16px;color:var(--muted);font-size:13px;text-align:center;">
        ${t('Введите код из приложения аутентификатора или резервный код.')}
      </p>

      <form id="f2fa">
        <div class="field">
          <label class="label" for="code2fa">${t('Код подтверждения')}</label>
          <input class="input" id="code2fa" type="text" inputmode="numeric" 
                 autocomplete="one-time-code" required 
                 placeholder="000000" maxlength="20" 
                 style="text-align:center;font-size:20px;letter-spacing:4px;" />
        </div>

        <div style="margin:12px 0;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;">
            <input type="checkbox" id="rememberDevice" style="cursor:pointer;" />
            <span>${t('Запомнить устройство на 30 дней')}</span>
          </label>
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <div class="row" style="margin-top:10px;">
          <a class="link" href="#" id="back">${t('← Назад')}</a>
        </div>

        <button class="btn btn-primary" type="submit" aria-label="${t('Подтвердить')}">${t('Подтвердить')}</button>
      </form>
    </section>
  `)
  );

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.onclick = (e) => {
      e.preventDefault();
      sessionStorage.removeItem('cyb_2fa_userId');
      Router.navigate('username');
    };
  }

  const msgEl = document.getElementById('msg');
  const showMsg = (type: string, text: string) => {
    if (!msgEl) return;
    msgEl.style.display = '';
    msgEl.className = `msg msg--${type}`;
    msgEl.textContent = text;
  };
  const clearMsg = () => {
    if (!msgEl) return;
    msgEl.style.display = 'none';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  };

  const codeInput = document.getElementById('code2fa') as HTMLInputElement;
  if (codeInput) {
    codeInput.addEventListener('input', clearMsg);
    codeInput.focus();
  }

  const form = document.getElementById('f2fa') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg();

      const code = codeInput.value.trim();
      if (!code) {
        showMsg('error', t('Введите код'));
        return;
      }

      const rememberDeviceCheckbox = document.getElementById('rememberDevice') as HTMLInputElement;
      const rememberDevice = rememberDeviceCheckbox?.checked || false;

      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      const oldText = btn.textContent || t('Подтвердить');
      btn.disabled = true;
      btn.textContent = t('Проверка...');

      try {
        const res = await apiCall('/auth/2fa/verify', {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            userId,
            code,
            rememberDevice,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showMsg('error', data?.error || t('Неверный код'));
          btn.disabled = false;
          btn.textContent = oldText;
          codeInput.value = '';
          codeInput.focus();
          return;
        }

        // Успешная верификация
        showMsg('ok', t('Код подтверждён! Переход...'));

        // Очищаем временный userId
        sessionStorage.removeItem('cyb_2fa_userId');

        // Если получили deviceToken, сохраняем
        if (data.deviceToken) {
          localStorage.setItem('cyb_device_token', data.deviceToken);
        }

        setTimeout(() => {
          Router.navigate('account-profile');
        }, 1000);
      } catch (err) {
        console.error('[2FA] Error:', err);
        showMsg('error', t('Ошибка сети. Попробуйте ещё раз.'));
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  }
}
