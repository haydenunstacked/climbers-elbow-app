import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, DIAGNOSES, byId, RUNG_BY_PHASE } from '../js/protocol.js';

import {
  dayKey, isoWeek, daysBetween, programWeek, daysLeftInWeek,
  planFor, wristTrend, heavyStatus, restAfterSet, formatClock,
  morningStatus, creepingUp, flareStreak, maxRungFor,
} from '../js/scheduler.js';

const THU = new Date(2026, 9, 15);
const OK = { redFlagsCheckedOn: '2026-10-14', wristSide: 'right', wristOnset: '2026-10-10' };
const ids = (plan) => plan.exercises.map((e) => e.id);
const scores = (o) => o; // readability for check-in fixtures

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

test('no safety check yet means the check comes first', () => {
  assert.equal(planFor({ date: THU }).kind, 'screen');
});

test('the safety check comes back after 14 days', () => {
  assert.equal(planFor({ profile: { ...OK, redFlagsCheckedOn: '2026-10-01' }, date: THU }).kind, 'screen');
  assert.notEqual(planFor({ profile: { ...OK, redFlagsCheckedOn: '2026-10-02' }, date: THU }).kind, 'screen');
});

test('a red flag stops rehab and climbing', () => {
  const p = planFor({ climbingToday: true, profile: { ...OK, redFlagHold: true }, date: THU });
  assert.equal(p.kind, 'hold');
  assert.equal(p.exercises.length, 0);
  assert.equal(p.climbAllowed, false);
  assert.match(p.subtitle, /no climbing/);
});

test('which wrist and when it started are asked before any session', () => {
  assert.equal(planFor({ profile: { ...OK, wristSide: 'unknown' }, date: THU }).kind, 'setup');
  assert.equal(planFor({ profile: { ...OK, wristOnset: null }, date: THU }).kind, 'setup');
});

test('a snapping ECU is sent to a clinician, never given exercise', () => {
  const p = planFor({ profile: { ...OK, wristDiagnosis: 'ecu-unstable' }, date: THU });
  assert.equal(p.kind, 'clinician');
  assert.equal(p.exercises.length, 0);
});

// ---------------------------------------------------------------- morning scores

test('morning status reads absolute scores and the change from yesterday', () => {
  const c = (w, e, yw, ye) => ({ '2026-10-15': { wrist: w, elbow: e }, '2026-10-14': { wrist: yw, elbow: ye } });
  assert.equal(morningStatus(c(1, 2, 1, 2), 'wrist', THU), 'green');
  assert.equal(morningStatus(c(2, 2, 1, 2), 'wrist', THU), 'amber');
  assert.equal(morningStatus(c(3, 2, 3, 2), 'wrist', THU), 'red', 'wrist 3 is red even if unchanged');
  assert.equal(morningStatus(c(0, 4, 0, 4), 'elbow', THU), 'amber', 'elbow 4 holds');
  assert.equal(morningStatus(c(0, 6, 0, 6), 'elbow', THU), 'red');
  assert.equal(morningStatus(c(0, 3, 0, 1), 'elbow', THU), 'red', 'up two is red');
  assert.equal(morningStatus({}, 'wrist', THU), null);
});

test('a slow creep shows up as creeping, even when each day reads as same', () => {
  const c = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(THU); d.setDate(d.getDate() - i);
    c[dayKey(d)] = { elbow: i < 7 ? 3 : 1, wrist: 0 };
  }
  assert.equal(creepingUp(c, 'elbow', THU), true);
  assert.equal(creepingUp(c, 'wrist', THU), false);
});

test('three red mornings running count as a streak', () => {
  const c = { '2026-10-15': { wrist: 4 }, '2026-10-14': { wrist: 4 }, '2026-10-13': { elbow: 7 }, '2026-10-12': { wrist: 0 } };
  assert.equal(flareStreak(c, THU), 3);
});

// ---------------------------------------------------------------- day choice

test('a climbing day is a light day with the ladder rung', () => {
  const p = planFor({ climbingToday: true, profile: OK, date: THU });
  assert.equal(p.kind, 'light');
  assert.equal(p.countsAsHeavy, false);
  assert.match(p.climbRung, /^Jugs/);
});

test('a rest day is heavy when nothing loaded yesterday', () => {
  const p = planFor({ profile: OK, lastHeavyDay: '2026-10-13', heavyThisWeek: 1, date: THU });
  assert.equal(p.kind, 'heavy');
  assert.ok(ids(p).includes('band-ecc'));
});

test('no heavy day the day after a heavy day or a climbing day', () => {
  assert.equal(planFor({ profile: OK, lastHeavyDay: '2026-10-14', date: THU }).kind, 'light');
  assert.equal(planFor({ profile: OK, lastClimbDay: '2026-10-14', date: THU }).kind, 'light');
});

test('a second heavy session on the same day is not offered', () => {
  assert.equal(planFor({ profile: OK, lastHeavyDay: '2026-10-15', date: THU }).kind, 'light');
});

test('three heavy days this week means light', () => {
  assert.equal(planFor({ profile: OK, heavyThisWeek: 3, date: THU }).kind, 'light');
});

