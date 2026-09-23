/**
 * Pricing Plans Configuration for CybLight Premium (1m, 3m, 6m, 1y)
 */

export interface PricingPlan {
  id: 'month_1' | 'month_3' | 'month_6' | 'year_1';
  name: string;
  durationDays: number;
  priceUah: number;
  priceUsd: number;
  periodLabel: string;
  badge?: string;
  discountBadge?: string;
  popular?: boolean;
  features: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'month_1',
    name: '1 Месяц',
    durationDays: 30,
    priceUah: 199,
    priceUsd: 4.99,
    periodLabel: '/ месяц',
    badge: '1M',
    features: [
      'Золотой значок Premium ⭐ в профиле',
      'Безлимитный Smart Home Hub (комнаты и устройства)',
      'Мгновенная E2EE синхронизация',
      'Эксклюзивные неоновые рамки и темы оформления',
      '10x увеличенные лимиты API запросов',
      'Приоритетная поддержка 24/7',
    ],
  },
  {
    id: 'month_3',
    name: '3 Месяца',
    durationDays: 90,
    priceUah: 499,
    priceUsd: 12.49,
    periodLabel: '/ 3 месяца',
    discountBadge: 'Скидка 16%',
    badge: '3M',
    features: [
      'Все преимущества тарифа на 1 месяц',
      'Экономия 16% по сравнению с помесячной оплатой',
      'Эксклюзивный бейдж Сезонного хранителя',
      'Ранний доступ к новым бета-модулям',
      'Приоритетная обработка очередей E2EE',
    ],
  },
  {
    id: 'month_6',
    name: '6 Месяцев',
    durationDays: 180,
    priceUah: 899,
    priceUsd: 22.49,
    periodLabel: '/ 6 месяцев',
    discountBadge: 'Скидка 25%',
    badge: '6M',
    features: [
      'Все возможности тарифа на 3 месяца',
      'Экономия 25% при полугодовой подписке',
      'Эксклюзивный титул Хранителя Эпохи',
      'Выделенный канал технической поддержки',
      'Расширенный аудит логов и телеметрии',
    ],
  },
  {
    id: 'year_1',
    name: '1 Год',
    durationDays: 365,
    priceUah: 1599,
    priceUsd: 39.99,
    periodLabel: '/ год',
    popular: true,
    discountBadge: 'Скидка 33%',
    badge: '1Y 👑',
    features: [
      'Максимальная выгода — скидка 33%',
      'Полный безлимит на все возможности экосистемы',
      'Золотая корона 👑 и VIP статус аккаунта',
      'Прямой закрытый канал связи с разработчиками',
      'Выделенный серверный шлюз и кастомные вебхуки',
    ],
  },
];
