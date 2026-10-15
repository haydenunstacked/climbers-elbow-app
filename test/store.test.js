import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStore, migrate, pruneCheckins, SCHEMA, DEFAULT_PROFILE } from '../js/store.js';

/** A minimal Storage stand-in. */
function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    _data: data,
  };
}

const THU = new Date(2026, 9, 15); // a Thursday in 2026-W42

test('a v1 payload migrates without losing the week or the start date', () => {
  const v1 = {
    v: 1,
    startDate: '2026-08-06',
    week: { isoWeek: '2026-W42', extraBlocksDone: 2, daysCompleted: ['2026-10-12'], extraCreditDays: ['2026-10-12'] },
  };
  const s = migrate(v1, THU);
  assert.equal(s.v, SCHEMA);
  assert.equal(s.startDate, '2026-08-06');
  assert.equal(s.week.extraBlocksDone, 2);
  assert.deepEqual(s.profile, { ...DEFAULT_PROFILE });
  assert.deepEqual(s.checkins, {});
});

test('a v1 payload missing extraCreditDays still gets one', () => {
  const s = migrate({ v: 1, startDate: '2026-08-06', week: { isoWeek: '2026-W42', extraBlocksDone: 1, daysCompleted: [] } }, THU);
  assert.ok(Array.isArray(s.week.extraCreditDays));
});

test('unknown schemas and junk start fresh instead of crashing', () => {
  for (const junk of [null, 42, 'x', { v: 99 }, {}]) {
    const s = migrate(junk, THU);
    assert.equal(s.v, SCHEMA);
    assert.equal(s.profile.wristDiagnosis, 'unknown');
  }
});

test('a v2 payload with a partial profile is filled from defaults', () => {
  const s = migrate({ v: 2, startDate: '2026-08-06', week: {}, profile: { wristSide: 'left' } }, THU);
  assert.equal(s.profile.wristSide, 'left');
  assert.equal(s.profile.wristPhase, 1);
});

test('the store reads a stored v1 payload and writes it back as v2', () => {
  const ls = fakeStorage({
    'climbers-elbow-v1': JSON.stringify({ v: 1, startDate: '2026-08-06', week: { isoWeek: '2026-W42', extraBlocksDone: 1, daysCompleted: [] } }),
  });
  const store = createStore(() => ls);
  const s = store.load(THU);
  assert.equal(s.week.extraBlocksDone, 1);
  assert.equal(JSON.parse(ls.getItem('climbers-elbow-v1')).v, SCHEMA);
});

test('the week still rolls over on a new ISO week', () => {
  const ls = fakeStorage();
  const store = createStore(() => ls);
  store.recordSession({ countsAsExtra: true }, THU);
  assert.equal(store.load(THU).week.extraBlocksDone, 1);
  assert.equal(store.load(new Date(2026, 9, 19)).week.extraBlocksDone, 0); // next Monday
});

test('profile changes persist and merge', () => {
  const ls = fakeStorage();
  const store = createStore(() => ls);
  store.setProfile({ wristSide: 'right' }, THU);
  store.setProfile({ wristPhase: 2 }, THU);
  const p = store.load(THU).profile;
  assert.equal(p.wristSide, 'right');
  assert.equal(p.wristPhase, 2);
  assert.equal(p.wristDiagnosis, 'unknown');
});

test('check-ins merge within a day and old ones are pruned', () => {
  const ls = fakeStorage();
  const store = createStore(() => ls);
  store.recordCheckin({ wrist: 1 }, THU);
  store.recordCheckin({ elbow: 3 }, THU);
  assert.deepEqual(store.load(THU).checkins['2026-10-15'], { wrist: 1, elbow: 3 });
  assert.equal(Object.keys(store.load(new Date(2026, 10, 15)).checkins).length, 0); // 31 days later
});

test('pruneCheckins keeps exactly the last 28 days', () => {
  const c = { '2026-10-15': {}, '2026-09-18': {}, '2026-09-17': {}, '2026-10-16': {} };
  assert.deepEqual(Object.keys(pruneCheckins(c, THU)).sort(), ['2026-09-18', '2026-10-15']);
});

test('a climb is remembered across days so tomorrow cannot be heavy', () => {
  const ls = fakeStorage();
  const store = createStore(() => ls);
  store.recordClimb(THU);
  assert.equal(store.load(new Date(2026, 9, 16)).lastClimbDay, '2026-10-15');
});

test('blocked storage falls back to memory and still works', () => {
  const store = createStore(() => { throw new Error('SecurityError'); });
  store.setProfile({ wristSide: 'left' }, THU);
  assert.equal(store.load(THU).profile.wristSide, 'left');
  assert.equal(store.isMemoryOnly(), true);
});
