# View Components - основные компоненты страниц

Все view-компоненты созданы и зарегистрированы в роутере.

## Созданные компоненты

### Аутентификация

- ✅ `username.ts` - Ввод имени пользователя (первый этап входа)
- ✅ `password.ts` - Ввод пароля (второй этап входа)
- ✅ `signup.ts` - Регистрация нового пользователя
- ✅ `reset.ts` - Восстановление пароля
- ✅ `2fa-verify.ts` - Подтверждение двухфакторной аутентификации
- ✅ `verify-email.ts` - Подтверждение email адреса

### Служебные страницы

- ✅ `account-banned.ts` - Страница блокировки аккаунта
- ✅ `contact-admin.ts` - Форма обращения к администратору
- ✅ `done.ts` - Страница успешного завершения

### Профиль

- ✅ `account.ts` - Страница аккаунта (базовая заглушка)

## Вспомогательные компоненты

### UI

- ✅ `shell.ts` - Обёртка для страниц аутентификации (header + footer)

### Password Components

- ✅ `password-helpers.ts` - Вспомогательные функции (show/hide password, shake)
- ✅ `password-hints.ts` - Подсказки требований к паролю

## Регистрация роутов

Все роуты зарегистрированы в `main.ts`:

```typescript
Router.on('username', renderUsername);
Router.on('password', renderPassword);
Router.on('signup', renderSignup);
Router.on('reset', renderReset);
Router.on('2fa-verify', render2FAVerify);
Router.on('verify-email', renderVerifyEmail);
Router.on('account-banned', renderAccountBanned);
Router.on('contact-admin', renderContactAdmin);
Router.on('done', renderDone);
Router.on('account', () => renderAccount('profile'));
Router.on('account-profile', () => renderAccount('profile'));
Router.on('account-settings', () => renderAccount('settings'));
Router.on('account-sessions', () => renderAccount('sessions'));
Router.on('account-friends', () => renderAccount('friends'));
Router.on('account-messages', () => renderAccount('messages'));
```

## Использование

Все view-компоненты экспортируются из `@/views`:

```typescript
import {
  renderUsername,
  renderPassword,
  renderSignup,
  // ... и т.д.
} from '@/views';
```

## Особенности

- Все view поддерживают параметры через history.state
- Интегрированы с Turnstile CAPTCHA через `captchaService`
- Используют единый `shell()` компонент для консистентного дизайна
- Поддерживают обработку ошибок и показ сообщений
- Интегрированы с `authService` для проверки сессий
