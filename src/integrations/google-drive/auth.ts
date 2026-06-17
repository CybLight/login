type TokenRecord = {
  accessToken: string;
  expiresAt: number;
};

type TokenClient = {
  requestAccessToken: (options?: { prompt?: '' | 'none' | 'consent' | 'select_account' }) => void;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

import {
  GOOGLE_DRIVE_CLIENT_ID,
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_GSI_SCRIPT_URL,
  GOOGLE_USERINFO_URL,
  isGoogleDriveConfigured,
} from './config';

const TOKEN_STORAGE_KEY = 'cyb_google_drive_token';
const PROFILE_STORAGE_KEY = 'cyb_google_drive_profile';

export type GoogleDriveProfile = {
  email: string;
  name: string;
};

let scriptPromise: Promise<void> | null = null;

function readStoredToken(): TokenRecord | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenRecord;
    if (!parsed?.accessToken || !parsed.expiresAt) return null;
    if (parsed.expiresAt <= Date.now() + 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeToken(accessToken: string, expiresInSec: number): TokenRecord {
  const record: TokenRecord = {
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresInSec) * 1000,
  };
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage errors
  }
  return record;
}

export function clearGoogleDriveToken(): void {
  const stored = readStoredToken();
  if (stored?.accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(stored.accessToken);
  }
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasGoogleDriveSession(): boolean {
  return readStoredToken() !== null;
}

function readStoredProfile(): GoogleDriveProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleDriveProfile;
    if (!parsed?.email && !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeProfile(profile: GoogleDriveProfile): void {
  try {
    sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

function formatAccountLabel(profile: GoogleDriveProfile | null): string | null {
  if (!profile) return null;
  if (profile.name && profile.email && profile.name !== profile.email) {
    return `${profile.name} (${profile.email})`;
  }
  return profile.email || profile.name || null;
}

export function getGoogleDriveAccountLabel(): string | null {
  return formatAccountLabel(readStoredProfile());
}

async function fetchGoogleDriveUserProfile(accessToken: string): Promise<GoogleDriveProfile | null> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { email?: string; name?: string };
  const email = String(data.email || '').trim();
  const name = String(data.name || '').trim();
  if (!email && !name) return null;

  const profile = { email, name };
  storeProfile(profile);
  return profile;
}

export async function resolveGoogleDriveAccountLabel(): Promise<string | null> {
  const token = readStoredToken();
  if (!token) return null;

  const cached = getGoogleDriveAccountLabel();
  if (cached) return cached;

  const profile = await fetchGoogleDriveUserProfile(token.accessToken);
  return formatAccountLabel(profile);
}

async function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GOOGLE_GSI_SCRIPT_URL}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('google_script_load_failed')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_GSI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('google_script_load_failed'));
      document.head.appendChild(script);
    });
  }
  await scriptPromise;
  if (!window.google?.accounts?.oauth2) {
    throw new Error('google_script_load_failed');
  }
}

function requestAccessToken(prompt: '' | 'consent' | 'select_account' = 'select_account'): Promise<string> {
  if (!isGoogleDriveConfigured()) {
    return Promise.reject(new Error('google_drive_not_configured'));
  }

  return new Promise((resolve, reject) => {
    void loadGoogleIdentityScript()
      .then(() => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (!oauth2) {
          reject(new Error('google_script_load_failed'));
          return;
        }

        const client = oauth2.initTokenClient({
          client_id: GOOGLE_DRIVE_CLIENT_ID,
          scope: GOOGLE_DRIVE_SCOPE,
          callback: (response) => {
            if (response.error) {
              if (response.error === 'access_denied') {
                reject(new Error('google_drive_auth_denied'));
                return;
              }
              reject(new Error('google_drive_auth_failed'));
              return;
            }
            const accessToken = response.access_token;
            const expiresIn = Number(response.expires_in || 3600);
            if (!accessToken) {
              reject(new Error('google_drive_auth_failed'));
              return;
            }
            storeToken(accessToken, expiresIn);
            void fetchGoogleDriveUserProfile(accessToken);
            resolve(accessToken);
          },
          error_callback: () => {
            reject(new Error('google_drive_auth_failed'));
          },
        });

        client.requestAccessToken({ prompt });
      })
      .catch(reject);
  });
}

export async function getGoogleDriveAccessToken(options?: {
  interactive?: boolean;
}): Promise<string> {
  const cached = readStoredToken();
  if (cached) return cached.accessToken;

  if (options?.interactive === false) {
    throw new Error('google_drive_auth_required');
  }

  return requestAccessToken('select_account');
}
