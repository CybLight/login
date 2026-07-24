/**
 * Utility for remembering and auto-filling backup passwords per user.
 */

const KEY_PREFIX = 'cyb_remembered_backup_pass_';

function getKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function getRememberedBackupPassword(userId: string): string | null {
  if (!userId) return null;
  try {
    const val = localStorage.getItem(getKey(userId));
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

export function setRememberedBackupPassword(
  userId: string,
  password: string,
  remember: boolean,
): void {
  if (!userId) return;
  try {
    const key = getKey(userId);
    const pass = password.trim();
    if (remember && pass.length > 0) {
      localStorage.setItem(key, pass);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

export function isBackupPasswordRemembered(userId: string): boolean {
  return Boolean(getRememberedBackupPassword(userId));
}

/**
 * Attaches handlers to sync a password input and a "remember password" checkbox with localStorage.
 */
export function bindRememberBackupPasswordHandler(
  userId: string,
  inputId: string,
  checkboxId: string,
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const checkbox = document.getElementById(checkboxId) as HTMLInputElement | null;
  if (!input || !checkbox || !userId) return;

  const remembered = getRememberedBackupPassword(userId);
  if (remembered) {
    if (!input.value) {
      input.value = remembered;
    }
    checkbox.checked = true;
  }

  const sync = () => {
    setRememberedBackupPassword(userId, input.value, checkbox.checked);
  };

  checkbox.addEventListener('change', sync);
  input.addEventListener('input', () => {
    if (checkbox.checked) {
      sync();
    }
  });
}
