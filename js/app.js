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

  mark(exId, result) {
    Algo.applyResult(this.state, exId, result, new Date());
    this.save();
    UI.render();
  },

  // Remove the most recent history entry for this exercise + revert its plan item.
  undo(exId) {
    const h = this.state.history;
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].exerciseId === exId) { h.splice(i, 1); break; }
    }
    const item = this.state.todayPlan?.items?.find(i => i.exerciseId === exId);
    if (item) item.done = null;
    // Recompute this exercise's streak from remaining history (keeps it honest).
    const ex = DB.EXERCISE_BY_ID[exId];
    const past = h.filter(x => x.exerciseId === exId);
    const st = { green: 0, red: 0 };
    for (const rec of past) {
      if (rec.result === 'green') { st.green++; st.red = 0; if (st.green >= 2) st.green = 0; }
      else { st.red++; st.green = 0; if (st.red >= 3) st.red = 0; }
    }
    this.state.exerciseState[exId] = st;
    void ex;
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
