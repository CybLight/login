/**
 * Security UI helper functions
 */

import { t } from '@/i18n';

export function updateSecurityIndicator(
  twoFAEnabled: boolean,
  passkeyCount: number,
  emailVerified: boolean
): void {
  console.log('[SECURITY-INDICATOR] START');

  try {
    const progressBar = document.getElementById('securityProgressBar');
    const scoreText = document.getElementById('securityScoreText');
    const check2FA = document.getElementById('2fa-check');
    const checkPasskey = document.getElementById('passkey-check');
    const itemSecurityCheck = document.getElementById('secSecurityCheckItem');
    const panelSecurityCheck = document.getElementById('secSecurityCheckPanel');
    const securityStatusBadge = document.getElementById('securityStatusBadge');
    const securityRecommendations = document.getElementById('securityRecommendations');

    console.log('[SECURITY-INDICATOR] Values:', {
      twoFAEnabled,
      passkeyCount,
      emailVerified,
      hasProgressBar: !!progressBar,
      hasScoreText: !!scoreText,
    });

    if (!progressBar || !scoreText) {
      console.log('[SECURITY-INDICATOR] DOM elements not found, skipping update');
      return;
    }

    let score = emailVerified ? 30 : 0;

    if (twoFAEnabled) {
      score += 40;
      if (check2FA) {
        check2FA.innerHTML = `
          <div class="security-check-icon">✅</div>
          <div class="security-check-label">${t('Двухфакторная аутентификация включена')}</div>
          <div class="security-check-status">${t('Выполнено')}</div>
        `;
        check2FA.classList.add('disabled');
      }
    }

    if (passkeyCount > 0) {
      score += 30;
      if (checkPasskey) {
        checkPasskey.innerHTML = `
          <div class="security-check-icon">✅</div>
          <div class="security-check-label">${t('Ключ доступа (Passkey) добавлен')}</div>
          <div class="security-check-status">${t('Выполнено')}</div>
        `;
        checkPasskey.classList.add('disabled');
      }
    }

    const levelClass =
      score >= 100
        ? 'security-level--good'
        : score >= 50
          ? 'security-level--medium'
          : 'security-level--low';
    const badgeText = score >= 100 ? `✓ ${t('Защищён')}` : score >= 50 ? `⚠ ${t('Средняя')}` : `⚠ ${t('Низкая')}`;
    const itemTitle = score >= 100 ? t('Ваш аккаунт под защитой') : t('Проверка безопасности');
    const itemSubtitle =
      score >= 100
        ? t('Ваш аккаунт прошёл Проверку безопасности')
        : t('Обнаружены рекомендации по защите');

    // Обновляем прогресс-бар и процент
    progressBar.style.width = `${score}%`;
    progressBar.classList.remove(
      'security-level--good',
      'security-level--medium',
      'security-level--low'
    );
    progressBar.classList.add(levelClass);
    progressBar.setAttribute('data-score', String(score));

    scoreText.textContent = `${score}%`;
    scoreText.classList.remove(
      'security-level--good',
      'security-level--medium',
      'security-level--low'
    );
    scoreText.classList.add('security-score-text', levelClass);

    // Обновляем заголовок и подзаголовок секции
    if (itemSecurityCheck) {
      const titleElem = itemSecurityCheck.querySelector('.sec-title');
      const subtitleElem = itemSecurityCheck.querySelector('.sec-sub');
      const iconContainer = itemSecurityCheck.querySelector('.sec-icon-box') as HTMLElement;

      if (titleElem) titleElem.textContent = itemTitle;
      if (subtitleElem) subtitleElem.textContent = itemSubtitle;

      // Обновляем иконку (PNG при 100%, SVG щит при меньше)
      if (iconContainer) {
        if (score >= 100) {
          iconContainer.innerHTML = `<img src="/assets/img/security/okey_64.png" width="32" height="32" alt="${t('Защищён')}" class="sec-icon-img" />`;
        } else {
          const svgColor = score >= 50 ? '#fbbf24' : '#ef4444';
          iconContainer.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 6V11C4 16.55 7.84 21.74 13 23C18.16 21.74 22 16.55 22 11V6L12 2Z" fill="${svgColor}" opacity="0.9"/>
          </svg>`;
        }
      }

      if (securityStatusBadge) {
        securityStatusBadge.textContent = badgeText;
        securityStatusBadge.classList.remove(
          'security-level--good',
          'security-level--medium',
          'security-level--low'
        );
        securityStatusBadge.classList.add(levelClass);
      }
    }

    // Обновляем блок рекомендаций
    if (securityRecommendations) {
      if (score >= 100) {
        securityRecommendations.innerHTML = `
          <div class="security-box-success">
            <div class="security-box-title">${t('🎉 Превосходно!')}</div>
            <div class="security-box-text">${t('Ваш аккаунт под надёжной защитой. Рекомендуемых действий не найдено.')}</div>
          </div>
        `;
      } else {
        const recommendationText =
          score < 30
            ? t('Начните с подтверждения email и включения 2FA для базовой защиты аккаунта.')
            : score < 50
              ? t('Добавьте еще несколько методов защиты для повышения безопасности.')
              : t('Отлично! Осталось совсем немного для максимальной защиты.');
        securityRecommendations.innerHTML = `
          <div class="security-box-info">
            <div class="security-box-title">${t('💡 Рекомендация')}</div>
            <div class="security-box-text">${recommendationText}</div>
          </div>
        `;
      }
    }

    // Автоматически управляем видимостью панели
    if (panelSecurityCheck) {
      if (score < 100) {
        panelSecurityCheck.style.display = 'block';
        itemSecurityCheck?.classList.add('is-open');
      } else {
        panelSecurityCheck.style.display = 'none';
        itemSecurityCheck?.classList.remove('is-open');
      }
    }

    console.log('[SECURITY-INDICATOR] DONE - score:', score, 'levelClass:', levelClass);
  } catch (err) {
    console.error('[SECURITY-INDICATOR] ERROR:', err);
  }
}

export function attachPasswordHints(
  input: HTMLInputElement | null,
  mount: HTMLElement | null,
  opts: { minLen?: number; requireUpper?: boolean; requireLower?: boolean } = {}
): void {
  if (!input || !mount) return;

  const minLen = opts.minLen ?? 8;
  const requireUpper = opts.requireUpper ?? true;
  const requireLower = opts.requireLower ?? true;

  mount.innerHTML = `
    <div class="pass-hints">
      <div class="pass-hints__title">${t('Пароль должен содержать как минимум:')}</div>
      <ul class="pass-hints__list">
        <li data-rule="len"><span class="icon"></span><span>${t('{count} символов', { count: minLen })}</span></li>
        ${requireUpper ? `<li data-rule="upper"><span class="icon"></span><span>${t('1 заглавную букву (A-Z)')}</span></li>` : ''}
        ${requireLower ? `<li data-rule="lower"><span class="icon"></span><span>${t('1 строчную букву (a-z)')}</span></li>` : ''}
        <li data-rule="digit"><span class="icon"></span><span>${t('1 число')}</span></li>
        <li data-rule="special"><span class="icon"></span><span>${t('1 спецсимвол (например ! $ ! @ % &)')}</span></li>
        <li data-rule="trim"><span class="icon"></span><span>${t('Без пробелов в начале и конце')}</span></li>
        <li data-rule="ascii"><span class="icon"></span><span>${t('Только латиница (без рус/укр)')}</span></li>
      </ul>
    </div>
  `;

  const ruleEls: Record<string, HTMLElement | null> = {
    len: mount.querySelector('[data-rule="len"]'),
    upper: mount.querySelector('[data-rule="upper"]'),
    lower: mount.querySelector('[data-rule="lower"]'),
    digit: mount.querySelector('[data-rule="digit"]'),
    special: mount.querySelector('[data-rule="special"]'),
    trim: mount.querySelector('[data-rule="trim"]'),
    ascii: mount.querySelector('[data-rule="ascii"]'),
  };

  const setRule = (key: string, ok: boolean) => {
    const el = ruleEls[key];
    if (!el) return;
    el.classList.toggle('ok', ok);
  };

  const update = () => {
    const v = String(input.value || '');
    setRule('len', v.length >= minLen);
    if (requireUpper) setRule('upper', /[A-Z]/.test(v));
    if (requireLower) setRule('lower', /[a-z]/.test(v));
    setRule('digit', /\d/.test(v));
    setRule('special', /[^A-Za-z0-9\s]/.test(v));
    setRule('trim', v === v.trim());
    setRule('ascii', /^[\x20-\x7E]*$/.test(v));
  };

  input.addEventListener('input', update);
  update();
}
