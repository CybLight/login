/**
 * CybLight Premium Pricing Page View with Monobank Jar Integration (1m, 3m, 6m, 1y)
 */

import { getLocale, getLocaleLabel, localePath, sitePath, t, type Locale } from '@/i18n';
import { setAppContent } from '@/ui';
import { apiCall, escapeHtml } from '@/utils';
import { PRICING_PLANS, type PricingPlan } from '@/config/pricing-tiers';

export async function renderPricing(): Promise<void> {
  document.body.classList.add('no-strawberries');

  const urlParams = new URLSearchParams(window.location.search);
  const autoPlanId = urlParams.get('plan')?.toLowerCase() || urlParams.get('tier')?.toLowerCase();

  let currentUser: { id?: string | number; login?: string; username?: string; email?: string } | null = null;
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

    const locale = getLocale();

    const html = `
      <div class="pricing-page-root">
        ${buildPricingHeader(userLogin, locale)}

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
                <p>${t('Вы переходите в официальную Банку Monobank и оплачиваете любой картой, Apple Pay или Google Pay. В комментарии обязательно указывается ваш логин CybLight.')}</p>
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

        ${buildPricingFooter(locale)}
      </div>

      <!-- Monobank Jar Modal Container -->
      <div id="monoPaymentModalOverlay" class="mono-modal-overlay" style="display:none;"></div>
    `;

    setAppContent(html);
    attachEvents();
  }

  function buildPricingHeader(userLogin: string, locale: Locale): string {
    const homeUrl = sitePath('', locale);
    const flagMap: Record<Locale, string> = {
      ru: '🇷🇺',
      uk: '🇺🇦',
      en: '🇬🇧',
    };

    const navItems = [
      { label: t('Главная'), url: sitePath('', locale), active: false },
      { label: 'Smart Home Hub', url: sitePath('/smarthomehub/', locale), active: false },
      { label: t('Приложение'), url: sitePath('/downloads/', locale), active: false },
      { label: t('Решения'), url: sitePath('/projects/', locale), active: false },
      { label: t('Тарифы'), url: localePath('/pricing', locale), active: true },
      { label: t('Контакты'), url: sitePath('/contacts/', locale), active: false },
    ];

    return `
      <header class="pricing-site-header">
        <div class="header-top">
          <div class="header-container">
            <div class="site-logo-global">
              <a href="${homeUrl}" aria-label="${t('Главная страница CybLight')}" title="${t('Открыть главную страницу')}">
                <img src="/assets/img/logo.svg" class="logo-global" alt="CybLight Logo" />
              </a>
            </div>

            <h2 class="siteName">CybLight</h2>

            <div class="header-top-right">
              <div class="header-lang-wrap">
                <button type="button" class="header-link header-lang" id="pricingLangBtn" aria-haspopup="listbox" aria-expanded="false">
                  <span class="icon-24">
                    <svg class="cl-language" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;">
                      <path fill="currentColor" d="M3.814 16.464a.501.501 0 00.65-.278L5.54 13.5h2.923l1.074 2.686a.5.5 0 00.928-.372l-3-7.5a.52.52 0 00-.928 0l-3 7.5a.5.5 0 00.278.65zM7 9.846L8.061 12.5H5.94zM6 7.5a.5.5 0 00.224-.053l2-1a.5.5 0 10-.448-.894l-2 1A.5.5 0 006 7.5zM11.75 14.25a2.025 2.025 0 001.75 2.25 2.584 2.584 0 001.482-.431c.039.088.07.152.075.162a.5.5 0 00.887-.461 4.654 4.654 0 01-.15-.368c.176-.168.359-.348.56-.548a11.374 11.374 0 001.92-2.652A1.55 1.55 0 0119 13.5a2.082 2.082 0 01-1.607 2.012.5.5 0 00.107.988.506.506 0 00.107-.012A3.055 3.055 0 0020 13.5a2.542 2.542 0 00-1.283-2.205c.16-.364.244-.6.255-.63a.5.5 0 10-.944-.33 7.97 7.97 0 01-.225.552 5.11 5.11 0 00-2.482-.21c.04-.428.091-.845.153-1.229 1.427-.123 3.04-.44 3.124-.458a.5.5 0 00-.196-.98c-.019.003-1.43.283-2.736.418.162-.761.31-1.273.313-1.284a.5.5 0 10-.958-.288c-.016.053-.206.695-.393 1.64-.041 0-.088.004-.128.004h-2a.5.5 0 000 1h1.955c-.072.476-.134.985-.17 1.517a4.001 4.001 0 00-2.535 3.233zm1.75 1.25c-.362 0-.75-.502-.75-1.25a2.82 2.82 0 011.506-2.094 11.674 11.674 0 00.384 2.927 1.684 1.684 0 01-1.14.417zm2.604-3.897a4.4 4.4 0 011.251.193 10.325 10.325 0 01-1.708 2.35l-.163.162A11.04 11.04 0 0115.25 12c0-.093.008-.185.01-.278a3.318 3.318 0 01.844-.12z M22.5 3h-21a.5.5 0 00-.5.5v16a.5.5 0 00.5.5H10v3.5a.5.5 0 00.854.354L14.707 20H22.5a.5.5 0 00.5-.5v-16a.5.5 0 00-.5-.5zM22 19h-7.5a.5.5 0 00-.354.146L11 22.293V19.5a.5.5 0 00-.5-.5H2V4h20z"></path>
                    </svg>
                  </span>
                  <span class="header-label">${flagMap[locale]} ${getLocaleLabel(locale)}</span>
                </button>
                <ul class="header-lang-menu" id="pricingLangMenu" role="listbox" hidden>
                  <li><a href="${localePath('/pricing', 'ru')}">🇷🇺 Русский</a></li>
                  <li><a href="${localePath('/pricing', 'uk')}">🇺🇦 Українська</a></li>
                  <li><a href="${localePath('/pricing', 'en')}">🇬🇧 English</a></li>
                </ul>
              </div>

              <a href="${localePath('/pricing', locale)}" class="header-link header-premium active" title="CybLight Premium">
                <span class="icon-24" aria-hidden="true">👑</span>
                <span class="header-label">Premium</span>
              </a>

              ${
                userLogin
                  ? `<a href="${localePath('/account-profile', locale)}" class="header-link header-login" title="${t('Мой профиль')}">
                      <span class="icon-24" aria-hidden="true">👤</span>
                      <span class="header-label">@${escapeHtml(userLogin)}</span>
                    </a>`
                  : `<a href="${localePath('/login', locale)}" class="header-link header-login" title="${t('Войти')}">
                      <span class="icon-24">
                        <svg class="cl-login" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;">
                          <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 4a3 3 0 1 1-3 3a3 3 0 0 1 3-3m0 14.2a8.21 8.21 0 0 1-5.79-2.38a4.25 4.25 0 0 1 5.79-3.82a4.25 4.25 0 0 1 5.79 3.82A8.21 8.21 0 0 1 12 20.2"></path>
                        </svg>
                      </span>
                      <span class="header-label">${t('Войти')}</span>
                    </a>`
              }
            </div>
          </div>
        </div>

        <nav class="header-nav">
          <div class="header-container">
            <ul class="nav-buttons">
              ${navItems
                .map(
                  (item) => `
                <li>
                  <a class="nav-button ${item.active ? 'active' : ''}" href="${item.url}">
                    ${item.label}
                  </a>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>
        </nav>
      </header>
    `;
  }

  function buildPricingFooter(locale: Locale): string {
    const termsUrl = sitePath('/terms/', locale);
    const privacyUrl = sitePath('/privacy/', locale);
    const refundUrl = sitePath('/refund/', locale);
    const statusUrl = sitePath('/status/', locale);
    const contactAdminUrl = localePath('/contact-admin', locale);

    return `
      <footer class="pricing-site-footer">
        <div class="footer-top">
          <div class="footer-container">
            <div class="footer-top-inner">
              <button class="footer-report" type="button" data-report-modal-open>
                <img src="/assets/img/report.svg" alt="" class="report-icon" aria-hidden="true" />
                <span>${t('Сообщить о проблеме')}</span>
              </button>

              <a class="footer-status-btn" href="${statusUrl}" target="_blank" rel="noopener" title="${t('Статус платформы CybLight')}">
                <span class="cyb-status-dot"></span>
                <span>CybLight Status</span>
              </a>

              <a class="hacked-btn" href="${contactAdminUrl}">
                <img src="/assets/img/account-alert.svg" alt="" class="hacked-icon" aria-hidden="true" />
                <span>${t('Взломали аккаунт?')}</span>
              </a>
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <div class="footer-container">
            <div class="footer-bottom-inner">
              <div class="footer-copyright">
                <p>Copyright &copy; ${new Date().getFullYear()} CybLight</p>
              </div>

              <div class="footer-text">
                <p>${t('CybLight — Программные решения и облачная инфраструктура для IoT и умного дома. Все права защищены.')}</p>
              </div>

              <div class="footer-links">
                <a href="${termsUrl}" target="_blank" rel="noopener">${t('УСЛОВИЯ ИСПОЛЬЗОВАНИЯ')}</a>
                &nbsp;|&nbsp;
                <a href="${privacyUrl}" target="_blank" rel="noopener">${t('ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ')}</a>
                &nbsp;|&nbsp;
                <a href="${refundUrl}" target="_blank" rel="noopener">${t('ПОЛИТИКА ВОЗВРАТА')}</a>
                &nbsp;|&nbsp;
                <a href="#" class="jsPrivacySettings">${t('НАСТРОЙКИ КОНФИДЕНЦИАЛЬНОСТИ')}</a>
              </div>
            </div>
          </div>
        </div>
        <div class="cyb-dev-footer-strip" aria-hidden="true"></div>
      </footer>
    `;
  }

  function attachEvents(): void {
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

    // Language dropdown in header
    const langBtn = document.getElementById('pricingLangBtn');
    const langMenu = document.getElementById('pricingLangMenu');
    if (langBtn && langMenu) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = langMenu.hasAttribute('hidden');
        if (isHidden) {
          langMenu.removeAttribute('hidden');
          langBtn.setAttribute('aria-expanded', 'true');
        } else {
          langMenu.setAttribute('hidden', '');
          langBtn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('click', () => {
        langMenu.setAttribute('hidden', '');
        langBtn.setAttribute('aria-expanded', 'false');
      });
    }
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
