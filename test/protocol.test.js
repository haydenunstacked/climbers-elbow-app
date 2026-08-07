import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXERCISES, byId, estimateMinutes } from '../js/protocol.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIAGRAMS = join(ROOT, 'diagrams');

test('exercise ids are unique', () => {
  const ids = EXERCISES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every exercise has the fields the UI reads', () => {
  for (const e of EXERCISES) {
    assert.ok(e.id && e.name, `missing id or name: ${JSON.stringify(e)}`);
    assert.ok(['core', 'extra', 'flare', 'alt'].includes(e.block), `bad block on ${e.id}`);
    assert.ok(Number.isInteger(e.sets) && e.sets > 0, `bad sets on ${e.id}`);
    assert.ok(e.dose && e.cue, `missing dose or cue on ${e.id}`);
    assert.ok(Number.isFinite(e.rest) && e.rest >= 0, `bad rest on ${e.id}`);
    assert.ok(Array.isArray(e.panels) && e.panels.length > 0, `no panels on ${e.id}`);
  }
});

test('every referenced diagram panel actually exists on disk', () => {
  for (const e of EXERCISES) {
    for (const p of e.panels) {
      assert.ok(existsSync(join(DIAGRAMS, p)), `${e.id} references missing panel ${p}`);
    }
  }
});

test('no generated panel is orphaned', () => {
  const used = new Set(EXERCISES.flatMap((e) => e.panels));
  const onDisk = readdirSync(DIAGRAMS).filter((f) => f.endsWith('.svg'));
  const orphans = onDisk.filter((f) => !used.has(f));
  assert.deepEqual(orphans, [], `unused panels: ${orphans.join(', ')}`);
});

test('tempo blocks are well formed', () => {
  for (const e of EXERCISES) {
    if (!e.tempo) continue;
    assert.ok(['rep', 'hold'].includes(e.tempo.type), `bad tempo type on ${e.id}`);
    assert.ok(e.tempo.seconds > 0 && e.tempo.seconds <= 60, `odd tempo seconds on ${e.id}`);
    assert.ok(e.tempo.label, `tempo missing label on ${e.id}`);
    if (e.tempo.type === 'rep') {
      assert.ok(e.tempo.reps > 0, `rep tempo needs reps on ${e.id}`);
    }
  }
});

test('the three blocks are each three exercises, flare is two', () => {
  const count = (b) => EXERCISES.filter((e) => e.block === b).length;
  assert.equal(count('core'), 3);
  assert.equal(count('extra'), 3);
  assert.equal(count('flare'), 2);
});

test('an exercise that offers an alternate points at a real one', () => {
  for (const e of EXERCISES) {
    if (!e.altId) continue;
    const alt = byId(e.altId);
    assert.ok(alt, `${e.id} points at missing alt ${e.altId}`);
    assert.equal(alt.block, 'alt', `${alt.id} should be in the alt block`);
    assert.ok(e.altLabel, `${e.id} has altId but no altLabel`);
  }
});

test('byId returns null rather than throwing on an unknown id', () => {
  assert.equal(byId('does-not-exist'), null);
});

test('estimateMinutes is monotonic', () => {
  const core = EXERCISES.filter((e) => e.block === 'core');
  const extra = EXERCISES.filter((e) => e.block === 'extra');
  assert.ok(estimateMinutes([...core, ...extra]) > estimateMinutes(core));
  assert.equal(estimateMinutes([]), 1); // floors at 1 rather than 0
});
