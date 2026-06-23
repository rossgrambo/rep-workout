// ===========================================================================
// data.js — Static reference data for the app.
//
// Everything here is *content*: the list of muscles, equipment, goals and the
// exercise database. None of this is per-user state (that lives in state.js).
// Keeping it separate means an LLM (or a human) can grow the exercise library
// later without touching the algorithm.
// ===========================================================================

// ---------------------------------------------------------------------------
// Muscle categories.
//
// `seedFraction` is the starting "strength score" for this muscle expressed as
// a fraction of the user's bodyweight. The strength score is an abstract number
// (roughly: an 8-rep working load in lb on a representative movement) that the
// progression algorithm nudges up and down over time. Prescriptions for every
// exercise are derived from these scores, so this is the single source of truth
// for "how strong is the user".
// ---------------------------------------------------------------------------
const MUSCLES = {
  cardio:      { label: 'Cardio',          seedFraction: 0.12, group: 'Conditioning' },
  chest:       { label: 'Chest',           seedFraction: 0.26, group: 'Push' },
  front_delt:  { label: 'Front Shoulder',  seedFraction: 0.14, group: 'Push' },
  side_delt:   { label: 'Side Shoulder',   seedFraction: 0.10, group: 'Push' },
  rear_delt:   { label: 'Rear Shoulder',   seedFraction: 0.08, group: 'Pull' },
  triceps:     { label: 'Triceps',         seedFraction: 0.16, group: 'Push' },
  biceps:      { label: 'Biceps',          seedFraction: 0.16, group: 'Pull' },
  forearms:    { label: 'Forearms',        seedFraction: 0.14, group: 'Pull' },
  upper_back:  { label: 'Upper Back / Lats',seedFraction: 0.30, group: 'Pull' },
  traps:       { label: 'Traps',           seedFraction: 0.34, group: 'Pull' },
  abs:         { label: 'Abs',             seedFraction: 0.10, group: 'Core' },
  obliques:    { label: 'Obliques',        seedFraction: 0.10, group: 'Core' },
  lower_back:  { label: 'Lower Back',      seedFraction: 0.22, group: 'Core' },
  glutes:      { label: 'Glutes',          seedFraction: 0.40, group: 'Legs' },
  quads:       { label: 'Quads',           seedFraction: 0.42, group: 'Legs' },
  hamstrings:  { label: 'Hamstrings',      seedFraction: 0.34, group: 'Legs' },
  calves:      { label: 'Calves',          seedFraction: 0.40, group: 'Legs' },
};

// ---------------------------------------------------------------------------
// Equipment.
//
// `weights` flag marks the three items that get a sub-section where the user
// declares which physical weights they own (dumbbells, curl-bar plates,
// barbell plates).
// ---------------------------------------------------------------------------
const EQUIPMENT = [
  { id: 'flat_area',        label: 'Flat open area',     icon: '🟩', section: 'Space' },
  { id: 'yoga_mat',         label: 'Yoga mat',           icon: '🧘', section: 'Space' },
  { id: 'sidewalk',         label: 'Sidewalk',           icon: '🛣️', section: 'Space' },
  { id: 'trail',            label: 'Trail',              icon: '🌲', section: 'Space' },
  { id: 'basketball_court', label: 'Basketball court',   icon: '🏀', section: 'Space' },

  { id: 'bench',            label: 'Bench',              icon: '🛋️', section: 'Stations' },
  { id: 'pullup_bar',       label: 'Pull-up bar',        icon: '🚪', section: 'Stations' },
  { id: 'squat_rack',       label: 'Squat rack',         icon: '🏗️', section: 'Stations' },
  { id: 'cable_machine',    label: 'Cable machine',      icon: '🎛️', section: 'Stations' },
  { id: 'leg_machine',      label: 'Leg press / curl machine', icon: '🦵', section: 'Stations' },

  { id: 'dumbbells',        label: 'Dumbbells',          icon: '🏋️', section: 'Free weights', weights: 'dumbbells' },
  { id: 'kettlebell',       label: 'Kettlebell',         icon: '🔔', section: 'Free weights' },
  { id: 'barbell',          label: 'Barbell',            icon: '➖', section: 'Free weights' },
  { id: 'barbell_plates',   label: 'Barbell plates',     icon: '⚫', section: 'Free weights', weights: 'barbell_plates' },
  { id: 'curl_bar',         label: 'Curl (EZ) bar',      icon: '〰️', section: 'Free weights' },
  { id: 'curl_bar_plates',  label: 'Curl bar plates',    icon: '🔘', section: 'Free weights', weights: 'curl_bar_plates' },
  { id: 'resistance_bands', label: 'Resistance bands',   icon: '🎗️', section: 'Free weights' },

  { id: 'treadmill',        label: 'Treadmill',          icon: '🏃', section: 'Cardio gear' },
  { id: 'standing_bike',    label: 'Standing / stationary bike', icon: '🚲', section: 'Cardio gear' },
  { id: 'jump_rope',        label: 'Jump rope',          icon: '🪢', section: 'Cardio gear' },
  { id: 'box',              label: 'Plyo box / step',    icon: '📦', section: 'Cardio gear' },
];

