import { apiCall, parseUA } from '@/utils';
import { trapFocus } from '@/utils/focus';

function ensureReportModal(): HTMLElement {
  let modal = document.getElementById('cybReportModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'cybReportModal';
  modal.className = 'cyb-report-modal';
  modal.innerHTML = `
    <div class="cyb-report-modal__backdrop"></div>
    <div class="cyb-report-modal__card" role="dialog" aria-modal="true" aria-labelledby="cyb-report-title" aria-describedby="cyb-report-desc">
      <div id="cyb-report-title" class="cyb-report-modal__title">Сообщить о проблеме</div>
      <div id="cyb-report-desc" class="sr-only">Форма для отправки сообщения администратору</div>
      <form id="reportForm" class="cyb-report-modal__form">
        <div class="field">
          <label class="label" for="reportEmail">Email (опционально)</label>
          <input class="input" id="reportEmail" type="email" placeholder="your@email.com" />
        </div>
        <div class="field">
          <label class="label" for="reportCategory">Категория</label>
          <select class="input" id="reportCategory" required>
            <option value="">-- Выберите категорию --</option>
            <option value="bug">Ошибка/Баг</option>
            <option value="performance">Проблема с производительностью</option>
            <option value="security">Проблема безопасности</option>
            <option value="feature">Предложение функции</option>
            <option value="other">Прочее</option>
          </select>
        </div>
        <div class="field">
          <label class="label" for="reportMessage">Описание проблемы</label>
          <textarea class="input" id="reportMessage" rows="5" placeholder="Подробно опишите проблему..." required style="resize: vertical; font-family: inherit;"></textarea>
        </div>
        <div class="msg msg--warn" id="reportWarning" style="display: none;"></div>
        <div class="msg msg--ok" id="reportSuccess" style="display: none;"></div>
        <div class="cyb-report-modal__actions">
          <button class="btn btn-outline" type="button" id="reportCancel" aria-label="Отмена">Отмена</button>
          <button class="btn btn-primary" type="submit" id="reportSubmit" aria-label="Отправить">Отправить</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.cyb-report-modal__backdrop')?.addEventListener('click', () => {
    modal?.classList.remove('is-open');
  });

  modal.querySelector('#reportCancel')?.addEventListener('click', () => {
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

function openReportModal(): void {
  const modal = ensureReportModal();
  const form = modal.querySelector('#reportForm') as HTMLFormElement | null;
  const warning = modal.querySelector('#reportWarning') as HTMLElement | null;
  const success = modal.querySelector('#reportSuccess') as HTMLElement | null;

  form?.reset();
  if (warning) warning.style.display = 'none';
  if (success) success.style.display = 'none';

  modal.classList.add('is-open');

  // Trap focus
  const cleanup = trapFocus(modal as HTMLElement);

  // Cleanup when modal closed
  const observer = new MutationObserver(() => {
    if (!modal.classList.contains('is-open')) {
      try {
        cleanup();
      } catch {
        /* ignore cleanup errors */
      }
      observer.disconnect();
    }
  });

  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
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

  if (!emailInput || !categorySelect || !messageInput || !submitBtn || !warning || !success) return;

  const email = emailInput.value.trim();
  const category = categorySelect.value;
  const message = messageInput.value.trim();

  if (!message) {
    warning.textContent = 'Пожалуйста, опишите проблему';
    warning.style.display = 'block';
    return;
  }

  if (!category) {
    warning.textContent = 'Пожалуйста, выберите категорию';
    warning.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправляю...';
  warning.style.display = 'none';
  success.style.display = 'none';

  try {
    const ua = parseUA(navigator.userAgent);

    const response = await apiCall('/error/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: category || 'unknown',
        email: email || null,
        category,
        message,
        userAgent: navigator.userAgent,
        browser: ua.browser,
        os: ua.os,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }),
      credentials: 'include',
    });

    if (response.ok) {
      success.textContent = '✓ Спасибо! Ваш отчёт отправлен администраторам.';
      success.style.display = 'block';
      (modal.querySelector('#reportForm') as HTMLFormElement | null)?.reset();

      window.setTimeout(() => {
        modal.classList.remove('is-open');
      }, 2000);
    } else {
      const errorData = await response.json().catch(() => ({}) as { message?: string });
      warning.textContent = errorData.message || 'Ошибка при отправке. Попробуйте позже.';
      warning.style.display = 'block';
    }
  } catch (error) {
    console.error('Report submission error:', error);
    warning.textContent = 'Ошибка сети. Проверьте подключение и попробуйте ещё раз.';
    warning.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Отправить';
  }
}

export function initReportModalTriggers(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest('[data-report-modal-open]') as HTMLElement | null;
    if (!trigger) return;

    event.preventDefault();
    openReportModal();
  });
}
