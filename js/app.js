// ===========================================================================
// app.js — Controller. Holds the live state, wires UI actions, owns the
// today-plan lifecycle, and registers the service worker.
// ===========================================================================

const App = {
  state: null,
  view: 'today',
  onboardStep: 0,
  editing: false,

  init() {
    this.state = Store.loadState();
    if (!this.state.onboarded) { this.view = 'onboard'; this.onboardStep = 0; }
    UI.render();
    this.registerSW();
  },

  save() { Store.saveState(this.state); },

  go(view) { this.view = view; this.editing = false; UI.render(); },

  // Make sure todayPlan matches the current calendar day; (re)generate if not.
  ensureTodayPlan() {
    const todayK = Algo.dateKey(new Date());
    if (!this.state.todayPlan || this.state.todayPlan.date !== todayK) {
      this.state.todayPlan = Algo.generatePlan(this.state, new Date());
      this.save();
    }
    if (!this.state.todayPlan.excluded) this.state.todayPlan.excluded = [];
    return this.state.todayPlan;
  },

  regenerate(force) {
    this.state.todayPlan = Algo.generatePlan(this.state, new Date());
    if (force && this.state.todayPlan.rest) {
      // user explicitly asked for a session on a rest day: pretend 1h budget
      const saved = this.state.time;
      const day = this.state.todayPlan.dayKey;
      this.state.time = { ...saved, [day]: Math.max(1, saved[day] || 1) };
      this.state.todayPlan = Algo.generatePlan(this.state, new Date());
      this.state.time = saved;
    }
    this.save();
    UI.render();
  },

  mark(movementId, result) {
    Algo.applyResult(this.state, movementId, result, new Date());
    this.save();
    UI.render();
  },

  // Remove the most recent history entry for this movement + revert its plan item.
  undo(movementId) {
    const h = this.state.history;
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].movementId === movementId) { h.splice(i, 1); break; }
    }
    const item = this.state.todayPlan?.items?.find(i => i.movementId === movementId);
    if (item) item.done = null;
    // Recompute this movement's streak from remaining history (keeps it honest).
    const past = h.filter(x => x.movementId === movementId);
    const st = { green: 0, red: 0 };
    for (const rec of past) {
      if (rec.result === 'green') { st.green++; st.red = 0; if (st.green >= 2) st.green = 0; }
      else { st.red++; st.green = 0; if (st.red >= 3) st.red = 0; }
    }
    this.state.exerciseState[movementId] = st;
    this.save();
    UI.render();
  },

  // --- card popup actions ---------------------------------------------------

  // Pick a specific equipment option for an exercise (overrides the auto choice).
  switchEquip(movementId, optionId) {
    const mv = DB.MOVEMENT_BY_ID[movementId];
    const item = this.state.todayPlan?.items?.find(i => i.movementId === movementId);
    if (!mv || !item) return;
    item.optionId = optionId;
    item.repsOverride = null;
    item.prescription = Algo.prescribe(this.state, mv, { optionId });
    item.estMin = Math.round(Algo.estimateMinutes(item.prescription));
    this.save();
    UI.render();
  },

  // Treat this exercise as "just used" and swap in a fresh one for the slot.
  reroll(movementId) {
    const plan = this.ensureTodayPlan();
    const idx = plan.items.findIndex(i => i.movementId === movementId);
    if (idx === -1) return;
    if (!plan.excluded.includes(movementId)) plan.excluded.push(movementId);
    const inPlan = plan.items.filter((_, i) => i !== idx).map(i => i.movementId);
    const exclude = new Set([...plan.excluded, ...inPlan]);
    const replacement = Algo.pickReplacement(this.state, plan.date, exclude);
    if (replacement) plan.items[idx] = replacement;
    else plan.items.splice(idx, 1); // nothing left to offer
    this.save();
    UI.render();
  },

  // Manual weight/reps edit — becomes the new baseline for that muscle.
  adjustBaseline(movementId, patch) {
    const mv = DB.MOVEMENT_BY_ID[movementId];
    const item = this.state.todayPlan?.items?.find(i => i.movementId === movementId);
    if (!mv || !item) return;
    Algo.setBaseline(this.state, movementId, item.optionId, patch);
    const opt = mv.options.find(o => o.id === item.optionId) || mv.options[0];
    const weighted = mv.cat !== 'cardio' && !['bodyweight', 'hold', 'time'].includes(opt.kind);
    if (patch.reps != null && weighted) item.repsOverride = patch.reps;
    item.prescription = Algo.prescribe(this.state, mv, { optionId: item.optionId, repsOverride: item.repsOverride });
    item.estMin = Math.round(Algo.estimateMinutes(item.prescription));
    this.save();
    UI.render();
  },

  reset() {
    this.state = Store.makeDefaultState();
    this.view = 'onboard';
    this.onboardStep = 0;
    this.editing = false;
    this.save();
    UI.render();
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Scope-relative so it works under any GitHub Pages sub-path.
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  },
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
