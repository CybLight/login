# CybLight Login

Фронтенд авторизации и личного кабинета CybLight ([login.cyblight.org](https://login.cyblight.org)).

Стек: **TypeScript**, **Vite**, vanilla DOM (без React). Раньше весь UI жил в `public/assets/js/login.js` (~9300 строк); сейчас код разбит на модули в `src/`.

## Быстрый старт

```bash
npm install
npm run dev      # http://localhost:5173
```

Продакшен-сборка:

```bash
npm run build    # tsc + vite build → dist/
npm run preview  # локальный просмотр dist/
```

Проверки:

```bash
npm run type-check
npm run lint
```

## Переменные окружения

Скопируйте `.env.example` в `.env` и при необходимости измените значения:

| Переменная | Назначение |
| --- | --- |
| `VITE_API_BASE` | Базовый URL API |
| `VITE_TURNSTILE_SITEKEY` | Cloudflare Turnstile |
| `VITE_LOG_LEVEL` | Уровень логирования (`debug` в dev) |

В режиме разработки запросы к `/api/*` проксируются на `https://api.cyblight.org` (см. `vite.config.ts`).

## Структура проекта

```text
login/
├── index.html              # Точка входа Vite
├── public/                 # Статика (копируется в dist как есть)
│   ├── _redirects          # SPA fallback для деплоя
│   ├── favicon.*           # Иконки
│   └── assets/img/         # Логотип, strawberries, security
├── src/
│   ├── main.ts             # Инициализация приложения
│   ├── router/             # Маршрутизация (hash-based)
│   ├── config/             # Константы
│   ├── types/              # TypeScript-типы
│   ├── utils/              # API, storage, validation, focus, keyboard
│   ├── services/           # auth, profile, friends, messages, sessions
│   ├── components/         # notification, modals, lightbox, strawberry
│   ├── ui/                 # shell, report-modal
│   ├── styles/             # CSS (импортируются из main.ts)
│   └── views/              # Страницы и вкладки аккаунта
└── scripts/
    └── auto_aria.cjs       # Автодобавление aria-label кнопкам-иконкам
```

### Слои

| Слой | Примеры | Назначение |
| --- | --- | --- |
| `views/` | `username.ts`, `account/` | Рендер страниц, обработчики UI |
| `services/` | `auth.ts`, `friends.ts` | Бизнес-логика и API |
| `utils/` | `api.ts`, `escapeHtml` | Инфраструктура |
| `components/` | `NotificationManager` | Переиспользуемый UI |

Импорты через алиас `@/` → `src/`.

## Маршруты

Основные страницы регистрируются в `src/main.ts`:

`username` · `password` · `signup` · `reset` · `2fa-verify` · `verify-email` · `done` · `account-*` · `profile` · `edit-profile` · `contact-admin` · `strawberry-history`

```typescript
import { Router } from '@/router/Router';
Router.navigate('account-profile');
```

## Примеры API

```typescript
import { apiCall, escapeHtml } from '@/utils';
import { authService } from '@/services';
import { NotificationManager } from '@/components/notification/NotificationManager';

const user = await authService.checkSession();
NotificationManager.success('Готово!');
element.innerHTML = escapeHtml(username); // всегда экранируйте пользовательский ввод
```

Типы — в `src/types/index.ts`, константы — в `src/config/constants.ts`.

## Деплой

1. `npm run build`
2. Опубликовать содержимое `dist/`
3. Убедиться, что `public/_redirects` попал в корень (`/* /index.html 200`)

Статические ассеты (favicon, изображения) лежат в `public/` и не проходят через бандлер.

## Разработка

### Добавление фичи

1. Тип в `src/types/index.ts` (если нужен)
2. Метод в `src/services/` или утилита в `src/utils/`
3. View в `src/views/` + регистрация роута в `main.ts`

### Правила

- Не вставляйте пользовательские данные в `innerHTML` без `escapeHtml`
- Используйте `logger` вместо `console.log` в продакшен-коде
- Избегайте `any` — `npm run lint` проверяет `@typescript-eslint/no-explicit-any`

### Доступность (a11y)

Чеклист, live regions, focus trap, skip links — в [A11Y_IMPROVEMENTS.md](./A11Y_IMPROVEMENTS.md).

Аудит:

```bash
npm install --save-dev @axe-core/cli
npx axe http://localhost:5173
```

Авто-aria для кнопок:

```bash
node scripts/auto_aria.cjs
```

## Миграция с legacy JS

Миграция **завершена**. Удалено из репозитория:

- `public/assets/js/login.js`, `router.js`, `profile.js`
- `public/assets/css/*.css` (стили в `src/styles/`)
- `public/index.html` (entry point — корневой `index.html`)

Логика перенесена в TypeScript-модули; сборка — единый бандл Vite.

## Лицензия

См. [LICENSE](./LICENSE).
