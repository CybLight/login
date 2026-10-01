import { t } from '@/i18n';

/**
 * Maps raw backend API error codes into user-friendly localized messages.
 */
export function formatApiError(rawError: string | undefined | null, fallbackMessage?: string): string {
  if (!rawError || typeof rawError !== 'string') {
    return fallbackMessage || t('Произошла ошибка при выполнении запроса');
  }

  const err = rawError.trim().toLowerCase();

  switch (err) {
    // Регистрация и логин
    case 'login_taken':
    case 'username_taken':
      return t('Это имя пользователя уже занято. Пожалуйста, выберите другое имя.');
    case 'reserved_username':
    case 'username_reserved':
    case 'admin_reserved_login':
      return t('Это имя пользователя зарезервировано администрацией сайта. Пожалуйста, выберите другое имя.');
    case 'email_taken':
      return t('Этот адрес электронной почты уже зарегистрирован в системе.');
    case 'user_exists':
    case 'user_already_exists':
      return t('Пользователь с такими данными уже существует.');
    case 'invalid_login':
    case 'invalid_username':
      return t('Некорректный формат логина. Используйте латинские буквы (A–Z), цифры (0–9) и символ подчеркивания (3–24 символа).');
    case 'invalid_password':
      return t('Пароль не соответствует требованиям безопасности (минимум 8 символов).');
    case 'passwords_do_not_match':
      return t('Введенные пароли не совпадают.');
    case 'invalid_credentials':
    case 'wrong_password':
      return t('Неверный логин или пароль. Проверьте введенные данные.');
    case 'user_not_found':
      return t('Пользователь с таким именем не найден.');

    // Капча и безопасность
    case 'turnstile_failed':
    case 'captcha_failed':
    case 'invalid_captcha':
    case 'captcha_required':
      return t('Проверка безопасности не пройдена. Пожалуйста, повторите попытку.');
    case 'rate_limit':
    case 'rate_limit_exceeded':
    case 'too_many_requests':
    case 'rate_limited':
      return t('Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');

    // Доступ и блокировки
    case 'user_banned':
    case 'account_banned':
      return t('Этот аккаунт заблокирован.');
    case 'access_denied':
    case 'forbidden':
      return t('Доступ ограничен. Недостаточно прав для выполнения этого действия.');
    case 'unauthorized':
    case 'session_expired':
      return t('Сессия истекла. Пожалуйста, войдите в аккаунт заново.');

    // Профиль и бейджи
    case 'invalid_avatar':
      return t('Выбран некорректный аватар.');
    case 'invalid_avatar_frame':
      return t('Выбрана некорректная рамка аватара.');
    case 'profanity_detected':
      return t('Текст содержит недопустимые или 18+ выражения.');

    // Загрузка файлов и безопасность
    case 'svg_not_allowed':
    case 'svg_forbidden':
      return t('Загрузка SVG-файлов запрещена в целях безопасности (защита от XSS-атак). Пожалуйста, выберите изображение в формате JPG, PNG, WEBP или GIF.');
    case 'unsupported_image_type':
    case 'invalid_image_type':
    case 'invalid_file_type':
      return t('Неподдерживаемый формат изображения. Допустимы только растровые изображения (JPG, PNG, WEBP, GIF). Векторные форматы (SVG) и скрипты запрещены.');
    case 'invalid_image_content':
    case 'corrupted_image':
    case 'invalid_file_signature':
      return t('Содержимое файла не является настоящим изображением. Простая смена расширения (например, .txt на .jpg) отклоняется системой безопасности. Пожалуйста, выберите настоящее изображение (JPG, PNG, WebP или GIF).');
    case 'file_too_large':
    case 'payload_too_large':
    case 'image_too_large':
      return t('Файл слишком большой. Максимально допустимый размер файла составляет 10 МБ.');
    case 'missing_fields':
    case 'no_file_uploaded':
      return t('Файл для загрузки не передан или повреждён.');
    case 'upload_failed':
      return t('Не удалось загрузить файл в хранилище. Пожалуйста, попробуйте снова.');

    // Токены и подтверждение email
    case 'token_used':
      return t('Эта ссылка уже была использована ранее (email уже подтверждён). Вы можете войти в аккаунт.');
    case 'token_expired':
      return t('Срок действия ссылки подтверждения истёк. Пожалуйста, запросите новую ссылку в настройках аккаунта.');
    case 'invalid_token':
      return t('Недействительная или поврежденная ссылка подтверждения. Проверьте ссылку из письма.');
    case 'token_required':
      return t('Отсутствует токен подтверждения.');
    case 'token_invalid_meta':
      return t('Некорректные параметры ссылки подтверждения.');
    case 'no_email':
      return t('Email адрес для подтверждения не найден.');
    case 'email_changed':
      return t('Email адрес аккаунта уже был изменён на другой.');

    default:
      // Если это уже понятный текст на русском / с пробелами, возвращаем как есть
      if (rawError.includes(' ') || /[а-яА-ЯёЁ]/.test(rawError)) {
        return rawError;
      }
      return fallbackMessage || `${t('Ошибка:')} ${rawError}`;
  }
}
