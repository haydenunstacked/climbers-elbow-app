import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/protocol.js';

import {
  dayKey, isoWeek, daysBetween, programWeek, daysLeftInWeek,
  planFor, extraBlockStatus, EXTRA_BLOCK_TARGET, restAfterSet, formatClock,
} from '../js/scheduler.js';

test('dayKey uses local time, not UTC', () => {
  // 23:30 local on the 6th must stay the 6th, even though UTC has rolled over.
  assert.equal(dayKey(new Date(2026, 7, 6, 23, 30)), '2026-08-06');
  assert.equal(dayKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
});

test('isoWeek follows ISO 8601', () => {
  // 2026-08-06 is a Thursday, in week 32.
  assert.equal(isoWeek(new Date(2026, 7, 6)), '2026-W32');
  // Monday and Sunday of the same ISO week agree.
  assert.equal(isoWeek(new Date(2026, 7, 3)), '2026-W32');
  assert.equal(isoWeek(new Date(2026, 7, 9)), '2026-W32');
  // The next Monday starts a new week.
  assert.equal(isoWeek(new Date(2026, 7, 10)), '2026-W33');
});

test('isoWeek handles the year boundary', () => {
  // 2026-01-01 is a Thursday, so it belongs to week 1 of 2026.
  assert.equal(isoWeek(new Date(2026, 0, 1)), '2026-W01');
  // 2024-12-30 is a Monday whose Thursday falls in 2025, so it is 2025-W01.
  assert.equal(isoWeek(new Date(2024, 11, 30)), '2025-W01');
});

test('daysBetween counts calendar days', () => {
  assert.equal(daysBetween('2026-08-06', '2026-08-06'), 0);
  assert.equal(daysBetween('2026-08-06', '2026-08-13'), 7);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1); // 2026 is not a leap year
});

test('programWeek is 1-based and clamps to the 12 week arc', () => {
  assert.equal(programWeek('2026-08-06', '2026-08-06'), 1);
  assert.equal(programWeek('2026-08-06', '2026-08-12'), 1); // day 6, still week 1
  assert.equal(programWeek('2026-08-06', '2026-08-13'), 2); // day 7 rolls over
  assert.equal(programWeek('2026-08-06', '2027-08-06'), 12); // clamped, not 53
});

test('daysLeftInWeek counts today through Sunday', () => {
  assert.equal(daysLeftInWeek(new Date(2026, 7, 3)), 7); // Monday
  assert.equal(daysLeftInWeek(new Date(2026, 7, 6)), 4); // Thursday
  assert.equal(daysLeftInWeek(new Date(2026, 7, 9)), 1); // Sunday
});

test('climbing day gives core only, and says to do it after climbing', () => {
  const p = planFor({ climbingToday: true });
  assert.equal(p.kind, 'core');
  assert.equal(p.countsAsExtra, false);
  assert.equal(p.exercises.length, 3);
  assert.match(p.subtitle, /after you climb/);
});

test('rest day gives core plus the extra block and earns credit', () => {
  const p = planFor({ climbingToday: false });
  assert.equal(p.kind, 'full');
  assert.equal(p.countsAsExtra, true);
  assert.equal(p.exercises.length, 6);
});

test('full plan keeps core first, then the extra block', () => {
  const blocks = planFor({ climbingToday: false }).exercises.map((e) => e.block);
  assert.deepEqual(blocks, ['core', 'core', 'core', 'extra', 'extra', 'extra']);
});

test('flare mode swaps in the isometrics and earns no credit', () => {
  const p = planFor({ mode: 'flare' });
  assert.equal(p.kind, 'flare');
  assert.equal(p.countsAsExtra, false);
  assert.ok(p.exercises.every((e) => e.block === 'flare'));
  assert.ok(p.exercises.every((e) => e.tempo?.type === 'hold'));
});

test('explicit mode overrides the climbing answer', () => {
  assert.equal(planFor({ climbingToday: true, mode: 'full' }).kind, 'full');
});

test('the alternate dumbbell exercise never lands in a plan by itself', () => {
  for (const opts of [{ climbingToday: true }, { climbingToday: false }, { mode: 'flare' }]) {
    assert.ok(planFor(opts).exercises.every((e) => e.block !== 'alt'));
  }
});

test('every plan reports a sane time estimate', () => {
  const core = planFor({ climbingToday: true }).minutes;
  const full = planFor({ climbingToday: false }).minutes;
  assert.ok(core > 0 && core < 20, `core was ${core}`);
  assert.ok(full > core, `full ${full} should exceed core ${core}`);
});

test('extra block status counts down and reads naturally', () => {
  const thu = new Date(2026, 7, 6); // 4 days left
  assert.equal(extraBlockStatus(0, thu).left, EXTRA_BLOCK_TARGET);
  assert.match(extraBlockStatus(2, thu).message, /^One more/);
  assert.equal(extraBlockStatus(3, thu).tone, 'good');
  assert.equal(extraBlockStatus(5, thu).left, 0); // never goes negative
});

test('extra block status flags a week that can no longer be saved', () => {
  const sun = new Date(2026, 7, 9); // 1 day left, 3 still owed
  const s = extraBlockStatus(0, sun);
  assert.equal(s.tone, 'behind');
  assert.match(s.message, /likely miss/);
});

test('singular day wording on the last day of the week', () => {
  assert.match(extraBlockStatus(2, new Date(2026, 7, 9)).message, /1 day left/);
});

// ---------------------------------------------------------------- rest timer

test('restAfterSet gives the exercise rest between sets', () => {
  const tyler = { sets: 3, rest: 60 };
  assert.equal(restAfterSet(tyler, 1), 60); // 1 of 3 done, rest before set 2
  assert.equal(restAfterSet(tyler, 2), 60); // 2 of 3 done, rest before set 3
});

test('restAfterSet gives nothing after the final set', () => {
  // the session should roll straight on to the next exercise
  assert.equal(restAfterSet({ sets: 3, rest: 60 }, 3), 0);
  assert.equal(restAfterSet({ sets: 2, rest: 45 }, 2), 0);
});

test('restAfterSet respects an exercise that declares no rest', () => {
  // the stretch is rest: 0, you just switch position
  assert.equal(restAfterSet({ sets: 2, rest: 0 }, 1), 0);
});

test('restAfterSet never returns a negative or overshoot value', () => {
  assert.equal(restAfterSet({ sets: 2, rest: 45 }, 5), 0); // more done than exist
  assert.equal(restAfterSet({ sets: 2, rest: -10 }, 1), 0); // bad data
});

test('restAfterSet works for every real exercise without throwing', () => {
  for (const ex of EXERCISES) {
    for (let done = 0; done <= ex.sets; done++) {
      const r = restAfterSet(ex, done);
      assert.ok(Number.isFinite(r) && r >= 0, `${ex.id} at ${done} gave ${r}`);
      if (done >= ex.sets) assert.equal(r, 0, `${ex.id} should not rest after its last set`);
    }
  }
});

test('formatClock renders mm:ss', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(7), '0:07');
  assert.equal(formatClock(47), '0:47');
  assert.equal(formatClock(60), '1:00');
  assert.equal(formatClock(125), '2:05');
});

test('formatClock clamps rather than showing a negative clock', () => {
  assert.equal(formatClock(-3), '0:00');
});