// Default weight inventories used when "select all" (gym) is assumed.
// Each entry: weight (lb) -> count owned.
const DEFAULT_WEIGHTS = {
  dumbbells: { 5:2, 10:2, 15:2, 20:2, 25:2, 30:2, 35:2, 40:2, 45:2, 50:2, 55:2, 60:2, 70:2, 80:2, 90:2, 100:2 },
  barbell_plates: { 2.5:4, 5:4, 10:4, 25:4, 35:2, 45:6 },
  curl_bar_plates: { 2.5:4, 5:4, 10:4, 25:2 },
};

// Candidate weights offered in the weight-picker UI (count defaults to 0).
const WEIGHT_OPTIONS = {
  dumbbells: [3,5,8,10,12,15,17.5,20,25,30,35,40,45,50,55,60,65,70,75,80,90,100],
  barbell_plates: [1.25,2.5,5,10,25,35,45],
  curl_bar_plates: [1.25,2.5,5,10,25],
};

// Implied bar weights (lb) for snapping barbell-style prescriptions.
const BAR_WEIGHTS = { barbell: 45, curl_bar: 20 };

// ---------------------------------------------------------------------------
// Goals.
//
// Each goal contributes a weighting over muscle categories. The selection
// algorithm sums the weights from every selected goal to get today's muscle
// priorities. `intensity` scales prescribed difficulty (longevity / injury
// prevention train lighter), `cardioBias` nudges how much conditioning shows up.
// ---------------------------------------------------------------------------
const GOALS = [
  {
    id: 'long_life',
    label: 'Long life',
    blurb: 'Balanced full-body health & cardiovascular fitness.',
    icon: '🌳',
    intensity: 0.9,
    weights: {
      cardio: 1.0, quads: 0.7, glutes: 0.7, hamstrings: 0.6, upper_back: 0.7,
      chest: 0.5, lower_back: 0.6, abs: 0.6, calves: 0.5, rear_delt: 0.5,
      side_delt: 0.4, biceps: 0.3, triceps: 0.3, traps: 0.3, front_delt: 0.3,
      obliques: 0.4, forearms: 0.3,
    },
  },
  {
    id: 'injury_prevention',
    label: 'Injury prevention',
    blurb: 'Stabilizers, posterior chain, core & mobility.',
    icon: '🛡️',
    intensity: 0.8,
    weights: {
      rear_delt: 1.0, lower_back: 1.0, abs: 0.9, obliques: 0.8, glutes: 0.9,
      hamstrings: 0.8, upper_back: 0.8, forearms: 0.6, calves: 0.6, quads: 0.6,
      side_delt: 0.6, cardio: 0.5, chest: 0.3, biceps: 0.3, triceps: 0.4,
      traps: 0.5, front_delt: 0.3,
    },
  },
  {
    id: 'male_vanity',
    label: 'Vanity muscles',
    blurb: 'Chest, arms, shoulders, abs & lats (the V-taper).',
    icon: '💪',
    intensity: 1.0,
    weights: {
      chest: 1.0, biceps: 1.0, triceps: 0.9, side_delt: 0.9, upper_back: 0.8,
      abs: 0.8, front_delt: 0.7, traps: 0.6, rear_delt: 0.5, forearms: 0.5,
      obliques: 0.5, quads: 0.4, glutes: 0.4, hamstrings: 0.3, calves: 0.4,
      cardio: 0.3, lower_back: 0.3,
    },
  },
  {
    id: 'lose_weight',
    label: 'Lose weight',
    blurb: 'High-calorie cardio + big compound lifts.',
    icon: '🔥',
    intensity: 0.95,
    weights: {
      cardio: 1.0, quads: 0.8, glutes: 0.8, upper_back: 0.7, chest: 0.7,
      hamstrings: 0.7, abs: 0.7, obliques: 0.5, calves: 0.5, triceps: 0.5,
      biceps: 0.5, side_delt: 0.5, front_delt: 0.4, rear_delt: 0.4,
      traps: 0.4, lower_back: 0.5, forearms: 0.4,
    },
  },
];

