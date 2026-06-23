// ===========================================================================
// data.js — Static reference content (not per-user state).
//
// NEW MODEL (v2): a workout is a MOVEMENT (a motion, e.g. "Bent Over Row"),
// independent of equipment. Each movement lists the EQUIPMENT OPTIONS that can
// perform it. The algorithm decides a target load (from muscle strength), then
// picks the option whose *achievable* load best matches — instead of clamping a
// single hard-wired piece of equipment down to whatever it can manage.
// ===========================================================================

// ---------------------------------------------------------------------------
// Muscle categories. `seedFraction` seeds the strength score as a fraction of
// bodyweight, expressed in a "per-limb-equivalent working load" (lb) — the
// common scale every equipment option is compared against. Conservative on
// purpose: new users tune their real baseline via the card popup, and the
// green/red progression takes over from there.
// ---------------------------------------------------------------------------
const MUSCLES = {
  cardio:      { label: 'Heart & Lungs',   seedFraction: 0.12, group: 'Conditioning' },
  chest:       { label: 'Chest',           seedFraction: 0.16, group: 'Push' },
  front_delt:  { label: 'Front Shoulder',  seedFraction: 0.09, group: 'Push' },
  side_delt:   { label: 'Side Shoulder',   seedFraction: 0.055, group: 'Push' },
  rear_delt:   { label: 'Rear Shoulder',   seedFraction: 0.045, group: 'Pull' },
  triceps:     { label: 'Triceps',         seedFraction: 0.09, group: 'Push' },
  biceps:      { label: 'Biceps',          seedFraction: 0.10, group: 'Pull' },
  forearms:    { label: 'Forearms',        seedFraction: 0.08, group: 'Pull' },
  upper_back:  { label: 'Upper Back / Lats',seedFraction: 0.16, group: 'Pull' },
  traps:       { label: 'Traps',           seedFraction: 0.22, group: 'Pull' },
  abs:         { label: 'Abs',             seedFraction: 0.08, group: 'Core' },
  obliques:    { label: 'Obliques',        seedFraction: 0.08, group: 'Core' },
  lower_back:  { label: 'Lower Back',      seedFraction: 0.14, group: 'Core' },
  glutes:      { label: 'Glutes',          seedFraction: 0.24, group: 'Legs' },
  quads:       { label: 'Quads',           seedFraction: 0.26, group: 'Legs' },
  hamstrings:  { label: 'Hamstrings',      seedFraction: 0.20, group: 'Legs' },
  calves:      { label: 'Calves',          seedFraction: 0.26, group: 'Legs' },
};

// ---------------------------------------------------------------------------
// Equipment (unchanged). `weights` marks items with a weight-inventory picker.
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

const DEFAULT_WEIGHTS = {
  dumbbells: { 5:2, 10:2, 15:2, 20:2, 25:2, 30:2, 35:2, 40:2, 45:2, 50:2, 55:2, 60:2, 70:2, 80:2, 90:2, 100:2 },
  barbell_plates: { 2.5:4, 5:4, 10:4, 25:4, 35:2, 45:6 },
  curl_bar_plates: { 2.5:4, 5:4, 10:4, 25:2 },
};
const WEIGHT_OPTIONS = {
  dumbbells: [3,5,8,10,12,15,17.5,20,25,30,35,40,45,50,55,60,65,70,75,80,90,100],
  barbell_plates: [1.25,2.5,5,10,25,35,45],
  curl_bar_plates: [1.25,2.5,5,10,25],
};
const BAR_WEIGHTS = { barbell: 45, curl_bar: 20 };

