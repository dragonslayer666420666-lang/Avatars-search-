import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const file = process.argv[2] || 'index.html';

if (!fs.existsSync(file)) {
  throw new Error(`${file} was not found.`);
}

const html = fs.readFileSync(file, 'utf8');

const secretPatterns = [
  /sk-or-v1-[A-Za-z0-9_-]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g
];

for (const pattern of secretPatterns) {
  if (pattern.test(html)) {
    throw new Error(`Possible secret detected by ${pattern}.`);
  }
}

const ids = [
  ...html.matchAll(/\bid=["']([^"']+)["']/g)
].map(m => m[1]);

const duplicateIds = [
  ...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))
];

if (duplicateIds.length) {
  throw new Error(
    `Duplicate HTML id(s): ${duplicateIds.join(', ')}`
  );
}

const refs = [
  ...html.matchAll(/getElementById\(["']([^"']+)["']\)/g),
  ...html.matchAll(/\$\(["']#([A-Za-z0-9_:-]+)["']\)/g)
].map(m => m[1]);

const idSet = new Set(ids);

const missingRefs = [
  ...new Set(refs.filter(id => !idSet.has(id)))
];

if (missingRefs.length) {
  throw new Error(
    `JavaScript references missing HTML id(s): ${missingRefs
      .slice(0, 30)
      .join(', ')}`
  );
}

const scripts = [
  ...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)
]
  .filter(match => !/\bsrc\s*=/.test(match[1]))
  .map(match => match[2]);

const combined = scripts.join('\n\n');

const temp = path.join(
  os.tmpdir(),
  `avatar-search-inline-${process.pid}.js`
);

fs.writeFileSync(temp, combined, 'utf8');

const checked = spawnSync(
  process.execPath,
  ['--check', temp],
  { encoding: 'utf8' }
);

fs.rmSync(temp, { force: true });

if (checked.status !== 0) {
  throw new Error(
    `Inline JavaScript syntax check failed:\n${checked.stderr || checked.stdout}`
  );
}

if (!/<\/html>\s*$/i.test(html)) {
  throw new Error('HTML closing tag is missing.');
}

console.log(
  `Validation passed: ${ids.length} ids, ${scripts.length} inline script block(s), no detected secrets.`
);
