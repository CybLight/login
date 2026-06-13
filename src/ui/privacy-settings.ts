import { getLocale, sitePath, t } from '@/i18n';

const STORAGE_KEY = 'cyblight-privacy-consent';

type OptionalConsent = {
  functional: boolean;
  diagnostic: boolean;
  usage: boolean;
};

type Consent = OptionalConsent & {
  decided: boolean;
};

type ConsentCategory = 'necessary' | keyof OptionalConsent;

let modalEl: HTMLDivElement | null = null;
let bannerEl: HTMLDivElement | null = null;
let bannerOffsetBound = false;

function syncBannerFooterOffset(): void {
  const footer = document.querySelector('.auth-footer') as HTMLElement | null;
  const height = footer?.getBoundingClientRect().height ?? 44;
  document.documentElement.style.setProperty('--cyb-privacy-footer-offset', `${Math.ceil(height)}px`);
}

function bindBannerOffsetSync(): void {
  if (bannerOffsetBound) return;
  bannerOffsetBound = true;
  window.addEventListener('resize', syncBannerFooterOffset);
  window.addEventListener('orientationchange', syncBannerFooterOffset);
}

function defaultOptional(): OptionalConsent {
  return { functional: false, diagnostic: false, usage: false };
}

function readStored(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<OptionalConsent>;
    if (!data || typeof data !== 'object') return null;
    return {
      functional: !!data.functional,
      diagnostic: !!data.diagnostic,
      usage: !!data.usage,
      decided: true,
    };
  } catch {
    return null;
  }
}

function writeStored(consent: OptionalConsent): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      functional: !!consent.functional,
      diagnostic: !!consent.diagnostic,
      usage: !!consent.usage,
      savedAt: Date.now(),
    }),
  );
}

function getConsent(): Consent {
  const stored = readStored();
  if (stored) return stored;
  return { ...defaultOptional(), decided: false };
}

function allows(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  const consent = getConsent();
  if (!consent.decided) return false;
  return !!consent[category];
}

function applyPrivacyState(): void {
  document.documentElement.classList.toggle('cyb-privacy-no-usage', !allows('usage'));
  document.documentElement.classList.toggle('cyb-privacy-no-functional', !allows('functional'));
  document.documentElement.classList.toggle('cyb-privacy-no-diagnostic', !allows('diagnostic'));
}

function dispatchChange(): void {
  applyPrivacyState();
  window.dispatchEvent(new CustomEvent('cyblight-privacy-change', { detail: getConsent() }));
}

function hideBanner(): void {
  if (!bannerEl) return;
  bannerEl.classList.remove('is-visible');
  document.body.classList.remove('cyb-privacy-banner-open');
}

function showBanner(): void {
  if (getConsent().decided) return;
  syncBannerFooterOffset();
  bindBannerOffsetSync();
  const banner = ensureBanner();
  banner.classList.add('is-visible');
  document.body.classList.add('cyb-privacy-banner-open');
}

function saveConsent(partial: Partial<OptionalConsent>): void {
  writeStored({ ...defaultOptional(), ...partial });
  dispatchChange();
  hideBanner();
}

function closeModal(): void {
  if (!modalEl) return;
  modalEl.classList.remove('is-open');
  document.body.classList.remove('cyb-privacy-modal-open');
  if (!getConsent().decided) showBanner();
}

function openModal(): void {
  hideBanner();
  const modal = ensureModal();
  const consent = getConsent();

  const functional = modal.querySelector('#cybPrivacyFunctional') as HTMLInputElement | null;
  const diagnostic = modal.querySelector('#cybPrivacyDiagnostic') as HTMLInputElement | null;
  const usage = modal.querySelector('#cybPrivacyUsage') as HTMLInputElement | null;
  if (functional) functional.checked = consent.functional;
  if (diagnostic) diagnostic.checked = consent.diagnostic;
  if (usage) usage.checked = consent.usage;

  modal.classList.add('is-open');
  document.body.classList.add('cyb-privacy-modal-open');
  modal.querySelector<HTMLButtonElement>('.cyb-privacy-modal__close')?.focus();
}

