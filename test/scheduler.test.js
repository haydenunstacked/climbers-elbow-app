import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, DIAGNOSES, byId } from '../js/protocol.js';

import {
  dayKey, isoWeek, daysBetween, programWeek, daysLeftInWeek,
  planFor, wristTrend, heavyStatus, restAfterSet, formatClock,
} from '../js/scheduler.js';

const THU = new Date(2026, 9, 15);
const OK = { redFlagsCheckedOn: '2026-10-14' }; // a clean screen yesterday
const ids = (plan) => plan.exercises.map((e) => e.id);

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

// ---------------------------------------------------------------- gates

test('no red-flag screen yet means the screen comes first', () => {
  assert.equal(planFor({ date: THU }).kind, 'screen');
});

test('the screen comes back after 14 days', () => {
  assert.equal(planFor({ profile: { redFlagsCheckedOn: '2026-10-01' }, date: THU }).kind, 'screen');
  assert.notEqual(planFor({ profile: { redFlagsCheckedOn: '2026-10-02' }, date: THU }).kind, 'screen');
});

test('a yes on the screen holds everything, with no exercises', () => {
  const p = planFor({ profile: { ...OK, redFlagHold: true }, date: THU });
  assert.equal(p.kind, 'hold');
  assert.equal(p.exercises.length, 0);
});

test('a snapping ECU is sent to a clinician, never given exercise', () => {
  const p = planFor({ profile: { ...OK, wristDiagnosis: 'ecu-unstable' }, date: THU });
  assert.equal(p.kind, 'clinician');
  assert.equal(p.exercises.length, 0);
});

// ---------------------------------------------------------------- day choice

test('a climbing day is always a light day, with the ladder rung', () => {
  const p = planFor({ climbingToday: true, profile: OK, date: THU });
  assert.equal(p.kind, 'light');
  assert.equal(p.countsAsHeavy, false);
  assert.match(p.climbRung, /^Jugs/);
  assert.match(p.subtitle, /After you climb/);
});

test('a rest day is heavy when the gap and the weekly count allow', () => {
  const p = planFor({ profile: OK, lastHeavyDay: '2026-10-13', heavyThisWeek: 1, date: THU });
  assert.equal(p.kind, 'heavy');
  assert.ok(ids(p).includes('tyler'));
});

test('heavy yesterday means light today', () => {
  assert.equal(planFor({ profile: OK, lastHeavyDay: '2026-10-14', date: THU }).kind, 'light');
});

test('three heavy days this week means light', () => {
  assert.equal(planFor({ profile: OK, heavyThisWeek: 3, date: THU }).kind, 'light');
});

test('a bit worse on either joint blocks heavy work', () => {
  for (const checkin of [{ wrist: 'amber' }, { elbow: 'amber' }]) {
    assert.equal(planFor({ profile: OK, checkin, date: THU }).kind, 'light');
  }
});

test('worse on either joint means a flare day', () => {
  for (const checkin of [{ wrist: 'red' }, { elbow: 'red' }]) {
    assert.equal(planFor({ profile: OK, checkin, date: THU }).kind, 'flare');
  }
});

test('a flare day with the wrist worse drops even the range of motion work', () => {
  assert.ok(!ids(planFor({ profile: OK, checkin: { wrist: 'red' }, date: THU })).includes('dtm'));
  assert.ok(ids(planFor({ profile: OK, checkin: { elbow: 'red' }, date: THU })).includes('dtm'));
});

// ---------------------------------------------------------------- the light day

test('the light day is the neutral floor for both joints', () => {
  assert.deepEqual(ids(planFor({ climbingToday: true, profile: OK, date: THU })),
    ['dtm', 'pron-iso', 'flex-iso', 'extensors']);
});

// ---------------------------------------------------------------- diagnosis and phase

test('an unexamined wrist is capped at phase 1 whatever the stored phase says', () => {
  const p = planFor({ profile: { ...OK, wristPhase: 4 }, date: THU });
  assert.equal(p.wristPhase, 1);
  for (const id of ['dtm-ball', 'wall-wb', 'fist-pushup']) assert.ok(!ids(p).includes(id), id);
});

test('a diagnosed TFCC unlocks the phases in order on heavy days', () => {
  const at = (n) => ids(planFor({ profile: { ...OK, wristDiagnosis: 'ulnar', wristPhase: n }, date: THU }));
  assert.ok(!at(1).includes('dtm-ball'));
  assert.ok(at(2).includes('dtm-ball') && !at(2).includes('wall-wb'));
  assert.ok(at(3).includes('wall-wb') && !at(3).includes('fist-pushup'));
  assert.ok(at(4).includes('fist-pushup'));
  assert.ok(!at(4).includes('dtm-ball') && !at(4).includes('wall-wb'), 'phase 4 replaces, it does not stack');
});

test('dorsal impingement never gets weight through the hand', () => {
  const p = planFor({ profile: { ...OK, wristDiagnosis: 'dorsal', wristPhase: 4 }, date: THU });
  assert.ok(!ids(p).includes('wall-wb') && !ids(p).includes('fist-pushup'));
});

