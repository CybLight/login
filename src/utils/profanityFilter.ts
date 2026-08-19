/**
 * Comprehensive Profanity & 18+ content filter for User Badges, Titles and Usernames
 * Protects against Leetspeak, Digit-interleaving, Homoglyphs, Transliteration, and Spacers.
 */

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '6': 'b',
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
  'ъ': '',
  'ы': 'y',
  'ь': '',
  'э': 'e',
  'ю': 'yu',
  'я': 'ya',
};

const LATIN_TO_CYRILLIC_LOOKALIKE: Record<string, string> = {
  'a': 'а',
  'b': 'б',
  'c': 'с',
  'e': 'е',
  'h': 'х',
  'i': 'и',
  'k': 'к',
  'm': 'м',
  'n': 'п',
  'o': 'о',
  'p': 'р',
  's': 'с',
  't': 'т',
  'u': 'и',
  'v': 'в',
  'x': 'х',
  'y': 'у',
};

const DIRECT_CYRILLIC_PATTERNS = [
  /секс/i,
  /порн/i,
  /ххх/i,
  /18\+/i,
  /эротик/i,
  /хентай/i,
  /нюдс/i,
  /сиськ/i,
  /сиси/i,
  /член/i,
  /пинис/i,
  /пенис/i,
  /вагин/i,
  /минет/i,
  /куни/i,
  /куннил/i,
  /дроч/i,
  /мастурб/i,
  /оргазм/i,
  /эскорт/i,
  /проститут/i,
  /шлюх/i,
  /шмар/i,
  /шалав/i,
  /бляд/i,
  /бля/i,
  /хуй/i,
  /хуе/i,
  /хуи/i,
  /хуя/i,
  /хер/i,
  /пизд/i,
  /ебат/i,
  /ебал/i,
  /ебан/i,
  /ебет/i,
  /еблан/i,
  /ебло/i,
  /заеб/i,
  /наеб/i,
  /поеб/i,
  /выеб/i,
  /сука/i,
  /сучк/i,
  /пидор/i,
  /пидар/i,
  /педик/i,
  /залуп/i,
  /гандон/i,
  /гондон/i,
  /мудак/i,
  /мудил/i,
  /ублюд/i,
  /даун/i,
  /дебил/i,
  /тварь/i,
  /чмо/i,
  /петух/i,
  /лох/i,
  /наркот/i,
  /кокаин/i,
  /героин/i,
  /мефедрон/i,
  /спайс/i,
  /соли/i,
];

const FORBIDDEN_LATIN_PATTERNS = [
  /sex/i,
  /seks/i,
  /porn/i,
  /porno/i,
  /xxx/i,
  /18\+/i,
  /hentai/i,
  /hent/i,
  /nude/i,
  /nsfw/i,
  /erot/i,
  /erotic/i,
  /anal/i,
  /oral/i,
  /vagin/i,
  /penis/i,
  /chlen/i,
  /dick/i,
  /cock/i,
  /pussy/i,
  /boob/i,
  /tits/i,
  /siski/i,
  /sisek/i,
  /sisi/i,
  /clit/i,
  /cum/i,
  /sperm/i,
  /dildo/i,
  /blowjob/i,
  /minet/i,
  /kuni/i,
  /droch/i,
  /masturb/i,
  /orgasm/i,
  /escort/i,
  /eskort/i,
  /prostitut/i,
  /putan/i,
  /ebal/i,
  /ebat/i,
  /ebash/i,
  /eblan/i,
  /ebat/i,
  /ebanut/i,
  /ebun/i,
  /ebet/i,
  /ebalo/i,
  /ebli/i,
  /bljad/i,
  /blyad/i,
  /blya/i,
  /blat/i,
  /hui/i,
  /huy/i,
  /xui/i,
  /xuy/i,
  /pizd/i,
  /pzd/i,
  /zaeb/i,
  /naeb/i,
  /poeb/i,
  /suka/i,
  /suchk/i,
  /pidor/i,
  /pidar/i,
  /pedik/i,
  /zalup/i,
  /gandon/i,
  /prezik/i,
  /mandal/i,
  /mudak/i,
  /mudil/i,
  /ublyud/i,
  /shlyuh/i,
  /shmara/i,
  /shalav/i,
  /daun/i,
  /autist/i,
  /debil/i,
  /tvar/i,
  /chmo/i,
  /petuh/i,
  /loh/i,
  /fuck/i,
  /fuk/i,
  /fck/i,
  /bitch/i,
  /asshole/i,
  /cunt/i,
  /whore/i,
  /slut/i,
  /nigger/i,
  /nigga/i,
  /faggot/i,
  /fag/i,
  /bastard/i,
  /twat/i,
  /retard/i,
  /bullshit/i,
  /shit/i,
  /scam/i,
  /casino/i,
  /drug/i,
  /kokain/i,
  /geroin/i,
  /weed/i,
];

