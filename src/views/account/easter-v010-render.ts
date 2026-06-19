import { t } from '@/i18n';
import type { UserEasterFlags } from '@/types';
import { escapeHtml } from '@/utils';

function easterFlag(
  easter: UserEasterFlags | undefined,
  camel: keyof UserEasterFlags,
  snake?: keyof UserEasterFlags,
): boolean {
  if (!easter) return false;
  const direct = easter[camel];
  if (typeof direct === 'boolean') return direct;
  if (snake) {
    const alt = easter[snake];
    if (typeof alt === 'boolean') return alt;
  }
  return false;
}

function easterProgressHtml(current: number, total: number, isSeconds = false): string {
  const label = isSeconds
    ? t('{current} из {total} сек', { current: String(current), total: String(total) })
    : t('{current} из {total}', { current: String(current), total: String(total) });
  return `<div class="easter-card-progress">${escapeHtml(label)}</div>`;
}

type V010CardSpec = {
  slug: string;
  emoji: string;
  title: string;
  descUnlocked: string;
  descLocked: string;
  hintLocked: string;
  camel: keyof UserEasterFlags;
  snake?: keyof UserEasterFlags;
};

const V010_APP_CARDS: V010CardSpec[] = [
  {
    slug: 'typographer',
    emoji: '🖋️',
    title: 'Типограф',
    descUnlocked: 'Отправил сообщение со всеми видами форматирования',
    descLocked: 'Собери все стили в одном сообщении',
    hintLocked: '💡 Подсказка: жирный, курсив, цитата, скрытый, ссылка, код и остальное — в одном тексте',
    camel: 'typographer',
  },
  {
    slug: 'spoiler-hunter',
    emoji: '🫥',
    title: 'Спойлерщик',
    descUnlocked: 'Раскрыл пять скрытых текстов',
    descLocked: 'Открой пять скрытых фрагментов в чатах',
    hintLocked: '💡 Подсказка: нажимай на жёлтые скрытые блоки в сообщениях',
    camel: 'spoilerHunter',
    snake: 'spoiler_hunter',
  },
  {
    slug: 'no-markers',
    emoji: '✨',
    title: 'Без звёздочек',
    descUnlocked: 'Отформатировал текст только через меню, без ручной разметки',
    descLocked: 'Используй меню форматирования при выделении текста',
    hintLocked: '💡 Подсказка: выдели текст → ⋮ → выбери стиль и отправь',
    camel: 'noMarkers',
    snake: 'no_markers',
  },
  {
    slug: 'enter-master',
    emoji: '↵',
    title: 'Enter-мастер',
    descUnlocked: 'Десять сообщений отправил только клавишей Enter',
    descLocked: 'Включи «Отправка по Enter» и отправь 10 сообщений',
    hintLocked: '💡 Подсказка: настройки чатов → отправка по Enter',
    camel: 'enterMaster',
    snake: 'enter_master',
  },
  {
    slug: 'font-extremes',
    emoji: '🔤',
    title: 'Гигант и микроскоп',
    descUnlocked: 'Отправил сообщения на минимальном и максимальном шрифте',
    descLocked: 'Отправь текст на самом маленьком и самом большом шрифте',
    hintLocked: '💡 Подсказка: настройки → размер шрифта в чатах',
    camel: 'fontExtremes',
    snake: 'font_extremes',
  },
  {
    slug: 'cloud-keeper',
    emoji: '☁️',
    title: 'Облачный хранитель',
    descUnlocked: 'Сохранил резервную копию в Google Drive',
    descLocked: 'Успешно создай backup в Google Drive',
    hintLocked: '💡 Подсказка: настройки → резервное копирование → Google Drive',
    camel: 'cloudKeeper',
    snake: 'cloud_keeper',
  },
  {
    slug: 'drive-pilot',
    emoji: '🚗',
    title: 'Водитель',
    descUnlocked: 'Три раза выбирал аккаунт Google для Drive',
    descLocked: 'Поиграй с выбором Google-аккаунта в backup',
    hintLocked: '💡 Подсказка: смени аккаунт Google в настройках backup',
    camel: 'drivePilot',
    snake: 'drive_pilot',
  },
  {
    slug: 'live-wire',
    emoji: '⚡',
    title: 'Молния',
    descUnlocked: 'Получил сообщение в реальном времени через WebSocket',
    descLocked: 'Будь в открытом чате, когда придёт новое сообщение',
    hintLocked: '💡 Подсказка: держи чат открытым — сообщение прилетит мгновенно',
    camel: 'liveWire',
    snake: 'live_wire',
  },
  {
    slug: 'from-shadow',
    emoji: '👤',
    title: 'Из тени',
    descUnlocked: 'Открыл чат из push-уведомления',
    descLocked: 'Нажми на уведомление о сообщении',
    hintLocked: '💡 Подсказка: получи push и открой чат напрямую',
    camel: 'fromShadow',
    snake: 'from_shadow',
  },
  {
    slug: 'watchman',
    emoji: '🛡️',
    title: 'Сторож',
    descUnlocked: 'Три раза открыл чат из уведомления с включённой блокировкой',
    descLocked: 'При блокировке приложения открой чат из push 3 раза',
    hintLocked: '💡 Подсказка: PIN или биометрия + уведомление о сообщении',
    camel: 'watchman',
  },
  {
    slug: 'carousel-watcher',
    emoji: '🎠',
    title: 'Карусель',
    descUnlocked: '30 секунд наблюдал за автопрокруткой проектов на главной',
    descLocked: 'Не трогай карусель проектов полминуты',
    hintLocked: '💡 Подсказка: главная → проекты → просто смотри',
    camel: 'carouselWatcher',
    snake: 'carousel_watcher',
  },
  {
    slug: 'synchronist',
    emoji: '🔄',
    title: 'Синхронист',
    descUnlocked: 'Восстановил чаты из Google Drive',
    descLocked: 'Успешно восстанови backup из Google Drive',
    hintLocked: '💡 Подсказка: настройки → восстановить из Google Drive',
    camel: 'synchronist',
  },
  {
    slug: 'quote-day',
    emoji: '💬',
    title: 'Цитата дня',
    descUnlocked: 'Три раза отправил сообщение с цитатой',
    descLocked: 'Отправь три сообщения с форматированием «Цитировать»',
    hintLocked: '💡 Подсказка: выдели текст → ⋮ → Цитировать',
    camel: 'quoteDay',
    snake: 'quote_day',
  },
  {
    slug: 'midnight-editor',
    emoji: '🌑',
    title: 'Полночный редактор',
    descUnlocked: 'Форматировал текст сразу после полуночи',
    descLocked: 'Примени форматирование между 00:00 и 00:05',
    hintLocked: '💡 Подсказка: ночная смена стилей в поле ввода',
    camel: 'midnightEditor',
    snake: 'midnight_editor',
  },
  {
    slug: 'polyglot-friend',
    emoji: '🌍',
    title: 'Друг на всех языках',
    descUnlocked: 'Отправил сообщения на русском, украинском и английском',
    descLocked: 'Смени язык приложения и отправь другу слово на ru, uk и en',
    hintLocked: '💡 Подсказка: настройки → язык → сообщение в чат',
    camel: 'polyglotFriend',
    snake: 'polyglot_friend',
  },
  {
    slug: 'silence',
    emoji: '🤫',
    title: 'Тишина',
    descUnlocked: 'Отправил сообщение из emoji со скрытым текстом внутри',
    descLocked: 'Сообщение только из emoji и скрытого фрагмента',
    hintLocked: '💡 Подсказка: emoji снаружи, ||секрет|| внутри',
    camel: 'silence',
  },
  {
    slug: 'reaction-streak',
    emoji: '👍',
    title: 'Реакция на всё',
    descUnlocked: 'Десять реакций подряд на входящие сообщения в одном чате',
    descLocked: 'Поставь реакции на 10 входящих сообщений подряд',
    hintLocked: '💡 Подсказка: один чат, только чужие сообщения, без пропусков',
    camel: 'reactionStreak',
    snake: 'reaction_streak',
  },
];

