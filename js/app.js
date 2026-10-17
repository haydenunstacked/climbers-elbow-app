// Screens, timers and DOM. All the impure parts live here.

import {
  EXERCISES, byId, PAIN_RULES, PROGRAM_WEEKS, DIAGNOSES, diagnosisById,
  PHASE_GATES, CLIMB_RUNGS, CLIMB_RULES, RED_FLAGS,
} from './protocol.js';
import {
  planFor, heavyStatus, wristTrend, programWeek, dayKey, restAfterSet, formatClock, maxRungFor,
} from './scheduler.js';
import { load, recordSession, recordClimb, setProfile, recordCheckin, isMemoryOnly } from './store.js';

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

// A new version that has taken over this page waits here until it is safe to
// reload, which is only from the Today screen. Everything on Today is already
// saved, and leaving a session for Today already drops it.
let updateReady = false;
let onToday = false;

function show(node) {
  onToday = false;
  root.replaceChildren(node);
  root.scrollTop = 0;
}

// ---------------------------------------------------------------- today

/** Everything planFor needs, read fresh from the store. */
function planInputs(now = new Date()) {
  const state = load(now);
  return {
    state,
    profile: state.profile,
    checkins: state.checkins,
    lastHeavyDay: state.lastHeavyDay,
    lastClimbDay: state.lastClimbDay,
    heavyThisWeek: state.week.extraBlocksDone,
    programStart: state.startDate,
    date: now,
  };
}

