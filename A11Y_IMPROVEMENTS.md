# Accessibility (A11y) Improvements

Документ описывает требования к доступности и текущий статус внедрения в TypeScript-версии приложения.

## Статус внедрения

| Область | Статус | Где реализовано |
| --- | --- | --- |
| `.sr-only`, `.skip-link` | ✅ Готово | `src/styles/accessibility.css` |
| Skip link | ✅ Готово | `src/main.ts` (динамически), цель `#main-content` |
| Landmark `main` | ✅ Готово | `src/ui/shell.ts`, `src/views/account/account-render.ts` |
| Live regions | ✅ Готово | `src/main.ts` (`#a11y-notifications`, `#a11y-errors`), `NotificationManager` |
| Focus trap | ✅ Готово | `src/utils/focus.ts` |
| Keyboard (Escape, Tab) | ✅ Готово | `src/utils/keyboard.ts`, модальные окна |
| ARIA dialog в модалках | ✅ Готово | `ModalsManager`, `report-modal`, `strawberry/modal`, `account/modals`, chat forward |
| aria-label на кнопках-иконках | ✅ В основном | По всему `src/views`, `scripts/auto_aria.cjs` |
| Формы с `aria-describedby` | ⚠️ Частично | `password.ts` — эталон; остальные формы — по мере доработки |
| Цветовой контраст WCAG AA | ⏳ Ручная проверка | DevTools / WebAIM Contrast Checker |
| Полный аудит axe-core | ✅ Без нарушений | `axe-results.json` (0 violations) |
| Тестирование screen readers | ⏳ Долгосрочно | NVDA / VoiceOver |
| ARIA landmarks (полный набор) | ⏳ Долгосрочно | `nav`, `main` частично есть |

---

## 1. ARIA Labels и Roles

### Проблемы (исходные)

- Кнопки без `aria-label` (иконки без текста)
- Модальные окна без `role="dialog"` и `aria-modal="true"`
- Формы без правильных `aria-describedby` для ошибок
- Интерактивные элементы без ясных меток

### Решение

```typescript
// src/components/modals/ModalsManager.ts
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Заголовок</h2>
  <p id="modal-description">Описание</p>
</div>

// Для кнопок-иконок
<button aria-label="Закрыть" aria-describedby="close-hint">✕</button>
<span id="close-hint" class="sr-only">Закрыть модальное окно</span>
```

**Реализовано в:** `ModalsManager`, `report-modal.ts`, `strawberry/modal.ts`, `account/modals.ts`, `messages-tab.ts` (forward modal), `lightbox.ts`.

---

## 2. Keyboard Navigation

### Реализация

```typescript
// src/utils/keyboard.ts
export function setupAccessibleModal(element, { onClose, trapFocusRoot })
export function handleKeyboardNavigation(element, { onEscape, trapFocus })
```

- **Tab** — нативная навигация + focus trap в модалках (`trapFocus`)
- **Escape** — закрытие модалок и lightbox
- **Enter/Space** — нативное поведение `<button>`
- **Arrow keys** — lightbox (←/→), чат (выбор сообщений)

---

## 3. Screen Reader Support

```css
/* src/styles/accessibility.css */
.sr-only { ... }
.sr-only-focusable:focus,
.sr-only-focusable:active { ... }
```

Подключается в `src/main.ts`.

---

## 4. Live Regions

```html
<div id="a11y-notifications" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
<div id="a11y-errors" role="alert" aria-live="assertive" aria-atomic="true" class="sr-only"></div>
```

Создаются при инициализации в `src/main.ts`. `NotificationManager` дублирует текст в эти регионы.

---

## 5. Focus Management

```typescript
// src/utils/focus.ts
export function trapFocus(container: HTMLElement): () => void
```

Используется во всех основных модальных окнах и lightbox.

---

## 6. Color Contrast

Проверить все цвета на соответствие WCAG 2.1 Level AA:

- Нормальный текст: контраст >= 4.5:1
- Крупный текст: контраст >= 3:1
- UI компоненты: контраст >= 3:1

**Инструменты:** [Contrast Checker](https://webaim.org/resources/contrastchecker/), Chrome DevTools Lighthouse.

> Статус: требует периодической ручной проверки при смене темы/цветов.

---

## 7. Form Accessibility

```html
<div class="field">
  <label for="password" id="password-label">
    Пароль
    <span class="required" aria-label="обязательное поле">*</span>
  </label>
  <input
    id="password"
    type="password"
    aria-labelledby="password-label"
    aria-describedby="password-help password-error"
    aria-invalid="false"
    aria-required="true"
    autocomplete="current-password"
  />
  <span id="password-help" class="field-help">Минимум 8 символов</span>
  <span id="password-error" role="alert" class="field-error" hidden>Неверный пароль</span>
</div>
```

**Эталон:** `src/views/password.ts`. Аналогичный паттерн рекомендуется для `signup.ts`, `reset.ts`, `edit-profile.ts`.

---

## 8. Skip Links

```html
<a href="#main-content" class="skip-link">Перейти к основному содержимому</a>
<main id="main-content" tabindex="-1">...</main>
```

**Реализовано:** skip link добавляется в `initApp()`, `id="main-content"` на `<main>` в shell и account layout.

---

## Приоритеты внедрения

### Высокий приоритет — ✅ выполнено

- [x] aria-labels на кнопках без текста
- [x] role="dialog" к модальным окнам
- [x] keyboard navigation (Escape, Tab trap)
- [x] sr-only класс

### Средний приоритет — ✅ в основном выполнено

- [x] Focus trap в модальных окнах
- [x] Live regions для уведомлений
- [x] Skip links
- [ ] Проверка цветового контраста (ручная)

### Низкий приоритет — в планах

- [x] Аудит через axe-core (`axe-results.json`)
- [ ] Тестирование со screen readers
- [ ] Полный набор ARIA landmarks
- [x] Документация по a11y (этот файл)

---

## Тестирование

```bash
# Установить axe-core для автоматического тестирования
npm install --save-dev @axe-core/cli

# Запустить аудит (dev-сервер должен быть запущен)
npx axe http://localhost:5173
```

Автодобавление `aria-label` для кнопок-иконок:

```bash
node scripts/auto_aria.cjs
```

---

## Полезные ресурсы

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
