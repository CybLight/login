/**
 * Reserved & Restricted Username Verification
 * Blocks usernames containing administrative, system, or CybLight-official keywords.
 */

const RESERVED_ADMIN_STEMS = [
  'cyblight',
  'cyblite',
  'admin',
  'administrator',
  'moder',
  'moderator',
  'moderation',
  'support',
  'supporter',
  'developer',
  'devteam',
  'sysadmin',
  'system',
  'root',
  'superuser',
  'security',
  'official',
  'staff',
  'helpdesk',
  'owner',
  'founder',
  'creator',
];

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  'а': 'a',
  'б': 'b',
  'в': 'v',
  'г': 'g',
  'д': 'd',
  'е': 'e',
  'ё': 'e',
  'ж': 'zh',
  'з': 'z',
  'и': 'i',
  'й': 'i',
  'к': 'k',
  'л': 'l',
  'м': 'm',
  'н': 'n',
  'о': 'o',
  'п': 'p',
  'р': 'r',
  'с': 's',
  'т': 't',
  'у': 'u',
  'ф': 'f',
  'х': 'h',
  'ц': 'ts',
  'ч': 'ch',
  'ш': 'sh',
  'щ': 'sch',
  'ы': 'y',
  'э': 'e',
  'ю': 'yu',
  'я': 'ya',
};

/**
 * Checks if a username is reserved for site administration or system services.
 * @returns true if the username is forbidden/reserved, false if allowed.
 */
export function isReservedUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;

  const raw = username.trim().toLowerCase();

  // 1. Check raw lowercase and stripped
  const rawStripped = raw.replace(/[^a-z0-9]/gi, '');
  for (const stem of RESERVED_ADMIN_STEMS) {
    if (raw.includes(stem) || rawStripped.includes(stem)) {
      return true;
    }
  }

  // 2. Normalized leetspeak check (e.g. 4dm1n, cybl1ght, m0d3r, 5upp0rt)
  let normalized = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    normalized += LEET_MAP[ch] !== undefined ? LEET_MAP[ch] : ch;
  }

  const normalizedStripped = normalized.replace(/[^a-z]/gi, '');
  const deduplicated = normalizedStripped.replace(/(.)\1+/g, '$1');

  for (const str of [normalized, normalizedStripped, deduplicated]) {
    for (const stem of RESERVED_ADMIN_STEMS) {
      if (str.includes(stem)) {
        return true;
      }
    }
  }

  return false;
}
