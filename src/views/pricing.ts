/**
 * CybLight Premium Pricing Page View with Monobank Jar Integration (1m, 3m, 6m, 1y)
 */

import { getLocale, localePath, t } from '@/i18n';
import { setAppContent } from '@/ui';
import { apiCall, escapeHtml } from '@/utils';
import { PRICING_PLANS, type PricingPlan } from '@/config/pricing-tiers';
import { buildProfileHeader, buildProfileFooter, bindProfileHeaderHandlers } from '@/views/profile';
import '@/styles/account-render.css';

export async function renderPricing(): Promise<void> {
  document.body.classList.add('no-strawberries');

  const urlParams = new URLSearchParams(window.location.search);
  const autoPlanId = urlParams.get('plan')?.toLowerCase() || urlParams.get('tier')?.toLowerCase();

  let currentUser: { id?: string | number; login?: string; username?: string; email?: string; role?: string } | null = null;
  let isPremium = false;
  let premiumUntil: number | null = null;
  let jarSendId = import.meta.env.VITE_MONOBANK_JAR_SEND_ID || 'cyblight_jar';
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;

  // Load user data & jar info in parallel
  try {
    const [meRes, jarRes] = await Promise.allSettled([
      apiCall('/auth/me'),
      apiCall('/premium/mono-jar-info'),
    ]);

    if (meRes.status === 'fulfilled' && meRes.value.ok) {
      const meData = await meRes.value.json().catch(() => ({}));
      if (meData?.ok && meData.user) {
        currentUser = meData.user;
      }
    }

    if (jarRes.status === 'fulfilled' && jarRes.value.ok) {
      const jarData = await jarRes.value.json().catch(() => ({}));
      if (jarData?.ok && jarData.jarInfo?.sendId) {
        jarSendId = jarData.jarInfo.sendId;
      }
    }

    // Also check premium status if user is logged in
    if (currentUser) {
      const statusRes = await apiCall('/premium/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData?.ok) {
          isPremium = Boolean(statusData.isPremium);
          premiumUntil = statusData.premiumUntil ? Number(statusData.premiumUntil) : null;
        }
      }
    }
  } catch (err) {
    console.warn('[PRICING] Error loading user / jar info:', err);
  }

  renderPage();

  // Auto-open modal if requested via URL param
  if (autoPlanId) {
    const matched = PRICING_PLANS.find(
      (p) => p.id.toLowerCase() === autoPlanId || p.id.includes(autoPlanId)
    );
    if (matched) {
      setTimeout(() => openPaymentModal(matched), 300);
    }
  }

  function getFormattedExpiry(): string {
    if (!premiumUntil) return '';
    try {
      return new Date(premiumUntil).toLocaleDateString(getLocale() === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function renderPage(): void {
    const userLogin = currentUser?.login || currentUser?.username || '';

    const planCardsHtml = PRICING_PLANS.map((plan) => {
      const isPopular = Boolean(plan.popular);
      const discountHtml = plan.discountBadge
        ? `<span class="pricing-discount-pill">${escapeHtml(plan.discountBadge)}</span>`
        : '';

      const featuresHtml = plan.features
        .map(
          (feat) => `
          <li class="pricing-feature-item">
            <span class="pricing-feature-check">✓</span>
            <span>${escapeHtml(t(feat))}</span>
          </li>
        `
        )
        .join('');

      return `
        <div class="pricing-card ${isPopular ? 'pricing-card--popular' : ''}">
          ${isPopular ? `<div class="pricing-card-badge">${t('Популярный выбор')}</div>` : ''}
          <div class="pricing-card-header">
            <div class="pricing-card-top-row">
              <span class="pricing-plan-badge">${escapeHtml(plan.badge || '⭐')}</span>
              ${discountHtml}
            </div>
            <h3 class="pricing-card-title">${escapeHtml(t(plan.name))}</h3>
            <div class="pricing-card-price-row">
              <div class="pricing-card-price-main">${plan.priceUah} ₴</div>
              <div class="pricing-card-price-usd">~$${plan.priceUsd}</div>
            </div>
            <div class="pricing-card-period">${escapeHtml(t(plan.periodLabel))}</div>
          </div>

          <ul class="pricing-features-list">
            ${featuresHtml}
          </ul>

          <button
            type="button"
            class="pricing-action-btn ${isPopular ? 'pricing-action-btn--primary' : ''}"
            data-plan-id="${plan.id}"
          >
            ${isPremium ? t('Продлить подписку') : t('Выбрать тариф')}
          </button>
        </div>
      `;
    }).join('');

    const userStatusBanner = currentUser
      ? `
        <div class="pricing-user-status-banner">
          <div class="status-user-info">
            <span class="status-avatar-icon">👑</span>
            <div>
              <div class="status-user-name"><strong>@${escapeHtml(userLogin)}</strong></div>
              <div class="status-badge-text">
                ${
                  isPremium
                    ? `<span style="color:#10b981;font-weight:700;">${t('Premium активен')}</span> (${t('до')} ${getFormattedExpiry()})`
                    : `<span style="color:#94a3b8;">${t('Базовый аккаунт (Free)')}</span>`
                }
              </div>
            </div>
          </div>
          <a href="${localePath('/account-settings')}" class="status-dashboard-link">
            ${t('Настройки профиля')} ›
          </a>
        </div>
      `
      : `
        <div class="pricing-guest-banner">
          <span>${t('Вы не вошли в аккаунт.')}</span>
          <a href="${localePath('/login')}" class="pricing-guest-login-link">${t('Войти в аккаунт')}</a>
          <span>${t('чтобы подписка активировалась на ваш профиль.')}</span>
        </div>
      `;

    const html = `
      <div class="pricing-page-root">
        ${buildProfileHeader('pricing', Boolean(currentUser), userLogin ? `@${userLogin}` : 'CybLight Premium', currentUser?.role, t('Тарифы'))}

        <main class="pricing-wrapper">
          <div class="pricing-hero">
            <h2>${t('Инвестируйте в полный контроль умного дома')}</h2>
            <p>${t('Выберите удобный период: безлимитный Smart Home Hub, приоритетная E2EE синхронизация и эксклюзивные функции.')}</p>
            ${userStatusBanner}
          </div>

          <div class="pricing-cards-grid">
            ${planCardsHtml}
          </div>

          <div class="pricing-monobank-info-card">
            <div class="mono-info-icon">🏦</div>
            <div class="mono-info-content">
              <h4>${t('Безопасная оплата через Monobank Банку')}</h4>
              <p>${t('Оплата картами любого банка мира, Apple Pay или Google Pay без скрытых комиссий. Подписка активируется автоматически после поступления средств.')}</p>
            </div>
          </div>

          <div class="pricing-faq-section">
            <h3>${t('Часто задаваемые вопросы')}</h3>
            <div class="pricing-faq-grid">
              <div class="faq-card">
                <h4>${t('Как происходит оплата?')}</h4>
                <p>${t('Вы переходите в официальную Банку Monobank и оплачиваете любой картой, Apple Pay или Google Pay. В комментарии обязательно указывается ваш логин на сайте CybLight.')}</p>
              </div>
              <div class="faq-card">
                <h4>${t('Как быстро активируется Premium?')}</h4>
                <p>${t('Автоматически в течение 5–60 секунд после подтверждения транзакции банком.')}</p>
              </div>
              <div class="faq-card">
                <h4>${t('Что если у меня уже есть активная подписка?')}</h4>
                <p>${t('Новый период просто прибавится к текущему сроку действия без потери оплаченных дней.')}</p>
              </div>
              <div class="faq-card">
                <h4>${t('Нужна помощь с оплатой?')}</h4>
                <p>${t('Напишите в нашу службу поддержки support@cyblight.org, и мы оперативно поможем.')}</p>
              </div>
            </div>
          </div>
        </main>

        ${buildProfileFooter()}
      </div>

      <!-- Monobank Jar Modal Container -->
      <div id="monoPaymentModalOverlay" class="mono-modal-overlay" style="display:none;"></div>
    `;

    setAppContent(html);
    attachEvents();
  }

  function attachEvents(): void {
    bindProfileHeaderHandlers();

    const buttons = document.querySelectorAll<HTMLButtonElement>('[data-plan-id]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const planId = btn.getAttribute('data-plan-id');
        const plan = PRICING_PLANS.find((p) => p.id === planId);
        if (plan) {
          openPaymentModal(plan);
        }
      });
    });
  }

  function openPaymentModal(plan: PricingPlan): void {
    const overlay = document.getElementById('monoPaymentModalOverlay');
    if (!overlay) return;

    const userLogin = currentUser?.login || currentUser?.username || '';
    const paymentUrl = `https://send.monobank.ua/jar/${jarSendId}?a=${plan.priceUah}${userLogin ? `&t=${encodeURIComponent(userLogin)}` : ''}`;
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=svg&data=${encodeURIComponent(paymentUrl)}`;

    overlay.innerHTML = `
      <div class="mono-modal-card">
        <button type="button" class="mono-modal-close" id="closeMonoModalBtn" aria-label="Закрыть">✕</button>

        <div class="mono-modal-header">
          <div class="mono-modal-jar-icon">🏦</div>
          <div>
            <h3 class="mono-modal-title">${t('Оплата подписки')}</h3>
            <div class="mono-modal-subtitle">${escapeHtml(t(plan.name))} — <strong>${plan.priceUah} ₴</strong> (~$${plan.priceUsd})</div>
          </div>
        </div>

        ${
          !userLogin
            ? `
          <div class="mono-modal-warning-box">
            ⚠️ <strong>${t('Внимание:')}</strong> ${t('Вы не вошли в аккаунт. Перед оплатой введите ваш точный логин CybLight:')}
            <div style="margin-top:8px;">
              <input type="text" id="manualLoginInput" class="mono-input" placeholder="${t('Ваш логин в CybLight')}" value="" />
            </div>
          </div>
        `
            : `
          <div class="mono-modal-account-box">
            <span>${t('Получатель подписки:')}</span>
            <span class="mono-modal-account-pill">@${escapeHtml(userLogin)}</span>
          </div>
        `
        }

        <div class="mono-modal-steps">
          <div class="mono-step-item">
            <span class="mono-step-num">1</span>
            <div class="mono-step-desc">
              ${t('Нажмите кнопку ниже или отсканируйте QR-код для перехода в Банку Monobank:')}
            </div>
          </div>
          <div class="mono-step-item">
            <span class="mono-step-num">2</span>
            <div class="mono-step-desc">
              ${t('Убедитесь, что в поле «Коментар» указан логин')} <strong>@${escapeHtml(userLogin || 'ваш_логин')}</strong>.
            </div>
          </div>
          <div class="mono-step-item">
            <span class="mono-step-num">3</span>
            <div class="mono-step-desc">
              ${t('Оплатите через Apple Pay, Google Pay или карту любого банка.')}
            </div>
          </div>
        </div>

        <div class="mono-modal-actions">
          <a
            href="${paymentUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="mono-pay-btn"
            id="openMonoJarBtn"
            data-skip-external-guard="true"
          >
            <span>🏦 ${t('Оплатить')} ${plan.priceUah} ₴ ${t('в Monobank')}</span>
            <span style="font-size:12px;opacity:0.85;">(Apple Pay / GPay / Карта) ↗</span>
          </a>

          <div class="mono-qr-wrapper">
            <div class="mono-qr-label">${t('Или отсканируйте QR-код телефоном:')}</div>
            <img src="${qrCodeApiUrl}" alt="Monobank QR" class="mono-qr-img" width="160" height="160" />
          </div>

          <div class="mono-check-status-wrap">
            <button type="button" class="mono-check-btn" id="checkMonoPaymentBtn">
              🔄 ${t('Я оплатил (Проверить статус)')}
            </button>
            <div id="monoCheckStatusMsg" class="mono-status-msg">
              <span class="mono-pulse-dot"></span> ${t('Ожидание подтверждения оплаты...')}
            </div>
          </div>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';

    // Modal Close
    document.getElementById('closeMonoModalBtn')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Manual login input listener if guest
    const manualInput = document.getElementById('manualLoginInput') as HTMLInputElement | null;
    if (manualInput) {
      manualInput.addEventListener('input', () => {
        const customLogin = manualInput.value.trim();
        const updatedUrl = `https://send.monobank.ua/jar/${jarSendId}?a=${plan.priceUah}${customLogin ? `&t=${encodeURIComponent(customLogin)}` : ''}`;
        const payBtn = document.getElementById('openMonoJarBtn') as HTMLAnchorElement | null;
        if (payBtn) payBtn.href = updatedUrl;
      });
    }

    // Manual Check Button
    document.getElementById('checkMonoPaymentBtn')?.addEventListener('click', () => {
      checkPaymentStatus(true);
    });

    // Start background auto-polling every 4 seconds
    startPolling();
  }

  function closeModal(): void {
    const overlay = document.getElementById('monoPaymentModalOverlay');
    if (overlay) overlay.style.display = 'none';
    stopPolling();
  }

  function startPolling(): void {
    stopPolling();
    pollIntervalId = setInterval(async () => {
      await checkPaymentStatus(false);
    }, 4000);
  }

  function stopPolling(): void {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  async function checkPaymentStatus(showFeedback = true): Promise<void> {
    const statusMsg = document.getElementById('monoCheckStatusMsg');
    if (showFeedback && statusMsg) {
      statusMsg.innerHTML = `🔄 ${t('Проверяем зачисление...')}`;
    }

    try {
      const res = await apiCall('/premium/check-mono-jar-payment');
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.ok && data.isPremium) {
          stopPolling();
          if (statusMsg) {
            statusMsg.innerHTML = `<span style="color:#10b981;font-weight:700;">✅ ${t('Оплата успешно подтверждена! Premium активирован.')}</span>`;
          }

          // Show success celebration
          setTimeout(() => {
            closeModal();
            renderPricing();
          }, 1500);
          return;
        }
      }

      if (showFeedback && statusMsg) {
        statusMsg.innerHTML = `⏳ ${t('Платёж пока в обработке банком. Обычно это занимает от 5 до 30 секунд.')}`;
      }
    } catch {
      // Ignore background network errors
    }
  }
}
