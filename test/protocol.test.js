import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXERCISES, byId, estimateMinutes, DIAGNOSES, diagnosisById } from '../js/protocol.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIAGRAMS = join(ROOT, 'diagrams');

test('exercise ids are unique', () => {
  const ids = EXERCISES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every exercise has the fields the UI reads', () => {
  for (const e of EXERCISES) {
    assert.ok(e.id && e.name, `missing id or name: ${JSON.stringify(e)}`);
    assert.ok(['light', 'heavy', 'wrist2', 'wrist3', 'wrist4', 'alt', 'original'].includes(e.group), `bad group on ${e.id}`);
    assert.ok(Array.isArray(e.joints) && e.joints.length > 0, `no joints on ${e.id}`);
    assert.ok(['wrist', 'elbow'].includes(e.painRule), `bad painRule on ${e.id}`);
    assert.ok(e.setup, `no setup cue on ${e.id}`);
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

test('every exercise that loads the wrist follows the wrist pain rule, outside the original programme', () => {
  for (const e of EXERCISES) {
    if (e.group === 'original') continue;
    if (e.joints.includes('wrist')) assert.equal(e.painRule, 'wrist', e.id);
  }
});

test('every diagnosis has a cap between 0 and 4', () => {
  for (const d of DIAGNOSES) assert.ok(Number.isInteger(d.cap) && d.cap >= 0 && d.cap <= 4, d.id);
  assert.equal(diagnosisById('nonsense').id, 'unknown');
});

test('an exercise that offers an alternate points at a real one', () => {
  for (const e of EXERCISES) {
    if (!e.altId) continue;
    const alt = byId(e.altId);
    assert.ok(alt, `${e.id} points at missing alt ${e.altId}`);
    assert.equal(alt.group, 'alt', `${alt.id} should be in the alt group`);
    assert.ok(e.altLabel, `${e.id} has altId but no altLabel`);
  }
});

test('byId returns null rather than throwing on an unknown id', () => {
  assert.equal(byId('does-not-exist'), null);
});

test('estimateMinutes is monotonic', () => {
  const core = EXERCISES.filter((e) => e.group === 'light');
  const extra = EXERCISES.filter((e) => e.group === 'heavy');
  assert.ok(estimateMinutes([...core, ...extra]) > estimateMinutes(core));
  assert.equal(estimateMinutes([]), 1); // floors at 1 rather than 0
});

// The splitter rebuilds each panel as a standalone document. Anything the panel
// references but that lives outside its <g> — gradients, markers, styles — has
// to be carried across or it silently resolves to nothing. That failed once in
// exactly this way and only showed up on the deployed site, hence these.

test('a panel that references a gradient also ships its definition', () => {
  for (const f of readdirSync(DIAGRAMS).filter((n) => n.endsWith('.svg'))) {
    const svg = readFileSync(join(DIAGRAMS, f), 'utf8');
    const refs = [...svg.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]);
    for (const id of refs) {
      assert.ok(svg.includes(`id="${id}"`), `${f} references #${id} but never defines it`);
    }
  }
});

test('every panel carries its own stylesheet', () => {
  for (const f of readdirSync(DIAGRAMS).filter((n) => n.endsWith('.svg'))) {
    const svg = readFileSync(join(DIAGRAMS, f), 'utf8');
    const classes = new Set([...svg.matchAll(/class="([\w\- ]+)"/g)]
      .flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
    for (const c of classes) {
      assert.ok(svg.includes(`.${c}{`), `${f} uses .${c} but the style block does not define it`);
    }
  }
});

test('the sore spot marker survives the split', () => {
  const svg = readFileSync(join(DIAGRAMS, 'reverse-tyler-twist-1.svg'), 'utf8');
  assert.match(svg, /radialGradient/, 'gradient definition missing from the split panel');
  assert.match(svg, /url\(#sore\)/, 'nothing actually uses the gradient');
});
