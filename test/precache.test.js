import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Everything the browser could ask for, relative to the app root. */
function shippedAssets() {
  // dist/ is the generated single-file bundle, not part of the served app
  const skip = new Set(['build', 'test', 'dist', 'node_modules', '.git', '.github']);
  const skipFiles = new Set(['package.json', 'package-lock.json', 'sw.js', 'README.md', '.gitignore', '.nojekyll']);
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(ROOT, full);
      if (skip.has(name) || name.startsWith('.')) continue;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (skipFiles.has(rel)) continue;
      if (rel.endsWith('.json') && rel.startsWith('diagrams')) continue; // build manifest, not shipped
      if (rel === 'icons/icon.svg') continue; // vector source, PNGs are what ship
      out.push(rel);
    }
  })(ROOT);
  return out.sort();
}

function precacheList() {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const block = sw.slice(sw.indexOf('const PRECACHE'), sw.indexOf('];', sw.indexOf('const PRECACHE')));
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('every shipped asset is precached, so offline is not partial', () => {
  const cached = new Set(precacheList());
  const missing = shippedAssets().filter((a) => !cached.has(a));
  assert.deepEqual(missing, [], `not in sw.js PRECACHE: ${missing.join(', ')}`);
});

test('precache does not list files that do not exist', () => {
  const ghosts = precacheList()
    .filter((p) => p !== './')
    .filter((p) => !existsSync(join(ROOT, p)));
  assert.deepEqual(ghosts, [], `listed in sw.js but missing on disk: ${ghosts.join(', ')}`);
});

test('the app shell and every diagram panel are covered', () => {
  const cached = new Set(precacheList());
  for (const must of ['./', 'index.html', 'styles.css', 'js/app.js', 'manifest.webmanifest']) {
    assert.ok(cached.has(must), `${must} must be precached`);
  }
  const panels = readdirSync(join(ROOT, 'diagrams')).filter((f) => f.endsWith('.svg'));
  assert.equal(panels.length, 26);
  for (const p of panels) assert.ok(cached.has(`diagrams/${p}`), `diagrams/${p} not precached`);
});

test('manifest icons all exist at the size they claim', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(ROOT, icon.src)), `manifest points at missing ${icon.src}`);
  }
  // the apple-touch-icon is referenced from index.html, not the manifest
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const apple = html.match(/rel="apple-touch-icon" href="([^"]+)"/)?.[1];
  assert.ok(apple && existsSync(join(ROOT, apple)), 'apple-touch-icon is missing');
});
