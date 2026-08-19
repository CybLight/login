import { t } from '@/i18n';
import { escapeHtml } from '@/utils';
import { trapFocus } from '@/utils/focus';

export type AppDialogTone = 'info' | 'success' | 'warn' | 'error';

export interface AppAlertOptions {
  title?: string;
  tone?: AppDialogTone;
  confirmLabel?: string;
}

export interface AppConfirmOptions {
  title?: string;
  tone?: AppDialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface AppPromptOptions {
  title?: string;
  label?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
}

type DialogMode = 'alert' | 'confirm' | 'prompt';

interface DialogRequest {
  mode: DialogMode;
  message: string;
  options: AppAlertOptions & AppConfirmOptions & AppPromptOptions;
  resolve: (value: boolean | string | null) => void;
}

let dialogRoot: HTMLElement | null = null;
let releaseFocus: (() => void) | null = null;
let escapeHandler: ((event: KeyboardEvent) => void) | null = null;
const queue: DialogRequest[] = [];
let active = false;

function defaultTitle(tone: AppDialogTone): string {
  if (tone === 'error') return t('Ошибка');
  if (tone === 'warn') return t('Внимание');
  if (tone === 'success') return t('Готово');
  return 'CybLight';
}

function toneIcon(tone: AppDialogTone): string {
  if (tone === 'error') {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="rgba(239, 68, 68, 0.18)"/><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  }
  if (tone === 'warn') {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="rgba(245, 158, 11, 0.2)" stroke="currentColor"/><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  }
  if (tone === 'success') {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="rgba(16, 185, 129, 0.18)"/><polyline points="16 9 10 15 8 13"></polyline></svg>`;
  }
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="rgba(56, 189, 248, 0.18)"/><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
}

function formatMessage(message: string): string {
  return escapeHtml(message).split('\n').join('<br>');
}

function ensureDialogRoot(): HTMLElement {
  if (dialogRoot) return dialogRoot;

  dialogRoot = document.createElement('div');
  dialogRoot.id = 'cybAppDialog';
  dialogRoot.className = 'cyb-app-dialog';
  dialogRoot.innerHTML = `
    <div class="cyb-app-dialog__backdrop" data-dialog-close></div>
    <div class="cyb-app-dialog__card" role="dialog" aria-modal="true" aria-labelledby="cybAppDialogTitle" aria-describedby="cybAppDialogMessage">
      <div class="cyb-app-dialog__icon" id="cybAppDialogIcon" aria-hidden="true"></div>
      <div id="cybAppDialogTitle" class="cyb-app-dialog__title"></div>
      <div id="cybAppDialogMessage" class="cyb-app-dialog__message"></div>
      <div class="cyb-app-dialog__field is-hidden" id="cybAppDialogField">
        <label class="cyb-app-dialog__label" for="cybAppDialogInput" id="cybAppDialogLabel"></label>
        <input class="input cyb-app-dialog__input" id="cybAppDialogInput" type="text" />
      </div>
      <div class="cyb-app-dialog__actions" id="cybAppDialogActions"></div>
    </div>
  `;
  document.body.appendChild(dialogRoot);
  return dialogRoot;
}

function cleanupDialog(): void {
  const root = ensureDialogRoot();
  root.classList.remove('is-open');
  releaseFocus?.();
  releaseFocus = null;
  if (escapeHandler) {
    window.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
}

function finishDialog(value: boolean | string | null): void {
  const current = queue.shift();
  current?.resolve(value);
  active = false;
  cleanupDialog();
  void pumpQueue();
}

function bindCloseOnBackdrop(root: HTMLElement, onClose: () => void): void {
  const backdrop = root.querySelector('[data-dialog-close]');
  if (!backdrop) return;
  backdrop.addEventListener('click', onClose, { once: true });
}

function openDialog(request: DialogRequest): void {
  const root = ensureDialogRoot();
  const tone = request.options.tone || (request.mode === 'confirm' ? 'warn' : 'info');
  const title = request.options.title || defaultTitle(tone);
  const iconEl = root.querySelector('#cybAppDialogIcon') as HTMLElement;
  const titleEl = root.querySelector('#cybAppDialogTitle') as HTMLElement;
  const messageEl = root.querySelector('#cybAppDialogMessage') as HTMLElement;
  const fieldWrap = root.querySelector('#cybAppDialogField') as HTMLElement;
  const labelEl = root.querySelector('#cybAppDialogLabel') as HTMLLabelElement;
  const inputEl = root.querySelector('#cybAppDialogInput') as HTMLInputElement;
  const actionsEl = root.querySelector('#cybAppDialogActions') as HTMLElement;
  const card = root.querySelector('.cyb-app-dialog__card') as HTMLElement;

  root.className = `cyb-app-dialog cyb-app-dialog--${tone}`;
  iconEl.innerHTML = toneIcon(tone);
  titleEl.textContent = title;
  messageEl.innerHTML = formatMessage(request.message);

  actionsEl.innerHTML = '';
  const backdrop = root.querySelector('[data-dialog-close]');
  const newBackdrop = backdrop?.cloneNode(true);
  backdrop?.replaceWith(newBackdrop as Node);

  if (request.mode === 'prompt') {
    fieldWrap.classList.remove('is-hidden');
    titleEl.textContent = request.options.title || request.message;
    messageEl.style.display = 'none';
    labelEl.textContent = request.options.label || request.options.title || request.message;
    inputEl.value = request.options.defaultValue || '';
    inputEl.placeholder = request.options.placeholder || '';
  } else {
    fieldWrap.classList.add('is-hidden');
    messageEl.style.display = '';
    inputEl.value = '';
  }

  bindCloseOnBackdrop(root, () => {
    if (request.mode === 'alert') {
      finishDialog(true);
      return;
    }
    finishDialog(null);
  });

  if (request.mode === 'alert') {
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-primary';
    okBtn.textContent = request.options.confirmLabel || t('Понятно');
    okBtn.addEventListener('click', () => finishDialog(true));
    actionsEl.appendChild(okBtn);
  } else {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-outline';
    cancelBtn.textContent = request.options.cancelLabel || t('Отмена');
    cancelBtn.addEventListener('click', () => finishDialog(null));
    actionsEl.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = request.options.destructive ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = request.options.confirmLabel || t('Подтвердить');
    confirmBtn.addEventListener('click', () => {
      if (request.mode === 'prompt') {
        finishDialog(inputEl.value.trim() || request.options.defaultValue || '');
        return;
      }
      finishDialog(true);
    });
    actionsEl.appendChild(confirmBtn);
  }

  escapeHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (request.mode === 'alert') finishDialog(true);
      else finishDialog(null);
    }
    if (event.key === 'Enter' && request.mode === 'prompt' && document.activeElement === inputEl) {
      event.preventDefault();
      finishDialog(inputEl.value.trim() || request.options.defaultValue || '');
    }
  };
  window.addEventListener('keydown', escapeHandler);

  root.classList.add('is-open');
  releaseFocus = trapFocus(card);

  if (request.mode === 'prompt') {
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 0);
  }
}

async function pumpQueue(): Promise<void> {
  if (active || queue.length === 0) return;
  active = true;
  openDialog(queue[0]);
}

function enqueue<T extends boolean | string | null>(
  mode: DialogMode,
  message: string,
  options: AppAlertOptions & AppConfirmOptions & AppPromptOptions
): Promise<T> {
  return new Promise<T>((resolve) => {
    queue.push({
      mode,
      message,
      options,
      resolve: resolve as (value: boolean | string | null) => void,
    });
    void pumpQueue();
  });
}

export function showAppAlert(message: string, options: AppAlertOptions = {}): Promise<void> {
  const tone = options.tone || (message.includes('❌') || message.toLowerCase().includes('ошиб') ? 'error' : 'info');
  return enqueue('alert', message, { ...options, tone }).then(() => undefined);
}

export function showAppConfirm(message: string, options: AppConfirmOptions = {}): Promise<boolean> {
  return enqueue<boolean>('confirm', message, options).then((value) => value === true);
}

export function showAppPrompt(
  message: string,
  defaultValue = '',
  options: AppPromptOptions = {}
): Promise<string | null> {
  return enqueue<string | null>('prompt', message, { ...options, defaultValue });
}
