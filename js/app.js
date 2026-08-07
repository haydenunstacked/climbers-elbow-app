// Screens, timers and DOM. All the impure parts live here.

import { EXERCISES, byId, PAIN_RULE, PROGRAM_WEEKS } from './protocol.js';
import { planFor, extraBlockStatus, programWeek, dayKey } from './scheduler.js';
import { load, recordSession, isMemoryOnly } from './store.js';

const root = document.getElementById('app');

const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const fmtDate = (d) =>
  d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Normally a real file path. The single-file bundle swaps in data URIs so the
// whole app can live in one document with no separate requests.
const diagramUrl = (p) => window.__DIAGRAMS__?.[p] ?? `diagrams/${p}`;

// ---------------------------------------------------------------- beeps

let audio = null;
/** iOS will not start an AudioContext outside a user gesture, so unlock on first tap. */
function unlockAudio() {
  if (audio) return;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}
function beep(freq = 660, ms = 110) {
  if (!audio || audio.state !== 'running') return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, audio.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + ms / 1000 + 0.02);
  } catch { /* audio is a nicety, never a failure */ }
}

// ---------------------------------------------------------------- state

let session = null; // { plan, index, setsDone: {id: n} }

function show(node) {
  root.replaceChildren(node);
  root.scrollTop = 0;
}

// ---------------------------------------------------------------- today

function screenToday() {
  const now = new Date();
  const state = load(now);
  const week = programWeek(state.startDate, dayKey(now));
  const status = extraBlockStatus(state.week.extraBlocksDone, now);

  const core = planFor({ climbingToday: true });
  const full = planFor({ climbingToday: false });

  const dots = Array.from({ length: status.target }, (_, i) =>
    `<i class="dot${i < status.done ? ' on' : ''}"></i>`).join('');

  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="top">
          <span class="date">${esc(fmtDate(now))}</span>
          <span class="wk">week ${week} of ${PROGRAM_WEEKS}</span>
        </div>
        <h1 class="ask">Climbing today?</h1>
        <button class="opt" data-go="core">
          <span class="m">~${core.minutes} min</span>
          <span class="k">YES</span>
          <span class="d">Daily core only. Do it after you climb, not before.</span>
        </button>
        <button class="opt" data-go="full">
          <span class="m">~${full.minutes} min</span>
          <span class="k">NO</span>
          <span class="d">Daily core plus the extra block.</span>
        </button>
        <div class="cnt">
          <span>Extra blocks this week</span>
          <span class="dots">${dots}</span>
          <span class="n">${status.done} of ${status.target}</span>
        </div>
        <div class="status ${status.tone}">${esc(status.message)}</div>
      </div>
      <div class="foot">
        <button class="flare" data-go="flare">Elbow angry? Run a flare day instead</button>
        ${isMemoryOnly() ? '<div class="warn">Storage is blocked, so this week’s count will not be saved.</div>' : ''}
      </div>
    </div>`);

  node.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    unlockAudio();
    const go = btn.dataset.go;
    const plan = go === 'flare' ? planFor({ mode: 'flare' })
      : planFor({ climbingToday: go === 'core' });
    session = { plan, index: 0, setsDone: {} };
    show(screenSession());
  });

  show(node);
}

// ---------------------------------------------------------------- session list

function screenSession() {
  const { plan } = session;
  let n = 0;
  let lastBlock = null;
  const rows = plan.exercises.map((ex) => {
    n++;
    let sep = '';
    if (ex.block === 'extra' && lastBlock !== 'extra') sep = '<div class="sep">extra block</div>';
    lastBlock = ex.block;
    const complete = (session.setsDone[ex.id] ?? 0) >= ex.sets;
    return `${sep}
      <button class="ex${complete ? ' done' : ''}" data-i="${n - 1}">
        <span class="num">${complete ? '&#10003;' : n}</span>
        <span><span class="exn">${esc(ex.name)}</span><span class="exd">${esc(ex.dose)}</span></span>
      </button>`;
  }).join('');

  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="bar">
          <button class="back" data-back aria-label="Back">&#8249;</button>
          <span class="ttl">Today's session</span>
          <span class="mins">~${plan.minutes} min</span>
        </div>
        <div class="kind">${esc(plan.title)}</div>
        ${plan.subtitle ? `<div class="sub">${esc(plan.subtitle)}</div>` : ''}
        ${rows}
      </div>
      <div class="foot"><button class="cta" data-start>Start</button></div>
    </div>`);

  node.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) return screenToday();
    if (e.target.closest('[data-start]')) {
      session.index = 0;
      return show(screenExercise());
    }
    const row = e.target.closest('[data-i]');
    if (row) {
      session.index = Number(row.dataset.i);
      show(screenExercise());
    }
  });
  return node;
}