function screenToday() {
  if (updateReady) return location.reload();
  const now = new Date();
  const inp = planInputs(now);
  const { state, profile } = inp;
  const checkin = state.checkins[dayKey(now)] ?? {};

  const gate = planFor(inp);
  if (gate.kind === 'screen') return show(screenRedFlags());
  if (gate.kind === 'setup') return show(screenSetup());
  if (gate.kind === 'hold' || gate.kind === 'clinician') return show(screenHold(gate));

  const week = programWeek(state.startDate, dayKey(now));
  const status = heavyStatus(state.week.extraBlocksDone, now);
  const yes = planFor({ ...inp, climbingToday: true });
  const no = planFor({ ...inp, climbingToday: false });
  const dx = diagnosisById(profile.wristDiagnosis);
  const trend = wristTrend(state.checkins, profile, now);

  const dots = Array.from({ length: status.target }, (_, i) =>
    `<i class="dot${i < status.done ? ' on' : ''}"></i>`).join('');

  const morning = planFor({ ...inp, climbingToday: false }).morning ?? {};
  const word = { green: 'fine', amber: 'a bit worse', red: 'worse, flare day' };
  const checkRow = (joint, label) => `
    <div class="chk">
      <span class="chkl">${label}<span class="chks ${morning[joint] ?? ''}">${morning[joint] ? word[morning[joint]] : 'not scored'}</span></span>
      <span class="score">${Array.from({ length: 11 }, (_, n) =>
        `<button class="sc${checkin[joint] === n ? ' on' : ''}" data-check="${joint}:${n}">${n}</button>`).join('')}</span>
    </div>`;

  const trendCard = {
    stepback: `<div class="card warnc"><b>Wrist sore two mornings running.</b> Step back to phase ${profile.wristPhase - 1}?
      <button class="link" data-phase="${profile.wristPhase - 1}">Step back</button></div>`,
    seeclinician: `<div class="card warnc"><b>Wrist sore two mornings running</b> at the gentlest phase. Worth getting it seen soon.</div>`,
    ready: `<div class="card goodc"><b>Two clean mornings.</b> Ready for phase ${profile.wristPhase + 1}? Only if the last two sessions stayed at 2 out of 10 or less.
      <button class="link" data-phase="${profile.wristPhase + 1}">Move up</button></div>`,
  }[trend] ?? '';

  const sideTxt = { left: 'left wrist', right: 'right wrist', unknown: 'wrist, side not set' }[profile.wristSide];
  const describe = (p) => `${p.title}. ${p.exercises.length} exercises.`;

  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="top">
          <span class="date">${esc(fmtDate(now))}</span>
          <span class="wk">week ${week} of ${PROGRAM_WEEKS}</span>
        </div>
        <div class="checkbox">
          <div class="kind" style="margin-top:4px">This morning, pain out of 10</div>
          ${checkRow('elbow', 'Elbow')}
          ${checkRow('wrist', 'Wrist')}
        </div>
        ${trendCard}
        <h1 class="ask">Climbing today?</h1>
        <button class="opt" data-go="yes">
          <span class="m">~${yes.minutes} min</span>
          <span class="k">YES</span>
          <span class="d">${yes.climbAllowed ? `${esc(describe(yes))} After you climb, not before. Hardest holds, rung ${Math.min(profile.wristRung, yes.maxRung)} of 5.` : 'Not today. See why on the next screen.'}</span>
        </button>
        <button class="opt" data-go="no">
          <span class="m">~${no.minutes} min</span>
          <span class="k">NO</span>
          <span class="d">${esc(describe(no))}</span>
        </button>
        <div class="cnt">
          <span>Heavy days this week</span>
          <span class="dots">${dots}</span>
          <span class="n">${status.done} of ${status.target}</span>
        </div>
        <button class="wristrow" data-settings>
          <span>${esc(sideTxt)}, ${esc(dx.label.toLowerCase())}, phase ${Math.min(profile.wristPhase, Math.max(dx.cap, 1))}</span>
          <span class="chev">&#8250;</span>
        </button>
      </div>
      <div class="foot">
        <button class="flare" data-go="flare">Elbow or wrist angry? Run a flare day instead</button>
        ${isMemoryOnly() ? '<div class="warn">Storage is blocked, so nothing will be remembered after you close the app.</div>' : ''}
      </div>
    </div>`);

  node.addEventListener('click', (e) => {
    const chk = e.target.closest('[data-check]');
    if (chk) {
      const [joint, v] = chk.dataset.check.split(':');
      recordCheckin({ [joint]: Number(v) }, new Date());
      return screenToday();
    }
    const ph = e.target.closest('[data-phase]');
    if (ph) { setProfile({ wristPhase: Number(ph.dataset.phase) }); return screenToday(); }
    if (e.target.closest('[data-settings]')) return show(screenSettings());
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    unlockAudio();
    const go = btn.dataset.go;
    // Climbing is forearm load whether or not the app allows it today, so it is
    // recorded either way and tomorrow will not be a heavy day.
    if (go === 'yes') recordClimb(new Date());
    const fresh = planInputs(new Date());
    const plan = go === 'flare' ? planFor({ ...fresh, mode: 'flare' })
      : planFor({ ...fresh, climbingToday: go === 'yes' });
    session = { plan, index: 0, setsDone: {} };
    show(screenSession());
  });

  show(node);
  onToday = true;
}

// ---------------------------------------------------------------- safety screen

function screenRedFlags() {
  const answers = RED_FLAGS.map(() => null);

  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="bar"><span class="ttl">Quick safety check</span><span class="mins">every 2 weeks</span></div>
        <div class="sub" style="margin-top:12px">Any yes means no rehab and no climbing until a clinician has looked at it. Takes twenty seconds.</div>
        ${RED_FLAGS.map((q, i) => `
          <div class="rf">
            <div class="rfq">${esc(q)}</div>
            <div class="rfa">
              <button class="pill" data-rf="${i}:no">No</button>
              <button class="pill red" data-rf="${i}:yes">Yes</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="foot"><button class="cta" data-rfdone disabled>Answer all ${RED_FLAGS.length}</button></div>
    </div>`);

  const cta = node.querySelector('[data-rfdone]');
  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rf]');
    if (b) {
      const [i, v] = b.dataset.rf.split(':');
      answers[Number(i)] = v;
      b.parentElement.querySelectorAll('.pill').forEach((x) => x.classList.toggle('on', x === b));
      const done = answers.every((a) => a !== null);
      cta.disabled = !done;
      cta.textContent = done ? 'Continue' : `Answer all ${RED_FLAGS.length}`;
      return;
    }
    if (e.target.closest('[data-rfdone]') && !cta.disabled) {
      const anyYes = answers.includes('yes');
      setProfile({ redFlagsCheckedOn: dayKey(new Date()), redFlagHold: anyYes });
      screenToday();
    }
  });
  return node;
}

function screenHold(plan) {
  const clinician = plan.kind === 'clinician';
  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="done">
          <div class="dh">${esc(plan.title)}</div>
          <div class="ds">${esc(plan.subtitle)}</div>
        </div>
        <div class="note">
          <div class="nh">What to do</div>
          <div class="nb">No climbing and no loaded gripping until then. Book a sports physio or hand specialist and tell them about the elbow and the wrist together. If the pain started with a fall, a catch or a pop, get seen within days, ligament repairs do best early. If a fracture is possible, or the fingers are cold, numb or weak, go the same day.</div>
        </div>
      </div>
      <div class="foot">
        ${clinician
          ? '<button class="cta" data-settings>Change the wrist diagnosis</button>'
          : '<button class="cta alt" data-cleared>I have been seen and it is cleared</button>'}
      </div>
    </div>`);
  node.addEventListener('click', (e) => {
    if (e.target.closest('[data-settings]')) return show(screenSettings());
    if (e.target.closest('[data-cleared]')) {
      setProfile({ redFlagHold: false, redFlagsCheckedOn: dayKey(new Date()) });
      screenToday();
    }
  });
  return node;
}

