const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src');
const FILE_EXT = /\.(ts|tsx|js|jsx|html)$/i;

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  list.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(full));
    } else if (FILE_EXT.test(entry.name)) {
      results.push(full);
    }
  });
  return results;
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|\s+/g, ' ')
    .trim();
}

// simple emoji detection: contains any emoji-range or dingbats
const emojiRegex = /[\u231A-\u32FF\u1F300-\u1F6FF\u1F900-\u1F9FF\u2600-\u26FF\u2700-\u27BF]/u;

const files = walk(ROOT);
let changedFiles = 0;
let changedCount = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  // regex to find button tags (non-greedy)
  const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  content = content.replace(re, (match, attrs, inner) => {
    const hasAria = /aria-label=|aria-labelledby=/.test(attrs);
    if (hasAria) return match;

    const titleMatch = /title\s*=\s*"([^"]*)"/.exec(attrs) || /title\s*=\s*'([^']*)'/.exec(attrs);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const innerText = stripTags(inner);
    const innerHasEmoji = emojiRegex.test(inner);
    const innerIsSvg = /<svg\b/i.test(inner);
    const innerIsIconChars =
      innerText.length > 0 && innerText.length <= 3 && !/[A-Za-zА-Яа-я0-9]/.test(innerText);

    if (innerText === '' && !innerIsSvg) {
      return match; // nothing to derive
    }

    if (!(innerHasEmoji || innerIsSvg || innerIsIconChars)) {
      return match; // likely has readable text
    }

    // derive label
    let label = '';
    if (title) label = title;
    else if (innerHasEmoji) label = innerText.replace(/\s+/g, ' ').trim();
    else {
      const dataAction =
        /data-action\s*=\s*"([^"]+)"/.exec(attrs) || /data-action\s*=\s*'([^']+)'/.exec(attrs);
      if (dataAction) label = dataAction[1];
      else {
        const cls = /class\s*=\s*"([^"]+)"/.exec(attrs) || /class\s*=\s*'([^']+)'/.exec(attrs);
        if (cls) label = cls[1].split(/\s+/)[0];
        else label = 'кнопка';
      }
    }

    label = label.replace(/"/g, '');
    // insert aria-label before closing of opening tag
    const newAttrs = attrs + (attrs.trim().length ? ' ' : ' ') + `aria-label=\"${label}\"`;
    changedCount++;
    return `<button${newAttrs}>${inner}</button>`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
  }
});

console.log(
  `Scanned ${files.length} files. Modified ${changedFiles} files, added ${changedCount} aria labels.`
);
process.exit(0);