function readFormChoices(): OptionalConsent {
  if (!modalEl) return defaultOptional();
  return {
    functional: !!(modalEl.querySelector('#cybPrivacyFunctional') as HTMLInputElement | null)?.checked,
    diagnostic: !!(modalEl.querySelector('#cybPrivacyDiagnostic') as HTMLInputElement | null)?.checked,
    usage: !!(modalEl.querySelector('#cybPrivacyUsage') as HTMLInputElement | null)?.checked,
  };
}

function privacyCookiesUrl(): string {
  return `${sitePath('privacy', getLocale())}#cookies`;
}

function privacyPolicyUrl(): string {
  return sitePath('privacy', getLocale());
}

function ensureModal(): HTMLDivElement {
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'cybPrivacyModal';
  modalEl.className = 'cyb-privacy-modal';
  modalEl.innerHTML = `
    <div class="cyb-privacy-modal__backdrop" aria-hidden="true"></div>
    <div class="cyb-privacy-modal__card" role="dialog" aria-modal="true" aria-labelledby="cybPrivacyTitle">
      <header class="cyb-privacy-modal__header">
        <h2 id="cybPrivacyTitle" class="cyb-privacy-modal__title">${t('Настройки конфиденциальности')}</h2>
        <button type="button" class="cyb-privacy-modal__close" aria-label="${t('Закрыть')}">×</button>
      </header>
      <div class="cyb-privacy-modal__body">
        <p class="cyb-privacy-modal__intro">
          ${t('Мы используем cookie и похожие технологии для работы сайта и улучшения вашего опыта. Подробнее — в разделе ')}
          <a href="${privacyCookiesUrl()}" target="_blank" rel="noopener">${t('«Cookies и локальное хранилище»')}</a>${t(' политики конфиденциальности.')}
        </p>

        <div class="cyb-privacy-modal__quick">
          <button type="button" class="cyb-privacy-modal__btn cyb-privacy-modal__btn--primary" data-privacy-allow-all>
            ${t('Разрешить все cookie')}
          </button>
          <button type="button" class="cyb-privacy-modal__btn cyb-privacy-modal__btn--outline" data-privacy-reject-all>
            ${t('Отклонить все cookie')}
          </button>
        </div>

        <p class="cyb-privacy-modal__note">
          <strong>${t('ПРИМЕЧАНИЕ.')}</strong>
          ${t('CybLight не продаёт ваши данные и не использует их для таргетированной рекламы.')}
        </p>

        <h3 class="cyb-privacy-modal__section-title">${t('Персональные настройки')}</h3>
        <hr class="cyb-privacy-modal__divider" />

        <div class="cyb-privacy-option cyb-privacy-option--locked">
          <label class="cyb-privacy-option__head">
            <input type="checkbox" checked disabled />
            <span>${t('Строго необходимые cookie')}</span>
          </label>
          <p class="cyb-privacy-option__desc">${t('Нужны для базовой работы login.cyblight.org, безопасности Cloudflare, входа в аккаунт и сохранения этих настроек. Их нельзя отключить.')}</p>
        </div>

        <div class="cyb-privacy-option">
          <label class="cyb-privacy-option__head">
            <input type="checkbox" id="cybPrivacyFunctional" />
            <span>${t('Разрешить функциональные cookie')}</span>
          </label>
          <p class="cyb-privacy-option__desc">${t('Сохраняют выбранный язык интерфейса и другие настройки для удобства.')}</p>
        </div>

        <div class="cyb-privacy-option">
          <label class="cyb-privacy-option__head">
            <input type="checkbox" id="cybPrivacyDiagnostic" />
            <span>${t('Отправлять диагностические данные')}</span>
          </label>
          <p class="cyb-privacy-option__desc">${t('Позволяет отправлять отчёты «Сообщить о проблеме» и технические события (например, срабатывание пасхалок) для исправления ошибок.')}</p>
        </div>

        <div class="cyb-privacy-option">
          <label class="cyb-privacy-option__head">
            <input type="checkbox" id="cybPrivacyUsage" />
            <span>${t('Отправлять данные об использовании')}</span>
          </label>
          <p class="cyb-privacy-option__desc">${t('Включает сторонние виджеты и статистику на основном сайте CybLight.org при переходе по ссылкам.')}</p>
        </div>

        <div class="cyb-privacy-modal__footer">
          <button type="button" class="cyb-privacy-modal__btn cyb-privacy-modal__btn--primary" data-privacy-confirm>
            ${t('Подтвердить')}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  modalEl.querySelector('.cyb-privacy-modal__backdrop')?.addEventListener('click', closeModal);
  modalEl.querySelector('.cyb-privacy-modal__close')?.addEventListener('click', closeModal);

  modalEl.querySelector('[data-privacy-allow-all]')?.addEventListener('click', () => {
    saveConsent({ functional: true, diagnostic: true, usage: true });
    closeModal();
  });

  modalEl.querySelector('[data-privacy-reject-all]')?.addEventListener('click', () => {
    saveConsent({ functional: false, diagnostic: false, usage: false });
    closeModal();
  });

  modalEl.querySelector('[data-privacy-confirm]')?.addEventListener('click', () => {
    saveConsent(readFormChoices());
    closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl?.classList.contains('is-open')) closeModal();
  });

  return modalEl;
}

function ensureBanner(): HTMLDivElement {
  if (bannerEl) return bannerEl;

  bannerEl = document.createElement('div');
  bannerEl.id = 'cybPrivacyBanner';
  bannerEl.className = 'cyb-privacy-banner';
  bannerEl.setAttribute('role', 'region');
  bannerEl.setAttribute('aria-label', t('Настройки конфиденциальности'));
  bannerEl.innerHTML = `
    <div class="cyb-privacy-banner__inner">
      <h2 class="cyb-privacy-banner__title">${t('Настройки конфиденциальности')}</h2>
      <p class="cyb-privacy-banner__text">
        ${t('Наш сайт использует cookie и похожие технологии для работы и улучшения вашего опыта. Некоторые необходимы для работы сайта, другие помогают сохранять ваши настройки.')}
        ${t(' Если нажать «Принять», будут сохранены все cookie. Если «Отклонить» — будут заблокированы все необязательные cookie.')}
        ${t(' Подробнее — в разделе ')}
        <a href="${privacyCookiesUrl()}" target="_blank" rel="noopener">${t('«Cookies и локальное хранилище»')}</a>${t(' и в ')}<a href="${privacyPolicyUrl()}" target="_blank" rel="noopener">${t('«Политике конфиденциальности»')}</a>.
      </p>
      <div class="cyb-privacy-banner__actions">
        <button type="button" class="cyb-privacy-banner__btn cyb-privacy-banner__btn--primary" data-privacy-banner-accept>
          ${t('Принять')}
        </button>
        <button type="button" class="cyb-privacy-banner__btn cyb-privacy-banner__btn--primary" data-privacy-banner-reject>
          ${t('Отклонить')}
        </button>
        <button type="button" class="cyb-privacy-banner__btn cyb-privacy-banner__btn--link" data-privacy-banner-configure>
          ${t('Настроить')}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(bannerEl);

  bannerEl.querySelector('[data-privacy-banner-accept]')?.addEventListener('click', () => {
    saveConsent({ functional: true, diagnostic: true, usage: true });
  });

  bannerEl.querySelector('[data-privacy-banner-reject]')?.addEventListener('click', () => {
    saveConsent({ functional: false, diagnostic: false, usage: false });
  });

  bannerEl.querySelector('[data-privacy-banner-configure]')?.addEventListener('click', () => {
    openModal();
  });

  return bannerEl;
}

export function initPrivacySettings(): void {
  window.CybPrivacy = {
    getConsent,
    allows,
    open: openModal,
    apply: applyPrivacyState,
  };

  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement | null)?.closest('.jsPrivacySettings');
    if (!link) return;
    e.preventDefault();
    openModal();
  });

  applyPrivacyState();
  if (!getConsent().decided) showBanner();
}

export { allows, getConsent, openModal as openPrivacySettings };
