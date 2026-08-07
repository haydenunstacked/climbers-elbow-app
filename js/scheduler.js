// Decides what today's session is. Pure functions only, no DOM, no storage.

import { EXERCISES, estimateMinutes, PROGRAM_WEEKS } from './protocol.js';

export const EXTRA_BLOCK_TARGET = 3;

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

const inBlock = (b) => EXERCISES.filter((e) => e.block === b);

/**
 * @param {{climbingToday?: boolean, mode?: 'core'|'full'|'flare', date?: Date}} opts
 * @returns {{kind, title, subtitle, exercises, minutes, countsAsExtra}}
 */
export function planFor({ climbingToday, mode, date = new Date() } = {}) {
  let kind = mode;
  if (!kind) kind = climbingToday ? 'core' : 'full';

  if (kind === 'flare') {
    const exercises = inBlock('flare');
    return {
      kind: 'flare',
      title: 'Flare day',
      subtitle: 'Isometrics instead of the eccentrics. Do not skip, swap.',
      exercises,
      minutes: estimateMinutes(exercises),
      countsAsExtra: false,
    };
  }

  if (kind === 'core') {
    const exercises = inBlock('core');
    return {
      kind: 'core',
      title: 'Daily core',
      subtitle: 'Do it after you climb, not before.',
      exercises,
      minutes: estimateMinutes(exercises),
      countsAsExtra: false,
    };
  }

  const exercises = [...inBlock('core'), ...inBlock('extra')];
  return {
    kind: 'full',
    title: 'Core plus extra block',
    subtitle: '',
    exercises,
    minutes: estimateMinutes(exercises),
    countsAsExtra: true,
  };
}

/**
 * What to tell him about the 3-extra-blocks-a-week target.
 * Reports, never blocks. He can always run the full block anyway.
 */
export function extraBlockStatus(done, date = new Date()) {
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
