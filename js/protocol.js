// Exercise data, mirrored from the vault note:
//   02 Personal notes/Climbers elbow rehab protocol.md
// The note is the source of truth. If the protocol changes there, change it here.
// Pure data, no logic, no imports.

/**
 * tempo shapes:
 *   { type:'rep',  seconds, reps, label }  per-rep bar, e.g. a 4 second lower
 *   { type:'hold', seconds, label }        single countdown, e.g. a 45 second isometric
 *   null                                   no timer, just count the sets
 */

export const EXERCISES = [
  {
    id: 'tyler',
    name: 'Reverse Tyler Twist',
    block: 'core',
    sets: 3,
    dose: '3 × 15, 60 seconds rest',
    cue: 'Only the slow release is the work',
    tempo: { type: 'rep', seconds: 4, reps: 15, label: '4s lower' },
    rest: 60,
    note: 'Red FlexBar to start, green once red gets easy.',
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
    id: 'tyler-dumbbell',
    name: 'Eccentric wrist flexion',
    block: 'alt',
    sets: 3,
    dose: '3 × 15, 4 second lowering',
    cue: 'Left hand lifts, right hand lowers',
    tempo: { type: 'rep', seconds: 4, reps: 15, label: '4s lower' },
    rest: 60,
    note: 'The dumbbell stand-in for the FlexBar.',
    panels: ['eccentric-wrist-flexion-1.svg', 'eccentric-wrist-flexion-2.svg'],
  },
  {
    id: 'extensors',
    name: 'Finger extensor band',
    block: 'core',
    sets: 2,
    dose: '2 × 20',
    cue: 'Slow open, slow back',
    tempo: null,
    rest: 30,
    note: 'The balance for everything the gripping does.',
    panels: ['finger-extensor-band-1.svg', 'finger-extensor-band-2.svg'],
  },
  {
    id: 'stretch',
    name: 'Wrist flexor stretch',
    block: 'core',
    sets: 2,
    setLabel: 'Position',
    dose: '15 to 20 seconds, both positions',
    cue: 'Then a minute of cross fiber massage on the tender spot',
    tempo: { type: 'hold', seconds: 20, label: 'hold' },
    rest: 0,
    note: 'Position 1 is palm down thumb in. Position 2 is palm out thumb out.',
    panels: ['wrist-flexor-stretch-1.svg', 'wrist-flexor-stretch-2.svg'],
  },
  {
    id: 'pronator',
    name: 'Pronator lever',
    block: 'extra',
    sets: 2,
    dose: '2 × 15 to 20, 5 second lower',
    cue: 'Free hand helps it back up. Only the lowering is loaded',
    tempo: { type: 'rep', seconds: 5, reps: 15, label: '5s lower' },
    rest: 45,
    note: 'This is the one that catches the pronator teres.',
    panels: ['pronator-lever-1.svg', 'pronator-lever-2.svg'],
  },
  {
    id: 'wristcurl',
    name: 'Reverse wrist curls',
    block: 'extra',
    sets: 2,
    dose: '2 × 15, light',
    cue: 'Slow in both directions',
    tempo: null,
    rest: 45,
    note: '',
    panels: ['reverse-wrist-curl-1.svg', 'reverse-wrist-curl-2.svg'],
  },
  {
    id: 'shoulder',
    name: 'Shoulder band work',
    block: 'extra',
    sets: 2,
    dose: '2 × 15 each',
    cue: 'External rotation, then a horizontal row',
    tempo: null,
    rest: 45,
    note: 'Elbow load is often driven by what the shoulder is not doing.',
    panels: ['shoulder-band-work-1.svg', 'shoulder-band-work-2.svg'],
  },
  {
    id: 'lockoff',
    name: 'Lock off hold',
    block: 'flare',
    sets: 3,
    dose: '2 to 3 sets, 15 to 20 seconds',
    cue: 'Neutral grip, mid range, do not move',
    tempo: { type: 'hold', seconds: 20, label: 'hold' },
    rest: 45,
    note: '',
    panels: ['isometric-holds-1.svg'],
  },
  {
    id: 'wristiso',
    name: 'Wrist flexion isometric',
    block: 'flare',
    sets: 5,
    dose: '5 × 45 seconds at about 70 percent',
    cue: 'Press into the other hand. Neither hand wins',
    tempo: { type: 'hold', seconds: 45, label: 'hold' },
    rest: 30,
    note: '',
    panels: ['isometric-holds-2.svg'],
  },
];

export const byId = (id) => EXERCISES.find((e) => e.id === id) || null;

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

export const PAIN_RULE =
  'Up to 5 out of 10 during is fine. Should be back at or below 5 by tomorrow morning. ' +
  'If it is climbing week over week, cut the load, not the frequency.';

export const PROGRAM_WEEKS = 12;
