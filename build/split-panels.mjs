// Splits the landscape vault diagrams into single-panel SVGs sized for a phone.
// Source files live beside this script; output goes to ../diagrams/.
// Each panel keeps its own <style> and <marker>, so the outputs are standalone
// documents safe to load via <img> without class or id collisions.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'diagrams');

// x-ranges are the horizontal slice each panel occupies in the source viewBox.
// y/h crop away the file title and the shared dose line, keeping art + caption.
const FOUR_PANEL = { y: 74, h: 320 };
const TWO_PANEL = { y: 74, h: 286 };

const CONFIG = {
  'reverse-tyler-twist.svg': {
    ...FOUR_PANEL,
    panels: [[15, 256], [262, 508], [514, 760], [766, 992]],
  },
  'eccentric-wrist-flexion.svg': { ...TWO_PANEL, panels: [[15, 366], [366, 712]] },
  'finger-extensor-band.svg': { ...TWO_PANEL, panels: [[15, 366], [366, 712]] },
  'wrist-flexor-stretch.svg': { ...TWO_PANEL, panels: [[15, 366], [366, 712]] },
  'pronator-lever.svg': { ...TWO_PANEL, panels: [[15, 366], [366, 712]] },
  'reverse-wrist-curl.svg': { ...TWO_PANEL, panels: [[15, 366], [366, 712]] },
  // panel 1's "elbow pinned to the ribs" label runs past the usual divider
  'shoulder-band-work.svg': { ...TWO_PANEL, panels: [[15, 392], [366, 712]] },
  'isometric-holds.svg': { ...TWO_PANEL, panels: [[15, 366], [366, 712]] },
};

const between = (src, open, close) => {
  const a = src.indexOf(open);
  if (a === -1) return '';
  const b = src.indexOf(close, a);
  if (b === -1) return '';
  return src.slice(a, b + close.length);
};

/** Pull each panel's <g>…</g>, tolerating nested groups inside a panel. */
function panelGroups(src) {
  const parts = src.split(/<!--\s*PANEL[^>]*-->/).slice(1);
  return parts.map((seg) => {
    const start = seg.indexOf('<g');
    const end = seg.lastIndexOf('</g>');
    if (start === -1 || end === -1) throw new Error('no group found in panel segment');
    return seg.slice(start, end + 4);
  });
}

let written = 0;
const manifest = {};

for (const file of readdirSync(HERE).filter((f) => f.endsWith('.svg'))) {
  const cfg = CONFIG[file];
  if (!cfg) throw new Error(`no panel config for ${file}`);

  const src = readFileSync(join(HERE, file), 'utf8');
  const style = between(src, '<style>', '</style>');
  const marker = between(src, '<marker', '</marker>');
  // gradients and any other defs must ride along, or they resolve to nothing
  // once the panel is a standalone document
  const defs = between(src, '<defs>', '</defs>');
  const groups = panelGroups(src);

  if (groups.length !== cfg.panels.length) {
    throw new Error(`${file}: found ${groups.length} panels, config expects ${cfg.panels.length}`);
  }

  const base = file.replace(/\.svg$/, '');
  manifest[base] = [];

  groups.forEach((group, i) => {
    const [x0, x1] = cfg.panels[i];
    const w = x1 - x0;
    const name = `${base}-${i + 1}.svg`;
    const out = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${cfg.y} ${w} ${cfg.h}" role="img" aria-label="${base} step ${i + 1}">`,
      `  ${style}`,
      defs ? `  ${defs}` : '',
      marker ? `  ${marker}` : '',
      `  <rect x="${x0}" y="${cfg.y}" width="${w}" height="${cfg.h}" fill="#FAF7F2"/>`,
      `  ${group}`,
      `</svg>`,
    ].filter(Boolean).join('\n');

    writeFileSync(join(OUT, name), out + '\n');
    manifest[base].push(name);
    written++;
  });
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${written} panel files across ${Object.keys(manifest).length} diagrams`);
for (const [k, v] of Object.entries(manifest)) console.log(`  ${k}: ${v.length}`);