// ---------------------------------------------------------------- exercise

function screenExercise(overrideEx = null) {
  const { plan } = session;
  const ex = overrideEx ?? plan.exercises[session.index];
  const total = plan.exercises.length;
  const setsDone = session.setsDone[ex.id] ?? 0;

  const panels = ex.panels.map((p) =>
    `<div class="panel"><img src="${diagramUrl(p)}" alt="" loading="eager"></div>`).join('');
  const pdots = ex.panels.length > 1
    ? `<div class="pdots">${ex.panels.map((_, i) =>
        `<i class="pdot${i === 0 ? ' on' : ''}"></i>`).join('')}</div>` : '';

  const sdots = Array.from({ length: ex.sets }, (_, i) =>
    `<i class="sd${i < setsDone ? ' on' : ''}"></i>`).join('');

  const setWord = ex.setLabel ?? 'Set';
  const timerHtml = ex.tempo ? `
    <div class="timer idle" data-timer>
      <div class="tt"><span data-tlabel>${esc(ex.tempo.label)}</span><span data-tcount></span></div>
      <div class="track"><div class="fill" data-fill></div></div>
      <button class="tbtn" data-tstart>Start ${esc(ex.tempo.label)}</button>
    </div>` : '';

  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="bar">
          <button class="back" data-back aria-label="Back">&#8249;</button>
          <span class="ttl">${esc(ex.name)}</span>
          <span class="mins">${overrideEx ? 'alt' : `${session.index + 1} of ${total}`}</span>
        </div>
        <div class="swipe" data-swipe>${panels}</div>
        ${pdots}
        <div class="dose">${esc(ex.dose)}</div>
        <div class="cue">${esc(ex.cue)}</div>
        ${ex.note ? `<div class="exnote">${esc(ex.note)}</div>` : ''}
        ${ex.altId && !overrideEx ? `<button class="altlink" data-alt>${esc(ex.altLabel)} Use the ${esc(byId(ex.altId).name.toLowerCase())} instead.</button>` : ''}
        ${overrideEx ? `<button class="altlink" data-unalt>Back to the ${esc(plan.exercises[session.index].name)}</button>` : ''}
      </div>
      <div class="foot">
        <div class="setrow">
          <span class="setlab">${esc(setWord)} ${Math.min(setsDone + 1, ex.sets)} of ${ex.sets}</span>
          <span class="sdots">${sdots}</span>
        </div>
        ${timerHtml}
        <div class="row">
          <button class="cta alt" data-skip>Skip</button>
          <button class="cta" data-setdone>${setWord} done</button>
        </div>
      </div>
    </div>`);

  wireSwipe(node);
  const stopTimer = ex.tempo ? wireTimer(node, ex) : () => {};

  node.addEventListener('click', (e) => {
    unlockAudio();
    if (e.target.closest('[data-back]')) { stopTimer(); return show(screenSession()); }
    if (e.target.closest('[data-alt]')) { stopTimer(); return show(screenExercise(byId(ex.altId))); }
    if (e.target.closest('[data-unalt]')) { stopTimer(); return show(screenExercise()); }
    if (e.target.closest('[data-skip]')) { stopTimer(); return advance(); }
    if (e.target.closest('[data-setdone]')) {
      stopTimer();
      // credit the real exercise even when running the alternate
      const creditId = overrideEx ? plan.exercises[session.index].id : ex.id;
      const now = (session.setsDone[creditId] ?? 0) + 1;
      session.setsDone[creditId] = now;
      if (now >= plan.exercises[session.index].sets) return advance();
      return show(screenExercise(overrideEx));
    }
  });

  return node;
}

function advance() {
  session.index++;
  if (session.index >= session.plan.exercises.length) {
    recordSession(session.plan, new Date());
    return show(screenDone());
  }
  show(screenExercise());
}

/** Keeps the panel dots in sync with the swipe position. */
function wireSwipe(node) {
  const strip = node.querySelector('[data-swipe]');
  const dots = [...node.querySelectorAll('.pdot')];
  if (!strip || dots.length < 2) return;
  strip.addEventListener('scroll', () => {
    const i = Math.round(strip.scrollLeft / strip.clientWidth);
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
  }, { passive: true });
}

/**
 * Timestamp-driven so backgrounding the app or the screen sleeping cannot
 * drift the count. Returns a stop function.
 */
function wireTimer(node, ex) {
  const box = node.querySelector('[data-timer]');
  const fill = node.querySelector('[data-fill]');
  const count = node.querySelector('[data-tcount]');
  const label = node.querySelector('[data-tlabel]');
  const btn = node.querySelector('[data-tstart]');
  const { type, seconds, reps = 1 } = ex.tempo;

  let startedAt = null;
  let raf = 0;
  let lastRep = -1;

  const stop = () => {
    startedAt = null;
    cancelAnimationFrame(raf);
    box.classList.add('idle');
    btn.textContent = `Start ${ex.tempo.label}`;
    fill.style.width = '0%';
    count.textContent = '';
    label.textContent = ex.tempo.label;
  };

  const tick = () => {
    if (startedAt === null) return;
    const elapsed = (Date.now() - startedAt) / 1000;
    const totalSecs = seconds * reps;

    if (elapsed >= totalSecs) {
      beep(880, 220);
      fill.style.width = '100%';
      count.textContent = type === 'rep' ? 'set complete' : 'done';
      label.textContent = 'Tap done';
      btn.textContent = `Start ${ex.tempo.label}`;
      startedAt = null;
      return;
    }

    if (type === 'rep') {
      const rep = Math.floor(elapsed / seconds);
      if (rep !== lastRep) { lastRep = rep; if (rep > 0) beep(660, 90); }
      const within = (elapsed % seconds) / seconds;
      fill.style.width = `${within * 100}%`;
      count.textContent = `rep ${rep + 1} of ${reps}`;
    } else {
      fill.style.width = `${(elapsed / totalSecs) * 100}%`;
      count.textContent = `${Math.ceil(totalSecs - elapsed)}s left`;
    }
    raf = requestAnimationFrame(tick);
  };

  btn.addEventListener('click', () => {
    unlockAudio();
    if (startedAt !== null) return stop();
    startedAt = Date.now();
    lastRep = -1;
    box.classList.remove('idle');
    btn.textContent = 'Stop';
    beep(560, 90);
    tick();
  });

  // A backgrounded tab stops firing rAF; recompute from the timestamp on return.
  const onVis = () => { if (!document.hidden && startedAt !== null) { cancelAnimationFrame(raf); tick(); } };
  document.addEventListener('visibilitychange', onVis);

  return () => { document.removeEventListener('visibilitychange', onVis); stop(); };
}

// ---------------------------------------------------------------- done

function screenDone() {
  const now = new Date();
  const state = load(now);
  const status = extraBlockStatus(state.week.extraBlocksDone, now);
  const { plan } = session;

  const dots = Array.from({ length: status.target }, (_, i) =>
    `<i class="dot${i < status.done ? ' on' : ''}"></i>`).join('');

  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="done">
          <svg class="tick" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="32" cy="32" r="29" stroke="var(--sage)" stroke-width="3.5"/>
            <path d="M19 33 L28 42 L45 23" stroke="var(--sage)" stroke-width="5"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="dh">Done for today</div>
          <div class="ds">${esc(plan.title)}, ${plan.exercises.length} exercises</div>
        </div>
        <div class="cnt" style="margin-top:26px;border-bottom:1px solid var(--line)">
          <span>Extra blocks this week</span>
          <span class="dots">${dots}</span>
          <span class="n">${status.done} of ${status.target}</span>
        </div>
        <div class="status ${status.tone}" style="padding-top:10px">${esc(status.message)}</div>
        <div class="note">
          <div class="nh">The pain rule</div>
          <div class="nb">${esc(PAIN_RULE)}</div>
        </div>
      </div>
      <div class="foot"><button class="cta" data-close>Close</button></div>
    </div>`);

  node.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { session = null; screenToday(); }
  });
  return node;
}

// ---------------------------------------------------------------- boot

screenToday();

// The single-file bundle has no sw.js to register, and its assets are already
// inline, so there is nothing to precache.
if (!window.__BUNDLED__ && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
  });
}

// exposed for the browser-driven smoke test only
window.__app = { EXERCISES, screenToday, get session() { return session; } };
