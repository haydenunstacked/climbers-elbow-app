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
    note: 'The path that loads the middle of the wrist least.',
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
    cue: 'Turn the palm down into the other hand. Neither hand wins',
    setup: 'Elbow at your side, bent to 90, thumb up, wrist straight',
    tempo: { type: 'hold', seconds: 30, label: 'hold' },
    rest: 30,
    note: 'One exercise for both. The elbow pronator and the muscle that steadies the wrist joint.',
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
    id: 'tyler',
    name: 'Reverse Tyler Twist, to neutral',
    group: 'heavy',
    joints: ['elbow', 'wrist'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 15, 4 second lowering',
    cue: 'Lower only to a straight wrist, then stop',
    setup: 'Forearm resting on a table, thumb up, lighter bar',
    tempo: { type: 'rep', seconds: 4, reps: 15, label: '4s lower' },
    rest: 60,
    note: 'The old version lowered on into extension, which the wrist does not like.',
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
    note: 'Phase 3. Not for dorsal impingement.',
    panels: ['weight-bearing-1.svg'],
  },
  {
    id: 'fist-pushup',
    name: 'Incline push-up on fists',
    group: 'wrist4',
    joints: ['wrist', 'elbow'],
    painRule: 'wrist',
    sets: 3,
    dose: '3 × 10',
    cue: 'Fists keep the wrist straight',
    setup: 'Fists on a bench or counter, body in a line, elbows soft at the top',
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
  elbow: 'Elbow. Up to 3 out of 10 is fine. 4 or 5, hold the load where it is. Above 5, stop the set. It should be settled by tomorrow morning.',
  wrist: 'Wrist. Up to 2 out of 10, and stop for any sharp pinky-side pain, clicking or catching. This rule wins for any exercise that brings on the wrist pain.',
};

export const PROGRAM_WEEKS = 12;
export const HEAVY_DAYS_PER_WEEK = 3;
export const HEAVY_MIN_GAP_DAYS = 2;
export const RED_FLAG_RECHECK_DAYS = 14;

/**
 * What the wrist is thought to be, and how far the phases may go for each.
 * cap 0 means no wrist loading at all. block means no session, see a clinician.
 */
export const DIAGNOSES = [
  { id: 'unknown', label: 'Not examined yet', cap: 1,
    note: 'Phase 1 only until someone has examined it. Bone marrow edema cannot be ruled out at home.' },
  { id: 'ulnar', label: 'TFCC, impaction or ulnocarpal synovitis', cap: 4,
    note: 'No loaded bending toward the pinky, loaded palm-down turning or hard gripping until phase 4.' },
  { id: 'ecu', label: 'ECU tendinopathy', cap: 4, note: '' },
  { id: 'dorsal', label: 'Dorsal impingement', cap: 2,
    note: 'No weight through an extended wrist, so phases 1 and 2 only.' },
  { id: 'fcu', label: 'FCU tendinopathy', cap: 4,
    note: 'The Twist is swapped for the flexion isometric until a clinician says otherwise.' },
  { id: 'bme', label: 'Lunate bone marrow edema', cap: 0,
    note: 'No wrist loading at all. Follow your clinician.' },
  { id: 'ecu-unstable', label: 'Snapping ECU', cap: 0, block: true,
    note: 'Needs a clinician to reduce and immobilise it. Not managed here.' },
];
export const diagnosisById = (id) => DIAGNOSES.find((d) => d.id === id) ?? DIAGNOSES[0];

export const PHASE_GATES = {
  1: 'Full pain-free range, and the isometrics stay at 2 out of 10 or less.',
  2: '2 sets of 10 with the ball at 2 out of 10 or less, with good control.',
  3: 'Wall weight-bearing at 2 out of 10 or less.',
  4: 'Back to normal climbing and prehab.',
};

export const CLIMB_RUNGS = [
  'Jugs and big holds, vertical terrain, wrist straight, low volume',
  'Crimps and pockets on easy terrain',
  'Pinches',
  'Compression and sidepulls',
  'Slopers and underclings',
];

/** Any yes means no session until a clinician has seen it. */
export const RED_FLAGS = [
  'A fall or knock on the hand in the last six weeks, and the hollow at the base of the thumb is tender or swollen, or pushing the thumb along its length hurts',
  'Tender right on the bony bump at the heel of the hand, pinky side',
  'Numbness in the ring and little fingers that does not go away, weakness, dropping things, or the fingers curling',
  'The wrist gives way, clunks, locks or catches, or clicks painfully',
  'The elbow locks or catches, will not fully bend or straighten, or went with a pop and new weakness',
  'A hot, red, swollen joint, fever, feeling unwell, or night pain that stops you sleeping',
  'Ring and little fingers cold, pale or blue',
];
