/**
 * Strawberry background - падающие клубнички
 */

import { triggerStrawberryEaster } from './strawberry-easter';

const COUNT = 35;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Инициализация фона с падающими клубниками
 */
export function initStrawberryBackground(): void {
  // Если уже есть фон — не дублируем
  if (document.querySelector('.bg-strawberries')) return;

  const bg = document.createElement('div');
  bg.className = 'bg-strawberries';
  // Hide decorative background from assistive technologies
  bg.setAttribute('aria-hidden', 'true');
  bg.setAttribute('role', 'presentation');
  document.body.appendChild(bg);

  // Выбранная особая клубника
  const specialIndex = rand(0, COUNT - 1);

  function createStrawberry(i: number): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'strawberry' + (i === specialIndex ? ' special' : '');
    el.textContent = '🍓';
    // Decorative - not announced by screen readers
    el.setAttribute('aria-hidden', 'true');

    const size = rand(16, 44);
    const left = rand(0, 100);
    const duration = rand(6, 14);
    const delay = rand(-12, 0);
    const drift = rand(-120, 120) + 'px';
    const rot = rand(-360, 360) + 'deg';

    el.style.left = left + 'vw';
    el.style.fontSize = size + 'px';
    el.style.setProperty('--drift', drift);
    el.style.setProperty('--rot', rot);
    el.style.animation = `fallStrawberry ${duration}s linear ${delay}s infinite`;

    // Делаем клубнику кликабельной
    el.style.pointerEvents = 'auto';
    el.style.userSelect = 'none';

    if (i === specialIndex) {
      el.title = '🤫';
      el.style.cursor = 'pointer';

      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerStrawberryEaster();
      });
    }

    // Перемешиваем позицию после каждой итерации
    el.addEventListener('animationiteration', () => {
      el.style.left = rand(0, 100) + 'vw';
      el.style.setProperty('--drift', rand(-120, 120) + 'px');
      el.style.setProperty('--rot', rand(-360, 360) + 'deg');
    });

    return el;
  }

  for (let i = 0; i < COUNT; i++) {
    bg.appendChild(createStrawberry(i));
  }
}

/**
 * Удалить фон с клубниками (для страниц профиля)
 */
export function removeStrawberryBackground(): void {
  const bg = document.querySelector('.bg-strawberries');
  if (bg) {
    bg.remove();
  }
}
