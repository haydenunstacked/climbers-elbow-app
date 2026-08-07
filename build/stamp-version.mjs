// Stamps sw.js's cache VERSION with a hash of everything it precaches.
// Without this, editing a file leaves users on the old cached copy forever,
// because the cache name never changes and the activate handler only purges
// caches whose name differs. Run this on every deploy.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = join(ROOT, 'sw.js');

const src = readFileSync(SW, 'utf8');

const start = src.indexOf('const PRECACHE');
const list = [...src.slice(start, src.indexOf('];', start)).matchAll(/'([^']+)'/g)]
  .map((m) => m[1])
  .filter((p) => p !== './');

const hash = createHash('sha256');
for (const rel of list.sort()) {
  hash.update(rel);
  hash.update(readFileSync(join(ROOT, rel)));
}
const version = hash.digest('hex').slice(0, 10);

const next = src.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
if (next === src && !src.includes(`'${version}'`)) {
  throw new Error('could not find the VERSION line to stamp');
}
writeFileSync(SW, next);
console.log(`sw.js cache version -> ${version} (${list.length} files)`);
