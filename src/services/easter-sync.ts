/**
 * Easter egg flags: pull server → localStorage and push local → server
 */

import { apiCall, getStorage } from '@/utils';
import { allowsFunctionalConsent } from '@/utils/privacy-guard';
import type { EasterLoginPayload } from '@/types';
import {
  EASTER_KEY,
  DARK_TRIGGER_KEY,
  PROFILE_MIRROR_KEY,
  LIGHT_CATCHER_KEY,
  POSTMASTER_KEY,
  DEVELOPER_MODE_KEY,
  THEME_FLUX_KEY,
} from '@/config/constants';

type ResolvedEasterFlags = {
  strawberry?: boolean;
  darkTrigger?: boolean;
  profileMirror?: boolean;
  lightCatcher?: boolean;
  postmaster?: boolean;
  developerMode?: boolean;
  themeFlux?: boolean;
  nightGuard?: boolean;
  trustedFingerprint?: boolean;
  bridge?: boolean;
  bridgeWebToday?: boolean;
  bridgeAppToday?: boolean;
  echo?: boolean;
  archivist?: boolean;
  typographer?: boolean;
  spoilerHunter?: boolean;
  noMarkers?: boolean;
  enterMaster?: boolean;
  fontExtremes?: boolean;
  cloudKeeper?: boolean;
  drivePilot?: boolean;
  liveWire?: boolean;
  fromShadow?: boolean;
  watchman?: boolean;
  carouselWatcher?: boolean;
  formatMirror?: boolean;
  formatMirrorWebToday?: boolean;
  formatMirrorAppToday?: boolean;
  synchronist?: boolean;
  quoteDay?: boolean;
  midnightEditor?: boolean;
  polyglotFriend?: boolean;
  silence?: boolean;
  reactionStreak?: boolean;
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
  {
    storageKey: THEME_FLUX_KEY,
    flag: 'themeFlux' as const,
    endpoint: '/auth/easter/theme-flux',
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
  const themeFluxFromEaster =
    typeof easter?.themeFlux === 'boolean'
      ? easter.themeFlux
      : typeof easter?.theme_flux === 'boolean'
        ? easter.theme_flux
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
  const themeFluxFromFlags =
    flags.includes('theme_flux') ||
    flags.includes('theme_flux_unlocked') ||
    flags.includes('easter_theme_flux');

  return {
    strawberry: strawberryFromEaster ?? (strawberryFromFlags ? true : undefined),
    darkTrigger: darkTriggerFromEaster ?? (darkTriggerFromFlags ? true : undefined),
    profileMirror: profileMirrorFromEaster ?? (profileMirrorFromFlags ? true : undefined),
    lightCatcher: lightCatcherFromEaster ?? (lightCatcherFromFlags ? true : undefined),
    postmaster: postmasterFromEaster ?? (postmasterFromFlags ? true : undefined),
    developerMode: developerModeFromEaster ?? (developerModeFromFlags ? true : undefined),
    themeFlux: themeFluxFromEaster ?? (themeFluxFromFlags ? true : undefined),
    nightGuard: typeof easter?.nightGuard === 'boolean' ? easter.nightGuard : undefined,
    trustedFingerprint:
      typeof easter?.trustedFingerprint === 'boolean'
        ? easter.trustedFingerprint
        : typeof easter?.trusted_fingerprint === 'boolean'
          ? easter.trusted_fingerprint
          : undefined,
    bridge: typeof easter?.bridge === 'boolean' ? easter.bridge : undefined,
    bridgeWebToday:
      typeof easter?.bridgeWebToday === 'boolean'
        ? easter.bridgeWebToday
        : typeof easter?.bridge_web_today === 'boolean'
          ? easter.bridge_web_today
          : undefined,
    bridgeAppToday:
      typeof easter?.bridgeAppToday === 'boolean'
        ? easter.bridgeAppToday
        : typeof easter?.bridge_app_today === 'boolean'
          ? easter.bridge_app_today
          : undefined,
    echo: typeof easter?.echo === 'boolean' ? easter.echo : undefined,
    archivist: typeof easter?.archivist === 'boolean' ? easter.archivist : undefined,
    typographer: typeof easter?.typographer === 'boolean' ? easter.typographer : undefined,
    spoilerHunter:
      typeof easter?.spoilerHunter === 'boolean'
        ? easter.spoilerHunter
        : typeof easter?.spoiler_hunter === 'boolean'
          ? easter.spoiler_hunter
          : undefined,
    noMarkers:
      typeof easter?.noMarkers === 'boolean'
        ? easter.noMarkers
        : typeof easter?.no_markers === 'boolean'
          ? easter.no_markers
          : undefined,
    enterMaster:
      typeof easter?.enterMaster === 'boolean'
        ? easter.enterMaster
        : typeof easter?.enter_master === 'boolean'
          ? easter.enter_master
          : undefined,
    fontExtremes:
      typeof easter?.fontExtremes === 'boolean'
        ? easter.fontExtremes
        : typeof easter?.font_extremes === 'boolean'
          ? easter.font_extremes
          : undefined,
    cloudKeeper:
      typeof easter?.cloudKeeper === 'boolean'
        ? easter.cloudKeeper
        : typeof easter?.cloud_keeper === 'boolean'
          ? easter.cloud_keeper
          : undefined,
    drivePilot:
      typeof easter?.drivePilot === 'boolean'
        ? easter.drivePilot
        : typeof easter?.drive_pilot === 'boolean'
          ? easter.drive_pilot
          : undefined,
    liveWire:
      typeof easter?.liveWire === 'boolean'
        ? easter.liveWire
        : typeof easter?.live_wire === 'boolean'
          ? easter.live_wire
          : undefined,
    fromShadow:
      typeof easter?.fromShadow === 'boolean'
        ? easter.fromShadow
        : typeof easter?.from_shadow === 'boolean'
          ? easter.from_shadow
          : undefined,
    watchman: typeof easter?.watchman === 'boolean' ? easter.watchman : undefined,
    carouselWatcher:
      typeof easter?.carouselWatcher === 'boolean'
        ? easter.carouselWatcher
        : typeof easter?.carousel_watcher === 'boolean'
          ? easter.carousel_watcher
          : undefined,
    formatMirror:
      typeof easter?.formatMirror === 'boolean'
        ? easter.formatMirror
        : typeof easter?.format_mirror === 'boolean'
          ? easter.format_mirror
          : undefined,
    formatMirrorWebToday:
      typeof easter?.formatMirrorWebToday === 'boolean'
        ? easter.formatMirrorWebToday
        : typeof easter?.format_mirror_web_today === 'boolean'
          ? easter.format_mirror_web_today
          : undefined,
    formatMirrorAppToday:
      typeof easter?.formatMirrorAppToday === 'boolean'
        ? easter.formatMirrorAppToday
        : typeof easter?.format_mirror_app_today === 'boolean'
          ? easter.format_mirror_app_today
          : undefined,
    synchronist: typeof easter?.synchronist === 'boolean' ? easter.synchronist : undefined,
    quoteDay:
      typeof easter?.quoteDay === 'boolean'
        ? easter.quoteDay
        : typeof easter?.quote_day === 'boolean'
          ? easter.quote_day
          : undefined,
    midnightEditor:
      typeof easter?.midnightEditor === 'boolean'
        ? easter.midnightEditor
        : typeof easter?.midnight_editor === 'boolean'
          ? easter.midnight_editor
          : undefined,
    polyglotFriend:
      typeof easter?.polyglotFriend === 'boolean'
        ? easter.polyglotFriend
        : typeof easter?.polyglot_friend === 'boolean'
          ? easter.polyglot_friend
          : undefined,
    silence: typeof easter?.silence === 'boolean' ? easter.silence : undefined,
    reactionStreak:
      typeof easter?.reactionStreak === 'boolean'
        ? easter.reactionStreak
        : typeof easter?.reaction_streak === 'boolean'
          ? easter.reaction_streak
          : undefined,
  };
}

function pullEasterFlagsToStorage(source: ResolvedEasterFlags): void {
  if (!allowsFunctionalConsent()) return;

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

  if (source.themeFlux === true) {
    localStorage.setItem(THEME_FLUX_KEY, '1');
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