// ---------------------------------------------------------------------------
// Goals → muscle priorities (summed across selected goals).
// ---------------------------------------------------------------------------
const GOALS = [
  { id:'long_life', label:'Long life', blurb:'Balanced full-body health & cardiovascular fitness.', icon:'🌳', intensity:0.9,
    weights:{ cardio:1.0, quads:0.7, glutes:0.7, hamstrings:0.6, upper_back:0.7, chest:0.5, lower_back:0.6, abs:0.6, calves:0.5, rear_delt:0.5, side_delt:0.4, biceps:0.3, triceps:0.3, traps:0.3, front_delt:0.3, obliques:0.4, forearms:0.3 } },
  { id:'injury_prevention', label:'Injury prevention', blurb:'Stabilizers, posterior chain, core & mobility.', icon:'🛡️', intensity:0.8,
    weights:{ rear_delt:1.0, lower_back:1.0, abs:0.9, obliques:0.8, glutes:0.9, hamstrings:0.8, upper_back:0.8, forearms:0.6, calves:0.6, quads:0.6, side_delt:0.6, cardio:0.5, chest:0.3, biceps:0.3, triceps:0.4, traps:0.5, front_delt:0.3 } },
  { id:'male_vanity', label:'Vanity muscles', blurb:'Chest, arms, shoulders, abs & lats (the V-taper).', icon:'💪', intensity:1.0,
    weights:{ chest:1.0, biceps:1.0, triceps:0.9, side_delt:0.9, upper_back:0.8, abs:0.8, front_delt:0.7, traps:0.6, rear_delt:0.5, forearms:0.5, obliques:0.5, quads:0.4, glutes:0.4, hamstrings:0.3, calves:0.4, cardio:0.3, lower_back:0.3 } },
  { id:'lose_weight', label:'Lose weight', blurb:'High-calorie cardio + big compound lifts.', icon:'🔥', intensity:0.95,
    weights:{ cardio:1.0, quads:0.8, glutes:0.8, upper_back:0.7, chest:0.7, hamstrings:0.7, abs:0.7, obliques:0.5, calves:0.5, triceps:0.5, biceps:0.5, side_delt:0.5, front_delt:0.4, rear_delt:0.4, traps:0.4, lower_back:0.5, forearms:0.4 } },
];

// ---------------------------------------------------------------------------
// Equipment-option helpers. Each option declares a `kind` that tells the load
// engine how to convert the target load <-> a real prescription:
//
//   dbpair    a pair of dumbbells     (load shown "per hand")
//   dbsingle  one dumbbell
//   barbell   olympic bar + plates    (load shown as total)
//   curlbar   EZ bar + plates         (total)
//   cable     cable stack             (total, fine increments)
//   machine   plate/selectorized mach (total)
//   bodyweight no external load        (reps scale with strength)
//   time      duration in minutes      (cardio)
//   hold      isometric hold in seconds
//
// Options are listed best→fallback; that order breaks ties when two options
// match the target load equally well.
// ---------------------------------------------------------------------------
const O = {
  db:        (extra={}) => ({ id:'db',    kind:'dbpair',   equip:['dumbbells'], ...extra }),
  db1:       (extra={}) => ({ id:'db1',   kind:'dbsingle', equip:['dumbbells'], ...extra }),
  barbell:   (extra={}) => ({ id:'bb',    kind:'barbell',  equip:['barbell'], ...extra }),
  barbellRk: (extra={}) => ({ id:'bb',    kind:'barbell',  equip:['barbell','squat_rack'], ...extra }),
  curlbar:   (extra={}) => ({ id:'ez',    kind:'curlbar',  equip:['curl_bar'], ...extra }),
  cable:     (extra={}) => ({ id:'cab',   kind:'cable',    equip:['cable_machine'], ...extra }),
  machine:   (extra={}) => ({ id:'mac',   kind:'machine',  equip:['leg_machine'], ...extra }),
  body:      (extra={}) => ({ id:'bw',    kind:'bodyweight', equip:[], ...extra }),
  bodyBench: (extra={}) => ({ id:'bw',    kind:'bodyweight', equip:['bench'], ...extra }),
  bodyBar:   (extra={}) => ({ id:'pb',    kind:'bodyweight', equip:['pullup_bar'], ...extra }),
};

