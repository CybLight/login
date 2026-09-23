/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_TURNSTILE_SITEKEY?: string;
  readonly VITE_ENABLE_ANALYTICS?: string;
  readonly VITE_ENABLE_ERROR_REPORTING?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_GOOGLE_DRIVE_CLIENT_ID?: string;
  readonly VITE_MONOBANK_JAR_SEND_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
