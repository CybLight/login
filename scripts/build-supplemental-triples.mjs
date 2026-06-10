/**
 * Builds scripts/supplemental-triples.mjs from missing-keys.json + translation map.
 * Run: node scripts/build-supplemental-triples.mjs && node scripts/gen-i18n-maps.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import missing from './missing-keys.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Record<string, [string, string]>} */
const T = {
  ...(await import('./supplemental-part1.json', { with: { type: 'json' } })).default,
  ...(await import('./supplemental-part2.json', { with: { type: 'json' } })).default,
  ...(await import('./supplemental-part3.json', { with: { type: 'json' } })).default,
};

// Keys already in base gen-i18n-maps or regex false positives — skip.
const SKIP = new Set([
  'Логин: только латиница (A–Z), цифры (0–9) и ',
  'Регистрация прошла, но сессия не установилась (cookie заблокирована). Проверь CORS / credentials.',
]);

const gen = fs.readFileSync(path.join(__dirname, 'gen-i18n-maps.mjs'), 'utf8');
const tripleRe = /\[\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,/gs;
const existing = new Set();
for (const m of gen.matchAll(tripleRe)) existing.add(m[2]);

const triples = [];
const gaps = [];
for (const ru of missing) {
  if (SKIP.has(ru) || existing.has(ru)) continue;
  const tr = T[ru];
  if (!tr) {
    gaps.push(ru);
    continue;
  }
  triples.push([ru, tr[0], tr[1]]);
}

if (gaps.length) {
  console.error('Missing translations for', gaps.length, 'keys:');
  gaps.forEach((k) => console.error(' -', JSON.stringify(k)));
  process.exit(1);
}

const body = triples
  .map(([ru, uk, en]) => `  [${JSON.stringify(ru)}, ${JSON.stringify(uk)}, ${JSON.stringify(en)}],`)
  .join('\n');

// Manual extras (presence labels, etc.) — not always in missing-keys scan
const MANUAL_EXTRAS = Object.entries(
  (await import('./supplemental-manual.json', { with: { type: 'json' } })).default,
).map(([ru, [uk, en]]) => [ru, uk, en]);

const allSupplemental = [...triples];
const seen = new Set(triples.map(([ru]) => ru));
for (const row of MANUAL_EXTRAS) {
  if (!seen.has(row[0])) {
    allSupplemental.push(row);
    seen.add(row[0]);
  }
}

const bodyAll = allSupplemental
  .map(([ru, uk, en]) => `  [${JSON.stringify(ru)}, ${JSON.stringify(uk)}, ${JSON.stringify(en)}],`)
  .join('\n');

const out = `/** Auto-generated — run: node scripts/build-supplemental-triples.mjs */\nexport const supplementalTriples = [\n${bodyAll}\n];\n`;
fs.writeFileSync(path.join(__dirname, 'supplemental-triples.mjs'), out, 'utf8');
console.log('Wrote', allSupplemental.length, 'supplemental triples', `(${MANUAL_EXTRAS.length} manual)`);
