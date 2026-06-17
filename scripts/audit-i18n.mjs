import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory() && !['node_modules', 'dist'].includes(f)) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

function unescapeJsString(body) {
  return body
    .replace(/\\\\/g, '\u0000')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\`/g, '`')
    .replace(/\u0000/g, '\\');
}

function extractTKeys(files) {
  const keys = new Set();
  const re = /\bt\(\s*(['"`])([\s\S]*?)\1/g;
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(s))) {
      if (!m[2].includes('${')) keys.add(unescapeJsString(m[2]));
    }
  }
  return keys;
}

async function main() {
  const files = walk(path.join(ROOT, 'src'));
  const used = extractTKeys(files);

  const enMod = await import(pathToFileURL(path.join(ROOT, 'src/i18n/locales/en.ts')).href);
  const ukMod = await import(pathToFileURL(path.join(ROOT, 'src/i18n/locales/uk.ts')).href);
  const enKeys = new Set(Object.keys(enMod.en));
  const ukKeys = new Set(Object.keys(ukMod.uk));

  const missingEn = [...used].filter((k) => !enKeys.has(k)).sort();
  const missingUk = [...used].filter((k) => !ukKeys.has(k)).sort();
  const onlyEn = [...enKeys].filter((k) => !ukKeys.has(k));
  const onlyUk = [...ukKeys].filter((k) => !enKeys.has(k));
  const untranslatedEn = [...enKeys].filter((k) => enMod.en[k] === k);
  const untranslatedUk = [...ukKeys].filter((k) => ukMod.uk[k] === k);

  console.log('=== login.cyblight.org i18n audit ===');
  console.log('t() keys in source:', used.size);
  console.log('en map:', enKeys.size, '| uk map:', ukKeys.size);
  console.log('');
  console.log('Missing EN translations:', missingEn.length);
  missingEn.forEach((k) => console.log('  -', JSON.stringify(k)));
  console.log('');
  console.log('Missing UK translations:', missingUk.length);
  missingUk.forEach((k) => console.log('  -', JSON.stringify(k)));
  console.log('');
  console.log('EN keys not in UK:', onlyEn.length);
  onlyEn.forEach((k) => console.log('  -', JSON.stringify(k)));
  console.log('');
  console.log('UK keys not in EN:', onlyUk.length);
  onlyUk.forEach((k) => console.log('  -', JSON.stringify(k)));
  console.log('');
  console.log('EN value equals RU key (likely untranslated):', untranslatedEn.length);
  untranslatedEn.forEach((k) => console.log('  -', JSON.stringify(k)));
  console.log('');
  console.log('UK value equals RU key (likely untranslated):', untranslatedUk.length);
  untranslatedUk.forEach((k) => console.log('  -', JSON.stringify(k)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
