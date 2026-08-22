/**
 * Pricing Tiers Configuration for Paddle Live / Sandbox
 * Easily configurable list of subscription tiers.
 */

export interface Tier {
  name: 'Starter' | 'Pro' | 'Advanced';
  description: string;
  features: string[];
  priceId: { month: string; year: string };
  badge?: string;
  popular?: boolean;
}

export const PRICING_TIERS: Tier[] = [
  {
    name: 'Starter',
    description: 'Базовый набор возможностей для личного использования и быстрого старта.',
    features: [
      'Стандартные лимиты запросов к API',
      'До 3 комнат в Smart Home Hub',
      'Базовая E2EE синхронизация',
      'Стандартный набор аватаров',
      'Золотой значок Premium',
      'Кастомный титул/бейдж',
      'Поддержка в сообществе',
    ],
    priceId: {
      month: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTH || 'pri_01starter_month',
      year: import.meta.env.VITE_PADDLE_PRICE_STARTER_YEAR || 'pri_01starter_year',
    },
  },
  {
    name: 'Pro',
    description: 'Идеальный выбор для активных пользователей и энтузиастов умного дома.',
    features: [
      '10x увеличенные лимиты API',
      'Безлимитный Smart Home Hub',
      'Мгновенная приоритетная E2EE синхронизация',
      'Все эксклюзивные неоновые рамки аватара',
      'Золотой значок Premium',
      'Кастомный титул/бейдж',
      'Приоритетная поддержка 24/7',
    ],
    priceId: {
      month: import.meta.env.VITE_PADDLE_PRICE_PRO_MONTH || 'pri_01pro_month',
      year: import.meta.env.VITE_PADDLE_PRICE_PRO_YEAR || 'pri_01pro_year',
    },
    popular: true,
    badge: 'Популярный выбор',
  },
  {
    name: 'Advanced',
    description: 'Максимум мощности для разработчиков, команд и профессионалов.',
    features: [
      'Безлимитные лимиты API и выделенный канал',
      'Все возможности Pro тарифа',
      'Ранний доступ ко всем новым функциям',
      'Прямой закрытый чат с разработчиками',
      'Кастомные интеграции и расширенный аудит',
      'VIP ∞ статус в системе CybLight',
    ],
    priceId: {
      month: import.meta.env.VITE_PADDLE_PRICE_ADVANCED_MONTH || 'pri_01advanced_month',
      year: import.meta.env.VITE_PADDLE_PRICE_ADVANCED_YEAR || 'pri_01advanced_year',
    },
    badge: 'VIP Максимум',
  },
];