test('FCU never gets the Twist', () => {
  const p = planFor({ profile: { ...OK, wristDiagnosis: 'fcu' }, date: THU });
  assert.equal(p.kind, 'heavy');
  assert.ok(!ids(p).includes('tyler'));
});

test('bone marrow edema gets nothing that loads the wrist', () => {
  for (const climbingToday of [true, false]) {
    const p = planFor({ climbingToday, profile: { ...OK, wristDiagnosis: 'bme' }, date: THU });
    for (const e of p.exercises) assert.ok(!e.joints.includes('wrist'), e.id);
  }
});

test('a sore left wrist gives the right elbow its original loading', () => {
  const p = planFor({ profile: { ...OK, wristSide: 'left' }, date: THU });
  assert.ok(ids(p).includes('tyler-full'));
  assert.ok(ids(p).includes('pronator'));
  assert.ok(!ids(p).includes('tyler'), 'not the FlexBar, it wrings the left wrist');
});

// ---------------------------------------------------------------- the safety sweep

test('safety rules hold across every combination', () => {
  const sides = ['unknown', 'right', 'left'];
  const checks = [{}, { wrist: 'green', elbow: 'green' }, { wrist: 'amber' }, { elbow: 'amber' }, { wrist: 'red' }, { elbow: 'red' }];
  let n = 0;
  for (const dx of DIAGNOSES) for (const phase of [1, 2, 3, 4]) for (const side of sides)
  for (const climbingToday of [true, false]) for (const checkin of checks) for (const heavy of [0, 3]) {
    const profile = { ...OK, wristDiagnosis: dx.id, wristPhase: phase, wristSide: side };
    const p = planFor({ climbingToday, profile, checkin, heavyThisWeek: heavy, date: THU });
    const got = ids(p);
    const tag = `${dx.id}/p${phase}/${side}/${climbingToday ? 'climb' : 'rest'}/${JSON.stringify(checkin)}/h${heavy}`;
    n++;
    if (dx.block) { assert.equal(got.length, 0, tag); continue; }
    // the pre-wrist programme only ever runs when the wrist is on the other arm
    if (side !== 'left') for (const e of p.exercises) assert.notEqual(e.group, 'original', tag);
    // nothing past the diagnosis cap
    if (dx.cap < 2) assert.ok(!got.includes('dtm-ball'), tag);
    if (dx.cap < 3) assert.ok(!got.includes('wall-wb'), tag);
    if (dx.cap < 4) assert.ok(!got.includes('fist-pushup'), tag);
    if (dx.cap === 0) for (const e of p.exercises) assert.ok(!e.joints.includes('wrist'), tag);
    // heavy work only on a clean, non-climbing day
    if (climbingToday || checkin.wrist === 'amber' || checkin.elbow === 'amber' || heavy >= 3) {
      assert.equal(p.countsAsHeavy, false, tag);
    }
    if (checkin.wrist === 'red' || checkin.elbow === 'red') {
      assert.equal(p.kind, 'flare', tag);
      for (const e of p.exercises) assert.ok(['light'].includes(e.group), tag);
    }
    if (dx.id === 'fcu') assert.ok(!got.includes('tyler'), tag);
    // anything that loads the wrist follows the wrist pain rule
    if (side !== 'left') for (const e of p.exercises) if (e.joints.includes('wrist')) assert.equal(e.painRule, 'wrist', tag);
    // no duplicates and a sane length
    assert.equal(new Set(got).size, got.length, tag);
    assert.ok(p.minutes <= 30, `${tag} ran ${p.minutes} min`);
  }
  assert.ok(n > 1000, `only ${n} combinations checked`);
});

// ---------------------------------------------------------------- trend and status

test('two sore mornings suggest stepping back, or a clinician at phase 1', () => {
  const c = { '2026-10-14': { wrist: 'amber' }, '2026-10-15': { wrist: 'red' } };
  assert.equal(wristTrend(c, { wristPhase: 2, wristDiagnosis: 'ulnar' }, THU), 'stepback');
  assert.equal(wristTrend(c, { wristPhase: 1 }, THU), 'seeclinician');
});

test('two clean mornings suggest moving up only below the cap', () => {
  const c = { '2026-10-14': { wrist: 'green' }, '2026-10-15': { wrist: 'green' } };
  assert.equal(wristTrend(c, { wristPhase: 1, wristDiagnosis: 'ulnar' }, THU), 'ready');
  assert.equal(wristTrend(c, { wristPhase: 1, wristDiagnosis: 'unknown' }, THU), null);
  assert.equal(wristTrend({}, {}, THU), null);
});

test('heavy status counts toward three a week', () => {
  assert.equal(heavyStatus(0, THU).left, 3);
  assert.equal(heavyStatus(3, THU).tone, 'good');
  assert.equal(heavyStatus(0, new Date(2026, 9, 18)).tone, 'behind');
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
