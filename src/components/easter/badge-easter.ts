import { apiCall } from '@/utils';
import { t } from '@/i18n';
import { showEasterUnlockCelebrationModal } from '@/views/account/modals';

export function bindBadgeEasterEgg(root: HTMLElement = document.body): void {
  let tapCount = 0;
  let lastTapTime = 0;
  let isCooldown = false;

  const badgeSelector = '.profile-hero__chips-row .chip, .profile-status-badges .chip, .badge--premium, .badge--custom, .badges .chip';

  root.querySelectorAll<HTMLElement>(badgeSelector).forEach((badge) => {
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', async (e: MouseEvent) => {
      if (isCooldown) return;

      const now = Date.now();
      if (now - lastTapTime > 2500) {
        tapCount = 1;
      } else {
        tapCount++;
      }
      lastTapTime = now;

      // Spawn spark particles at cursor
      spawnSparkles(e.clientX, e.clientY);

      if (tapCount >= 5) {
        tapCount = 0;
        isCooldown = true;
        setTimeout(() => {
          isCooldown = false;
        }, 1500);

        badge.classList.remove('easter-badge-spin');
        void badge.offsetWidth; // trigger reflow
        badge.classList.add('easter-badge-spin');

        localStorage.setItem('cyb_star_spark_unlocked', '1');

        try {
          await apiCall('/auth/easter/star-spark', {
            method: 'POST',
            credentials: 'include',
          });
        } catch {
          // ignore network errors
        }

        // Show celebratory modal
        showEasterUnlockCelebrationModal({
          icon: '⭐',
          title: t('Звёздная искра'),
          subtitle: t('Секретный ритм найден! ✨'),
          description: t('Великолепно! Вы разгадали секрет бейджа статуса, совершив 5 быстрых тапов, и пробудили звёздную силу CybLight!'),
          hint: t('Пасхалка добавлена в вашу коллекцию в профиле.'),
          targetCardId: 'easterCardStarSpark',
          subtab: 'site',
        });
      }
    });
  });
}

function spawnSparkles(x: number, y: number): void {
  const icons = ['✨', '⭐', '💫', '🌟', '👑'];
  for (let i = 0; i < 4; i++) {
    const p = document.createElement('div');
    p.className = 'badge-sparkle-particle';
    p.textContent = icons[Math.floor(Math.random() * icons.length)];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;

    const tx = (Math.random() - 0.5) * 80;
    const ty = (Math.random() - 0.8) * 80;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);

    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}