export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const raw = text.trim().toLowerCase();

  // 1. Direct check on raw string
  for (const regex of DIRECT_CYRILLIC_PATTERNS) {
    if (regex.test(raw)) return true;
  }
  for (const regex of FORBIDDEN_LATIN_PATTERNS) {
    if (regex.test(raw)) return true;
  }

  // 2. Digit-strip check: remove all digits and symbols (e.g. "C1E1K1C" -> "cekc")
  const lettersOnly = raw.replace(/[^а-яa-z]/gi, '');
  const lettersDeduplicated = lettersOnly.replace(/(.)\1+/g, '$1');

  for (const str of [lettersOnly, lettersDeduplicated]) {
    for (const regex of DIRECT_CYRILLIC_PATTERNS) {
      if (regex.test(str)) return true;
    }
    for (const regex of FORBIDDEN_LATIN_PATTERNS) {
      if (regex.test(str)) return true;
    }
  }

  // 3. Convert Latin letters in lettersOnly to Cyrillic lookalikes (e.g. "cekc" -> "секс")
  let latinToCyr = '';
  for (let i = 0; i < lettersOnly.length; i++) {
    const ch = lettersOnly[i];
    latinToCyr += LATIN_TO_CYRILLIC_LOOKALIKE[ch] !== undefined ? LATIN_TO_CYRILLIC_LOOKALIKE[ch] : ch;
  }
  const cyrDeduplicated = latinToCyr.replace(/(.)\1+/g, '$1');

  for (const str of [latinToCyr, cyrDeduplicated]) {
    for (const regex of DIRECT_CYRILLIC_PATTERNS) {
      if (regex.test(str)) return true;
    }
  }

  // 4. Leetspeak substitution check (digits/symbols converted to letters: 4->a, 3->e, 1->i, 0->o, etc.)
  let leetTranslit = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    leetTranslit += LEET_MAP[ch] !== undefined ? LEET_MAP[ch] : ch;
  }

  const leetStripped = leetTranslit.replace(/[^a-z0-9]/gi, '');
  const leetLettersOnly = leetTranslit.replace(/[^a-z]/gi, '');
  const leetDeduplicated = leetLettersOnly.replace(/(.)\1+/g, '$1');

  for (const str of [leetTranslit, leetStripped, leetLettersOnly, leetDeduplicated]) {
    for (const regex of FORBIDDEN_LATIN_PATTERNS) {
      if (regex.test(str)) return true;
    }
  }

  // 5. Check phonetic transformations (e.g., 'c' -> 's', 'k' -> 'c')
  const phoneticS = leetLettersOnly.replace(/c/g, 's').replace(/k/g, 'c');
  const phoneticDeduplicated = phoneticS.replace(/(.)\1+/g, '$1');
  for (const str of [phoneticS, phoneticDeduplicated]) {
    for (const regex of FORBIDDEN_LATIN_PATTERNS) {
      if (regex.test(str)) return true;
    }
  }

  return false;
}
