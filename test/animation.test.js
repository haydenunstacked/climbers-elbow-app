import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXERCISES } from '../js/protocol.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIAGRAMS = join(ROOT, 'diagrams');

// The diagrams animate with SMIL, which runs inside an <img> where scripts and
// outside CSS cannot reach. It also fails silently: a keyTimes list one entry
// short, or two path shapes that do not line up, and the drawing just sits
// still or jumps. Nothing errors, so these check the markup instead.

// Setup steps with nothing to do yet. Every other panel moves or pulses.
const STILL = new Set([
  'finger-extensor-band-1.svg',
  'pronation-isometric-1.svg',
  'reverse-tyler-twist-1.svg',
  'reverse-tyler-twist-2.svg',
  'reverse-tyler-twist-3.svg',
]);

const panels = readdirSync(DIAGRAMS).filter((n) => n.endsWith('.svg'));
const read = (f) => readFileSync(join(DIAGRAMS, f), 'utf8');

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
function animations(svg) {
  return [...svg.matchAll(/<(animate|animateTransform)\b[^>]*\/>/g)].map(([tag, kind]) => ({
    tag,
    kind,
    name: attr(tag, 'attributeName'),
    type: attr(tag, 'type'),
    values: attr(tag, 'values').split(';'),
    keyTimes: attr(tag, 'keyTimes').split(';').map(Number),
    dur: parseFloat(attr(tag, 'dur')),
    repeat: attr(tag, 'repeatCount'),
  }));
}

test('every panel moves, unless it is a setup step kept still on purpose', () => {
  for (const f of panels) {
    const n = animations(read(f)).length;
    if (STILL.has(f)) assert.equal(n, 0, `${f} is listed as still but animates`);
    else assert.ok(n > 0, `${f} has no animation`);
  }
});

test('every animation is well formed, so none of them silently stops', () => {
  for (const f of panels) {
    for (const a of animations(read(f))) {
      const where = `${f}: ${a.tag.slice(0, 80)}`;
      assert.equal(a.values.length, a.keyTimes.length, `values and keyTimes differ in length in ${where}`);
      assert.equal(a.keyTimes[0], 0, `keyTimes must start at 0 in ${where}`);
      assert.equal(a.keyTimes.at(-1), 1, `keyTimes must end at 1 in ${where}`);
      a.keyTimes.slice(1).forEach((t, i) => assert.ok(t >= a.keyTimes[i], `keyTimes go backwards in ${where}`));
      assert.ok(a.dur > 0, `no duration in ${where}`);
      assert.equal(a.repeat, 'indefinite', `plays once and stops in ${where}`);
      if (a.type === 'rotate') {
        for (const v of a.values) assert.equal(v.trim().split(/\s+/).length, 3, `rotate needs angle and centre in ${where}`);
      }
      if (a.name === 'd') {
        // path morphs interpolate number by number, so every shape needs the same commands
        const shape = (d) => d.replace(/-?[\d.]+/g, '#').replace(/\s+/g, '');
        assert.equal(new Set(a.values.map(shape)).size, 1, `path shapes do not line up in ${where}`);
      }
    }
  }
});

test('everything in a panel runs on one clock, so moving parts stay together', () => {
  for (const f of panels) {
    const durs = new Set(animations(read(f)).map((a) => a.dur));
    assert.ok(durs.size <= 1, `${f} mixes durations ${[...durs].join(', ')}`);
  }
});

test('the lowering in each tempo exercise takes as long as its timer', () => {
  for (const e of EXERCISES.filter((x) => x.tempo?.type === 'rep')) {
    const f = e.panels.at(-1);
    const rot = animations(read(f)).find((a) => a.type === 'rotate');
    assert.ok(rot, `${e.id}: ${f} has no rotation to time`);
    // the longest stretch where the angle changes is the controlled part of the rep
    const angle = (v) => Number(v.trim().split(/\s+/)[0]);
    let longest = 0;
    for (let i = 1; i < rot.values.length; i++) {
      if (angle(rot.values[i]) !== angle(rot.values[i - 1])) {
        longest = Math.max(longest, (rot.keyTimes[i] - rot.keyTimes[i - 1]) * rot.dur);
      }
    }
    assert.ok(Math.abs(longest - e.tempo.seconds) < 0.01,
      `${e.id}: ${f} lowers over ${longest.toFixed(2)}s, the timer says ${e.tempo.seconds}s`);
  }
});
