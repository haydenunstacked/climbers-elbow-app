// Decides what today's session is. Pure functions only, no DOM, no storage.

import {
  byId, estimateMinutes, PROGRAM_WEEKS, CLIMB_RUNGS, diagnosisById, DEFAULT_PROFILE,
  HEAVY_DAYS_PER_WEEK, RED_FLAG_RECHECK_DAYS, RUNG_BY_PHASE,
  WRIST_EXAM_DAYS, ELBOW_REVIEW_WEEKS, FLARE_STREAK_LIMIT,
} from './protocol.js';


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

const shiftDay = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return dayKey(d); };

/**
 * One joint's morning, from absolute 0 to 10 scores. Pure.
 *   red    wrist 3 or more, elbow 6 or more, or up 2 or more on yesterday
 *   amber  wrist up on yesterday, elbow 4 or 5 or up on yesterday
 *   green  otherwise
 *   null   not scored today
 * The thresholds are design defaults built on the 24 hour rule.
 */
export function morningStatus(checkins = {}, joint, date = new Date()) {
  const s = checkins[dayKey(date)]?.[joint];
  if (typeof s !== 'number') return null;
  const y = checkins[shiftDay(date, -1)]?.[joint];
  const up = typeof y === 'number' ? s - y : 0;
  if (joint === 'wrist') {
    if (s >= 3 || up >= 2) return 'red';
    if (up >= 1) return 'amber';
    return 'green';
  }
  if (s >= 6 || up >= 2) return 'red';
  if (s >= 4 || up >= 1) return 'amber';
  return 'green';
}

/** Mean morning score for one joint over the 7 days ending `endOffset` days ago. */
function weekMean(checkins, joint, date, endOffset) {
  const v = [];
  for (let i = endOffset; i < endOffset + 7; i++) {
    const x = checkins[shiftDay(date, -i)]?.[joint];
    if (typeof x === 'number') v.push(x);
  }
  return v.length >= 4 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** True when this week's mornings average at least a point above last week's. */
export function creepingUp(checkins = {}, joint, date = new Date()) {
  const now = weekMean(checkins, joint, date, 0);
  const before = weekMean(checkins, joint, date, 7);
  return now !== null && before !== null && now - before >= 1;
}

/** Red mornings in a row on either joint, counting back from today. */
export function flareStreak(checkins = {}, date = new Date()) {
  let n = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(date); d.setDate(d.getDate() - i);
    if (morningStatus(checkins, 'wrist', d) === 'red' || morningStatus(checkins, 'elbow', d) === 'red') n++;
    else break;
  }
  return n;
}

/** Highest climbing rung allowed for this wrist phase and diagnosis. 0 means no climbing. */
export function maxRungFor(profile = DEFAULT_PROFILE) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const dx = diagnosisById(p.wristDiagnosis);
  const phase = Math.max(1, Math.min(p.wristPhase, Math.max(dx.cap, 1)));
  return Math.min(RUNG_BY_PHASE[phase], dx.maxRung);
}

/**
 * Today's session for both joints together. Pure.
 *
 * @param {object} o
 * @param {boolean} [o.climbingToday]
 * @param {'flare'} [o.mode]             a manual flare day from the Today screen
 * @param {object}  [o.profile]          from the store
 * @param {object}  [o.checkins]         dayKey -> { wrist, elbow } as 0 to 10 scores
 * @param {string|null} [o.lastHeavyDay]
 * @param {string|null} [o.lastClimbDay]
 * @param {number}  [o.heavyThisWeek]
 * @param {string|null} [o.programStart] dayKey the elbow rehab started
 * @param {Date}    [o.date]
 */
