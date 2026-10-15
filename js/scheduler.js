// Decides what today's session is. Pure functions only, no DOM, no storage.

import {
  byId, estimateMinutes, PROGRAM_WEEKS, CLIMB_RUNGS, diagnosisById,
  HEAVY_DAYS_PER_WEEK, HEAVY_MIN_GAP_DAYS, RED_FLAG_RECHECK_DAYS,
} from './protocol.js';

// Duplicated from store.js on purpose, so the scheduler stays import-free of storage.
const DEFAULT_PROFILE = {
  wristSide: 'unknown', wristDiagnosis: 'unknown', wristPhase: 1, wristRung: 1,
  redFlagsCheckedOn: null, redFlagHold: false,
};


/** Local-time YYYY-MM-DD. Deliberately not toISOString, which shifts by timezone. */
export function dayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** ISO 8601 week string, e.g. "2026-W32". Week belongs to the year of its Thursday. */
export function isoWeek(date) {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = t.getUTCDay() || 7; // Mon=1 … Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - dow); // hop to this week's Thursday
  const year = t.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((t - jan1) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Whole days between two day-keys, ignoring clock time. */
export function daysBetween(fromKey, toKey) {
  const [ay, am, ad] = fromKey.split('-').map(Number);
  const [by, bm, bd] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** 1-based week of the 12 week arc. Clamped so it never reads as week 0 or 13+. */
export function programWeek(startKey, todayKey) {
  const d = daysBetween(startKey, todayKey);
  return Math.min(PROGRAM_WEEKS, Math.max(1, Math.floor(d / 7) + 1));
}

/** Days left in the week, counting today, given a JS date. Mon-anchored. */
export function daysLeftInWeek(date) {
  const dow = date.getDay() || 7; // Mon=1 … Sun=7
  return 8 - dow;
}

/**
 * Today's session for both joints together. Pure.
 *
 * @param {object} o
 * @param {boolean} [o.climbingToday]
 * @param {'flare'} [o.mode]            a manual flare day from the Today screen
 * @param {object}  [o.profile]         from the store
 * @param {object}  [o.checkin]         this morning's { wrist, elbow }, each green|amber|red
 * @param {string|null} [o.lastHeavyDay] dayKey of the last heavy session
 * @param {number}  [o.heavyThisWeek]
 * @param {Date}    [o.date]
 */
export function planFor({
  climbingToday = false, mode, profile = DEFAULT_PROFILE, checkin = {},
  lastHeavyDay = null, heavyThisWeek = 0, date = new Date(),
} = {}) {
  const today = dayKey(date);
  const p = { ...DEFAULT_PROFILE, ...profile };
  const dx = diagnosisById(p.wristDiagnosis);
  const base = { exercises: [], minutes: 0, countsAsHeavy: false, banners: [], climbRung: null };

  // 1. The red-flag screen gates everything.
  if (p.redFlagHold) {
    return { ...base, kind: 'hold', title: 'See a clinician first',
      subtitle: 'You answered yes on the red-flag screen. No rehab until someone has looked at it.' };
  }
  if (!p.redFlagsCheckedOn || daysBetween(p.redFlagsCheckedOn, today) >= RED_FLAG_RECHECK_DAYS) {
    return { ...base, kind: 'screen', title: 'Quick safety check',
      subtitle: 'Seven yes or no questions, every two weeks.' };
  }
  if (dx.block) {
    return { ...base, kind: 'clinician', title: 'See a clinician first', subtitle: dx.note };
  }

  // 2. What kind of day.
  const red = checkin.wrist === 'red' || checkin.elbow === 'red';
  const amber = checkin.wrist === 'amber' || checkin.elbow === 'amber';
  const gapOk = !lastHeavyDay || daysBetween(lastHeavyDay, today) >= HEAVY_MIN_GAP_DAYS;
  const heavyAllowed = !climbingToday && !amber && gapOk && heavyThisWeek < HEAVY_DAYS_PER_WEEK;
  let kind = 'light';
  if (mode === 'flare' || red) kind = 'flare';
  else if (heavyAllowed) kind = 'heavy';

  const banners = [];
  if (red) banners.push('One joint was worse this morning, so today is a flare day. Gentle isometrics only.');
  else if (amber) banners.push('One joint was a bit worse this morning, so no heavy work today.');
  else if (!climbingToday && kind === 'light' && !gapOk) banners.push('Light day. Heavy work needs a day between sessions.');
  else if (!climbingToday && kind === 'light') banners.push(`Light day. This week's ${HEAVY_DAYS_PER_WEEK} heavy days are done.`);
  if (dx.id === 'unknown') banners.push('Wrist not examined yet. Book one visit that covers the elbow and the wrist together.');
  if (dx.cap === 0) banners.push(dx.note);

  // 3. Which exercises.
  const sameArm = p.wristSide !== 'left';
  const phase = Math.max(0, Math.min(p.wristPhase, dx.cap));
  const wristCalm = checkin.wrist !== 'red';
  const pick = (...ids) => ids.map(byId).filter(Boolean);
  let list = [];

  if (kind === 'flare') {
    list = dx.cap === 0 ? pick('extensors') : pick('pron-iso', 'flex-iso');
    if (dx.cap >= 1 && wristCalm) list.unshift(byId('dtm'));
  } else if (!sameArm) {
    // Sore wrist on the left: the right elbow keeps its original loading.
    // The left wrist gets range work and the pronator quadratus isometric. The
    // flexion isometric is left out, it only duplicated elbow work the right arm
    // already gets in full, and keeping it pushed heavy days past half an hour.
    list = pick('tyler-full', 'extensors', 'stretch');
    if (dx.cap >= 1) list.push(...pick('dtm', 'pron-iso'));
    if (kind === 'heavy') list.push(...pick('pronator', 'wristcurl', 'shoulder'));
  } else if (dx.cap === 0) {
    // No wrist loading at all: only what leaves the wrist out.
    list = pick('extensors');
    if (kind === 'heavy') list.push(byId('shoulder'));
  } else {
    list = pick('dtm', 'pron-iso', 'flex-iso', 'extensors');
    if (kind === 'heavy') {
      if (dx.id !== 'fcu') list.push(byId('tyler'));
      list.push(byId('shoulder'));
    }
  }
  // Phases replace rather than stack, as in the Singapore programme. Phase 3 keeps
  // the ball work alongside the wall, phase 4 drops both for the push-ups.
  if (kind === 'heavy' && dx.cap >= 1) {
    if (phase === 2 || phase === 3) list.push(byId('dtm-ball'));
    if (phase === 3) list.push(byId('wall-wb'));
    if (phase === 4) list.push(byId('fist-pushup'));
  }

  const titles = { flare: 'Flare day', light: 'Light day', heavy: 'Heavy day' };
  const subtitles = {
    flare: 'Do not skip, swap. Gentle and neutral.',
    light: climbingToday ? 'After you climb, not before. The wall already loaded the forearm.' : 'Neutral work for both joints.',
    heavy: 'Light work first, then the strength work.',
  };

  return {
    ...base,
    kind,
    title: titles[kind],
    subtitle: subtitles[kind],
    exercises: list,
    minutes: estimateMinutes(list),
    countsAsHeavy: kind === 'heavy',
    banners,
    climbRung: climbingToday ? CLIMB_RUNGS[Math.min(CLIMB_RUNGS.length, Math.max(1, p.wristRung)) - 1] : null,
    wristPhase: phase,
    sameArm,
  };
}

/**
 * Reads the last two mornings of wrist check-ins.
 *   'stepback'  worse, or a bit worse, two mornings running
 *   'ready'     two clean mornings and the phase is below the diagnosis cap
 *   null        nothing to suggest
 * The app only ever suggests. The user confirms, because the gate is how it feels.
 */
export function wristTrend(checkins = {}, profile = DEFAULT_PROFILE, date = new Date()) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const today = dayKey(date);
  const y = new Date(date); y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  const a = checkins[today]?.wrist;
  const b = checkins[yesterday]?.wrist;
  const sore = (v) => v === 'amber' || v === 'red';
  if (sore(a) && sore(b)) return p.wristPhase > 1 ? 'stepback' : 'seeclinician';
  const cap = diagnosisById(p.wristDiagnosis).cap;
  if (a === 'green' && b === 'green' && p.wristPhase < cap) return 'ready';
  return null;
}

/**
 * What to say about this week's heavy days. Reports, never blocks.
 */
export function heavyStatus(done, date = new Date()) {
  const EXTRA_BLOCK_TARGET = HEAVY_DAYS_PER_WEEK;
  const left = Math.max(0, EXTRA_BLOCK_TARGET - done);
  const daysLeft = daysLeftInWeek(date);

  if (left === 0) {
    return { done, target: EXTRA_BLOCK_TARGET, left, daysLeft, tone: 'good', message: 'Three done. Week is covered.' };
  }
  const noun = left === 1 ? 'One more' : `${left} more`;
  if (left > daysLeft) {
    return {
      done, target: EXTRA_BLOCK_TARGET, left, daysLeft, tone: 'behind',
      message: `${noun} to go and only ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left. You will likely miss one this week.`,
    };
  }
  return {
    done, target: EXTRA_BLOCK_TARGET, left, daysLeft, tone: 'ok',
    message: `${noun} to go, ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left.`,
  };
}

/**
 * Seconds to rest after finishing a set. Zero means move straight on.
 *
 * Returns nothing after the final set, because the session should roll on to
 * the next exercise rather than sit you down. Also returns nothing where the
 * exercise declares no rest, which is the stretch, where you just switch side.
 *
 * @param {{sets:number, rest:number}} exercise
 * @param {number} setsCompleted how many sets are done, counting the one just finished
 */
export function restAfterSet(exercise, setsCompleted) {
  if (!exercise) return 0;
  if (setsCompleted >= exercise.sets) return 0;
  return Math.max(0, exercise.rest ?? 0);
}

/** Seconds to m:ss. Clamps at zero so a late tick never shows a negative clock. */
export function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