// `rel` = how heavily this movement loads its primary muscle vs the per-limb
// reference (compounds > isolation). Scheme is sets×reps.
const MOVEMENTS = [
  // ---- PUSH: chest -------------------------------------------------------
  { id:'flat_press', name:'Flat Press', emoji:'🏋️', pattern:'push', primary:'chest', secondary:['front_delt','triceps'],
    cat:'strength', rel:1.5, scheme:{sets:4,reps:8}, options:[ O.db(), O.barbell({equip:['barbell','bench']}), O.cable(), O.bodyBench({label:'Push-ups'}) ] },
  { id:'incline_press', name:'Incline Press', emoji:'📐', pattern:'push', primary:'chest', secondary:['front_delt','triceps'],
    cat:'strength', rel:1.35, scheme:{sets:4,reps:8}, options:[ O.db({equip:['dumbbells','bench']}), O.barbell({equip:['barbell','bench']}), O.body({label:'Decline Push-ups'}) ] },
  { id:'chest_fly', name:'Chest Fly', emoji:'🦋', pattern:'push', primary:'chest', secondary:['front_delt'],
    cat:'strength', rel:0.8, scheme:{sets:3,reps:12}, benchmarkFor:'chest', options:[ O.db({equip:['dumbbells','bench']}), O.cable() ] },

  // ---- PUSH: shoulders ---------------------------------------------------
  { id:'overhead_press', name:'Overhead Press', emoji:'⬆️', pattern:'push', primary:'front_delt', secondary:['side_delt','triceps'],
    cat:'strength', rel:1.25, scheme:{sets:4,reps:8}, benchmarkFor:'front_delt', options:[ O.db(), O.barbell(), O.cable() ] },
  { id:'lateral_raise', name:'Lateral Raise', emoji:'🔱', pattern:'push', primary:'side_delt', secondary:[],
    cat:'strength', rel:1.0, scheme:{sets:3,reps:12}, benchmarkFor:'side_delt', options:[ O.db(), O.cable() ] },
  { id:'front_raise', name:'Front Raise', emoji:'🙆', pattern:'push', primary:'front_delt', secondary:[],
    cat:'strength', rel:1.0, scheme:{sets:3,reps:12}, options:[ O.db(), O.cable() ] },
  { id:'rear_fly', name:'Rear-Delt Fly', emoji:'🕊️', pattern:'pull', primary:'rear_delt', secondary:['upper_back'],
    cat:'strength', rel:1.0, scheme:{sets:3,reps:15}, benchmarkFor:'rear_delt', options:[ O.db(), O.cable() ] },

  // ---- PULL: back --------------------------------------------------------
  { id:'bent_row', name:'Bent Over Row', emoji:'🚣', pattern:'pull', primary:'upper_back', secondary:['biceps','rear_delt'],
    cat:'strength', rel:1.4, scheme:{sets:4,reps:8}, benchmarkFor:'upper_back', options:[ O.db(), O.db1({label:'One-Arm Row'}), O.barbell(), O.curlbar(), O.cable() ] },
  { id:'pulldown', name:'Lat Pulldown / Pull-up', emoji:'🧗', pattern:'pull', primary:'upper_back', secondary:['biceps','forearms'],
    cat:'strength', rel:1.3, scheme:{sets:4,reps:10}, options:[ O.cable({label:'Lat Pulldown'}), O.bodyBar({label:'Pull-ups', scheme:{sets:4,reps:6}}) ] },
  { id:'shrug', name:'Shrug', emoji:'🤷', pattern:'carry', primary:'traps', secondary:['forearms'],
    cat:'strength', rel:1.5, scheme:{sets:4,reps:12}, benchmarkFor:'traps', options:[ O.db(), O.barbell() ] },

  // ---- PULL: arms --------------------------------------------------------
  { id:'biceps_curl', name:'Biceps Curl', emoji:'💪', pattern:'pull', primary:'biceps', secondary:['forearms'],
    cat:'strength', rel:1.0, scheme:{sets:4,reps:8}, benchmarkFor:'biceps', options:[ O.db(), O.curlbar(), O.cable() ] },
  { id:'hammer_curl', name:'Hammer Curl', emoji:'🔨', pattern:'pull', primary:'biceps', secondary:['forearms'],
    cat:'strength', rel:1.0, scheme:{sets:3,reps:10}, options:[ O.db() ] },
  { id:'triceps_ext', name:'Triceps Extension', emoji:'🔧', pattern:'push', primary:'triceps', secondary:[],
    cat:'strength', rel:1.0, scheme:{sets:4,reps:10}, benchmarkFor:'triceps', options:[ O.db1(), O.curlbar(), O.cable() ] },
  { id:'triceps_dip', name:'Triceps Dip', emoji:'⬇️', pattern:'push', primary:'triceps', secondary:['chest','front_delt'],
    cat:'strength', rel:1.0, scheme:{sets:3,reps:12}, options:[ O.bodyBench() ] },
  { id:'wrist_curl', name:'Wrist Curl', emoji:'🤜', pattern:'carry', primary:'forearms', secondary:[],
    cat:'strength', rel:1.0, scheme:{sets:3,reps:15}, benchmarkFor:'forearms', options:[ O.db(), O.barbell() ] },

  // ---- CORE --------------------------------------------------------------
  { id:'plank', name:'Plank', emoji:'🧱', pattern:'rotation', primary:'abs', secondary:['obliques','lower_back'],
    cat:'core', rel:1.0, holdBase:45, scheme:{sets:3,reps:1}, options:[ O.body({kind:'hold'}) ] },
  { id:'crunch', name:'Crunch', emoji:'🌀', pattern:'rotation', primary:'abs', secondary:[],
    cat:'core', rel:1.0, scheme:{sets:3,reps:20}, benchmarkFor:'abs', options:[ O.body() ] },
  { id:'leg_raise', name:'Leg Raise', emoji:'🦿', pattern:'rotation', primary:'abs', secondary:['obliques'],
    cat:'core', rel:1.0, scheme:{sets:3,reps:15}, options:[ O.body(), O.bodyBar({label:'Hanging Leg Raise'}) ] },
  { id:'russian_twist', name:'Russian Twist', emoji:'🔄', pattern:'rotation', primary:'obliques', secondary:['abs'],
    cat:'core', rel:1.0, scheme:{sets:3,reps:20}, benchmarkFor:'obliques', options:[ O.body(), O.db1({label:'Weighted Twist'}) ] },
  { id:'back_ext', name:'Back Extension', emoji:'🌉', pattern:'hinge', primary:'lower_back', secondary:['glutes','hamstrings'],
    cat:'core', rel:1.0, scheme:{sets:3,reps:15}, benchmarkFor:'lower_back', options:[ O.body({label:'Superman'}), O.bodyBench() ] },

  // ---- LEGS --------------------------------------------------------------
  { id:'squat', name:'Squat', emoji:'🏋️', pattern:'squat', primary:'quads', secondary:['glutes','hamstrings','lower_back'],
    cat:'strength', rel:1.6, scheme:{sets:4,reps:8}, benchmarkFor:'quads', options:[ O.barbellRk(), O.db1({label:'Goblet Squat'}), O.body({label:'Bodyweight Squat', scheme:{sets:3,reps:20}}) ] },
  { id:'lunge', name:'Lunge', emoji:'🚶', pattern:'lunge', primary:'glutes', secondary:['quads','hamstrings'],
    cat:'strength', rel:1.2, scheme:{sets:3,reps:16}, options:[ O.db(), O.body() ] },
  { id:'rdl', name:'Romanian Deadlift', emoji:'🪝', pattern:'hinge', primary:'hamstrings', secondary:['glutes','lower_back'],
    cat:'strength', rel:1.5, scheme:{sets:4,reps:10}, benchmarkFor:'hamstrings', options:[ O.db(), O.barbell() ] },
  { id:'deadlift', name:'Deadlift', emoji:'🏗️', pattern:'hinge', primary:'hamstrings', secondary:['glutes','lower_back','upper_back','traps'],
    cat:'strength', rel:1.7, scheme:{sets:4,reps:5}, options:[ O.barbell() ] },
  { id:'hip_thrust', name:'Hip Thrust', emoji:'🍑', pattern:'hinge', primary:'glutes', secondary:['hamstrings'],
    cat:'strength', rel:1.5, scheme:{sets:4,reps:12}, benchmarkFor:'glutes', options:[ O.barbell({equip:['barbell','bench']}), O.db({equip:['dumbbells','bench']}), O.bodyBench() ] },
  { id:'calf_raise', name:'Calf Raise', emoji:'🦶', pattern:'squat', primary:'calves', secondary:[],
    cat:'strength', rel:1.2, scheme:{sets:4,reps:18}, benchmarkFor:'calves', options:[ O.db(), O.machine(), O.body({scheme:{sets:4,reps:25}}) ] },

  // ---- CONDITIONING (heart & lungs) — equipment swaps the activity --------
  { id:'steady_cardio', name:'Steady Cardio', emoji:'🏃', pattern:'gait', primary:'cardio', secondary:['quads','calves','glutes'],
    cat:'cardio', rel:1.0, scheme:{sets:1,reps:1}, benchmarkFor:'cardio', options:[
      { id:'tread', kind:'time', equip:['treadmill'], label:'Treadmill Run', emoji:'🏃‍♂️', minMult:1.4 },
      { id:'trail', kind:'time', equip:['trail'],     label:'Trail Run',     emoji:'🌲', minMult:1.4 },
      { id:'road',  kind:'time', equip:['sidewalk'],  label:'Road Run',      emoji:'🏃', minMult:1.4 },
      { id:'bike',  kind:'time', equip:['standing_bike'], label:'Stationary Bike', emoji:'🚲', minMult:1.9 },
      { id:'rope',  kind:'time', equip:['jump_rope'], label:'Jump Rope',     emoji:'🪢', minMult:0.9, scheme:{sets:3,reps:1} },
    ] },
  { id:'cardio_intervals', name:'Cardio Intervals', emoji:'💥', pattern:'gait', primary:'cardio', secondary:['quads','glutes','abs'],
    cat:'cardio', rel:1.0, scheme:{sets:4,reps:12}, options:[
      { id:'burpee', kind:'bodyweight', equip:[], label:'Burpees', emoji:'💥' },
      { id:'boxjump',kind:'bodyweight', equip:['box'], label:'Box Jumps', emoji:'📦' },
      { id:'suicide',kind:'time', equip:['basketball_court'], label:'Court Suicides', emoji:'🏀', minMult:0.6, scheme:{sets:4,reps:1} },
      { id:'jacks',  kind:'time', equip:[], label:'Jumping Jacks', emoji:'⭐', minMult:0.5, scheme:{sets:3,reps:1} },
    ] },
];

const MOVEMENT_BY_ID = Object.fromEntries(MOVEMENTS.map(m => [m.id, m]));

const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];
const DAY_LABELS = { sun:'Sun', mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat' };

// Default per-equipment efficiency: converts target per-limb load <-> native.
const KIND_EFF = { dbpair:1.0, dbsingle:1.0, barbell:1.1, curlbar:1.0, cable:1.0, machine:1.1 };
const KIND_LABEL = { dbpair:'Dumbbells', dbsingle:'Dumbbell', barbell:'Barbell', curlbar:'Curl bar', cable:'Cable', machine:'Machine', bodyweight:'Bodyweight', hold:'Bodyweight', time:'Cardio' };

window.DB = {
  MUSCLES, EQUIPMENT, DEFAULT_WEIGHTS, WEIGHT_OPTIONS, BAR_WEIGHTS, GOALS,
  MOVEMENTS, MOVEMENT_BY_ID, DAYS, DAY_LABELS, KIND_EFF, KIND_LABEL,
};
