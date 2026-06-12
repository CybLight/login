/**
 * Easter egg flags: pull server → localStorage and push local → server
 */

import { apiCall, getStorage } from '@/utils';
import type { EasterLoginPayload } from '@/types';
import {
  EASTER_KEY,
  DARK_TRIGGER_KEY,
  PROFILE_MIRROR_KEY,
  LIGHT_CATCHER_KEY,
  POSTMASTER_KEY,
  DEVELOPER_MODE_KEY,
} from '@/config/constants';

type ResolvedEasterFlags = {
  strawberry?: boolean;
  darkTrigger?: boolean;
  profileMirror?: boolean;
  lightCatcher?: boolean;
  postmaster?: boolean;
  developerMode?: boolean;
};

const EASTER_SYNC_TARGETS = [
  { storageKey: EASTER_KEY, flag: 'strawberry' as const, endpoint: '/auth/easter/strawberry' },
  {
    storageKey: DARK_TRIGGER_KEY,
    flag: 'darkTrigger' as const,
    endpoint: '/auth/easter/dark-trigger',
  },
  {
    storageKey: PROFILE_MIRROR_KEY,
    flag: 'profileMirror' as const,
    endpoint: '/auth/easter/profile-mirror',
  },
  {
    storageKey: LIGHT_CATCHER_KEY,
    flag: 'lightCatcher' as const,
    endpoint: '/auth/easter/light-catcher',
  },
  {
    storageKey: POSTMASTER_KEY,
    flag: 'postmaster' as const,
    endpoint: '/auth/easter/postmaster',
  },
  {
    storageKey: DEVELOPER_MODE_KEY,
    flag: 'developerMode' as const,
    endpoint: '/auth/easter/developer-mode',
  },
] as const;

export function extractEasterFlags(payload: EasterLoginPayload): ResolvedEasterFlags {
  const easter = payload?.easter ?? payload?.user?.easter;
  const flags = Array.isArray(payload?.flags)
    ? payload.flags
    : Array.isArray(payload?.user?.flags)
      ? payload.user.flags
      : [];

  const strawberryFromEaster =
    typeof easter?.strawberry === 'boolean' ? easter.strawberry : undefined;
  const darkTriggerFromEaster =
    typeof easter?.darkTrigger === 'boolean'
      ? easter.darkTrigger
      : typeof easter?.dark_trigger === 'boolean'
        ? easter.dark_trigger
        : undefined;
  const profileMirrorFromEaster =
    typeof easter?.profileMirror === 'boolean'
      ? easter.profileMirror
      : typeof easter?.profile_mirror === 'boolean'
        ? easter.profile_mirror
        : undefined;
  const lightCatcherFromEaster =
    typeof easter?.lightCatcher === 'boolean'
      ? easter.lightCatcher
      : typeof easter?.light_catcher === 'boolean'
        ? easter.light_catcher
        : undefined;
  const postmasterFromEaster =
    typeof easter?.postmaster === 'boolean' ? easter.postmaster : undefined;
  const developerModeFromEaster =
    typeof easter?.developerMode === 'boolean'
      ? easter.developerMode
      : typeof easter?.developer_mode === 'boolean'
        ? easter.developer_mode
        : undefined;

  const strawberryFromFlags =
    flags.includes('strawberry') ||
    flags.includes('strawberry_unlocked') ||
    flags.includes('easter_strawberry');
  const darkTriggerFromFlags =
    flags.includes('dark_trigger') ||
    flags.includes('dark_trigger_unlocked') ||
    flags.includes('easter_dark_trigger');
  const profileMirrorFromFlags =
    flags.includes('profile_mirror') ||
    flags.includes('profile_mirror_unlocked') ||
    flags.includes('easter_profile_mirror');
  const lightCatcherFromFlags =
    flags.includes('light_catcher') ||
    flags.includes('light_catcher_unlocked') ||
    flags.includes('easter_light_catcher');
  const postmasterFromFlags =
    flags.includes('postmaster') ||
    flags.includes('postmaster_unlocked') ||
    flags.includes('easter_postmaster');
  const developerModeFromFlags =
    flags.includes('developer_mode') ||
    flags.includes('developer_mode_unlocked') ||
    flags.includes('easter_developer_mode');

  return {
    strawberry: strawberryFromEaster ?? (strawberryFromFlags ? true : undefined),
    darkTrigger: darkTriggerFromEaster ?? (darkTriggerFromFlags ? true : undefined),
    profileMirror: profileMirrorFromEaster ?? (profileMirrorFromFlags ? true : undefined),
    lightCatcher: lightCatcherFromEaster ?? (lightCatcherFromFlags ? true : undefined),
    postmaster: postmasterFromEaster ?? (postmasterFromFlags ? true : undefined),
    developerMode: developerModeFromEaster ?? (developerModeFromFlags ? true : undefined),
  };
}

function pullEasterFlagsToStorage(source: ResolvedEasterFlags): void {
  if (source.strawberry === true) {
    localStorage.setItem(EASTER_KEY, '1');
  }

  if (source.darkTrigger === true) {
    localStorage.setItem(DARK_TRIGGER_KEY, '1');
  }

  if (source.profileMirror === true) {
    localStorage.setItem(PROFILE_MIRROR_KEY, '1');
  }

  if (source.lightCatcher === true) {
    localStorage.setItem(LIGHT_CATCHER_KEY, '1');
  }

  if (source.postmaster === true) {
    localStorage.setItem(POSTMASTER_KEY, '1');
  }

  if (source.developerMode === true) {
    localStorage.setItem(DEVELOPER_MODE_KEY, '1');
  }
}

function hasLocalEasterFlag(storageKey: string): boolean {
  return getStorage(storageKey) === '1';
}

export async function pushLocalEasterFlagsToServer(
  serverFlags?: ResolvedEasterFlags
): Promise<void> {
  let flags = serverFlags;

  if (!flags) {
    try {
      const meRes = await apiCall('/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (!meRes.ok) return;

      const meData = await meRes.json().catch(() => ({}));
      flags = extractEasterFlags(meData);
    } catch {
      return;
    }
  }

  for (const { storageKey, flag, endpoint } of EASTER_SYNC_TARGETS) {
    if (!hasLocalEasterFlag(storageKey)) continue;
    if (flags[flag] === true) continue;

    try {
      const res = await apiCall(endpoint, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        console.warn(`[EASTER] Failed to sync ${flag} to server:`, res.status);
      }
    } catch (error) {
      console.warn(`[EASTER] Error syncing ${flag}:`, error);
    }
  }
}

export async function syncEasterAfterLogin(loginPayload: EasterLoginPayload): Promise<void> {
  pullEasterFlagsToStorage(extractEasterFlags(loginPayload));

  try {
    const meRes = await apiCall('/auth/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (!meRes.ok) {
      await pushLocalEasterFlagsToServer(extractEasterFlags(loginPayload));
      return;
    }

    const meData = await meRes.json().catch(() => ({}));
    const serverFlags = extractEasterFlags(meData);
    pullEasterFlagsToStorage(serverFlags);
    await pushLocalEasterFlagsToServer(serverFlags);
  } catch (syncError) {
    console.warn('[EASTER] Sync skipped:', syncError);
    await pushLocalEasterFlagsToServer(extractEasterFlags(loginPayload));
  }
}
