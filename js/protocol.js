// Exercise data and rules, mirrored from the vault note:
//   02 Personal notes/Combined elbow and wrist rehab protocol.md
// The note is the source of truth. If the protocol changes there, change it here.
// Pure data, no logic beyond small lookups, no imports.

/**
 * tempo shapes:
 *   { type:'rep',  seconds, reps, label }  per-rep bar, e.g. a 4 second lower
 *   { type:'hold', seconds, label }        single countdown, e.g. a 30 second isometric
 *   null                                   no timer, just count the sets
 *
 * painRule says which pain rule governs the exercise. Anything that loads the
 * wrist follows the wrist rule, the elbow ones included.
 *
 * group decides where an exercise can appear:
 *   light       every session, the floor of the routine
 *   heavy       added on heavy days only
 *   wrist2..4   added on heavy days once the wrist reaches that phase
 *   original    the pre-wrist elbow programme, used only when the sore wrist
 *               is on the other arm
 *   alt         a stand-in offered from another exercise's screen
 */

export const EXERCISES = [
  // ---------------------------------------------------------------- light
  {
    id: 'dtm',
    name: "Dart-thrower's motion",
    group: 'light',
    joints: ['wrist'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 20, slow, pain-free',
    cue: 'Back and toward the thumb, then forward and toward the pinky',
    setup: 'Forearm resting on a table, hand off the edge, no weight',
    tempo: null,
    rest: 30,
    note: 'Where the one dosed TFCC programme starts. Unloaded, and the motion takes the least effort.',
    panels: ['dart-throw-1.svg', 'dart-throw-2.svg'],
  },
  {
    id: 'pron-iso',
    name: 'Pronation isometric at neutral',
    group: 'light',
    joints: ['elbow', 'wrist'],
    painRule: 'wrist',
    sets: 5,
    dose: '5 × 30 seconds, about half effort',
    cue: 'Try to turn the palm down. Nothing moves',
    setup: 'Elbow at your side, bent to 90, thumb up. Resist with the other hand on the forearm just above the wrist, never on the hand, or press against a doorframe',
    tempo: { type: 'hold', seconds: 30, label: 'hold' },
    rest: 30,
    note: 'One exercise for both. The elbow pronator and the muscle that steadies the wrist joint.',
    progress: 'After two weeks at 3 or below on the elbow and 2 or below on the wrist, press at about 70 percent instead of half.',
    panels: ['pronation-isometric-1.svg', 'pronation-isometric-2.svg'],
  },
  {
    id: 'flex-iso',
    name: 'Wrist flexion isometric',
    group: 'light',
    joints: ['elbow', 'wrist'],
    painRule: 'wrist',
    sets: 5,
    dose: '5 × 30 seconds, about half effort',
    cue: 'Press up toward the thumb side. Neither hand wins',
    setup: 'Forearm on your thigh, palm up, wrist straight',
    tempo: { type: 'hold', seconds: 30, label: 'hold' },
    rest: 30,
    note: 'Leaning toward the thumb side spares the pinky-side tendon.',
    progress: 'After two weeks at 3 or below on the elbow and 2 or below on the wrist, press at about 70 percent instead of half.',
    panels: ['isometric-holds-2.svg'],
  },
  {
    id: 'extensors',
    name: 'Finger extensor band',
    group: 'light',
    joints: ['elbow'],
    painRule: 'elbow',
    sets: 2,
    dose: '2 × 20',
    cue: 'Slow open, slow back',
    setup: 'Wrist resting straight on a table',
    tempo: null,
    rest: 30,
    note: 'The balance for everything the gripping does.',
    panels: ['finger-extensor-band-1.svg', 'finger-extensor-band-2.svg'],
  },

  // ---------------------------------------------------------------- heavy
  {
    id: 'band-ecc',
    name: 'Open-hand band eccentric',
    group: 'heavy',
    joints: ['elbow', 'wrist'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 15, 4 second lowering',
    cue: 'The other hand helps it up, then lower to a straight wrist and stop',
    setup: 'Band under your foot and looped over the palm, fingers relaxed, no gripping. Forearm on your thigh, palm up',
    tempo: { type: 'rep', seconds: 4, reps: 15, label: '4s lower' },
    rest: 60,
    note: 'The elbow eccentric without the grip. Gripping hard pushes the ulna into the pinky side of the wrist.',
    progress: 'When every set stays at 3 or below and the next morning is clean twice running, go up one band.',
    panels: ['band-eccentric-1.svg', 'band-eccentric-2.svg'],
  },
  {
    id: 'tyler',
    name: 'Reverse Tyler Twist, to neutral',
    group: 'heavy4',
    joints: ['elbow', 'wrist'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 15, 4 second lowering',
    cue: 'Lower only to a straight wrist, then stop',
    setup: 'Forearm on a folded towel, inner elbow clear of the table edge, thumb up, red FlexBar',
    tempo: { type: 'rep', seconds: 4, reps: 15, label: '4s lower' },
    rest: 60,
    note: 'Back from wrist phase 4, once gripping is allowed again. Still stops at a straight wrist.',
    progress: 'When every set stays at 3 or below and the next morning is clean twice running, move from the red bar to the green.',
    panels: [
      'reverse-tyler-twist-1.svg',
      'reverse-tyler-twist-2.svg',
      'reverse-tyler-twist-3.svg',
      'reverse-tyler-twist-4.svg',
    ],
    altId: 'tyler-dumbbell',
    altLabel: 'No FlexBar?',
  },
  {
    id: 'shoulder',
    name: 'Shoulder band work',
    group: 'heavy',
    joints: ['elbow'],
    painRule: 'elbow',
    sets: 2,
    dose: '2 × 15 each',
    cue: 'External rotation, then a horizontal row',
    setup: 'Loop the band over your forearm or through a strap so the hand barely grips',
    tempo: null,
    rest: 45,
    note: 'Elbow load is often driven by what the shoulder is not doing.',
    panels: ['shoulder-band-work-1.svg', 'shoulder-band-work-2.svg'],
  },

  // ---------------------------------------------------------------- wrist phases
  {
    id: 'dtm-ball',
    name: "Dart-thrower's motion with a ball",
    group: 'wrist2',
    joints: ['wrist'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 10 to 20, light 0.5 kg ball',
    cue: 'Same path, slow and controlled',
    setup: 'Forearm on a table, ball in the hand',
    tempo: null,
    rest: 45,
    note: 'Phase 2. Stay at 2 out of 10 or less.',
    panels: ['dart-throw-1.svg', 'dart-throw-2.svg'],
  },
  {
    id: 'wall-wb',
    name: 'Wall weight-bearing',
    group: 'wrist3',
    joints: ['wrist'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 30 seconds',
    cue: 'Lean in gently, wrist short of full extension',
    setup: 'Palm on the wall at chest height, arm nearly straight, elbow soft',
    tempo: { type: 'hold', seconds: 30, label: 'hold' },
    rest: 45,
    note: 'Phase 3. Lean only until the wrist is well short of where it starts to pinch. Not for dorsal impingement.',
    panels: ['weight-bearing-1.svg'],
  },
  {
    id: 'wedge-pushup',
    name: 'Incline push-up, wrist straight',
    group: 'wrist4',
    joints: ['wrist', 'elbow'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 10',
    cue: 'Keep the wrist straight the whole way',
    setup: 'Hands on a wedge or a folded towel on a bench edge so the wrist stays straight. Not on fists, which loads the pinky side',
    tempo: null,
    rest: 60,
    note: 'Phase 4.',
    panels: ['weight-bearing-2.svg'],
  },

  // ---------------------------------------------------------------- alt
  {
    id: 'tyler-dumbbell',
    name: 'Eccentric wrist flexion',
    group: 'alt',
    joints: ['elbow', 'wrist'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 15, 4 second lowering',
    cue: 'Left hand lifts, right hand lowers to straight and stops',
    setup: 'Forearm on your thigh, palm up, light dumbbell',
    tempo: { type: 'rep', seconds: 4, reps: 15, label: '4s lower' },
    rest: 60,
    note: 'The dumbbell stand-in for the FlexBar.',
    panels: ['eccentric-wrist-flexion-1.svg', 'eccentric-wrist-flexion-2.svg'],
  },

  // ---------------------------------------------------------------- original elbow programme
  // Used only when the sore wrist is the left, so the right forearm can keep
  // its full original loading. Paused otherwise.
  {
    id: 'tyler-full',
    name: 'Eccentric wrist flexion, full range',
    group: 'original',
    joints: ['elbow'],
    painRule: 'elbow',
    sets: 3,
    dose: '3 × 15, 4 second lowering',
    cue: 'Left hand lifts lightly, right hand lowers all the way',
    setup: 'Forearm on your thigh, palm up. The dumbbell version, since the FlexBar Twist works the left wrist hard',
    tempo: { type: 'rep', seconds: 4, reps: 15, label: '4s lower' },
    rest: 60,
    note: 'The original elbow loading, kept because the sore wrist is on the other arm.',
    panels: ['eccentric-wrist-flexion-1.svg', 'eccentric-wrist-flexion-2.svg'],
  },
  {
    id: 'stretch',
    name: 'Wrist flexor stretch',
    group: 'original',
    joints: ['elbow'],
    painRule: 'elbow',
    sets: 2,
    setLabel: 'Position',
    dose: '15 to 20 seconds, both positions',
    cue: 'Then a minute of cross fiber massage on the tender spot',
    setup: 'Right arm out in front, the left hand does the pulling',
    tempo: { type: 'hold', seconds: 20, label: 'hold' },
    rest: 0,
    note: 'Position 1 is palm down thumb in. Position 2 is palm out thumb out.',
    panels: ['wrist-flexor-stretch-1.svg', 'wrist-flexor-stretch-2.svg'],
  },
  {
    id: 'pronator',
    name: 'Pronator lever',
    group: 'original',
    joints: ['elbow'],
    painRule: 'elbow',
    sets: 2,
    dose: '2 × 15 to 20, 5 second lower',
    cue: 'Free hand helps it back up. Only the lowering is loaded',
    setup: 'Forearm on your thigh, palm up, hammer held near the end',
    tempo: { type: 'rep', seconds: 5, reps: 15, label: '5s lower' },
    rest: 45,
    note: 'This is the one that catches the pronator teres.',
    panels: ['pronator-lever-1.svg', 'pronator-lever-2.svg'],
  },
  {
    id: 'wristcurl',
    name: 'Reverse wrist curls',
    group: 'original',
    joints: ['elbow'],
    painRule: 'elbow',
    sets: 2,
    dose: '2 × 15, light',
    cue: 'Slow in both directions',
    setup: 'Forearm on your thigh, palm down',
    tempo: null,
    rest: 45,
    note: '',
    panels: ['reverse-wrist-curl-1.svg', 'reverse-wrist-curl-2.svg'],
  },
  {
    id: 'lockoff',
    name: 'Lock off hold',
    group: 'original',
    joints: ['elbow'],
    painRule: 'elbow',
    sets: 3,
    dose: '2 to 3 sets, 15 to 20 seconds',
    cue: 'Neutral grip, mid range, do not move',
    setup: 'A jug or rail you can step off',
    tempo: { type: 'hold', seconds: 20, label: 'hold' },
    rest: 45,
    note: 'Paused while the wrist is on the same arm.',
    panels: ['isometric-holds-1.svg'],
  },
];

export const byId = (id) => EXERCISES.find((e) => e.id === id) || null;
export const inGroup = (g) => EXERCISES.filter((e) => e.group === g);

/** Rough wall-clock estimate in minutes for a list of exercises. */
export function estimateMinutes(list) {
  let s = 0;
  for (const e of list) {
    const work = e.tempo?.type === 'rep'
      ? e.tempo.seconds * e.tempo.reps
      : e.tempo?.type === 'hold' ? e.tempo.seconds : 40;
    s += e.sets * work + Math.max(0, e.sets - 1) * e.rest;
  }
  return Math.max(1, Math.round(s / 60));
}

export const PAIN_RULES = {
  elbow: 'Elbow. Up to 3 out of 10, carry on, and that is the level to add load from. 4 counts as a hold, keep the load where it is next time. 5 or more, stop the set, skip the exercise today and go lighter next time.',
  wrist: 'Wrist. Under 2 out of 10. At 2 or more, or any sharp wrist pain anywhere, or tingling in the ring or little finger, stop the exercise and skip it today. A painless click is fine, a painful one is a red flag.',
  both: 'Any wrist pain at all during an exercise puts it under the wrist rule. If both joints hurt, the stricter action wins.',
};

export const PROGRAM_WEEKS = 12;

/** What the app assumes about the wrist until told otherwise. */
export const DEFAULT_PROFILE = Object.freeze({
  wristSide: 'unknown', // 'left' | 'right' | 'unknown', unknown is treated as the same arm
  wristDiagnosis: 'unknown',
  wristPhase: 1,
  wristRung: 1,
  redFlagsCheckedOn: null, // dayKey of the last clean red-flag screen
  redFlagHold: false, // a yes on the screen, cleared only by the user
  wristOnset: null, // dayKey the wrist pain started, asked once
});
export const HEAVY_DAYS_PER_WEEK = 3;
export const RED_FLAG_RECHECK_DAYS = 14;

/**
 * What the wrist is thought to be, and how far the phases may go for each.
 * cap 0 means no wrist loading at all. block means no session, see a clinician.
 */
export const DIAGNOSES = [
  { id: 'unknown', label: 'Not examined yet', cap: 1, maxRung: 2,
    note: 'Phase 1 only until someone has examined it. Bone marrow edema cannot be ruled out at home.' },
  { id: 'ulnar', label: 'TFCC, impaction or ulnocarpal synovitis', cap: 4, maxRung: 5,
    note: 'No loaded bending toward the pinky, no turning through range under load, and no hard gripping until phase 4. The neutral pronation hold is fine, it is in the TFCC programme itself.' },
  { id: 'ecu', label: 'ECU tendinopathy', cap: 4, maxRung: 5, note: '' },
  { id: 'dorsal', label: 'Dorsal impingement', cap: 2, maxRung: 3,
    note: 'No weight through an extended wrist, so phases 1 and 2 only, and no compression, mantles or palming on the wall.' },
  { id: 'fcu', label: 'FCU tendinopathy', cap: 4, maxRung: 5,
    note: 'No eccentric flexion until a clinician says otherwise, the isometrics carry the elbow.' },
  { id: 'bme', label: 'Lunate bone marrow edema', cap: 0, maxRung: 0,
    note: 'No wrist loading and no climbing. One climbing source wants at least four months off and a clear MRI first. Follow your clinician.' },
  { id: 'ecu-unstable', label: 'Snapping ECU', cap: 0, maxRung: 0, block: true,
    note: 'Needs a clinician to reduce and immobilise it. Not managed here.' },
];
export const diagnosisById = (id) => DIAGNOSES.find((d) => d.id === id) ?? DIAGNOSES[0];

export const PHASE_GATES = {
  1: 'Move on when range matches the other wrist without pain, and the isometrics stay under 2 out of 10.',
  2: 'Move on when 2 sets of 10 with the ball stay under 2 out of 10, with good control.',
  3: 'Move on when wall weight-bearing stays under 2 out of 10.',
  4: 'The last phase. Keep the prehab going.',
};

/** Highest ladder rung allowed at each wrist phase, before the diagnosis cap. */
export const RUNG_BY_PHASE = { 1: 2, 2: 3, 3: 4, 4: 5 };

export const CLIMB_RUNGS = [
  'Jugs and big holds, vertical terrain, wrist straight, low volume',
  'Open-hand crimps and pockets on easy terrain, no full crimp',
  'Pinches',
  'Compression and sidepulls',
  'Slopers, underclings and mantles',
];

export const CLIMB_RULES = [
  'No mantles or palming until wrist phase 4. They put full body weight through an extended wrist.',
  'No campusing, no dynos, no hangboarding. Climb with straighter arms and hips close to the wall.',
  'Warm up for longer than you think you need.',
  'Wrist above 2 out of 10 on the wall, stop for the day and drop a rung next time.',
  'Early on, two sessions a week and not on back-to-back days.',
];

/** Any yes means no rehab and no climbing until a clinician has seen it. */
export const RED_FLAGS = [
  'The wrist pain began with one specific moment, a fall, a hard catch or a pop, rather than building up',
  'After a fall or knock, the hollow at the base of the thumb is tender or swollen, or pushing the thumb along its length hurts',
  'Find the bony bump at the heel of the hand on the pinky side. It is tender a thumb width toward the middle of the palm from that bump',
  'Numbness in the ring and little fingers lasting more than two days, tingling that comes on during exercise, weakness, dropping things, or the fingers curling',
  'The wrist gives way, clunks, locks or catches, or clicks painfully',
  'The elbow locks or catches, will not fully bend or straighten, or went with a pop and new weakness',
  'A hot, red, swollen joint, fever, feeling unwell, or night pain that stops you sleeping',
  'Ring and little fingers cold, pale or blue',
];

/** Escalation clocks, in days. */
export const WRIST_EXAM_DAYS = 28; // from wrist onset, inside the six week scapholunate window
export const ELBOW_REVIEW_WEEKS = 13; // three months of progressive loading
export const FLARE_STREAK_LIMIT = 3; // red mornings running before it says get seen