test('a bit worse on either joint blocks heavy work', () => {
  for (const [c, y] of [[{ wrist: 1 }, { wrist: 0 }], [{ elbow: 4 }, { elbow: 4 }]]) {
    const checkins = { '2026-10-15': c, '2026-10-14': y };
    assert.equal(planFor({ profile: OK, checkins, date: THU }).kind, 'light');
  }
});

test('worse on either joint means a flare day and no climbing', () => {
  for (const c of [{ wrist: 3 }, { elbow: 6 }]) {
    const p = planFor({ climbingToday: true, profile: OK, checkins: { '2026-10-15': c }, date: THU });
    assert.equal(p.kind, 'flare');
    assert.equal(p.climbAllowed, false);
    assert.equal(p.climbRung, null);
  }
});

test('a flare day with the wrist worse drops even the range work', () => {
  assert.ok(!ids(planFor({ profile: OK, checkins: { '2026-10-15': { wrist: 4 } }, date: THU })).includes('dtm'));
  assert.ok(ids(planFor({ profile: OK, checkins: { '2026-10-15': { elbow: 7 } }, date: THU })).includes('dtm'));
});

// ---------------------------------------------------------------- climbing ceiling

test('an unexamined wrist climbs no harder than open-hand crimps', () => {
  assert.equal(maxRungFor(OK), 2);
  const p = planFor({ climbingToday: true, profile: { ...OK, wristRung: 5 }, date: THU });
  assert.match(p.climbRung, /^Open-hand crimps/);
});

test('the climbing ceiling rises with the wrist phase', () => {
  for (const ph of [1, 2, 3, 4]) {
    assert.equal(maxRungFor({ ...OK, wristDiagnosis: 'ulnar', wristPhase: ph }), RUNG_BY_PHASE[ph]);
  }
});

test('lunate edema means no climbing at all', () => {
  const p = planFor({ climbingToday: true, profile: { ...OK, wristDiagnosis: 'bme' }, date: THU });
  assert.equal(p.climbAllowed, false);
  assert.equal(p.climbRung, null);
});

test('dorsal impingement never reaches compression or mantles', () => {
  assert.ok(maxRungFor({ ...OK, wristDiagnosis: 'dorsal', wristPhase: 4 }) <= 3);
});

// ---------------------------------------------------------------- exercises

test('the light day is the neutral floor for both joints', () => {
  assert.deepEqual(ids(planFor({ climbingToday: true, profile: OK, date: THU })),
    ['dtm', 'pron-iso', 'flex-iso', 'extensors']);
});

test('no gripped eccentric for the same arm until wrist phase 4', () => {
  for (const ph of [1, 2, 3]) {
    const got = ids(planFor({ profile: { ...OK, wristDiagnosis: 'ulnar', wristPhase: ph }, date: THU }));
    assert.ok(got.includes('band-ecc') && !got.includes('tyler'), `phase ${ph}`);
  }
  assert.ok(ids(planFor({ profile: { ...OK, wristDiagnosis: 'ulnar', wristPhase: 4 }, date: THU })).includes('tyler'));
});

test('a diagnosed TFCC unlocks the phases in order, replacing not stacking', () => {
  const at = (n) => ids(planFor({ profile: { ...OK, wristDiagnosis: 'ulnar', wristPhase: n }, date: THU }));
  assert.ok(!at(1).includes('dtm-ball'));
  assert.ok(at(2).includes('dtm-ball') && !at(2).includes('wall-wb'));
  assert.ok(at(3).includes('wall-wb') && !at(3).includes('wedge-pushup'));
  assert.ok(at(4).includes('wedge-pushup') && !at(4).includes('dtm-ball') && !at(4).includes('wall-wb'));
});

test('an unexamined wrist is capped at phase 1 whatever the stored phase says', () => {
  const p = planFor({ profile: { ...OK, wristPhase: 4 }, date: THU });
  assert.equal(p.wristPhase, 1);
  for (const id of ['dtm-ball', 'wall-wb', 'wedge-pushup', 'tyler']) assert.ok(!ids(p).includes(id), id);
});

test('FCU gets no eccentric flexion at all', () => {
  const got = ids(planFor({ profile: { ...OK, wristDiagnosis: 'fcu', wristPhase: 4 }, date: THU }));
  for (const id of ['band-ecc', 'tyler', 'tyler-full']) assert.ok(!got.includes(id), id);
});

test('a sore left wrist gives the right elbow its fuller loading, without the FlexBar', () => {
  const p = planFor({ profile: { ...OK, wristSide: 'left' }, date: THU });
  const got = ids(p);
  assert.ok(got.includes('tyler-full') && got.includes('pronator'));
  assert.ok(!got.includes('tyler'), 'the FlexBar Twist wrings with the left hand');
  assert.ok(p.banners.some((b) => /doorframe/.test(b)));
});

// ---------------------------------------------------------------- escalation

test('the wrist exam banner hardens at four weeks from onset', () => {
  const early = planFor({ profile: { ...OK, wristOnset: '2026-10-01' }, date: THU });
  const late = planFor({ profile: { ...OK, wristOnset: '2026-09-17' }, date: THU });
  assert.ok(early.banners.some((b) => /Book one visit/.test(b)));
  assert.ok(late.banners.some((b) => /Book it this week/.test(b)));
});