// ---------------------------------------------------------------------------
// Exercise database.
//
// Fields:
//   id            unique key (also used in history)
//   name          display name
//   emoji         lightweight "image" for the card
//   primary       primary muscle (drives the prescribed load)
//   secondary     [] of assisting muscles (counted at half weight for variety)
//   equip         [] equipment ids, ALL required to be available
//   equipAny      optional [][] — at least one id from each inner group required
//   loadType      'per_dumbbell' | 'barbell' | 'curl_bar' | 'kettlebell' |
//                 'bodyweight' | 'time' | 'none'
//   twoHand       true if it consumes a *pair* of dumbbells
//   mult          load multiplier applied to the primary muscle's strength score
//   scheme        { sets, reps }   (for 'time' exercises reps = minutes)
//   benchmarkFor  muscle id if this is the canonical isolation lift used to
//                 read out that muscle's strength number
//   cat           'strength' | 'cardio' | 'core' | 'mobility'
// ---------------------------------------------------------------------------
const S = (sets, reps) => ({ sets, reps });

const EXERCISES = [
  // ---- Chest -------------------------------------------------------------
  { id:'flat_db_press', name:'Flat Dumbbell Press', emoji:'🏋️', primary:'chest', secondary:['front_delt','triceps'],
    equip:['dumbbells','bench'], loadType:'per_dumbbell', twoHand:true, mult:0.9, scheme:S(4,8), cat:'strength' },
  { id:'incline_db_press', name:'Incline Dumbbell Press', emoji:'📐', primary:'chest', secondary:['front_delt','triceps'],
    equip:['dumbbells','bench'], loadType:'per_dumbbell', twoHand:true, mult:0.82, scheme:S(4,8), cat:'strength' },
  { id:'barbell_bench', name:'Barbell Bench Press', emoji:'🛏️', primary:'chest', secondary:['front_delt','triceps'],
    equip:['barbell','bench'], loadType:'barbell', mult:2.4, scheme:S(4,8), cat:'strength' },
  { id:'db_fly', name:'Dumbbell Fly', emoji:'🦋', primary:'chest', secondary:['front_delt'],
    equip:['dumbbells','bench'], loadType:'per_dumbbell', twoHand:true, mult:0.5, scheme:S(3,12), cat:'strength', benchmarkFor:'chest' },
  { id:'pushup', name:'Push-up', emoji:'🤸', primary:'chest', secondary:['front_delt','triceps','abs'],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(3,12), cat:'strength' },

  // ---- Shoulders ---------------------------------------------------------
  { id:'db_shoulder_press', name:'Dumbbell Shoulder Press', emoji:'🆙', primary:'front_delt', secondary:['side_delt','triceps'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:0.85, scheme:S(4,8), cat:'strength' },
  { id:'military_press', name:'Overhead Barbell Press', emoji:'⬆️', primary:'front_delt', secondary:['side_delt','triceps'],
    equip:['barbell'], loadType:'barbell', mult:1.7, scheme:S(4,8), cat:'strength', benchmarkFor:'front_delt' },
  { id:'lateral_raise', name:'Lateral Raise', emoji:'🔱', primary:'side_delt', secondary:[],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.0, scheme:S(3,12), cat:'strength', benchmarkFor:'side_delt' },
  { id:'front_raise', name:'Front Raise', emoji:'🙆', primary:'front_delt', secondary:[],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.0, scheme:S(3,12), cat:'strength' },
  { id:'rear_fly', name:'Reverse / Rear-Delt Fly', emoji:'🕊️', primary:'rear_delt', secondary:['upper_back'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.0, scheme:S(3,15), cat:'strength', benchmarkFor:'rear_delt' },

  // ---- Back --------------------------------------------------------------
  { id:'one_arm_row', name:'One-Arm Dumbbell Row', emoji:'🚣', primary:'upper_back', secondary:['biceps','rear_delt'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:false, mult:1.0, scheme:S(4,8), cat:'strength', benchmarkFor:'upper_back' },
  { id:'barbell_row', name:'Bent-Over Barbell Row', emoji:'🛶', primary:'upper_back', secondary:['biceps','rear_delt','lower_back'],
    equip:['barbell'], loadType:'barbell', mult:1.9, scheme:S(4,8), cat:'strength' },
  { id:'pullup', name:'Pull-up', emoji:'🧗', primary:'upper_back', secondary:['biceps','forearms'],
    equip:['pullup_bar'], loadType:'bodyweight', mult:1, scheme:S(4,6), cat:'strength' },
  { id:'lat_pulldown', name:'Cable Lat Pulldown', emoji:'🪂', primary:'upper_back', secondary:['biceps'],
    equip:['cable_machine'], loadType:'barbell', mult:1.5, scheme:S(4,10), cat:'strength' },
  { id:'shrug', name:'Dumbbell Shrug', emoji:'🤷', primary:'traps', secondary:['forearms'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.0, scheme:S(4,12), cat:'strength', benchmarkFor:'traps' },

  // ---- Arms --------------------------------------------------------------
  { id:'db_curl', name:'Standing Dumbbell Curl', emoji:'💪', primary:'biceps', secondary:['forearms'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.0, scheme:S(4,8), cat:'strength', benchmarkFor:'biceps' },
  { id:'curl_bar_curl', name:'EZ-Bar Curl', emoji:'〰️', primary:'biceps', secondary:['forearms'],
    equip:['curl_bar'], loadType:'curl_bar', mult:1.9, scheme:S(4,8), cat:'strength' },
  { id:'hammer_curl', name:'Hammer Curl', emoji:'🔨', primary:'biceps', secondary:['forearms'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.0, scheme:S(3,10), cat:'strength' },
  { id:'tricep_ext', name:'Overhead Triceps Extension', emoji:'🔧', primary:'triceps', secondary:[],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:false, mult:1.0, scheme:S(4,10), cat:'strength', benchmarkFor:'triceps' },
  { id:'tricep_kickback', name:'Triceps Kickback', emoji:'🦵', primary:'triceps', secondary:[],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:0.6, scheme:S(3,12), cat:'strength' },
  { id:'dips', name:'Bench Dips', emoji:'⬇️', primary:'triceps', secondary:['chest','front_delt'],
    equip:['bench'], loadType:'bodyweight', mult:1, scheme:S(3,12), cat:'strength' },
  { id:'wrist_curl', name:'Wrist Curl', emoji:'🤜', primary:'forearms', secondary:[],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.0, scheme:S(3,15), cat:'strength', benchmarkFor:'forearms' },

  // ---- Core --------------------------------------------------------------
  { id:'plank', name:'Plank', emoji:'🧱', primary:'abs', secondary:['obliques','lower_back'],
    equip:[], loadType:'time', mult:0.6, scheme:S(3,1), cat:'core' }, // reps field unused; minutes derived
  { id:'crunch', name:'Crunch', emoji:'🌀', primary:'abs', secondary:[],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(3,20), cat:'core', benchmarkFor:'abs' },
  { id:'leg_raise', name:'Hanging / Lying Leg Raise', emoji:'🦿', primary:'abs', secondary:['obliques'],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(3,15), cat:'core' },
  { id:'russian_twist', name:'Russian Twist', emoji:'🔄', primary:'obliques', secondary:['abs'],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(3,20), cat:'core', benchmarkFor:'obliques' },
  { id:'superman', name:'Superman', emoji:'🦸', primary:'lower_back', secondary:['glutes'],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(3,15), cat:'core', benchmarkFor:'lower_back' },
  { id:'back_extension', name:'Back Extension', emoji:'🌉', primary:'lower_back', secondary:['glutes','hamstrings'],
    equip:['bench'], loadType:'bodyweight', mult:1, scheme:S(3,15), cat:'core' },

  // ---- Legs --------------------------------------------------------------
  { id:'goblet_squat', name:'Goblet Squat', emoji:'🏆', primary:'quads', secondary:['glutes','hamstrings'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:false, mult:1.0, scheme:S(4,10), cat:'strength' },
  { id:'back_squat', name:'Barbell Back Squat', emoji:'🏋️', primary:'quads', secondary:['glutes','hamstrings','lower_back'],
    equip:['barbell','squat_rack'], loadType:'barbell', mult:2.6, scheme:S(4,8), cat:'strength', benchmarkFor:'quads' },
  { id:'bodyweight_squat', name:'Bodyweight Squat', emoji:'🪑', primary:'quads', secondary:['glutes'],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(3,20), cat:'strength' },
  { id:'lunge', name:'Walking Lunge', emoji:'🚶', primary:'glutes', secondary:['quads','hamstrings'],
    equip:['flat_area'], loadType:'bodyweight', mult:1, scheme:S(3,16), cat:'strength' },
  { id:'db_rdl', name:'Dumbbell Romanian Deadlift', emoji:'🪝', primary:'hamstrings', secondary:['glutes','lower_back'],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.1, scheme:S(4,10), cat:'strength', benchmarkFor:'hamstrings' },
  { id:'barbell_deadlift', name:'Barbell Deadlift', emoji:'🏗️', primary:'hamstrings', secondary:['glutes','lower_back','upper_back','traps'],
    equip:['barbell'], loadType:'barbell', mult:3.0, scheme:S(4,5), cat:'strength' },
  { id:'hip_thrust', name:'Hip Thrust', emoji:'🍑', primary:'glutes', secondary:['hamstrings'],
    equip:['bench'], loadType:'bodyweight', mult:1, scheme:S(4,15), cat:'strength', benchmarkFor:'glutes' },
  { id:'calf_raise', name:'Standing Calf Raise', emoji:'🦶', primary:'calves', secondary:[],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(4,20), cat:'strength', benchmarkFor:'calves' },
  { id:'db_calf_raise', name:'Dumbbell Calf Raise', emoji:'🦵', primary:'calves', secondary:[],
    equip:['dumbbells'], loadType:'per_dumbbell', twoHand:true, mult:1.4, scheme:S(4,15), cat:'strength' },

  // ---- Cardio ------------------------------------------------------------
  { id:'run_trail', name:'Trail Run', emoji:'🌲', primary:'cardio', secondary:['quads','calves','glutes'],
    equip:['trail'], loadType:'time', mult:1.6, scheme:S(1,1), cat:'cardio' },
  { id:'run_sidewalk', name:'Road Run', emoji:'🏃', primary:'cardio', secondary:['quads','calves'],
    equip:['sidewalk'], loadType:'time', mult:1.6, scheme:S(1,1), cat:'cardio' },
  { id:'treadmill_run', name:'Treadmill Run', emoji:'🏃‍♂️', primary:'cardio', secondary:['quads','calves'],
    equip:['treadmill'], loadType:'time', mult:1.6, scheme:S(1,1), cat:'cardio', benchmarkFor:'cardio' },
  { id:'bike', name:'Stationary Bike', emoji:'🚲', primary:'cardio', secondary:['quads'],
    equip:['standing_bike'], loadType:'time', mult:2.0, scheme:S(1,1), cat:'cardio' },
  { id:'jump_rope', name:'Jump Rope', emoji:'🪢', primary:'cardio', secondary:['calves'],
    equip:['jump_rope'], loadType:'time', mult:0.8, scheme:S(3,1), cat:'cardio' },
  { id:'box_jump', name:'Box Jumps', emoji:'📦', primary:'cardio', secondary:['quads','glutes','calves'],
    equip:['box'], loadType:'bodyweight', mult:1, scheme:S(4,12), cat:'cardio' },
  { id:'burpee', name:'Burpees', emoji:'💥', primary:'cardio', secondary:['chest','quads','abs'],
    equip:[], loadType:'bodyweight', mult:1, scheme:S(4,12), cat:'cardio' },
  { id:'suicides', name:'Court Suicides', emoji:'🏀', primary:'cardio', secondary:['quads','calves'],
    equip:['basketball_court'], loadType:'time', mult:0.6, scheme:S(4,1), cat:'cardio' },
  { id:'jumping_jacks', name:'Jumping Jacks', emoji:'⭐', primary:'cardio', secondary:['calves','side_delt'],
    equip:[], loadType:'time', mult:0.5, scheme:S(3,1), cat:'cardio' },
];

// Quick lookup by id.
const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];
const DAY_LABELS = { sun:'Sun', mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat' };

window.DB = {
  MUSCLES, EQUIPMENT, DEFAULT_WEIGHTS, WEIGHT_OPTIONS, BAR_WEIGHTS,
  GOALS, EXERCISES, EXERCISE_BY_ID, DAYS, DAY_LABELS,
};
