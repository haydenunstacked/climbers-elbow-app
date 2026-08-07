// Renders the app icon to PNG at the sizes iOS and the web manifest need.
// Uses headless Chrome because this machine has no rsvg/ImageMagick/cairosvg.

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = join(HERE, '..', 'icons');
const TMP = join(HERE, '.icon-tmp');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SIZES = [180, 192, 512];

/** A bent arm at a mid-range lock off, with the rust arc from the diagrams. */
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1F2421"/>
  <path d="M168 124 L206 286 L352 214"
        stroke="#EFE9DF" stroke-width="52" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="206" cy="286" r="15" fill="#1F2421" opacity=".55"/>
  <path d="M292 372 A118 118 0 0 0 316 236"
        stroke="#C2543D" stroke-width="26" fill="none" stroke-linecap="round"/>
</svg>`;

mkdirSync(ICONS, { recursive: true });
mkdirSync(TMP, { recursive: true });

for (const size of SIZES) {
  const src = join(TMP, `icon-${size}.svg`);
  const out = join(ICONS, `icon-${size}.png`);
  writeFileSync(src, svg(size));
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--screenshot=${out}`,
    `--window-size=${size},${size}`,
    `--default-background-color=00000000`,
    `file://${src}`,
  ], { stdio: 'pipe' });
  console.log(`icons/icon-${size}.png`);
}

// keep the vector around, drop the scratch copies
writeFileSync(join(ICONS, 'icon.svg'), svg(512));
rmSync(TMP, { recursive: true, force: true });
console.log('icons/icon.svg');
