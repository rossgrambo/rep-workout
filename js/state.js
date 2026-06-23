// ===========================================================================
// state.js — The single source of truth for everything about the user.
//
// The ENTIRE user is one JSON object (see makeDefaultState). It is persisted to
// localStorage. The long-term plan is to let an LLM edit this JSON directly
// ("lower my bicep strength", "I keep running out of time") — so we keep it flat,
// readable, and free of derived/cached fields.
// ===========================================================================

const STORAGE_KEY = 'workout.state.v1';
const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Default / empty state.
// ---------------------------------------------------------------------------
function makeDefaultState() {
  // Equipment: every item checked by default (assume a fully-stocked gym).
  const equipment = {};
  for (const item of DB.EQUIPMENT) {
    equipment[item.id] = true;
    if (item.weights) {
      // Full default inventory for the weighted items.
      equipment[item.weights] = { ...DB.DEFAULT_WEIGHTS[item.weights] };
    }
  }

  // Time available: default 1 hour on weekdays, a bit more on weekends, 0 = rest.
  const time = { sun:1, mon:0.75, tue:0.75, wed:0.75, thu:0.75, fri:0.75, sat:1 };

  return {
    version: SCHEMA_VERSION,
    onboarded: false,
    bodyweight: 175,           // lb — used only to seed strength scores
    units: 'lb',
    equipment,
    time,
    goals: [],                 // e.g. ['male_vanity','lose_weight']
    muscleStrength: {},        // muscle id -> strength score (seeded at finish)
    exerciseState: {},         // exercise id -> { green, red } streak counters
    history: [],               // [{ date, exerciseId, result, prescription }]
    todayPlan: null,           // { date, items:[planItem] } cached for the day
  };
}

// Seed each muscle's strength score from bodyweight. Called when onboarding
// finishes (and any time strengths are missing).
function seedStrengths(state) {
  for (const [id, m] of Object.entries(DB.MUSCLES)) {
    if (state.muscleStrength[id] == null) {
      state.muscleStrength[id] = Math.round(state.bodyweight * m.seedFraction);
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence.
// ---------------------------------------------------------------------------
function loadState() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { raw = null; }
  if (!raw) return makeDefaultState();
  try {
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (_) {
    return makeDefaultState();
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

// Forward-compatible migration hook. For now just fill in any missing keys so
// older saves (or hand-edited JSON) don't crash the app.
function migrate(state) {
  const def = makeDefaultState();
  const merged = { ...def, ...state };
  merged.equipment = { ...def.equipment, ...(state.equipment || {}) };
  merged.time = { ...def.time, ...(state.time || {}) };
  merged.muscleStrength = { ...(state.muscleStrength || {}) };
  merged.exerciseState = { ...(state.exerciseState || {}) };
  merged.history = Array.isArray(state.history) ? state.history : [];
  merged.goals = Array.isArray(state.goals) ? state.goals : [];
  merged.version = SCHEMA_VERSION;
  return merged;
}

// Export / import the whole user as JSON text (handy for backups + future LLM).
function exportState(state) { return JSON.stringify(state, null, 2); }
function importState(text) { return migrate(JSON.parse(text)); }

window.Store = {
  STORAGE_KEY, makeDefaultState, seedStrengths, loadState, saveState,
  migrate, exportState, importState,
};
