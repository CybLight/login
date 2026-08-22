/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_TURNSTILE_SITEKEY?: string;
  readonly VITE_ENABLE_ANALYTICS?: string;
  readonly VITE_ENABLE_ERROR_REPORTING?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_GOOGLE_DRIVE_CLIENT_ID?: string;
  readonly VITE_PADDLE_ENVIRONMENT?: string;
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
  readonly VITE_PADDLE_PRICE_STARTER_MONTH?: string;
  readonly VITE_PADDLE_PRICE_STARTER_YEAR?: string;
  readonly VITE_PADDLE_PRICE_PRO_MONTH?: string;
  readonly VITE_PADDLE_PRICE_PRO_YEAR?: string;
  readonly VITE_PADDLE_PRICE_ADVANCED_MONTH?: string;
  readonly VITE_PADDLE_PRICE_ADVANCED_YEAR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
