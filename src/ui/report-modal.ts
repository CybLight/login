import { t } from '@/i18n';
import { apiCall, parseUA } from '@/utils';

let currentTargetUserId: string | null = null;
let currentTargetUsername: string | null = null;

function ensureReportModal(): HTMLElement {
  let modal = document.getElementById('cybReportModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'cybReportModal';
  modal.className = 'cyb-report-modal';
  modal.innerHTML = `
    <div class="cyb-report-modal__backdrop"></div>
    <div class="cyb-report-modal__card" role="dialog" aria-modal="true" aria-labelledby="cyb-report-title" aria-describedby="cyb-report-desc">
      <div id="cyb-report-title" class="cyb-report-modal__title">${t('Сообщить о проблеме')}</div>
      <div id="cyb-report-desc" class="sr-only">${t('Форма для отправки сообщения администратору')}</div>
      <form id="reportForm" class="cyb-report-modal__form">
        <input type="hidden" id="reportTargetUserId" value="" />
        <div class="field" id="reportEmailField">
          <label class="label" for="reportEmail">${t('Email (опционально)')}</label>
          <input class="input" id="reportEmail" type="email" placeholder="your@email.com" />
        </div>
        <div class="field">
          <label class="label" for="reportCategory">${t('Категория')}</label>
          <select class="input" id="reportCategory" required>
            <option value="">${t('-- Выберите категорию --')}</option>
            <option value="bug">${t('Ошибка/Баг')}</option>
            <option value="performance">${t('Проблема с производительностью')}</option>
            <option value="security">${t('Проблема безопасности')}</option>
            <option value="feature">${t('Предложение функции')}</option>
            <option value="other">${t('Прочее')}</option>
          </select>
        </div>
        <div class="field">
          <label class="label" for="reportMessage">${t('Описание проблемы / Нарушения')}</label>
          <textarea class="input" id="reportMessage" rows="5" placeholder="${t('Подробно опишите проблему...')}" required style="resize: vertical; font-family: inherit;"></textarea>
        </div>
        <div class="msg msg--warn" id="reportWarning" style="display: none;"></div>
        <div class="msg msg--ok" id="reportSuccess" style="display: none;"></div>
        <div class="cyb-report-modal__actions">
          <button class="btn btn-outline" type="button" id="reportCancel" aria-label="${t('Отмена')}">${t('Отмена')}</button>
          <button class="btn btn-primary" type="submit" id="reportSubmit" aria-label="${t('Отправить')}">${t('Отправить')}</button>
        </div>
      </form>
      <div id="reportSuccessView" class="cyb-report-modal__success" style="display: none; text-align: center; padding: 12px 0;">
        <div style="font-size: 56px; margin-bottom: 12px; line-height: 1;">✅</div>
        <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-bottom: 12px;">
          ${t('Жалоба успешно отправлена!')}
        </div>
        <div style="font-size: 14px; color: rgba(231, 236, 255, 0.95); line-height: 1.6; margin-bottom: 24px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 14px; padding: 16px 18px; text-align: center;">
          ${t('Ваша жалоба отправлена и будет рассмотрена в течение 1-3 рабочих дней.')}
        </div>
        <div class="cyb-report-modal__actions" style="justify-content: center;">
          <button type="button" class="btn btn-primary" id="reportSuccessClose" style="min-width: 160px; font-weight: 700;">
            ${t('Понятно')}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.cyb-report-modal__backdrop')?.addEventListener('click', () => {
    modal?.classList.remove('is-open');
  });

  modal.querySelector('#reportCancel')?.addEventListener('click', () => {
    modal?.classList.remove('is-open');
  });

  modal.querySelector('#reportSuccessClose')?.addEventListener('click', () => {
    modal?.classList.remove('is-open');
  });

  modal.querySelector('#reportForm')?.addEventListener('submit', handleReportSubmit);

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && modal?.classList.contains('is-open')) {
      modal.classList.remove('is-open');
    }
  });

  return modal;
}

export function openReportUserModal(targetUserId: string, targetUsername?: string): void {
  currentTargetUserId = targetUserId;
  currentTargetUsername = targetUsername || targetUserId;
  openReportModal();
}

export function openReportModal(targetUserId?: string, targetUsername?: string): void {
  if (targetUserId) {
    currentTargetUserId = targetUserId;
    currentTargetUsername = targetUsername || targetUserId;
  }

  const modal = ensureReportModal();
  const warning = modal.querySelector('#reportWarning') as HTMLElement | null;
  const success = modal.querySelector('#reportSuccess') as HTMLElement | null;
  const title = modal.querySelector('#cyb-report-title') as HTMLElement | null;
  const categorySelect = modal.querySelector('#reportCategory') as HTMLSelectElement | null;
  const targetIdInput = modal.querySelector('#reportTargetUserId') as HTMLInputElement | null;
  const emailField = modal.querySelector('#reportEmailField') as HTMLElement | null;

  const form = modal.querySelector('#reportForm') as HTMLElement | null;
  const successView = modal.querySelector('#reportSuccessView') as HTMLElement | null;

  if (form) form.style.display = 'flex';
  if (successView) successView.style.display = 'none';

  if (warning) warning.style.display = 'none';
  if (success) success.style.display = 'none';

  if (targetIdInput) targetIdInput.value = currentTargetUserId || '';

  if (currentTargetUserId && title && categorySelect) {
    title.style.display = 'block';
    title.textContent = `${t('Пожаловаться на пользователя')} @${currentTargetUsername}`;
    if (emailField) emailField.style.display = 'none';
    categorySelect.innerHTML = `
      <option value="">${t('-- Выберите причину жалобы --')}</option>
      <option value="spam">${t('📢 Спам / Реклама')}</option>
      <option value="harassment">${t('🤬 Оскорбления / Травля')}</option>
      <option value="inappropriate_content">${t('🔞 Запрещённый контент')}</option>
      <option value="fraud">${t('⚠️ Мошенничество')}</option>
      <option value="other">${t('❓ Другое нарушение')}</option>
    `;
  } else if (title && categorySelect) {
    title.style.display = 'block';
    title.textContent = t('Сообщить о проблеме');
    if (emailField) emailField.style.display = 'block';
    categorySelect.innerHTML = `
      <option value="">${t('-- Выберите категорию --')}</option>
      <option value="bug">${t('Ошибка/Баг')}</option>
      <option value="performance">${t('Проблема с производительностью')}</option>
      <option value="security">${t('Проблема безопасности')}</option>
      <option value="feature">${t('Предложение функции')}</option>
      <option value="other">${t('Прочее')}</option>
    `;
  }

  modal.classList.add('is-open');
}

async function handleReportSubmit(event: Event): Promise<void> {
  event.preventDefault();

  const modal = document.getElementById('cybReportModal');
  if (!modal) return;

  const emailInput = modal.querySelector('#reportEmail') as HTMLInputElement | null;
  const categorySelect = modal.querySelector('#reportCategory') as HTMLSelectElement | null;
  const messageInput = modal.querySelector('#reportMessage') as HTMLTextAreaElement | null;
  const submitBtn = modal.querySelector('#reportSubmit') as HTMLButtonElement | null;
  const warning = modal.querySelector('#reportWarning') as HTMLElement | null;
  const success = modal.querySelector('#reportSuccess') as HTMLElement | null;
  const form = modal.querySelector('#reportForm') as HTMLElement | null;
  const successView = modal.querySelector('#reportSuccessView') as HTMLElement | null;
  const title = modal.querySelector('#cyb-report-title') as HTMLElement | null;

  if (!categorySelect || !messageInput || !submitBtn || !warning || !success) return;

  const email = emailInput?.value.trim() || '';
  const category = categorySelect.value;
  const message = messageInput.value.trim();
  const targetUserId = currentTargetUserId;

  if (!message) {
    warning.textContent = t('Пожалуйста, опишите проблему');
    warning.style.display = 'block';
    return;
  }

  if (!category) {
    warning.textContent = t('Пожалуйста, выберите категорию');
    warning.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = t('Отправляю...');
  warning.style.display = 'none';
  success.style.display = 'none';

  try {
    const ua = parseUA(navigator.userAgent);
    const endpoint = targetUserId ? '/reports/user' : '/error/report';

    const payload = targetUserId
      ? {
          targetUserId,
          category,
          reason: message,
          details: `URL: ${window.location.href}`,
        }
      : {
          type: category || 'unknown',
          email: email || null,
          category,
          message,
          userAgent: navigator.userAgent,
          browser: ua.browser,
          os: ua.os,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        };

    const response = await apiCall(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (response.ok) {
      if (form) form.style.display = 'none';
      if (title) title.style.display = 'none';
      if (successView) successView.style.display = 'block';

      (modal.querySelector('#reportForm') as HTMLFormElement | null)?.reset();
      currentTargetUserId = null;
      currentTargetUsername = null;
    } else {
      const errorData = await response.json().catch(() => ({}) as { message?: string });
      warning.textContent = errorData.message || t('Ошибка при отправке. Попробуйте позже.');
      warning.style.display = 'block';
    }
  } catch (error) {
    console.error('Report submission error:', error);
    warning.textContent = t('Ошибка сети. Проверьте подключение и попробуйте ещё раз.');
    warning.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t('Отправить');
  }
}

export function initReportModalTriggers(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const reportUserTrigger = target?.closest('[data-report-user-id]') as HTMLElement | null;
    if (reportUserTrigger) {
      event.preventDefault();
      const userId = reportUserTrigger.getAttribute('data-report-user-id') || '';
      const username = reportUserTrigger.getAttribute('data-report-username') || userId;
      if (userId) {
        openReportUserModal(userId, username);
        return;
      }
    }

    const trigger = target?.closest('[data-report-modal-open]') as HTMLElement | null;
    if (!trigger) return;

    event.preventDefault();
    openReportModal();
  });
}
