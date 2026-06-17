import { t } from '@/i18n';

const SPOILER_ICON = `
<svg class="chat-format-icon" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
  <path d="M7 17L17 7M9 19L19 9M5 15L15 5" stroke="currentColor" stroke-width="1" stroke-linecap="round"></path>
</svg>`;

const LINK_ICON = `
<svg class="chat-format-icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M10 14a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
  <path d="M14 10a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
</svg>`;

export function renderChatFormattingToolbarHtml(): string {
  return `
        <div class="chat-formatting-toolbar">
          <button class="chat-format-btn" data-format="bold" type="button" title="${t('Жирный (Ctrl+B)')}" aria-label="${t('Жирный (Ctrl+B)')}"><b>B</b></button>
          <button class="chat-format-btn" data-format="italic" type="button" title="${t('Курсив (Ctrl+I)')}" aria-label="${t('Курсив (Ctrl+I)')}"><i>I</i></button>
          <button class="chat-format-btn" data-format="underline" type="button" title="${t('Подчёркнутый (Ctrl+U)')}" aria-label="${t('Подчёркнутый (Ctrl+U)')}"><u>U</u></button>
          <button class="chat-format-btn" data-format="strike" type="button" title="${t('Зачёркнутый (Ctrl+Shift+X)')}" aria-label="${t('Зачёркнутый (Ctrl+Shift+X)')}"><s>S</s></button>
          <button class="chat-format-btn" data-format="mono" type="button" title="${t('Моноширинный (Ctrl+Shift+M)')}" aria-label="${t('Моноширинный (Ctrl+Shift+M)')}"><code>M</code></button>
          <button class="chat-format-btn chat-format-btn--icon" data-format="spoiler" type="button" title="${t('Спойлер (Ctrl+Shift+P)')}" aria-label="${t('Спойлер (Ctrl+Shift+P)')}">${SPOILER_ICON}</button>
          <button class="chat-format-btn chat-format-btn--icon" data-format="quote" type="button" title="${t('Цитата (Ctrl+Shift+Q)')}" aria-label="${t('Цитата (Ctrl+Shift+Q)')}"><img class="chat-format-icon chat-format-icon--quote" src="/assets/img/msg/quotes.png" alt="" aria-hidden="true"></button>
          <span class="chat-format-separator" aria-hidden="true"></span>
          <button class="chat-format-btn chat-format-btn--icon" data-format="link" type="button" title="${t('Вставить ссылку (Ctrl+K)')}" aria-label="${t('Вставить ссылку (Ctrl+K)')}">${LINK_ICON}</button>
          <button class="chat-format-btn" data-format="code" type="button" title="${t('Блок кода (Ctrl+Shift+C)')}" aria-label="${t('Блок кода (Ctrl+Shift+C)')}"><span class="chat-format-code-braces">{&nbsp;}</span></button>
        </div>`;
}