test('three months of elbow loading prompts a review', () => {
  const p = planFor({ profile: { ...OK, redFlagsCheckedOn: '2026-11-05' }, programStart: '2026-08-06', date: new Date(2026, 10, 6) });
  assert.ok(p.banners.some((b) => /Three months/.test(b)));
});

// ---------------------------------------------------------------- the safety sweep

test('safety rules hold across every combination', () => {
  const sides = ['right', 'left'];
  const mornings = [{}, { wrist: 0, elbow: 0 }, { wrist: 1, elbow: 0 }, { wrist: 0, elbow: 4 }, { wrist: 3, elbow: 0 }, { wrist: 0, elbow: 6 }];
  let n = 0;
  for (const dx of DIAGNOSES) for (const phase of [1, 2, 3, 4]) for (const side of sides)
  for (const climbingToday of [true, false]) for (const m of mornings) for (const heavy of [0, 3])
  for (const yesterday of [null, 'heavy', 'climb']) for (const rung of [1, 5]) {
    const profile = { ...OK, wristDiagnosis: dx.id, wristPhase: phase, wristSide: side, wristRung: rung };
    const checkins = { '2026-10-15': m, '2026-10-14': { wrist: 0, elbow: 0 } };
    const p = planFor({
      climbingToday, profile, checkins, heavyThisWeek: heavy, date: THU,
      lastHeavyDay: yesterday === 'heavy' ? '2026-10-14' : null,
      lastClimbDay: yesterday === 'climb' ? '2026-10-14' : null,
    });
    const got = ids(p);
    const tag = `${dx.id}/p${phase}/${side}/${climbingToday ? 'climb' : 'rest'}/${JSON.stringify(m)}/h${heavy}/${yesterday}/r${rung}`;
    n++;
    if (dx.block) { assert.equal(got.length, 0, tag); assert.equal(p.climbAllowed, false, tag); continue; }
    const red = p.morning.wrist === 'red' || p.morning.elbow === 'red';
    const amber = p.morning.wrist === 'amber' || p.morning.elbow === 'amber';

    // the pre-wrist programme only ever runs when the wrist is on the other arm
    if (side === 'right') for (const e of p.exercises) assert.notEqual(e.group, 'original', tag);
    // nothing past the diagnosis cap
    if (dx.cap < 2) assert.ok(!got.includes('dtm-ball'), tag);
    if (dx.cap < 3) assert.ok(!got.includes('wall-wb'), tag);
    if (dx.cap < 4) assert.ok(!got.includes('wedge-pushup'), tag);
    if (dx.cap === 0) for (const e of p.exercises) assert.ok(!e.joints.includes('wrist'), tag);
    // gripping: no gripped eccentric on the sore arm before phase 4
    if (side === 'right' && Math.min(phase, dx.cap) < 4) assert.ok(!got.includes('tyler'), tag);
    // the FlexBar never runs when it would wring the sore left wrist
    if (side === 'left') assert.ok(!got.includes('tyler'), tag);
    // heavy work only when nothing loaded yesterday and the morning was clean
    if (climbingToday || amber || red || heavy >= 3 || yesterday) assert.equal(p.countsAsHeavy, false, tag);
    // climbing never on a red morning, never past the ceiling
    if (red) { assert.equal(p.kind, 'flare', tag); assert.equal(p.climbAllowed, false, tag); }
    if (p.climbRung) {
      const idx = p.maxRung;
      assert.ok(idx >= 1 && idx <= Math.min(RUNG_BY_PHASE[Math.max(1, Math.min(phase, Math.max(dx.cap, 1)))], dx.maxRung), tag);
    }
    if (dx.id === 'bme') assert.equal(p.climbAllowed, false, tag);
    if (dx.id === 'fcu') for (const id of ['band-ecc', 'tyler', 'tyler-full']) assert.ok(!got.includes(id), tag);
    // anything that loads the wrist follows the wrist rule
    if (side === 'right') for (const e of p.exercises) if (e.joints.includes('wrist')) assert.equal(e.painRule, 'wrist', tag);
    assert.equal(new Set(got).size, got.length, tag);
    assert.ok(p.minutes <= 30, `${tag} ran ${p.minutes} min`);
  }
  assert.ok(n >= 8000, `only ${n} combinations checked`);
});

// ---------------------------------------------------------------- trend and status

test('two sore wrist mornings suggest stepping back, or a clinician at phase 1', () => {
  const c = { '2026-10-13': { wrist: 0 }, '2026-10-14': { wrist: 1 }, '2026-10-15': { wrist: 3 } };
  assert.equal(wristTrend(c, { wristPhase: 2, wristDiagnosis: 'ulnar' }, THU), 'stepback');
  assert.equal(wristTrend(c, { wristPhase: 1 }, THU), 'seeclinician');
});

test('two clean mornings suggest moving up only below the cap', () => {
  const c = { '2026-10-14': { wrist: 0 }, '2026-10-15': { wrist: 0 } };
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
