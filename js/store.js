// The only persisted state: which week we are in, how many extra blocks are done,
// and when the program started. Everything else is derived.
// Falls back to memory if Safari blocks storage, so the app still runs for the session.

import { isoWeek, dayKey } from './scheduler.js';

const KEY = 'climbers-elbow-v1';
const SCHEMA = 1;

let memory = null; // used only when localStorage is unavailable
let usingMemory = false;

function backing() {
  if (usingMemory) return null;
  try {
    const probe = '__probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    usingMemory = true;
    return null;
  }
}

function fresh(today = new Date()) {
  return {
    v: SCHEMA,
    startDate: dayKey(today),
    week: { isoWeek: isoWeek(today), extraBlocksDone: 0, daysCompleted: [] },
  };
}

function read(today = new Date()) {
  const ls = backing();
  if (!ls) return memory ?? (memory = fresh(today));
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return fresh(today);
    const parsed = JSON.parse(raw);
    if (parsed?.v !== SCHEMA) return fresh(today); // no migrations to do yet
    return parsed;
  } catch {
    return fresh(today); // corrupt payload, start clean rather than crash
  }
}

function write(state) {
  const ls = backing();
  if (!ls) { memory = state; return state; }
  try {
    ls.setItem(KEY, JSON.stringify(state));
  } catch {
    usingMemory = true;
    memory = state;
  }
  return state;
}

/** Reads state, rolling the week over if we have crossed into a new ISO week. */
export function load(today = new Date()) {
  const state = read(today);
  const wk = isoWeek(today);
  if (state.week.isoWeek !== wk) {
    state.week = { isoWeek: wk, extraBlocksDone: 0, daysCompleted: [] };
    write(state);
  }
  return state;
}

/** Records a finished session. Extra blocks only count once per day. */
export function recordSession(plan, today = new Date()) {
  const state = load(today);
  const key = dayKey(today);
  if (!state.week.daysCompleted.includes(key)) state.week.daysCompleted.push(key);
  if (plan.countsAsExtra && !state.week.extraCreditDays?.includes(key)) {
    state.week.extraCreditDays = [...(state.week.extraCreditDays ?? []), key];
    state.week.extraBlocksDone += 1;
  }
  return write(state);
}

export function isMemoryOnly() {
  backing();
  return usingMemory;
}

/** Test and reset hook. Not reachable from the UI. */
export function _reset(today = new Date()) {
  const ls = backing();
  if (ls) { try { ls.removeItem(KEY); } catch { /* ignore */ } }
  memory = null;
  return read(today);
}
