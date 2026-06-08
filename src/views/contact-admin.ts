/**
 * Contact Admin view - форма обращения к администратору
 */

import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import { escapeHtml, apiCall } from '@/utils';
import { captchaService } from '@/services';

export async function renderContactAdmin(params: Record<string, unknown> = {}): Promise<void> {
  const username = String(params.username ?? '');
  const banContext = String(params.banContext ?? '');

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
          <h1>Обращение к администратору</h1>
        </div>
      </div>

      <form id="fContact">
        <div class="field">
          <label class="label" for="email">Ваш Email *</label>
          <input class="input" id="email" type="email" autocomplete="email" 
            placeholder="name@example.com" required />
        </div>

        <div class="field">
          <label class="label" for="name">Ваше имя</label>
          <input class="input" id="name" type="text" autocomplete="name"
            placeholder="Как к вам обращаться" value="${escapeHtml(username)}" />
        </div>

        <div class="field">
          <label class="label" for="subject">Тема обращения *</label>
          <input class="input" id="subject" type="text" 
            placeholder="Краткое описание проблемы" required 
            value="${banContext ? 'Вопрос по блокировке аккаунта' : ''}" />
        </div>

        <div class="field">
          <label class="label" for="message">Сообщение *</label>
          <textarea class="input" id="message" rows="6" required 
            placeholder="Опишите ситуацию подробно..." style="resize: vertical; min-height: 120px;"></textarea>
        </div>

        <div class="field" style="margin-top:12px;">
          <div class="cf-turnstile"></div>
        </div>

        <div id="msg" class="msg" aria-live="polite" style="display:none;"></div>

        <div class="row" style="margin-top: 12px;">
          <a class="link" href="#" id="back">← Назад</a>
        </div>

        <button class="btn btn-primary" type="submit" aria-label="Отправить сообщение">Отправить сообщение</button>
      </form>

      <p style="margin: 12px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5;">
        Администрация рассмотрит ваше обращение и свяжется с вами по указанному email.
      </p>
    </section>
  `)
  );

  const oldBtn = document.getElementById('scrollTopBtn');
  if (oldBtn) oldBtn.remove();

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

  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.onclick = (e) => {
      e.preventDefault();
      if (banContext) {
        Router.navigate('account-banned', { reason: banContext, username });
      } else {
        Router.navigate('username');
      }
    };
  }

  // Инициализируем Turnstile
  await captchaService.init('cf-turnstile');

  const form = document.getElementById('fContact') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      const oldText = btn.textContent || 'Отправить сообщение';

      clearMsg();

      const email = (document.getElementById('email') as HTMLInputElement).value.trim();
      const name = (document.getElementById('name') as HTMLInputElement).value.trim();
      const subject = (document.getElementById('subject') as HTMLInputElement).value.trim();
      const message = (document.getElementById('message') as HTMLTextAreaElement).value.trim();

      if (!email || !subject || !message) {
        showMsg('error', 'Заполните все обязательные поля');
        return;
      }

      if (!captchaService.token) {
        showMsg('warn', 'Подтвердите, что вы не робот');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Отправка...';

      try {
        const res = await apiCall('/support/contact', {
          method: 'POST',
          body: JSON.stringify({
            email,
            name,
            subject,
            message,
            context: banContext || undefined,
            turnstileToken: captchaService.token,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showMsg('error', data?.error || 'Ошибка при отправке. Попробуйте позже.');
          await captchaService.reset();
          btn.disabled = false;
          btn.textContent = oldText;
          return;
        }

        showMsg(
          'ok',
          '✓ Спасибо! Ваше обращение отправлено. Мы свяжемся с вами в ближайшее время.'
        );
        form.reset();

        setTimeout(() => {
          Router.navigate('username');
        }, 3000);
      } catch (err) {
        console.error('[CONTACT] Error:', err);
        showMsg('error', 'Ошибка сети. Проверьте подключение и попробуйте ещё раз.');
        await captchaService.reset();
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  }
}