// ---------------------------------------------------------------- first run

function screenSetup() {
  const { profile } = planInputs(new Date());
  let side = profile.wristSide === 'unknown' ? null : profile.wristSide;
  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="bar"><span class="ttl">Two questions about the wrist</span></div>
        <div class="kind">Which wrist hurts</div>
        <div class="sub">The elbow is the right. This decides which exercises are safe.</div>
        <button class="radio${side === 'right' ? ' on' : ''}" data-side="right"><span class="rl">Right, same arm as the elbow</span></button>
        <button class="radio${side === 'left' ? ' on' : ''}" data-side="left"><span class="rl">Left</span></button>
        <div class="kind">When it started</div>
        <div class="sub">Roughly is fine. It sets when the app pushes for an examination, four weeks in.</div>
        <input class="datein" type="date" data-onset value="${profile.wristOnset ?? ''}" max="${dayKey(new Date())}">
      </div>
      <div class="foot"><button class="cta" data-save disabled>Continue</button></div>
    </div>`);
  const cta = node.querySelector('[data-save]');
  const onset = node.querySelector('[data-onset]');
  const ready = () => { cta.disabled = !(side && onset.value); };
  onset.addEventListener('input', ready);
  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-side]');
    if (b) {
      side = b.dataset.side;
      node.querySelectorAll('[data-side]').forEach((x) => x.classList.toggle('on', x === b));
      return ready();
    }
    if (e.target.closest('[data-save]') && !cta.disabled) {
      setProfile({ wristSide: side, wristOnset: onset.value });
      screenToday();
    }
  });
  ready();
  return node;
}

// ---------------------------------------------------------------- wrist settings

function screenSettings() {
  const { profile } = planInputs(new Date());
  const dx = diagnosisById(profile.wristDiagnosis);
  const radio = (key, value, label, note = '', disabled = false) => `
    <button class="radio${profile[key] === value ? ' on' : ''}" data-set="${key}:${value}" ${disabled ? 'disabled' : ''}>
      <span class="rl">${esc(label)}</span>${note ? `<span class="rn">${esc(note)}</span>` : ''}
    </button>`;

  const node = el(`
    <div class="screen">
      <div class="scroll">
        <div class="bar">
          <button class="back" data-back aria-label="Back">&#8249;</button>
          <span class="ttl">Wrist settings</span>
        </div>

        <div class="kind">Which wrist</div>
        <div class="sub">The elbow is the right.</div>
        ${radio('wristSide', 'right', 'Right, same arm as the elbow')}
        ${radio('wristSide', 'left', 'Left', 'The right elbow gets back its fuller loading.')}
        <div class="kind">When it started</div>
        <input class="datein" type="date" data-onsetset value="${profile.wristOnset ?? ''}" max="${dayKey(new Date())}">

        <div class="kind">What it is</div>
        <div class="sub">Only change this once a clinician has examined it.</div>
        ${DIAGNOSES.map((d) => radio('wristDiagnosis', d.id, d.label, d.note)).join('')}

        <div class="kind">Phase</div>
        <div class="sub">${dx.cap === 0 ? 'No wrist loading for this diagnosis.' : `This diagnosis allows up to phase ${dx.cap}. Move on only when the gate is met.`}</div>
        ${[1, 2, 3, 4].map((n) => radio('wristPhase', n, `Phase ${n}`, PHASE_GATES[n], n > Math.max(dx.cap, 1))).join('')}

        <div class="kind">Climbing ladder</div>
        <div class="sub">The hardest holds you use. Move up after two or three sessions with clean mornings. ${maxRungFor(profile) === 0 ? 'No climbing for this diagnosis.' : `The wrist allows up to rung ${maxRungFor(profile)} right now.`}</div>
        ${CLIMB_RUNGS.map((r, i) => radio('wristRung', i + 1, `${i + 1}. ${r}`, '', i + 1 > maxRungFor(profile))).join('')}

        <div class="kind">Support</div>
        <div class="sub">If you wear anything, a plain compression strap that keeps the wrist neutral, the WristWidget type. Never a splint that holds the wrist bent unless a clinician fits it, the right position differs by diagnosis and some are opposites.</div>

        <button class="link" data-rescreen style="margin:22px 2px 30px">Run the safety check again</button>
      </div>
    </div>`);

  node.querySelector('[data-onsetset]')?.addEventListener('change', (e) => {
    if (e.target.value) setProfile({ wristOnset: e.target.value });
  });
  node.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) return screenToday();
    if (e.target.closest('[data-rescreen]')) { setProfile({ redFlagsCheckedOn: null }); return screenToday(); }
    const b = e.target.closest('[data-set]');
    if (!b || b.disabled) return;
    const [key, raw] = b.dataset.set.split(':');
    const value = ['wristPhase', 'wristRung'].includes(key) ? Number(raw) : raw;
    const patch = { [key]: value };
    // a diagnosis with a lower cap pulls the phase down with it
    if (key === 'wristDiagnosis') {
      const cap = diagnosisById(value).cap;
      if (profile.wristPhase > Math.max(cap, 1)) patch.wristPhase = Math.max(cap, 1);
    }
    // the ladder can never sit above what the wrist allows
    const next = { ...profile, ...patch };
    if (next.wristRung > Math.max(1, maxRungFor(next))) patch.wristRung = Math.max(1, maxRungFor(next));
    setProfile(patch);
    show(screenSettings());
  });
  return node;
}

// ---------------------------------------------------------------- session list

function screenSession() {
  const { plan } = session;
  let n = 0;
  let lastGroup = null;
  const rows = plan.exercises.map((ex) => {
    n++;
    let sep = '';
    const heavyish = ex.group !== 'light';
    if (plan.kind === 'heavy' && heavyish && lastGroup === 'light') sep = '<div class="sep">strength work</div>';
    lastGroup = heavyish ? 'heavy' : 'light';
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
        ${plan.climbRung ? `<div class="card"><b>On the wall today.</b> ${esc(plan.climbRung)}, and nothing harder.
          <ul class="rules">${CLIMB_RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
        ${plan.banners.map((b) => `<div class="card warnc">${esc(b)}</div>`).join('')}
        ${rows}
      </div>
      <div class="foot"><button class="cta" data-start ${plan.exercises.length ? '' : 'disabled'}>Start</button></div>
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

function screenExercise(overrideEx = null, resting = 0) {
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
        ${ex.setup ? `<div class="setup">${esc(ex.setup)}</div>` : ''}
        <div class="dose">${esc(ex.dose)}</div>
        <div class="cue">${esc(ex.cue)}</div>
        ${ex.progress ? `<div class="exnote"><b>Progress.</b> ${esc(ex.progress)}</div>` : ''}
        <div class="rule ${ex.painRule}">${ex.painRule === 'wrist' ? 'Wrist rule. Under 2 out of 10' : 'Elbow rule. Up to 3 fine, hold at 4, stop at 5'}</div>
        ${ex.note ? `<div class="exnote">${esc(ex.note)}</div>` : ''}
        ${ex.altId && !overrideEx ? `<button class="altlink" data-alt>${esc(ex.altLabel)} Use the ${esc(byId(ex.altId).name.toLowerCase())} instead.</button>` : ''}
        ${overrideEx ? `<button class="altlink" data-unalt>Back to the ${esc(plan.exercises[session.index].name)}</button>` : ''}
        <button class="altlink hurt" data-hurt>Pain past the rule, or tingling in the fingers</button>
      </div>
      <div class="foot">
        ${resting > 0 ? `
          <div class="rest">
            <div class="restTop">
              <span class="restLab">Resting</span>
              <span class="restNext">next: ${esc(setWord.toLowerCase())} ${Math.min(setsDone + 1, ex.sets)} of ${ex.sets}</span>
            </div>
            <div class="restClock" data-restclock>${formatClock(resting)}</div>
            <div class="track"><div class="fill" data-restfill style="width:0%"></div></div>
          </div>
          <button class="cta alt" data-restskip>Skip rest</button>
        ` : `
          <div class="setrow">
            <span class="setlab">${esc(setWord)} ${Math.min(setsDone + 1, ex.sets)} of ${ex.sets}</span>
            <span class="sdots">${sdots}</span>
          </div>
          ${timerHtml}
          <div class="row">
            <button class="cta alt" data-skip>Skip</button>
            <button class="cta" data-setdone>${setWord} done</button>
          </div>
        `}
      </div>
    </div>`);

  wireSwipe(node);
  const stopTimer = (ex.tempo && resting === 0) ? wireTimer(node, ex) : () => {};
  const stopRest = resting > 0
    ? wireRest(node, resting, () => show(screenExercise(overrideEx, 0)))
    : () => {};

  node.addEventListener('click', (e) => {
    unlockAudio();
    if (e.target.closest('[data-back]')) { stopTimer(); stopRest(); return show(screenSession()); }
    if (e.target.closest('[data-alt]')) { stopTimer(); return show(screenExercise(byId(ex.altId))); }
    if (e.target.closest('[data-unalt]')) { stopTimer(); return show(screenExercise()); }
    if (e.target.closest('[data-skip]')) { stopTimer(); stopRest(); return advance(); }
    if (e.target.closest('[data-hurt]')) {
      stopTimer(); stopRest();
      const msg = ex.painRule === 'wrist'
        ? 'Stopped and skipped for today. Score the wrist honestly tomorrow morning. If it was tingling in the ring or little finger, book the assessment.'
        : 'Stopped and skipped for today. Go lighter on this one next time. If it was tingling in the ring or little finger, book the assessment.';
      session.notes = [...(session.notes ?? []), `${ex.name}. ${msg}`];
      return advance();
    }
    if (e.target.closest('[data-restskip]')) { stopRest(); return show(screenExercise(overrideEx, 0)); }
    if (e.target.closest('[data-setdone]')) {
      stopTimer();
      // credit the real exercise even when running the alternate
      const real = plan.exercises[session.index];
      const creditId = overrideEx ? real.id : ex.id;
      const now = (session.setsDone[creditId] ?? 0) + 1;
      session.setsDone[creditId] = now;
      if (now >= real.sets) return advance();
      return show(screenExercise(overrideEx, restAfterSet(real, now)));
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
 * Counts a rest period down and calls onDone when it expires. Driven from a
 * timestamp for the same reason the tempo timer is: rest is the part of a
 * session you are most likely to spend with the phone in your pocket, and an
 * interval-based clock would silently lose time there.
 */
function wireRest(node, seconds, onDone) {
  const clock = node.querySelector('[data-restclock]');
  const fill = node.querySelector('[data-restfill]');
  if (!clock) return () => {};

  const endsAt = Date.now() + seconds * 1000;
  let raf = 0;
  let timer = 0;
  let live = true;

  const stop = () => {
    live = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVis);
  };

  const finish = () => {
    if (!live) return;
    clock.textContent = formatClock(0);
    fill.style.width = '100%';
    beep(880, 240);
    stop();
    onDone();
  };

  const tick = () => {
    if (!live) return;
    const left = (endsAt - Date.now()) / 1000;
    if (left <= 0) return finish();
    clock.textContent = formatClock(left);
    fill.style.width = `${((seconds - left) / seconds) * 100}%`;
    raf = requestAnimationFrame(tick);
  };

  // Three independent paths to completion, because each one alone has a hole.
  // rAF paints the smooth countdown but stops dead whenever the page is not
  // being rendered. The timeout still fires when the page is merely hidden.
  // The visibility handler recomputes from the timestamp for the case iOS
  // suspends everything, which it does to a backgrounded PWA.
  timer = setTimeout(finish, seconds * 1000 + 40);
  const onVis = () => { if (!document.hidden && live) { cancelAnimationFrame(raf); tick(); } };
  document.addEventListener('visibilitychange', onVis);
  tick();
  return stop;
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
  const status = heavyStatus(state.week.extraBlocksDone, now);
  const { plan } = session;
  const notes = session.notes ?? [];

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
          <span>Heavy days this week</span>
          <span class="dots">${dots}</span>
          <span class="n">${status.done} of ${status.target}</span>
        </div>
        <div class="status ${status.tone}" style="padding-top:10px">${esc(status.message)}</div>
        ${notes.map((n) => `<div class="card warnc">${esc(n)}</div>`).join('')}
        <div class="note">
          <div class="nh">The pain rules</div>
          <div class="nb">${esc(PAIN_RULES.elbow)}</div>
          <div class="nb" style="margin-top:8px">${esc(PAIN_RULES.wrist)}</div>
          <div class="nb" style="margin-top:8px">${esc(PAIN_RULES.both)}</div>
          <div class="nb" style="margin-top:8px">Tomorrow morning, score both joints on the Today screen. That is what decides the next session.</div>
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
  // No controller means this is the first install, which has nothing to replace.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || updateReady) return;
    updateReady = true;
    if (onToday) location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        // A home screen app comes back from the background without loading the
        // page, so the browser never looks for a new version unless asked.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => { /* offline is a bonus, not a requirement */ });
  });
}

// exposed for the browser-driven smoke test only
window.__app = { EXERCISES, screenToday, get session() { return session; } };