export function planFor({
  climbingToday = false, mode, profile = DEFAULT_PROFILE, checkins = {},
  lastHeavyDay = null, lastClimbDay = null, heavyThisWeek = 0, programStart = null,
  date = new Date(),
} = {}) {
  const today = dayKey(date);
  const yesterday = shiftDay(date, -1);
  const p = { ...DEFAULT_PROFILE, ...profile };
  const dx = diagnosisById(p.wristDiagnosis);
  const base = { exercises: [], minutes: 0, countsAsHeavy: false, banners: [], climbRung: null, climbAllowed: false, maxRung: 0 };

  // 1. Gates. A red flag stops climbing as well as rehab.
  if (p.redFlagHold) {
    return { ...base, kind: 'hold', title: 'See a clinician first',
      subtitle: 'You answered yes on the safety check. No rehab and no climbing until someone has looked at it.' };
  }
  if (!p.redFlagsCheckedOn || daysBetween(p.redFlagsCheckedOn, today) >= RED_FLAG_RECHECK_DAYS) {
    return { ...base, kind: 'screen', title: 'Quick safety check', subtitle: 'Eight yes or no questions, every two weeks.' };
  }
  if (p.wristSide === 'unknown' || !p.wristOnset) {
    return { ...base, kind: 'setup', title: 'Two questions about the wrist', subtitle: 'Which wrist, and when it started.' };
  }
  if (dx.block) {
    return { ...base, kind: 'clinician', title: 'See a clinician first', subtitle: dx.note };
  }

  // 2. The morning.
  const ws = morningStatus(checkins, 'wrist', date);
  const es = morningStatus(checkins, 'elbow', date);
  const red = ws === 'red' || es === 'red';
  const amber = ws === 'amber' || es === 'amber';

  // 3. What kind of day. Climbing wins, heavy days fill the gaps between.
  const yesterdayLoaded = lastHeavyDay === yesterday || lastClimbDay === yesterday;
  const heavyAllowed = !climbingToday && !amber && !yesterdayLoaded
    && lastHeavyDay !== today && heavyThisWeek < HEAVY_DAYS_PER_WEEK;
  let kind = 'light';
  if (mode === 'flare' || red) kind = 'flare';
  else if (heavyAllowed) kind = 'heavy';

  // 4. Climbing.
  const maxRung = maxRungFor(p);
  const climbAllowed = !red && mode !== 'flare' && maxRung > 0;
  const rung = Math.min(Math.max(1, p.wristRung), maxRung);

  const banners = [];
  if (red) banners.push('One joint was worse this morning. Flare day, gentle isometrics only, and no climbing today.');
  else if (amber) banners.push('One joint was a bit worse this morning. No heavy work, and keep any climbing easy.');
  else if (!climbingToday && kind === 'light' && yesterdayLoaded) banners.push('Light day. Yesterday already loaded the forearm.');
  else if (!climbingToday && kind === 'light' && heavyThisWeek >= HEAVY_DAYS_PER_WEEK) banners.push(`Light day. This week's ${HEAVY_DAYS_PER_WEEK} heavy days are done.`);
  if (climbingToday && !climbAllowed) banners.push(maxRung === 0 ? 'No climbing with this diagnosis. Follow your clinician.' : 'No climbing today.');

  const onsetDays = daysBetween(p.wristOnset, today);
  if (dx.id === 'unknown') {
    banners.push(onsetDays >= WRIST_EXAM_DAYS
      ? `The wrist started ${onsetDays} days ago and has not been examined. Book it this week, and tell them about the elbow too.`
      : 'Wrist not examined yet. Book one visit that covers the elbow and the wrist together.');
  }
  if (dx.cap === 0) banners.push(dx.note);
  if (flareStreak(checkins, date) >= FLARE_STREAK_LIMIT) banners.push(`${FLARE_STREAK_LIMIT} worse mornings in a row. Get it seen rather than waiting it out.`);
  if (creepingUp(checkins, 'elbow', date)) banners.push('Elbow mornings are creeping up across the week. Hold the loads where they are and book a physio.');
  if (creepingUp(checkins, 'wrist', date)) banners.push('Wrist mornings are creeping up across the week. Step back a phase and get it examined.');
  if (p.wristSide === 'left' && kind !== 'flare') {
    banners.push('Left wrist. The range work and the pronation hold are for the left. Everything else is the right arm. Resist against a doorframe, not the sore hand.');
  }
  if (programStart && daysBetween(programStart, today) >= ELBOW_REVIEW_WEEKS * 7) {
    banners.push('Three months of elbow loading. If the elbow is not clearly better, see a physio.');
  }

  // 5. Which exercises.
  const sameArm = p.wristSide !== 'left';
  const phase = Math.max(0, Math.min(p.wristPhase, dx.cap));
  const pick = (...ids) => ids.map(byId).filter(Boolean);
  const eccentric = () => {
    if (dx.id === 'fcu') return [];
    // Left wrist: the right elbow gets its full-range dumbbell eccentric. The
    // FlexBar Twist is out because it wrings the bar with the left hand.
    if (!sameArm) return [byId('tyler-full')];
    return [byId(phase < 4 ? 'band-ecc' : 'tyler')];
  };
  let list = [];

  if (kind === 'flare') {
    list = dx.cap === 0 ? pick('extensors') : pick('pron-iso', 'flex-iso');
    if (dx.cap >= 1 && ws !== 'red') list.unshift(byId('dtm'));
  } else if (dx.cap === 0) {
    list = pick('extensors');
    if (kind === 'heavy') list.push(byId('shoulder'));
  } else {
    // Left wrist: the flexion hold is dropped, the right elbow already gets the
    // full eccentric and the pronator lever, and keeping it ran past half an hour.
    list = sameArm ? pick('dtm', 'pron-iso', 'flex-iso', 'extensors') : pick('dtm', 'pron-iso', 'extensors', 'stretch');
    if (kind === 'heavy') {
      list.push(...eccentric());
      list.push(byId('shoulder'));
      // The wrist is on the other arm, so the right elbow gets back the work
      // that was only paused to protect it.
      if (!sameArm) list.push(...pick('pronator', 'wristcurl'));
    }
  }
  // Phases replace rather than stack, as in the Singapore programme.
  if (kind === 'heavy' && dx.cap >= 1) {
    if (phase === 2 || phase === 3) list.push(byId('dtm-ball'));
    if (phase === 3) list.push(byId('wall-wb'));
    if (phase === 4) list.push(byId('wedge-pushup'));
  }

  const titles = { flare: 'Flare day', light: 'Light day', heavy: 'Heavy day' };
  const subtitles = {
    flare: 'Do not skip, swap. Gentle and neutral, no climbing.',
    light: climbingToday ? 'After you climb, not before. The wall already loaded the forearm.' : 'Neutral work for both joints.',
    heavy: 'Light work first, then the strength work. If you climb tomorrow, keep it easy.',
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
    climbAllowed,
    maxRung,
    climbRung: climbingToday && climbAllowed ? CLIMB_RUNGS[rung - 1] : null,
    wristPhase: phase,
    sameArm,
    morning: { wrist: ws, elbow: es },
  };
}

/**
 * Reads the last two mornings of wrist scores.
 *   'stepback'      a bit worse or worse two mornings running, above phase 1
 *   'seeclinician'  the same at phase 1, where there is nowhere to step back to
 *   'ready'         two clean mornings and the phase is below the diagnosis cap
 *   null            nothing to suggest
 * The app only ever suggests. The user confirms, because the gate is how it feels.
 */
export function wristTrend(checkins = {}, profile = DEFAULT_PROFILE, date = new Date()) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const y = new Date(date); y.setDate(y.getDate() - 1);
  const a = morningStatus(checkins, 'wrist', date);
  const b = morningStatus(checkins, 'wrist', y);
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
