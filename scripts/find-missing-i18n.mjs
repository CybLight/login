import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory() && f !== 'node_modules' && f !== 'locales') walk(p, acc);
    else if (/\.(ts|tsx|js)$/.test(f)) acc.push(p);
  }
  return acc;
}

const keys = new Set();
const re = /t\(\s*['"`]([^'"`]+)['"`]/g;
for (const f of walk(path.join(ROOT, 'src'))) {
  const c = fs.readFileSync(f, 'utf8');
  for (const m of c.matchAll(re)) keys.add(m[1]);
}

const gen = fs.readFileSync(path.join(ROOT, 'scripts/gen-i18n-maps.mjs'), 'utf8');
const tripleRe = /\[\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,\s*(['"`])((?:\\.|(?!\3).)*)\3\s*,\s*(['"`])((?:\\.|(?!\5).)*)\5\s*\]/gs;
const triples = [];
for (const m of gen.matchAll(tripleRe)) triples.push(m[2]);
const tripleSet = new Set(triples);
const cyr = /[А-Яа-яЁёІіЇїЄєҐґ]/;
const missing = [...keys].filter((k) => !tripleSet.has(k) && cyr.test(k)).sort();

const outPath = path.join(ROOT, 'scripts/missing-keys.json');
fs.writeFileSync(outPath, JSON.stringify(missing, null, 2), 'utf8');
console.log('Total t() keys:', keys.size);
console.log('In triples:', triples.length);
console.log('Missing Cyrillic:', missing.length);
console.log('Wrote', outPath);
