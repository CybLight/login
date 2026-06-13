import { API_BASE, API_TIMEOUT_MS, CACHE_DURATION } from '@/config/constants';

const isDev = typeof import.meta !== 'undefined' && Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

/**
 * Enhanced API call handler with timeout, error handling, and caching
 */

const apiCache = new Map<string, { data: Response; timestamp: number }>();

export async function apiCall(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = API_TIMEOUT_MS
): Promise<Response> {
  // Check internet connection
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('apiCall: Navigator is offline');
    return createErrorResponse(0, 'No internet connection', 'Нет подключения к интернету');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    if (isDev) {
      console.log('apiCall:', options.method || 'GET', url);
    }

    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (isDev) {
      console.log('apiCall response:', { url, ok: response.ok, status: response.status });
    }

    // Auto redirect on 401 if not an auth endpoint
    if (
      response.status === 401 &&
      !endpoint.includes('/auth/me') &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/register') &&
      !endpoint.includes('/auth/login-history') &&
      !endpoint.includes('/auth/trusted-devices') &&
      !endpoint.includes('/auth/easter/')
    ) {
      if (isDev) {
        console.log('401 detected, redirecting to username');
      }
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    let errorMessage = 'Ошибка сети';
    const err = error as { name?: string; message?: string } | undefined;

    if (err?.name === 'AbortError') {
      errorMessage = 'Превышено время ожидания. Сервер не отвечает.';
    } else if (err?.message?.includes('Failed to fetch')) {
      errorMessage = 'Не удалось подключиться к серверу. Проверьте интернет.';
    } else if (err?.message?.includes('NetworkError')) {
      errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
    } else {
      errorMessage = err?.message || 'Неизвестная ошибка сети';
    }

    return createErrorResponse(0, err?.message || '', errorMessage);
  }
}

/**
 * Cached API call with automatic cache invalidation
 */
export async function cachedApiCall(
  endpoint: string,
  options: RequestInit = {},
  cacheKey: string = endpoint
): Promise<Response> {
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const response = await apiCall(endpoint, options);

  if (response.ok) {
    apiCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });
  }

  return response;
}

/**
 * Clear API cache
 */
export function clearApiCache(cacheKey?: string): void {
  if (cacheKey) {
    apiCache.delete(cacheKey);
  } else {
    apiCache.clear();
  }
}

/**
 * Create error response object
 */
function createErrorResponse(status: number, statusText: string, errorMessage: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({ error: errorMessage }),
    text: async () => '',
    headers: new Headers(),
  } as Response;
}
