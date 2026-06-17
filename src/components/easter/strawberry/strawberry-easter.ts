/**
 * Strawberry Easter Egg - основная логика пасхалки
 */

import { Router } from '@/router/Router';
import { getStorage, setStorage, sendEasterLog } from '@/utils';
import { EASTER_KEY } from '@/config/constants';
import { authService, extractEasterFlags, pushLocalEasterFlagsToServer } from '@/services';
import { customPrompt, showCongratsModal } from './modal';
import { launchAllEffects, flashModal } from './effects';

let AlexUnlocked = false;

/**
 * Сохранить флаг пасхалки в localStorage
 */
export function setStrawberryAccess(): void {
  setStorage(EASTER_KEY, '1');
}

/**
 * Проверить есть ли доступ к пасхалке
 */
export function hasStrawberryAccess(): boolean {
  return getStorage(EASTER_KEY) === '1';
}

/**
 * Основная логика пасхалки с клубничкой
 */
export async function triggerStrawberryEaster(): Promise<void> {
  if (AlexUnlocked) return;
  if (String(getStorage('alex_done', '', sessionStorage)) === '1') return;

  AlexUnlocked = true;
  setStorage('alex_done', '1', sessionStorage);

  let storedName = (getStorage('itemUserName') || '').trim();

  while (!storedName) {
    const title = 'Поздравляю! Вы нашли пасхалку №2';
    const subtitle = 'Введите ваше имя пользователя:';
    const input = await customPrompt(title, subtitle);

    if (!input) {
      // Отмена - даём шанс снова
      AlexUnlocked = false;
      sessionStorage.removeItem('alex_done');
      return;
    }

    storedName = input.trim();
    setStorage('itemUserName', storedName);
  }

  // Отправляем лог
  sendEasterLog({
    type: 'alex_strawberry',
    alex: 2,
    userName: storedName,
    source: 'special_strawberry_click',
  });

  // Показываем поздравление с эффектами
  await showCongratsModal(storedName, async () => {
    // Получаем центр модального окна для эффектов
    const modalContent = document.querySelector('.modal-content') as HTMLElement;
    if (modalContent) {
      const rect = modalContent.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      launchAllEffects(cx, cy);
      flashModal(modalContent);
    }

    // Сохраняем пасхалку
    setStrawberryAccess();
    console.log('🍓 Strawberry flag set in localStorage');

    // Проверяем авторизацию
    const user = await authService.checkSession();

    if (user) {
      console.log('🍓 User is logged in, saving to server...');
      await pushLocalEasterFlagsToServer(extractEasterFlags({ user }));
    } else {
      console.log('⚠️ User not logged in, strawberry saved locally only');
      console.log('📌 Will be synced to server automatically after login');
    }

    // Перенаправляем на страницу истории
    Router.navigate('strawberry-history');
  });
}
