/**
 * Utility helper functions
 */

/**
 * Debounce function to limit function execution frequency
 */
export function debounce<T extends (...args: unknown[]) => unknown>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...(args as Parameters<T>));
    }, delay);
  }) as T;
}

/**
 * Throttle function to limit function execution frequency
 */
export function throttle<T extends (...args: unknown[]) => unknown>(func: T, delay: number): T {
  let lastExecution = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: unknown[]) => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecution;

    if (timeSinceLastExecution >= delay) {
      func(...(args as Parameters<T>));
      lastExecution = now;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...(args as Parameters<T>));
        lastExecution = Date.now();
      }, delay - timeSinceLastExecution);
    }
  }) as T;
}

/**
 * Wait for specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

/**
 * Retry failed function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === maxAttempts) throw error;
      const delay = delayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  throw new Error('Retry failed');
}

/**
 * Safely parse JSON
 */
export function safeJsonParse<T = unknown>(json: string, fallback: T | null = null): T | null {
  try {
    return JSON.parse(json) as T;
  } catch (error: unknown) {
    console.warn('JSON parse error:', error);
    return fallback;
  }
}
