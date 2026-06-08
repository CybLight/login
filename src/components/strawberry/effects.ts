/**
 * Strawberry effects - визуальные эффекты для пасхалки
 */

/**
 * Конфетти из клубничек
 */
export function spawnStrawberryConfetti(x: number, y: number): void {
  const COUNT = 28;

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'strawberry-confetti';
    el.textContent = '🍓';

    const angle = i * ((Math.PI * 2) / COUNT);
    let radius = 0;

    const speed = 1.2 + Math.random() * 1.1;
    const spin = 0.15 + Math.random() * 0.2;

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    document.body.appendChild(el);

    let alpha = 1;

    const animate = () => {
      radius += speed;
      const dx = Math.cos(angle + radius * 0.03) * radius;
      const dy = Math.sin(angle + radius * 0.03) * radius * 0.75;

      alpha -= 0.008;

      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${radius * spin}deg) scale(${alpha})`;
      el.style.opacity = String(alpha);

      if (alpha > 0) requestAnimationFrame(animate);
      else el.remove();
    };

    requestAnimationFrame(animate);
  }
}

/**
 * Кольцевая волна
 */
export function spawnRingWave(x: number, y: number): void {
  const ring = document.createElement('div');
  ring.className = 'strawberry-ring-wave';
  ring.style.left = x - 40 + 'px';
  ring.style.top = y - 40 + 'px';
  ring.style.width = '80px';
  ring.style.height = '80px';

  document.body.appendChild(ring);

  setTimeout(() => ring.remove(), 900);
}

/**
 * Вспышка модального окна
 */
export function flashModal(modal: HTMLElement): void {
  modal.classList.remove('flash');
  void modal.offsetWidth; // restart animation
  modal.classList.add('flash');
}

/**
 * Пульсация фона
 */
export function pulseBackground(): void {
  document.body.classList.remove('body-pulse');
  void document.body.offsetWidth;
  document.body.classList.add('body-pulse');
}

/**
 * Большие клубнички slow-mo
 */
export function launchBigStrawberries(centerX: number, centerY: number): void {
  const COUNT = 4 + Math.floor(Math.random() * 2); // 4-5 крупных клубничек

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'big-strawberry';
    el.textContent = '🍓';

    document.body.appendChild(el);

    // Начальная позиция со смещением
    const offsetX = Math.random() * 60 - 30;
    const offsetY = Math.random() * 30 - 15;

    const x = centerX + offsetX;
    const y = centerY + offsetY;

    // Параметры slow-mo движения
    const driftX = Math.random() * 80 - 40;
    const rise = 180 + Math.random() * 120;
    const rotSpeed = Math.random() * 0.6 - 0.3;

    let t = 0;

    const animate = () => {
      t += 0.015; // скорость SLOW-MO

      // Синусоидальный дрейф
      const dx = Math.sin(t * 3) * 25;
      const dy = -t * rise;

      // Позиция
      el.style.left = x + dx + driftX * t + 'px';
      el.style.top = y + dy + 'px';

      // Вращение + плавное уменьшение
      el.style.transform = `scale(${1 - t * 0.3}) rotate(${rotSpeed * t * 180}deg)`;

      // Плавное исчезновение
      el.style.opacity = String(1 - t * 0.9);

      if (t < 1.0) {
        requestAnimationFrame(animate);
      } else {
        el.remove();
      }
    };

    requestAnimationFrame(animate);
  }
}

/**
 * Запустить все эффекты одновременно
 */
export function launchAllEffects(centerX: number, centerY: number): void {
  spawnStrawberryConfetti(centerX, centerY);
  spawnRingWave(centerX, centerY);
  pulseBackground();
  launchBigStrawberries(centerX, centerY);
}
