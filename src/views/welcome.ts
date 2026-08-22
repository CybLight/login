/**
 * Welcome View - Success page after successful Paddle Checkout redirect (/welcome)
 */

import { t } from '@/i18n';
import { Router } from '@/router/Router';
import { setAppContent, shell } from '@/ui';

export function renderWelcome(): void {
  // Убираем no-strawberries класс для праздничного фона
  document.body.classList.remove('no-strawberries');

  setAppContent(
    shell(`
    <div style="width: 100%; max-width: 580px; margin: 40px auto; padding: 20px;">
      <section class="auth-card" style="
        border-radius: 28px;
        background: linear-gradient(160deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%);
        border: 1px solid rgba(251, 191, 36, 0.6);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.8), 0 0 40px rgba(234, 179, 8, 0.2);
        padding: 40px 32px;
        text-align: center;
        position: relative;
        overflow: hidden;
      ">
        
        <!-- Glow accent -->
        <div style="
          position: absolute;
          top: -80px;
          left: 50%;
          transform: translateX(-50%);
          width: 220px;
          height: 220px;
          background: radial-gradient(circle, rgba(234, 179, 8, 0.3) 0%, rgba(234, 179, 8, 0) 70%);
          border-radius: 50%;
          pointer-events: none;
        "></div>

        <!-- Success Badge -->
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(245, 158, 11, 0.3));
          color: #fef08a;
          border: 1px solid rgba(251, 191, 36, 0.7);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 24px;
        ">
          <span>🎉</span>
          <span>${t('Оплата успешно завершена')}</span>
        </div>

        <!-- Icon Box -->
        <div style="
          width: 96px;
          height: 96px;
          margin: 0 auto 24px;
          border-radius: 28px;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.3) 0%, rgba(245, 158, 11, 0.1) 100%);
          border: 2px solid rgba(251, 191, 36, 0.8);
          box-shadow: 0 0 30px rgba(234, 179, 8, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
        ">
          👑
        </div>

        <h1 style="
          font-size: clamp(26px, 4vw, 32px);
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.8px;
          margin: 0 0 12px 0;
          background: linear-gradient(135deg, #ffffff 0%, #fef08a 50%, #f59e0b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        ">
          ${t('Добро пожаловать в CybLight!')}
        </h1>

        <p style="font-size: 15px; color: #cbd5e1; line-height: 1.55; margin: 0 0 28px 0;">
          ${t('Ваша подписка успешно оформлена через Paddle. Все привилегии тарифа, увеличенные лимиты API и функции Smart Home Hub активированы.')}
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button 
            type="button" 
            class="btn btn-primary" 
            id="welcomeGoProfileBtn"
            style="
              width: 100%;
              padding: 14px 24px;
              border-radius: 14px;
              font-size: 15px;
              font-weight: 800;
              background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%);
              color: #000000;
              border: none;
              cursor: pointer;
              box-shadow: 0 4px 20px rgba(234, 179, 8, 0.4);
            "
          >
            <span>🚀 ${t('Перейти в личный кабинет')}</span>
          </button>

          <button 
            type="button" 
            class="btn btn-outline" 
            id="welcomeGoHomeBtn"
            style="
              width: 100%;
              padding: 12px 24px;
              border-radius: 14px;
              font-size: 14px;
              font-weight: 600;
              color: #94a3b8;
              border: 1px solid rgba(255, 255, 255, 0.12);
              background: transparent;
              cursor: pointer;
            "
          >
            ${t('На главную страницу')}
          </button>
        </div>
      </section>
    </div>
  `)
  );

  document.getElementById('welcomeGoProfileBtn')?.addEventListener('click', () => {
    Router.navigate('account-profile');
  });

  document.getElementById('welcomeGoHomeBtn')?.addEventListener('click', () => {
    Router.navigate('username');
  });
}