function renderCard(spec: V010CardSpec, unlocked: boolean): string {
  const badge = unlocked
    ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
    : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`;

  return `
    <div class="easter-card easter-card--${spec.slug} ${unlocked ? '' : 'locked'}">
      ${badge}
      <span class="easter-card-icon">${spec.emoji}</span>
      <div class="easter-card-title">${t(spec.title)}</div>
      <div class="easter-card-desc">${t(unlocked ? spec.descUnlocked : spec.descLocked)}</div>
      ${unlocked ? '' : `<div class="easter-hint">${t(spec.hintLocked)}</div>`}
    </div>
  `;
}

export function renderV010AppEasterCards(easter: UserEasterFlags | undefined): string {
  return V010_APP_CARDS.map((spec) =>
    renderCard(spec, easterFlag(easter, spec.camel, spec.snake)),
  ).join('');
}

export function countV010AppUnlockedEggs(easter: UserEasterFlags | undefined): number {
  let count = 0;
  for (const spec of V010_APP_CARDS) {
    if (easterFlag(easter, spec.camel, spec.snake)) count++;
  }
  return count;
}

export const V010_APP_EGGS_TOTAL = V010_APP_CARDS.length;

export function countV010UnlockedEggs(easter: UserEasterFlags | undefined): number {
  let count = countV010AppUnlockedEggs(easter);
  if (easterFlag(easter, 'formatMirror', 'format_mirror')) count++;
  return count;
}

export function renderFormatMirrorEasterCard(easter: UserEasterFlags | undefined): string {
  const unlocked = easterFlag(easter, 'formatMirror', 'format_mirror');
  const webToday =
    easter?.formatMirrorWebToday === true || easter?.format_mirror_web_today === true;
  const appToday =
    easter?.formatMirrorAppToday === true || easter?.format_mirror_app_today === true;
  const platformsToday = (webToday ? 1 : 0) + (appToday ? 1 : 0);

  const badge = unlocked
    ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
    : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`;

  return `
    <div class="easter-card easter-card--format-mirror ${unlocked ? '' : 'locked'}">
      ${badge}
      <span class="easter-card-icon">🪞</span>
      <div class="easter-card-title">${t('Зеркало формата')}</div>
      <div class="easter-card-desc">${
        unlocked
          ? t('В один день отправил форматированное сообщение на сайте и в приложении')
          : t('Отформатируй сообщение и на сайте, и в приложении в один день')
      }</div>
      ${unlocked ? '' : easterProgressHtml(platformsToday, 2)}
      ${
        unlocked
          ? `<div class="easter-hint">${t('🎊 Формат отражён на обеих платформах!')}</div>`
          : `<div class="easter-hint">${t('💡 Подсказка: жирный, курсив или другой стиль — на сайте и в приложении')}</div>`
      }
    </div>
  `;
}
