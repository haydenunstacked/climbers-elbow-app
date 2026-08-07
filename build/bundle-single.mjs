// Bundles the whole app into one self-contained HTML file: CSS inlined, the four
// ES modules concatenated, and all 18 diagrams embedded as data URIs.
//
// Why: the multi-file app needs a real origin (modules and service workers both
// do). A single file can be dropped onto any host, or published as an artifact,
// without a build step on the other end. It is also a durable backup copy.
//
// Tradeoff: no service worker, so offline depends on the browser's own cache
// rather than being guaranteed. GitHub Pages remains the primary target.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXERCISES } from '../js/protocol.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Dependency order. protocol has no imports, scheduler needs protocol,
// store needs scheduler, app needs all three.
const MODULES = ['js/protocol.js', 'js/scheduler.js', 'js/store.js', 'js/app.js'];

/** Strip module syntax so the files can be concatenated into one classic scope. */
function flatten(src) {
  return src
    .replace(/^\s*import[\s\S]*?from\s+'[^']+';\s*$/gm, '')
    .replace(/^export\s+(?=(const|function|class|let|async))/gm, '')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
}

const svgDataUri = (file) => {
  const svg = readFileSync(join(ROOT, 'diagrams', file), 'utf8');
  // UTF-8 safe, and avoids escaping every quote in the markup
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
};

const panels = [...new Set(EXERCISES.flatMap((e) => e.panels))].sort();
const diagrams = Object.fromEntries(panels.map((p) => [p, svgDataUri(p)]));
const iconUri = `data:image/png;base64,${readFileSync(join(ROOT, 'icons/icon-180.png')).toString('base64')}`;

const js = MODULES.map((m) => `/* ---- ${m} ---- */\n${flatten(read(m))}`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Elbow</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Elbow">
<link rel="apple-touch-icon" href="${iconUri}">
<meta name="theme-color" content="#FAF7F2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16191A" media="(prefers-color-scheme: dark)">
<style>
${read('styles.css')}
</style>
</head>
<body>
<main id="app"></main>
<script>
window.__BUNDLED__ = true;
window.__DIAGRAMS__ = ${JSON.stringify(diagrams)};
</script>
<script>
${js}
</script>
</body>
</html>
`;

mkdirSync(DIST, { recursive: true });
const out = join(DIST, 'elbow-standalone.html');
writeFileSync(out, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`dist/elbow-standalone.html  ${kb} KB, ${panels.length} diagrams inlined`);
