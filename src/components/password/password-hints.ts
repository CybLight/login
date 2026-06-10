/**
 * Password hints component - подсказки для правил пароля
 */

import { t } from '@/i18n';

export interface PasswordHintsOptions {
  minLen?: number;
  requireUpper?: boolean;
  requireLower?: boolean;
}

/**
 * Attach password hints to input element
 */
export function attachPasswordHints(
  inputEl: HTMLInputElement | null,
  containerEl: HTMLElement | null,
  opts: PasswordHintsOptions = {}
): void {
  if (!inputEl || !containerEl) return;

  const settings = {
    minLen: opts.minLen ?? 8,
    requireUpper: !!opts.requireUpper,
    requireLower: !!opts.requireLower,
  };

  // HTML подсказок
  containerEl.innerHTML = `
    <div class="pass-hints">
      <div class="pass-hints__title">${t('Пароль должен содержать как минимум:')}</div>
      <ul class="pass-hints__list">
        <li data-rule="minLen"><span class="icon" aria-hidden="true"></span> ${t('{count} символов', { count: settings.minLen })}</li>
        ${settings.requireUpper ? `<li data-rule="hasUpper"><span class="icon" aria-hidden="true"></span> ${t('1 заглавную букву (A-Z)')}</li>` : ''}
        ${settings.requireLower ? `<li data-rule="hasLower"><span class="icon" aria-hidden="true"></span> ${t('1 строчную букву (a-z)')}</li>` : ''}
        <li data-rule="hasDigit"><span class="icon" aria-hidden="true"></span> ${t('1 число')}</li>
        <li data-rule="hasSpecial"><span class="icon" aria-hidden="true"></span> ${t('1 спецсимвол (например, $ ! @ % &)')}</li>
        <li data-rule="noEdgeSpaces"><span class="icon" aria-hidden="true"></span> ${t('Без пробелов в начале и конце')}</li>
        <li data-rule="asciiOnly"><span class="icon" aria-hidden="true"></span>${t('Только латиница (без рус/укр)')}</li>
      </ul>
    </div>
  `;

  const rules: Record<string, (v: string) => boolean> = {
    minLen: (v) => v.length >= settings.minLen,
    hasDigit: (v) => /\d/.test(v),
    hasSpecial: (v) => /[^\w\s]/.test(v),
    noEdgeSpaces: (v) => v === v.trim(),
    asciiOnly: (v) => /^[\x20-\x7E]*$/.test(v),
    hasUpper: (v) => /[A-Z]/.test(v),
    hasLower: (v) => /[a-z]/.test(v),
  };

  function update(): void {
    if (!inputEl || !containerEl) return;
    const v = String(inputEl.value || '');
    containerEl.querySelectorAll('[data-rule]').forEach((li) => {
      const key = li.getAttribute('data-rule');
      if (!key) return;
      const ok = rules[key] ? rules[key](v) : false;
      li.classList.toggle('ok', ok);
    });
  }

  // Обновлять на ввод/фокус/блюр
  const onInput = () => update();
  inputEl.addEventListener('input', onInput);
  inputEl.addEventListener('focus', onInput);
  inputEl.addEventListener('blur', onInput);

  // Первичный рендер
  update();
}
