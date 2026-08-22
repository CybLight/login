/**
 * Paddle Billing Integration Service (@paddle/paddle-js)
 * Implements PricePreview and Checkout.open overlay with strict environment validation.
 */

import { initializePaddle, type Paddle, type PricePreviewParams, type PricePreviewResponse } from '@paddle/paddle-js';

let paddleInstance: Paddle | null = null;
let initPromise: Promise<Paddle> | null = null;

/**
 * Validates environment variables and initializes Paddle SDK singleton.
 * Fails loudly if environment or token is missing.
 */
export async function getPaddleInstance(): Promise<Paddle> {
  if (paddleInstance) {
    return paddleInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const rawEnv = import.meta.env.VITE_PADDLE_ENVIRONMENT;
    const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

    if (!rawEnv || typeof rawEnv !== 'string' || !rawEnv.trim()) {
      const errorMsg = 'CRITICAL CONFIGURATION ERROR: VITE_PADDLE_ENVIRONMENT is not set! Set VITE_PADDLE_ENVIRONMENT to "production" or "sandbox" in .env.';
      console.error(`[PADDLE] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const cleanEnv = rawEnv.trim().toLowerCase();
    if (cleanEnv !== 'production' && cleanEnv !== 'sandbox' && cleanEnv !== 'live') {
      const errorMsg = `CRITICAL CONFIGURATION ERROR: Invalid VITE_PADDLE_ENVIRONMENT="${rawEnv}". Allowed values are "production" (live) or "sandbox".`;
      console.error(`[PADDLE] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (!clientToken || typeof clientToken !== 'string' || !clientToken.trim()) {
      const errorMsg = 'CRITICAL CONFIGURATION ERROR: VITE_PADDLE_CLIENT_TOKEN is not set! Set your Paddle client-side token in .env.';
      console.error(`[PADDLE] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const environment: 'production' | 'sandbox' = cleanEnv === 'sandbox' ? 'sandbox' : 'production';

    // Verify token prefix matches environment
    if (environment === 'production' && !clientToken.startsWith('live_')) {
      console.warn('[PADDLE] Warning: Live/Production environment should use a token starting with "live_".');
    } else if (environment === 'sandbox' && !clientToken.startsWith('test_')) {
      console.warn('[PADDLE] Warning: Sandbox environment should use a token starting with "test_".');
    }

    const paddle = await initializePaddle({
      environment,
      token: clientToken.trim(),
      checkout: {
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          variant: 'one-page',
          successUrl: `${window.location.origin}/welcome`,
        },
      },
    });

    if (!paddle) {
      throw new Error('Failed to initialize Paddle SDK instance.');
    }

    paddleInstance = paddle;
    return paddle;
  })();

  return initPromise;
}

/**
 * Fetches country-localized price preview for the given price IDs.
 * If countryCode is absent or invalid, Paddle auto-detects from visitor IP.
 */
export async function getPaddlePricePreview(
  priceIds: string[],
  countryCode?: string
): Promise<PricePreviewResponse | null> {
  if (!priceIds.length) return null;

  try {
    const paddle = await getPaddleInstance();

    const params: PricePreviewParams = {
      items: priceIds.map((priceId) => ({
        priceId,
        quantity: 1,
      })),
    };

    // Only pass valid 2-letter ISO country codes. Never pass 'OTHERS' or unknown sentinels.
    if (countryCode && /^[A-Z]{2}$/i.test(countryCode) && countryCode.toUpperCase() !== 'OTHERS') {
      params.address = {
        countryCode: countryCode.toUpperCase(),
      };
    }

    return await paddle.PricePreview(params);
  } catch (error) {
    console.error('[PADDLE] Error fetching price preview:', error);
    return null;
  }
}

export interface OpenCheckoutOptions {
  priceId: string;
  userEmail?: string;
  countryCode?: string;
  customData?: Record<string, string>;
}

/**
 * Opens Paddle Checkout as a one-page overlay.
 */
export async function openPaddleCheckout(options: OpenCheckoutOptions): Promise<void> {
  const { priceId, userEmail, countryCode, customData } = options;

  const paddle = await getPaddleInstance();

  const checkoutParams: Parameters<Paddle['Checkout']['open']>[0] = {
    items: [
      {
        priceId,
        quantity: 1,
      },
    ],
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      variant: 'one-page',
      successUrl: `${window.location.origin}/welcome`,
    },
  };

  const validCountry =
    countryCode && /^[A-Z]{2}$/i.test(countryCode) && countryCode.toUpperCase() !== 'OTHERS'
      ? countryCode.toUpperCase()
      : undefined;

  if (userEmail && userEmail.includes('@')) {
    checkoutParams.customer = {
      email: userEmail.trim(),
      ...(validCountry ? { address: { countryCode: validCountry } } : {}),
    };
  }

  if (customData) {
    checkoutParams.customData = customData;
  }

  paddle.Checkout.open(checkoutParams);
}
