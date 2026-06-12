/**
 * Strawberry History view - галерея фотографий
 */

import { t } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';
import { getStorage, escapeHtml, apiCall } from '@/utils';
import { HISTORY_FROM_KEY } from '@/config/constants';
import { hasStrawberryAccess, setStrawberryAccess } from '@/components/strawberry';
import { pushLocalEasterFlagsToServer } from '@/services';
import { StrawberryLightbox } from '@/components/lightbox';

export async function renderStrawberryHistory(): Promise<void> {
  // Убираем no-strawberries класс
  document.body.classList.remove('no-strawberries');

  // Проверка доступа
  if (!hasStrawberryAccess()) {
    try {
      const res = await apiCall('/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await res.json().catch(() => null);

      const serverHas = !!(
        res.ok &&
        data?.ok &&
        (data?.user?.easter?.strawberry || data?.easter?.strawberry)
      );

      if (serverHas) {
        setStrawberryAccess();
      } else {
        Router.navigate('account');
        return;
      }
    } catch {
      Router.navigate('account');
      return;
    }
  } else {
    void pushLocalEasterFlagsToServer();
  }

  const from = String(getStorage(HISTORY_FROM_KEY, '', sessionStorage) || '');
  const login = getStorage('cyb_login', '', sessionStorage) || t('Гость');

  setAppContent(
    shell(`
    <section class="auth-card strawberry-history">
      <div class="auth-head">
        <div class="brand-logo">
          <img src="/assets/img/logo.svg" alt="CybLight" />
        </div>
        <div class="auth-title">
          <h1>${t('Стенография 🍓')}</h1>
          <span class="brand">${escapeHtml(login)}</span>
        </div>
      </div>

      <p class="strawberry-text">
        ${t('Мы зафиксировали необычную активность.')}<br>
        ${t('Этот клубничный дождь не зря тут падает…')}
      </p>

      <div class="strawberry-grid">
        <img src="/assets/img/strawberries/1-StrwAlex.png" alt="🍓Alex">
        <img src="/assets/img/strawberries/2.webp" alt="🍓 Alex">
        <img src="/assets/img/strawberries/3.jpg" alt="🍓 Alex">
        <img src="/assets/img/strawberries/4.jpg" alt="🍓 Izzzi">
        <img src="/assets/img/strawberries/5.jpg" alt="🍓 CybLight">
        <img src="/assets/img/strawberries/6.jpg" alt="🍓 Alex">
        <img src="/assets/img/strawberries/7.jpg" alt="🍓 Vlad">
        <img src="/assets/img/strawberries/8.jpg" alt="🍓 Izzzi">
      </div>

      <button class="btn btn-primary" id="toUsername" aria-label="${from === 'account-easter-eggs' ? t('← Вернуться назад') : t('Продолжить')}">
         ${from === 'account-easter-eggs' ? t('← Вернуться назад') : t('Продолжить')}
      </button>
    </section>
  `)
  );

  // Scroll top button
  const old = document.getElementById('scrollTopBtn');
  if (old) old.remove();

  const scrollBtn = document.createElement('div');
  scrollBtn.id = 'scrollTopBtn';
  scrollBtn.textContent = '⬆';
  document.body.appendChild(scrollBtn);

  scrollBtn.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Глобальный обработчик скролла
  if (!window.__history_scroll_bound) {
    window.__history_scroll_bound = true;

    window.__history_scroll_handler = () => {
      const btn = document.getElementById('scrollTopBtn');
      if (!btn) return;

      if (window.scrollY > 300) btn.classList.add('show');
      else btn.classList.remove('show');
    };

    window.addEventListener('scroll', window.__history_scroll_handler, {
      passive: true,
    });
  }

  // Обновляем видимость
  window.__history_scroll_handler?.();

  // Lightbox для изображений
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.strawberry-grid img'));
  const sources = imgs.map((img) => img.src);
  const captions = imgs.map((img) => img.alt);

  imgs.forEach((img, i) => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      StrawberryLightbox.open({ sources, captions }, i);
    });
  });

  // Кнопка "Продолжить"
  const toUsernameBtn = document.getElementById('toUsername');
  if (toUsernameBtn) {
    toUsernameBtn.onclick = () => {
      const from2 = String(getStorage(HISTORY_FROM_KEY, '', sessionStorage) || '');
      if (from2 === 'account-easter-eggs') {
        sessionStorage.removeItem(HISTORY_FROM_KEY);
        Router.navigate('account-easter-eggs');
      } else {
        Router.navigate('username');
      }
    };
  }
}
