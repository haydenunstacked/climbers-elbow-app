// Everything the app remembers, kept in the phone's own storage and nowhere else.
//
//   week      how many extra blocks are done this week, resets every Monday
//   profile   which wrist, what the wrist is thought to be, its rehab phase and
//             sloper ladder rung, and when the red-flag screen was last passed
//   checkins  the one-tap morning check on each joint, last 14 days only
//
// Falls back to memory if Safari blocks storage, so the app still runs for the
// session. Schema changes migrate rather than wipe, because the week count and
// the wrist phase are worth keeping across an update.

import { isoWeek, dayKey, daysBetween } from './scheduler.js';

const KEY = 'climbers-elbow-v1'; // key name kept so v1 data is found and migrated
export const SCHEMA = 2;
const CHECKIN_DAYS = 14;

export const DEFAULT_PROFILE = Object.freeze({
  wristSide: 'unknown', // 'left' | 'right' | 'unknown'
  wristDiagnosis: 'unknown',
  wristPhase: 1,
  wristRung: 1,
  redFlagsCheckedOn: null, // dayKey of the last clean red-flag screen
});

function freshWeek(today) {
  return { isoWeek: isoWeek(today), extraBlocksDone: 0, daysCompleted: [], extraCreditDays: [] };
}

function fresh(today) {
  return {
    v: SCHEMA,
    startDate: dayKey(today),
    week: freshWeek(today),
    profile: { ...DEFAULT_PROFILE },
    checkins: {},
  };
}

/**
 * Brings any older payload up to the current schema. Pure, so it is tested
 * directly. Unknown or corrupt input falls back to a fresh state.
 */
export function migrate(raw, today = new Date()) {
  if (!raw || typeof raw !== 'object') return fresh(today);
  let s = { ...raw };
  if (s.v === 1) {
    s = {
      v: 2,
      startDate: s.startDate ?? dayKey(today),
      week: { ...freshWeek(today), ...(s.week ?? {}) },
      profile: { ...DEFAULT_PROFILE },
      checkins: {},
    };
  }
  if (s.v !== SCHEMA) return fresh(today);
  s.profile = { ...DEFAULT_PROFILE, ...(s.profile ?? {}) };
  s.checkins = s.checkins && typeof s.checkins === 'object' ? s.checkins : {};
  s.week = { ...freshWeek(today), ...(s.week ?? {}) };
  return s;
}

/** Drops check-ins older than the window so storage never grows. */
export function pruneCheckins(checkins, today = new Date()) {
  const todayKey = dayKey(today);
  const out = {};
  for (const [k, v] of Object.entries(checkins ?? {})) {
    const age = daysBetween(k, todayKey);
    if (age >= 0 && age < CHECKIN_DAYS) out[k] = v;
  }
  return out;
}

/**
 * A store over any Storage-like object. The app uses localStorage. Tests pass
 * a plain fake, which is how the migration gets exercised under node.
 */
export function createStore(getStorage = () => globalThis.localStorage) {
  let memory = null;
  let usingMemory = false;

  function backing() {
    if (usingMemory) return null;
    try {
      const ls = getStorage();
      if (!ls) throw new Error('no storage');
      const probe = '__probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    } catch {
      usingMemory = true;
      return null;
    }
  }

  function read(today) {
    const ls = backing();
    if (!ls) return memory ?? (memory = fresh(today));
    try {
      const raw = ls.getItem(KEY);
      if (!raw) return fresh(today);
      const parsed = JSON.parse(raw);
      const state = migrate(parsed, today);
      if (parsed?.v !== SCHEMA) state._migrated = true;
      return state;
    } catch {
      return fresh(today);
    }
  }

  function write(state) {
    const ls = backing();
    if (!ls) { memory = state; return state; }
    try { ls.setItem(KEY, JSON.stringify(state)); } catch { usingMemory = true; memory = state; }
    return state;
  }

  /** Reads state, rolling the week and pruning old check-ins as needed. */
  function load(today = new Date()) {
    const state = read(today);
    let dirty = false;
    if (state.week.isoWeek !== isoWeek(today)) { state.week = freshWeek(today); dirty = true; }
    const pruned = pruneCheckins(state.checkins, today);
    if (Object.keys(pruned).length !== Object.keys(state.checkins).length) { state.checkins = pruned; dirty = true; }
    if (state._migrated) { delete state._migrated; dirty = true; }
    if (dirty) write(state);
    return state;
  }

  /** Records a finished session. Extra blocks only count once per day. */
  function recordSession(plan, today = new Date()) {
    const state = load(today);
    const key = dayKey(today);
    if (!state.week.daysCompleted.includes(key)) state.week.daysCompleted.push(key);
    if (plan.countsAsExtra && !state.week.extraCreditDays.includes(key)) {
      state.week.extraCreditDays.push(key);
      state.week.extraBlocksDone += 1;
    }
    return write(state);
  }

  function setProfile(patch, today = new Date()) {
    const state = load(today);
    state.profile = { ...state.profile, ...patch };
    return write(state);
  }

  /** One check-in per day, later taps overwrite earlier ones. */
  function recordCheckin(entry, today = new Date()) {
    const state = load(today);
    const key = dayKey(today);
    state.checkins[key] = { ...(state.checkins[key] ?? {}), ...entry };
    return write(state);
  }

  function isMemoryOnly() { backing(); return usingMemory; }

  function reset(today = new Date()) {
    const ls = backing();
    if (ls) { try { ls.removeItem(KEY); } catch { /* ignore */ } }
    memory = null;
    return read(today);
  }

  return { load, recordSession, setProfile, recordCheckin, isMemoryOnly, reset };
}

// The app's own store, over localStorage.
const appStore = createStore();
export const load = appStore.load;
export const recordSession = appStore.recordSession;
export const setProfile = appStore.setProfile;
export const recordCheckin = appStore.recordCheckin;
export const isMemoryOnly = appStore.isMemoryOnly;
export const _reset = appStore.reset;
