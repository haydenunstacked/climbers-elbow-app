// The bundler concatenates ES modules into one classic script by stripping
// import/export syntax with regexes. That is the fragile part of the build, so
// it gets checked: a missed `export` keyword is a syntax error that would only
// surface on the phone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'elbow-standalone.html');

// build once for the whole file
execFileSync('node', [join(ROOT, 'build', 'bundle-single.mjs')], { cwd: ROOT, stdio: 'pipe' });
const html = readFileSync(OUT, 'utf8');

test('the bundle builds', () => {
  assert.ok(existsSync(OUT));
  assert.ok(html.startsWith('<!doctype html>'));
});

test('no module syntax survives the flatten', () => {
  const leftovers = [...html.matchAll(/^\s*(?:import|export)\s+/gm)].map((m) => m[0].trim());
  assert.deepEqual(leftovers, [], `flatten() missed: ${leftovers.join(', ')}`);
});

test('the inlined script actually parses', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 2, 'expected the data block and the app block');
  for (const [i, body] of scripts.entries()) {
    // throws SyntaxError on malformed output, which is the whole point
    assert.doesNotThrow(() => new Function(body), `script block ${i} does not parse`);
  }
});

test('every diagram is embedded, none left as a file path', () => {
  assert.equal((html.match(/src="diagrams\//g) ?? []).length, 0);
  const map = html.match(/window\.__DIAGRAMS__ = (\{[\s\S]*?\});/)?.[1];
  assert.ok(map, 'diagram map missing');
  const parsed = JSON.parse(map);
  assert.equal(Object.keys(parsed).length, 18);
  for (const [name, uri] of Object.entries(parsed)) {
    assert.ok(uri.startsWith('data:image/svg+xml;base64,'), `${name} is not a data URI`);
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
    assert.ok(svg.includes('<svg'), `${name} did not round-trip through base64`);
  }
});

test('the bundle does not try to register a service worker', () => {
  assert.ok(html.includes('window.__BUNDLED__ = true'));
  const guarded = /if \(!window\.__BUNDLED__ && 'serviceWorker' in navigator\)/.test(html);
  assert.ok(guarded, 'service worker registration must be guarded in the bundle');
});

test('styles are inlined, nothing is fetched from another host', () => {
  assert.ok(html.includes('--accent'), 'stylesheet not inlined');
  assert.equal((html.match(/<link rel="stylesheet"/g) ?? []).length, 0);
  const remote = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
  assert.deepEqual(remote, [], `bundle reaches offsite: ${remote.join(', ')}`);
});

test('it stays comfortably small', () => {
  const kb = Buffer.byteLength(html) / 1024;
  assert.ok(kb < 500, `bundle grew to ${kb.toFixed(0)} KB`);
});
