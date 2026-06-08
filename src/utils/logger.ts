/**
 * Logging utilities
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error';

export const logger = {
  log: (level: LogLevel, message: string, data: Record<string, unknown> = {}): void => {
    const fn = (console[level] as (...args: unknown[]) => void) || console.log;
    fn(`[${level.toUpperCase()}] ${message}`, data);

    // Send server logs in production
    if ((level === 'error' || level === 'warn') && window.location.hostname !== 'localhost') {
      // apiCall('/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(logEntry),
      // }).catch(() => {});
    }
  },

  info: (message: string, data?: Record<string, unknown>): void => {
    logger.log('info', message, data ?? {});
  },

  warn: (message: string, data?: Record<string, unknown>): void => {
    logger.log('warn', message, data ?? {});
  },

  error: (message: string, data?: Record<string, unknown>): void => {
    logger.log('error', message, data ?? {});
  },
};
