/**
 * 3-Tier Pricing Page View with Paddle Live / Sandbox Checkout
 */

import { getLocale, getLocaleLabel, localePath, sitePath, t } from '@/i18n';
import { setAppContent } from '@/ui';
import { buildAuthFooter } from '@/ui/auth-footer';
import { apiCall, escapeHtml } from '@/utils';
import { Router } from '@/router/Router';
import { PRICING_TIERS } from '@/config/pricing-tiers';
import { getPaddlePricePreview, openPaddleCheckout, getPaddleInstance } from '@/services/paddle';
import type { PricePreviewResponse } from '@paddle/paddle-js';

type BillingInterval = 'month' | 'year';

export async function renderPricing(): Promise<void> {
  // Отключаем фоновую анимацию клубничек для чистого строгого вида
  document.body.classList.add('no-strawberries');

  const urlParams = new URLSearchParams(window.location.search);
  const autoTier = urlParams.get('tier')?.toLowerCase();
  const autoInterval = urlParams.get('interval')?.toLowerCase();

  let currentInterval: BillingInterval = (autoInterval === 'year' || autoInterval === 'yearly') ? 'year' : 'month';
  let detectedCountry: string | undefined = undefined;
  let pricePreviewData: PricePreviewResponse | null = null;
  let isLoadingPrices = true;
  let configError: string | null = null;
  let userEmail: string | undefined = undefined;
  let currentUser: { id?: number | string; login?: string; username?: string; email?: string } | null = null;
  let hasAutoOpenedCheckout = false;

  // Render initial loading state
  renderPage();

  // Load user data if signed in
  try {
    const meRes = await apiCall('/auth/me');
    if (meRes.ok) {
      const meData = await meRes.json().catch(() => ({}));
      if (meData?.ok && meData.user) {
        currentUser = meData.user;
        if (meData.user.email) {
          userEmail = meData.user.email;
        }
      }
    }
  } catch {
    // Non-blocking: guests can also purchase
  }

  // Detect country server-side
  try {
    const geoRes = await apiCall('/geo');
    if (geoRes.ok) {
      const geoData = await geoRes.json().catch(() => ({}));
      if (geoData?.ok && geoData.country && /^[A-Z]{2}$/i.test(geoData.country)) {
        detectedCountry = geoData.country.toUpperCase();
      }
    }
  } catch (err) {
    console.warn('[PADDLE] Geo detection error, will use IP-based fallback:', err);
  }

  // Load price preview from Paddle
  try {
    await getPaddleInstance();

    // Collect all price IDs (both monthly and yearly for all tiers)
    const allPriceIds = PRICING_TIERS.flatMap((tier) => [tier.priceId.month, tier.priceId.year]).filter(Boolean);

    pricePreviewData = await getPaddlePricePreview(allPriceIds, detectedCountry);
    isLoadingPrices = false;
  } catch (err: unknown) {
    console.error('[PADDLE] Initialization or PricePreview error:', err);
    isLoadingPrices = false;
    configError = err instanceof Error ? err.message : 'Не удалось загрузить цены Paddle. Проверьте настройки конфигурации в .env.';
  }

  renderPage();

  // Auto-open Paddle Checkout if ?tier= was requested
  if (!hasAutoOpenedCheckout && autoTier && !isLoadingPrices) {
    hasAutoOpenedCheckout = true;
    const matchedTier = PRICING_TIERS.find((t) => t.name.toLowerCase() === autoTier);
    if (matchedTier) {
      const activePriceId = matchedTier.priceId[currentInterval];
      if (activePriceId) {
        setTimeout(async () => {
          try {
            await openPaddleCheckout({
              priceId: activePriceId,
              userEmail,
              countryCode: detectedCountry,
              customData: {
                userId: currentUser?.id ? String(currentUser.id) : '',
                userLogin: currentUser?.login || currentUser?.username || '',
                tier: matchedTier.name,
                interval: currentInterval,
              },
            });
          } catch (err) {
            console.warn('[PADDLE] Auto-checkout open failed:', err);
          }
        }, 350);
      }
    }
  }

  function getFormattedPrice(priceId: string): string {
    if (isLoadingPrices) {
      return '...';
    }

    if (!pricePreviewData || !pricePreviewData.data?.details?.lineItems) {
      return '—';
    }

    const item = pricePreviewData.data.details.lineItems.find(
      (li) => li.price?.id === priceId
    );

    if (item && item.formattedTotals?.total) {
      return item.formattedTotals.total;
    }

    return '—';
  }

  function renderPage(): void {
    const tierCardsHtml = PRICING_TIERS.map((tier) => {
      const activePriceId = tier.priceId[currentInterval];
      const formattedPrice = getFormattedPrice(activePriceId);
      const isPopular = Boolean(tier.popular);
      const intervalLabel = currentInterval === 'year' ? t('/ год') : t('/ мес');

      const featuresHtml = tier.features
        .map(
          (feat) => `
          <li style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; font-size: 14px; color: #cbd5e1; line-height: 1.4;">
            <span style="color: #10b981; font-weight: 900; font-size: 16px; line-height: 1; flex-shrink: 0; margin-top: 2px;">✓</span>
            <span>${escapeHtml(t(feat))}</span>
          </li>
        `
        )
        .join('');

      return `
        <div class="pricing-card ${isPopular ? 'pricing-card--popular' : ''}" style="
          position: relative;
          background: ${isPopular ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)' : 'rgba(15, 23, 42, 0.85)'};
          border: 1px solid ${isPopular ? 'rgba(251, 191, 36, 0.7)' : 'rgba(255, 255, 255, 0.12)'};
          border-radius: 24px;
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          box-shadow: ${isPopular ? '0 20px 50px -10px rgba(234, 179, 8, 0.25), 0 0 30px rgba(234, 179, 8, 0.15)' : '0 10px 30px rgba(0, 0, 0, 0.5)'};
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: ${isPopular ? 'scale(1.03)' : 'none'};
          z-index: ${isPopular ? '2' : '1'};
        ">
          ${
            tier.badge
              ? `
            <div style="
              position: absolute;
              top: -14px;
              left: 50%;
              transform: translateX(-50%);
              background: linear-gradient(135deg, #f59e0b, #eab308);
              color: #000;
              font-size: 11px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              padding: 4px 14px;
              border-radius: 999px;
              box-shadow: 0 4px 14px rgba(234, 179, 8, 0.4);
            ">
              ${escapeHtml(t(tier.badge))}
            </div>
          `
              : ''
          }

          <div style="margin-bottom: 20px; text-align: center;">
            <h3 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0; letter-spacing: -0.5px;">
              ${escapeHtml(tier.name)}
            </h3>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.45; min-height: 38px; margin: 0;">
              ${escapeHtml(t(tier.description))}
            </p>
          </div>

          <div style="margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
            <div style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
              <span style="font-size: 38px; font-weight: 900; color: #ffffff; letter-spacing: -1px; font-variant-numeric: tabular-nums;">
                ${escapeHtml(formattedPrice)}
              </span>
              <span style="font-size: 14px; font-weight: 600; color: #94a3b8;">
                ${escapeHtml(intervalLabel)}
              </span>
            </div>
            ${
              currentInterval === 'year'
                ? `<div style="font-size: 12px; color: #38bdf8; font-weight: 600; margin-top: 4px; text-align: center;">⚡ ${t('Выгодная годовая подписка')}</div>`
                : ''
            }
          </div>

          <ul style="list-style: none; padding: 0; margin: 0 0 32px 0; flex: 1;">
            ${featuresHtml}
          </ul>

          <button 
            type="button"
            class="subscribe-btn"
            data-tier="${escapeHtml(tier.name)}"
            data-price-id="${escapeHtml(activePriceId)}"
            style="
              width: 100%;
              padding: 14px 20px;
              border-radius: 14px;
              font-size: 15px;
              font-weight: 800;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              border: none;
              background: ${isPopular ? 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)' : 'rgba(255, 255, 255, 0.1)'};
              color: ${isPopular ? '#000000' : '#ffffff'};
              box-shadow: ${isPopular ? '0 4px 20px rgba(234, 179, 8, 0.4)' : 'none'};
            "
          >
            <span>${t('Оформить')} ${escapeHtml(tier.name)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    setAppContent(`
      <style>
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
          align-items: stretch;
          margin-bottom: 48px;
          width: 100%;
        }
        @media (max-width: 992px) {
          .pricing-grid {
            grid-template-columns: 1fr;
            max-width: 480px;
            margin-left: auto;
            margin-right: auto;
          }
        }
      </style>
      <div class="account-page pricing-view" style="min-height: 100vh; display: flex; flex-direction: column; background: transparent;">
        ${buildPricingHeader()}
        <main id="main-content" class="auth-center" tabindex="-1" style="flex: 1; width: 100%; display: flex; justify-content: center; padding: 0;">
          <div class="pricing-page" style="width: 100%; max-width: 1160px; margin: 0 auto; padding: 28px 14px 80px;">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 36px;">
              <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 999px; background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.35); color: #fef08a; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 16px;">
                <span>👑</span>
                <span>${t('Тарифные планы CybLight')}</span>
              </div>
              <h1 style="font-size: clamp(32px, 5vw, 48px); font-weight: 900; color: #ffffff; letter-spacing: -1.2px; margin: 0 0 14px 0; background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                ${t('Выберите идеальный план для себя')}
              </h1>
              <p style="font-size: 16px; color: #94a3b8; max-width: 620px; margin: 0 auto; line-height: 1.5;">
                ${t('Прозрачная оплата через Paddle с безопасной защитой, автоматической конвертацией валют и мгновенной активацией.')}
              </p>
            </div>

            ${
              configError
                ? `
              <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 16px; padding: 16px 20px; margin-bottom: 30px; color: #fca5a5; font-size: 14px; text-align: center;">
                <strong>⚠️ ${t('Ошибка конфигурации Paddle')}:</strong> ${escapeHtml(configError)}
              </div>
            `
                : ''
            }

            <!-- Billing Interval Toggle -->
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 44px;">
              <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; padding: 4px; display: inline-flex; align-items: center; position: relative;">
                <button 
                  type="button" 
                  id="billingMonthlyBtn" 
                  style="
                    padding: 10px 24px;
                    border-radius: 999px;
                    font-size: 14px;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: ${currentInterval === 'month' ? 'linear-gradient(135deg, #f59e0b, #eab308)' : 'transparent'};
                    color: ${currentInterval === 'month' ? '#000000' : '#94a3b8'};
                  "
                >
                  ${t('Ежемесячно')}
                </button>
                <button 
                  type="button" 
                  id="billingYearlyBtn" 
                  style="
                    padding: 10px 24px;
                    border-radius: 999px;
                    font-size: 14px;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: ${currentInterval === 'year' ? 'linear-gradient(135deg, #f59e0b, #eab308)' : 'transparent'};
                    color: ${currentInterval === 'year' ? '#000000' : '#94a3b8'};
                  "
                >
                  <span>${t('Ежегодно')}</span>
                  <span style="font-size: 11px; font-weight: 900; background: ${currentInterval === 'year' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(34, 197, 94, 0.2)'}; color: ${currentInterval === 'year' ? '#000' : '#4ade80'}; padding: 2px 8px; border-radius: 999px;">-20%</span>
                </button>
              </div>
            </div>

            <!-- 3 Tiers Grid -->
            <div class="pricing-grid">
              ${tierCardsHtml}
            </div>

            <!-- Security & Payment Methods Footer -->
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 22px 24px; text-align: center; max-width: 860px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
              <div style="display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px;">
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); color: #e2e8f0; font-size: 13.5px; font-weight: 700; white-space: nowrap;">
                  <span style="font-size: 17px; line-height: 1;">🔒</span>
                  <span>${t('Безопасная оплата через Paddle')}</span>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); color: #e2e8f0; font-size: 13.5px; font-weight: 700; white-space: nowrap;">
                  <span style="font-size: 17px; line-height: 1;">💳</span>
                  <span>Visa / Mastercard</span>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); color: #e2e8f0; font-size: 13.5px; font-weight: 700; white-space: nowrap;">
                  <span style="font-size: 17px; line-height: 1;">🍏</span>
                  <span>Apple Pay</span>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); color: #e2e8f0; font-size: 13.5px; font-weight: 700; white-space: nowrap;">
                  <span style="font-size: 17px; line-height: 1;">🌐</span>
                  <span>Google Pay</span>
                </div>
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 0 0 10px 0; line-height: 1.4;">
                ${t('Подписку можно отменить в любой момент в личном кабинете. Никаких скрытых платежей.')}
              </p>
              <p style="font-size: 12.5px; color: #94a3b8; margin: 0; line-height: 1.5;">
                ${t('Платежи безопасно обрабатываются Paddle. Оформляя подписку, вы соглашаетесь с {termsLink}, {privacyLink} и {refundLink} (14 дней гарантии возврата средств).', {
                  termsLink: `<a href="${sitePath('terms', getLocale())}" target="_blank" rel="noopener" style="color: #93c5fd; text-decoration: underline;">${t('Условиями использования')}</a>`,
                  privacyLink: `<a href="${sitePath('privacy', getLocale())}" target="_blank" rel="noopener" style="color: #93c5fd; text-decoration: underline;">${t('Политикой конфиденциальности')}</a>`,
                  refundLink: `<a href="${sitePath('refund', getLocale())}" target="_blank" rel="noopener" style="color: #93c5fd; text-decoration: underline;">${t('Политикой возврата')}</a>`,
                })}
              </p>
            </div>

          </div>
        </main>
        ${buildAuthFooter({ showLangSwitcher: false, showHackedLink: false })}
      </div>
    `);

    // Bind event listeners
    const langBtn = document.getElementById('pricingLangBtn');
    const langMenu = document.getElementById('pricingLangMenu');
    langBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = langMenu?.hasAttribute('hidden');
      if (isHidden) {
        langMenu?.removeAttribute('hidden');
        langBtn.setAttribute('aria-expanded', 'true');
      } else {
        langMenu?.setAttribute('hidden', '');
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('click', () => {
      langMenu?.setAttribute('hidden', '');
      langBtn?.setAttribute('aria-expanded', 'false');
    });

    document.getElementById('pricingAccountBtn')?.addEventListener('click', () => {
      Router.navigate('account-profile');
    });

    document.getElementById('pricingSigninBtn')?.addEventListener('click', () => {
      Router.navigate('login');
    });

    document.getElementById('billingMonthlyBtn')?.addEventListener('click', () => {
      if (currentInterval !== 'month') {
        currentInterval = 'month';
        renderPage();
      }
    });

    document.getElementById('billingYearlyBtn')?.addEventListener('click', () => {
      if (currentInterval !== 'year') {
        currentInterval = 'year';
        renderPage();
      }
    });

    document.querySelectorAll('.subscribe-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget as HTMLButtonElement;
        const priceId = button.dataset.priceId;
        const tierName = button.dataset.tier;

        if (!priceId) return;

        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span>⏳ ${t('Открытие кассы...')}</span>`;

        try {
          await openPaddleCheckout({
            priceId,
            userEmail,
            countryCode: detectedCountry,
            customData: {
              userId: currentUser?.id ? String(currentUser.id) : '',
              userLogin: currentUser?.login || currentUser?.username || '',
              tier: tierName || '',
              interval: currentInterval,
            },
          });
        } catch (err: unknown) {
          console.error('[PADDLE] Checkout open failed:', err);
          const errorMsg = err instanceof Error ? err.message : t('Не удалось открыть окно оплаты Paddle');
          alert(errorMsg);
        } finally {
          button.disabled = false;
          button.innerHTML = originalText;
        }
      });
    });
  }

  function buildPricingHeader(): string {
    const locale = getLocale();
    const homeUrl = sitePath('', locale);
    const displayName = currentUser?.login || currentUser?.username || 'CybLight Premium';

    const headerAction = currentUser
      ? `
        <button type="button" class="account-mobile-header__signin" id="pricingAccountBtn" aria-label="${t('Личный кабинет')}" style="display: flex; align-items: center; gap: 6px; padding: 7px 16px;">
          <span style="font-size: 15px;">👤</span>
          <span>${t('Личный кабинет')}</span>
        </button>
      `
      : `
        <button type="button" class="account-mobile-header__signin" id="pricingSigninBtn" aria-label="${t('Войти')}">
          ${t('Войти')}
        </button>
      `;

    return `
      <header class="account-mobile-header" aria-label="${t('Тарифы и подписка')}">
        <div class="account-mobile-header__inner">
          <a href="${homeUrl}" class="account-mobile-header__logo" aria-label="${t('Главная страница')}">
            <img src="/assets/img/logo.svg" alt="CybLight" />
          </a>
          <div class="account-mobile-header__info">
            <div class="account-mobile-header__title">${t('Тарифы и подписка')}</div>
            <div class="account-mobile-header__login">${escapeHtml(displayName)}</div>
          </div>
          <div class="account-header-actions">
            <button
              type="button"
              class="account-lang-btn"
              id="pricingLangBtn"
              aria-haspopup="true"
              aria-expanded="false"
              aria-label="${t('Выбор языка')}"
              title="${t('Язык')}"
            >
              <svg class="cl-language" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="currentColor" d="M3.814 16.464a.501.501 0 00.65-.278L5.54 13.5h2.923l1.074 2.686a.5.5 0 00.928-.372l-3-7.5a.52.52 0 00-.928 0l-3 7.5a.5.5 0 00.278.65zM7 9.846L8.061 12.5H5.94zM6 7.5a.5.5 0 00.224-.053l2-1a.5.5 0 10-.448-.894l-2 1A.5.5 0 006 7.5zM11.75 14.25a2.025 2.025 0 001.75 2.25 2.584 2.584 0 001.482-.431c.039.088.07.152.075.162a.5.5 0 00.887-.461 4.654 4.654 0 01-.15-.368c.176-.168.359-.348.56-.548a11.374 11.374 0 001.92-2.652A1.55 1.55 0 0119 13.5a2.082 2.082 0 01-1.607 2.012.5.5 0 00.107.988.506.506 0 00.107-.012A3.055 3.055 0 0020 13.5a2.542 2.542 0 00-1.283-2.205c.16-.364.244-.6.255-.63a.5.5 0 10-.944-.33 7.97 7.97 0 01-.225.552 5.11 5.11 0 00-2.482-.21c.04-.428.091-.845.153-1.229 1.427-.123 3.04-.44 3.124-.458a.5.5 0 00-.196-.98c-.019.003-1.43.283-2.736.418.162-.761.31-1.273.313-1.284a.5.5 0 10-.958-.288c-.016.053-.206.695-.393 1.64-.041 0-.088.004-.128.004h-2a.5.5 0 000 1h1.955c-.072.476-.134.985-.17 1.517a4.001 4.001 0 00-2.535 3.233zm1.75 1.25c-.362 0-.75-.502-.75-1.25a2.82 2.82 0 011.506-2.094 11.674 11.674 0 00.384 2.927 1.684 1.684 0 01-1.14.417zm2.604-3.897a4.4 4.4 0 011.251.193 10.325 10.325 0 01-1.708 2.35l-.163.162A11.04 11.04 0 0115.25 12c0-.093.008-.185.01-.278a3.318 3.318 0 01.844-.12z M22.5 3h-21a.5.5 0 00-.5.5v16a.5.5 0 00.5.5H10v3.5a.5.5 0 00.854.354L14.707 20H22.5a.5.5 0 00.5-.5v-16a.5.5 0 00-.5-.5zM22 19h-7.5a.5.5 0 00-.354.146L11 22.293V19.5a.5.5 0 00-.5-.5H2V4h20z"></path>
              </svg>
              <span class="account-lang-btn__label">${getLocaleLabel(locale)}</span>
            </button>

            <div class="account-lang-menu" id="pricingLangMenu" hidden>
              <ul role="listbox">
                <li><a href="${localePath('pricing', 'ru')}" class="${locale === 'ru' ? 'is-active' : ''}" hreflang="ru">🇷🇺 ${t('Русский')}</a></li>
                <li><a href="${localePath('pricing', 'uk')}" class="${locale === 'uk' ? 'is-active' : ''}" hreflang="uk">🇺🇦 Українська</a></li>
                <li><a href="${localePath('pricing', 'en')}" class="${locale === 'en' ? 'is-active' : ''}" hreflang="en">🇬🇧 English</a></li>
              </ul>
            </div>

            ${headerAction}
          </div>
        </div>
      </header>
    `;
  }
}
