// ===========================================================================
// algorithm.js — The "brain". Three responsibilities, all pure-ish functions
// over (state) so they're easy to test and easy to swap for an LLM later:
//
//   1. prescribe()    — given a muscle's strength score, what weight/reps/time?
//   2. generatePlan() — pick today's exercises (goal priority + least-recently-used)
//   3. applyResult()  — record a green/red check and adjust strength scores
//
// Difficulty philosophy (per the spec): a RED check (finished, but hit failure)
// is the target zone. Two GREENs in a row = too easy → bump the muscle up.
// Three REDs in a row = too hard → bring it back down.
// ===========================================================================

// ---- date helpers ---------------------------------------------------------
function dateKey(d) {
  // Local YYYY-MM-DD (not UTC) so "today" matches the user's calendar.
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function daysBetween(aKey, bKey) {
  const a = new Date(aKey + 'T00:00:00'), b = new Date(bKey + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// ---- equipment helpers ----------------------------------------------------
function hasEquip(state, id) {
  const v = state.equipment[id];
  return v === true || (v && typeof v === 'object'); // inventories are truthy objects
}
function exerciseAvailable(state, ex) {
  for (const id of ex.equip) if (!hasEquip(state, id)) return false;
  if (ex.equipAny) for (const grp of ex.equipAny) if (!grp.some(id => hasEquip(state, id))) return false;
  // Weighted lifts need at least one usable weight.
  if (ex.loadType === 'per_dumbbell' && availableDumbbells(state, ex.twoHand).length === 0) return false;
  if ((ex.loadType === 'barbell' || ex.loadType === 'curl_bar') && achievableBar(state, ex.loadType).length === 0) return false;
  return true;
}

// Dumbbell weights the user owns enough of (a pair if twoHand), ascending.
function availableDumbbells(state, twoHand) {
  const inv = state.equipment.dumbbells;
  if (!inv || typeof inv !== 'object') return [];
  const need = twoHand ? 2 : 1;
  return Object.keys(inv).map(Number).filter(w => inv[w] >= need).sort((a,b)=>a-b);
}

// All achievable total weights for a bar style, given the plate inventory.
function achievableBar(state, loadType) {
  const barId = loadType === 'curl_bar' ? 'curl_bar' : 'barbell';
  const plateKey = loadType === 'curl_bar' ? 'curl_bar_plates' : 'barbell_plates';
  if (!hasEquip(state, barId)) return [];
  const bar = DB.BAR_WEIGHTS[barId] || 45;
  const inv = state.equipment[plateKey];
  // No plate info? assume you can at least load the bare bar + common jumps.
  if (!inv || typeof inv !== 'object') return [bar];
  // Bounded knapsack over plate *pairs* -> reachable "added" weights.
  const reachable = new Set([0]);
  for (const w of Object.keys(inv).map(Number)) {
    const pairs = Math.floor(inv[w] / 2);
    if (pairs <= 0) continue;
    const add = 2 * w;
    const snapshot = [...reachable];
    for (const base of snapshot)
      for (let k = 1; k <= pairs; k++) reachable.add(base + add * k);
  }
  return [...reachable].map(a => bar + a).sort((a,b)=>a-b);
}

// Snap a target down to the closest achievable value at or below it
// (fall back to the smallest available if target is below everything).
function snapDown(target, sortedVals) {
  if (!sortedVals.length) return null;
  let best = sortedVals[0];
  for (const v of sortedVals) { if (v <= target) best = v; else break; }
  return best;
}

// ---- prescription ---------------------------------------------------------
function seedValue(state, muscle) {
  return Math.max(1, Math.round(state.bodyweight * (DB.MUSCLES[muscle]?.seedFraction || 0.1)));
}
function strengthRatio(state, muscle) {
  const s = state.muscleStrength[muscle] ?? seedValue(state, muscle);
  return clamp(s / seedValue(state, muscle), 0.5, 3);
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// Returns { sets, reps, loadType, load, unit, text } — a self-contained snapshot
// describing exactly what to do, suitable for storing in history.
function prescribe(state, ex) {
  const strength = state.muscleStrength[ex.primary] ?? seedValue(state, ex.primary);
  const base = strength * ex.mult;
  const { sets } = ex.scheme;
  let reps = ex.scheme.reps, load = null, unit = '', text = '';

  switch (ex.loadType) {
    case 'per_dumbbell': {
      load = snapDown(base, availableDumbbells(state, ex.twoHand));
      unit = state.units;
      text = `${load}${unit}${ex.twoHand ? ' each' : ''}`;
      break;
    }
    case 'barbell':
    case 'curl_bar': {
      load = snapDown(base, achievableBar(state, ex.loadType));
      unit = state.units;
      text = `${load}${unit}`;
      break;
    }
    case 'bodyweight': {
      reps = Math.max(1, Math.round(ex.scheme.reps * strengthRatio(state, ex.primary)));
      text = 'bodyweight';
      break;
    }
    case 'time': {
      const ratio = strengthRatio(state, ex.primary);
      if (ex.cat === 'cardio') {
        load = clamp(Math.round(ex.mult * 18 * ratio), 5, 60); unit = 'min';
      } else { // holds like the plank, measured in seconds
        load = clamp(Math.round(ex.mult * 75 * ratio), 20, 240); unit = 'sec';
      }
      text = `${load} ${unit}`;
      break;
    }
    default: text = '';
  }
  return { sets, reps, loadType: ex.loadType, load, unit, text };
}

// Human sentence for a card, e.g. "Incline Dumbbell Press — 4×8 @ 60lb each".
function prescriptionText(ex, p) {
  if (p.loadType === 'time' && ex.cat === 'cardio') {
    return p.sets > 1 ? `${p.sets} × ${p.load} ${p.unit}` : `${p.load} ${p.unit}`;
  }
  if (p.loadType === 'time') return `${p.sets} × ${p.load} ${p.unit} hold`;
  if (p.loadType === 'bodyweight') return `${p.sets} × ${p.reps} (bodyweight)`;
  return `${p.sets} × ${p.reps} @ ${p.text}`;
}

// Rough minutes an exercise will take — used to fill the time budget.
function estimateMinutes(ex, p) {
  if (p.loadType === 'time' && ex.cat === 'cardio') return p.load * p.sets + 1;
  if (p.loadType === 'time') return p.sets * (p.load / 60 + 0.5) + 1;
  const restPerSet = 1.2, secPerRep = 0.06;
  return 1 + p.sets * (p.reps * secPerRep + restPerSet);
}

// ---- selection ------------------------------------------------------------
// Goal-weighted priority over muscles. Sum of each selected goal's weights.
function musclePriorities(state) {
  const pri = {};
  for (const m of Object.keys(DB.MUSCLES)) pri[m] = 0;
  const goals = DB.GOALS.filter(g => state.goals.includes(g.id));
  if (goals.length === 0) { for (const m in pri) pri[m] = 0.5; return pri; }
  for (const g of goals)
    for (const [m, w] of Object.entries(g.weights)) pri[m] = (pri[m] || 0) + w;
  return pri;
}

// Days since an exercise was last completed (large number if never).
function daysSince(state, exId, todayK) {
  let last = null;
  for (let i = state.history.length - 1; i >= 0; i--) {
    if (state.history[i].exerciseId === exId) { last = state.history[i].date; break; }
  }
  return last ? daysBetween(last, todayK) : 999;
}

// The main event: build today's plan.
function generatePlan(state, date) {
  const todayK = dateKey(date);
  const dayKey = DB.DAYS[date.getDay()];
  const hours = state.time[dayKey] ?? 0;
  if (hours <= 0) return { date: todayK, dayKey, rest: true, items: [] };

  const budget = hours * 60;
  const pri = musclePriorities(state);
  const intensity = avgIntensity(state);

  // Build scored candidates.
  const candidates = DB.EXERCISES.filter(ex => exerciseAvailable(state, ex)).map(ex => {
    const p = prescribe(state, ex);
    const recency = clamp(daysSince(state, ex.id, todayK) / 7, 0, 1); // 0..1, 1 = a week+ ago / never
    let muscleScore = (pri[ex.primary] || 0);
    for (const s of ex.secondary) muscleScore += 0.35 * (pri[s] || 0);
    // Priority dominates; recency breaks ties and rotates the library (LRU).
    const score = muscleScore * (0.45 + 0.55 * recency);
    return { ex, p, score, estMin: estimateMinutes(ex, p) };
  });

  // Greedy fill: each pick reduces the marginal value of muscles already hit,
  // which naturally diversifies the session.
  const covered = {};
  const chosen = [];
  let used = 0;
  const pool = [...candidates];
  while (pool.length && used < budget && chosen.length < 10) {
    let bestIdx = -1, bestEff = -1;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const penalty = 1 / (1 + (covered[c.ex.primary] || 0));
      const eff = c.score * penalty;
      // Must fit remaining time (always allow the very first pick).
      const fits = chosen.length === 0 || used + c.estMin <= budget + 3;
      if (fits && eff > bestEff) { bestEff = eff; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    const pick = pool.splice(bestIdx, 1)[0];
    chosen.push(pick);
    used += pick.estMin;
    covered[pick.ex.primary] = (covered[pick.ex.primary] || 0) + 1;
    for (const s of pick.ex.secondary) covered[s] = (covered[s] || 0) + 0.5;
  }

  // Order: cardio (warm up) → strength → core (finisher).
  const order = { cardio: 0, strength: 1, core: 2, mobility: 3 };
  chosen.sort((a, b) => (order[a.ex.cat] - order[b.ex.cat]));

  const items = chosen.map(c => ({
    exerciseId: c.ex.id,
    prescription: c.p,
    estMin: Math.round(c.estMin),
    done: null,            // null | 'green' | 'red'
  }));
  void intensity;          // reserved: future global difficulty scaling
  return { date: todayK, dayKey, rest: false, items };
}

function avgIntensity(state) {
  const goals = DB.GOALS.filter(g => state.goals.includes(g.id));
  if (!goals.length) return 1;
  return goals.reduce((s, g) => s + g.intensity, 0) / goals.length;
}

// ---- progression ----------------------------------------------------------
// Nudge a muscle's strength score. dir>0 = harder, dir<0 = easier.
function adjustStrength(state, muscle, dir) {
  const cur = state.muscleStrength[muscle] ?? seedValue(state, muscle);
  const factor = dir > 0 ? 1.05 : 0.92;
  let next = Math.round(cur * factor);
  if (next === cur) next = cur + (dir > 0 ? 1 : -1); // guarantee movement
  state.muscleStrength[muscle] = Math.max(1, next);
}

// Record a result for an exercise and apply the streak rules.
function applyResult(state, exId, result, date) {
  const ex = DB.EXERCISE_BY_ID[exId];
  if (!ex) return;
  const todayK = dateKey(date);

  // Snapshot what was actually prescribed today (from the cached plan if present).
  let prescription = prescribe(state, ex);
  const item = state.todayPlan?.items?.find(i => i.exerciseId === exId);
  if (item) prescription = item.prescription;

  state.history.push({ date: todayK, exerciseId: exId, result, prescription });
  if (item) item.done = result;

  const st = state.exerciseState[exId] || { green: 0, red: 0 };
  if (result === 'green') {
    st.green += 1; st.red = 0;
    if (st.green >= 2) { adjustStrength(state, ex.primary, +1); st.green = 0; } // too easy → harder
  } else { // red — completed with failure; the desired training stimulus
    st.red += 1; st.green = 0;
    if (st.red >= 3) { adjustStrength(state, ex.primary, -1); st.red = 0; }     // failing out → easier
  }
  state.exerciseState[exId] = st;
}

// ---- strength readout (for the Stats screen) ------------------------------
function strengthLevel(state, muscle) {
  const ratio = (state.muscleStrength[muscle] ?? seedValue(state, muscle)) / seedValue(state, muscle);
  if (ratio < 0.85) return 'Rebuilding';
  if (ratio < 1.15) return 'Baseline';
  if (ratio < 1.6) return 'Developing';
  if (ratio < 2.2) return 'Strong';
  return 'Elite';
}

window.Algo = {
  dateKey, generatePlan, prescribe, prescriptionText, estimateMinutes,
  applyResult, adjustStrength, musclePriorities, exerciseAvailable,
  availableDumbbells, achievableBar, strengthLevel, seedValue, daysSince,
};
