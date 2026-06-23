// ===========================================================================
// ui.js — All rendering. Talks to the global `App` (app.js) for state + actions.
// Plain DOM, no framework, so it drops straight onto GitHub Pages.
// ===========================================================================

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const UI = {
  // ---- top-level router ---------------------------------------------------
  render() {
    const root = document.getElementById('app');
    root.innerHTML = '';
    const s = App.state;
    if (!s.onboarded && App.view !== 'onboard') App.view = 'onboard';

    if (App.view === 'onboard') { root.appendChild(UI.onboarding()); return; }

    const wrap = h('<div class="screen"></div>');
    if (App.view === 'today')    wrap.appendChild(UI.today());
    if (App.view === 'stats')    wrap.appendChild(UI.stats());
    if (App.view === 'settings') wrap.appendChild(UI.settings());
    root.appendChild(wrap);
    root.appendChild(UI.nav());
  },

  nav() {
    const tabs = [['today','Today','🏋️'],['stats','Strength','📊'],['settings','Setup','⚙️']];
    const nav = h('<nav class="tabbar"></nav>');
    for (const [id,label,icon] of tabs) {
      const b = h(`<button class="tab ${App.view===id?'active':''}"><span class="ti">${icon}</span><span>${label}</span></button>`);
      b.onclick = () => App.go(id);
      nav.appendChild(b);
    }
    return nav;
  },

  // ======================================================================
  // ONBOARDING (also reused by Setup for editing)
  // ======================================================================
  onboarding() {
    const steps = ['welcome','equipment','time','goals'];
    const i = App.onboardStep || 0;
    const step = steps[i];
    const c = h('<div class="onboard"></div>');

    const header = h(`<div class="ob-head">
      <div class="ob-progress">${steps.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div>
      <h1>${['Welcome','What do you have?','When do you train?','What are your goals?'][i]}</h1>
    </div>`);
    c.appendChild(header);

    const body = h('<div class="ob-body"></div>');
    if (step==='welcome')   body.appendChild(UI.stepWelcome());
    if (step==='equipment') body.appendChild(UI.stepEquipment());
    if (step==='time')      body.appendChild(UI.stepTime());
    if (step==='goals')     body.appendChild(UI.stepGoals());
    c.appendChild(body);

    const foot = h('<div class="ob-foot"></div>');
    if (i>0) { const b=h('<button class="btn ghost">Back</button>'); b.onclick=()=>{App.onboardStep--;UI.render();}; foot.appendChild(b); }
    const next = h(`<button class="btn primary">${i===steps.length-1?(App.editing?'Save':'Finish setup'):'Next'}</button>`);
    next.onclick = () => UI.onboardNext(i, steps.length);
    foot.appendChild(next);
    c.appendChild(foot);
    return c;
  },

  onboardNext(i, total) {
    if (App.view==='onboard' && App.editing) { /* editing in-place */ }
    if (i < total - 1) { App.onboardStep = i + 1; UI.render(); return; }
    // Finishing
    if (App.state.goals.length === 0) { alert('Pick at least one goal.'); return; }
    Store.seedStrengths(App.state);
    App.state.onboarded = true;
    App.state.todayPlan = null;          // force fresh plan
    App.editing = false;
    App.save();
    App.go('today');
  },

  stepWelcome() {
    const s = App.state;
    const d = h(`<div>
      <p class="muted">A workout that plans itself. Tell us your gear, your time, and your goals — then just open the app, do the moves, and tap the checks.</p>
      <label class="field">
        <span>Your bodyweight (${esc(s.units)})</span>
        <input id="bw" type="number" inputmode="decimal" min="60" max="500" step="1" value="${s.bodyweight}">
      </label>
      <p class="hint">Used once, to estimate sensible starting weights. Everything self-corrects as you train.</p>
    </div>`);
    d.querySelector('#bw').onchange = e => { App.state.bodyweight = Number(e.target.value)||175; };
    return d;
  },

  stepEquipment() {
    const s = App.state;
    const wrap = h('<div></div>');
    wrap.appendChild(h('<p class="hint">Everything is on by default (a full gym). Turn off what you don\'t have.</p>'));
    const bulk = h('<div class="bulk"><button class="btn tiny ghost" id="all">All on</button><button class="btn tiny ghost" id="none">All off</button></div>');
    bulk.querySelector('#all').onclick = ()=>{ DB.EQUIPMENT.forEach(it=>{ s.equipment[it.id]=true; if(it.weights&&typeof s.equipment[it.weights]!=='object') s.equipment[it.weights]={...DB.DEFAULT_WEIGHTS[it.weights]}; }); UI.render(); };
    bulk.querySelector('#none').onclick = ()=>{ DB.EQUIPMENT.forEach(it=>{ s.equipment[it.id]=false; }); UI.render(); };
    wrap.appendChild(bulk);

    const sections = [...new Set(DB.EQUIPMENT.map(e=>e.section))];
    for (const sec of sections) {
      const box = h(`<div class="eq-section"><h3>${esc(sec)}</h3></div>`);
      for (const it of DB.EQUIPMENT.filter(e=>e.section===sec)) {
        const on = !!s.equipment[it.id];
        const row = h(`<div class="eq-item">
          <label class="chk">
            <input type="checkbox" ${on?'checked':''}>
            <span class="eq-ic">${it.icon}</span><span>${esc(it.label)}</span>
          </label>
        </div>`);
        row.querySelector('input').onchange = e => {
          s.equipment[it.id] = e.target.checked;
          if (it.weights && e.target.checked && typeof s.equipment[it.weights] !== 'object')
            s.equipment[it.weights] = { ...DB.DEFAULT_WEIGHTS[it.weights] };
          UI.render();
        };
        if (it.weights && on) row.appendChild(UI.weightPicker(it.weights));
        box.appendChild(row);
      }
      wrap.appendChild(box);
    }
    return wrap;
  },

  weightPicker(key) {
    const s = App.state;
    const inv = (s.equipment[key] && typeof s.equipment[key]==='object') ? s.equipment[key] : (s.equipment[key]={});
    const box = h('<div class="weights"></div>');
    for (const w of DB.WEIGHT_OPTIONS[key]) {
      const count = inv[w] || 0;
      const chip = h(`<div class="wchip ${count>0?'have':''}">
        <span class="wlbl">${w}</span>
        <span class="wctl"><button class="minus">–</button><span class="wcount">${count}</span><button class="plus">+</button></span>
      </div>`);
      chip.querySelector('.plus').onclick = ()=>{ inv[w]=(inv[w]||0)+1; UI.render(); };
      chip.querySelector('.minus').onclick = ()=>{ inv[w]=Math.max(0,(inv[w]||0)-1); if(inv[w]===0) delete inv[w]; UI.render(); };
      box.appendChild(chip);
    }
    return box;
  },

  stepTime() {
    const s = App.state;
    const wrap = h('<div></div>');
    wrap.appendChild(h('<p class="hint">Hours available each day. Set 0 for a rest day.</p>'));
    const grid = h('<div class="time-grid"></div>');
    for (const d of DB.DAYS) {
      const row = h(`<div class="trow"><span class="tday">${DB.DAY_LABELS[d]}</span>
        <input type="range" min="0" max="3" step="0.25" value="${s.time[d]??0}">
        <span class="tval">${fmtHours(s.time[d]??0)}</span></div>`);
      const range = row.querySelector('input'), val = row.querySelector('.tval');
      range.oninput = e => { s.time[d]=Number(e.target.value); val.textContent=fmtHours(s.time[d]); };
      grid.appendChild(row);
    }
    wrap.appendChild(grid);
    return wrap;
  },

  stepGoals() {
    const s = App.state;
    const wrap = h('<div class="goals"></div>');
    for (const g of DB.GOALS) {
      const on = s.goals.includes(g.id);
      const card = h(`<button class="goal ${on?'on':''}">
        <span class="g-ic">${g.icon}</span>
        <span class="g-txt"><b>${esc(g.label)}</b><small>${esc(g.blurb)}</small></span>
        <span class="g-check">${on?'✓':''}</span>
      </button>`);
      card.onclick = () => {
        const i = s.goals.indexOf(g.id);
        if (i>=0) s.goals.splice(i,1); else s.goals.push(g.id);
        UI.render();
      };
      wrap.appendChild(card);
    }
    wrap.appendChild(h('<p class="hint">Pick one or more. They decide which muscles get prioritised.</p>'));
    return wrap;
  },

  // ======================================================================
  // TODAY
  // ======================================================================
  today() {
    const s = App.state;
    const plan = App.ensureTodayPlan();
    const wrap = h('<div class="today"></div>');
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});

    if (plan.rest || plan.items.length === 0) {
      wrap.appendChild(h(`<header class="day-head"><h1>${esc(dateStr)}</h1></header>`));
      wrap.appendChild(h(`<div class="empty">
        <div class="big">${plan.rest?'😴':'🎯'}</div>
        <h2>${plan.rest?'Rest day':'Nothing scheduled'}</h2>
        <p class="muted">${plan.rest?'Recovery is part of the plan. Enjoy it.':'Adjust your available time or equipment in Setup.'}</p>
        <button class="btn ghost" id="force">Generate a session anyway</button>
      </div>`));
      wrap.querySelector('#force').onclick = ()=>{ App.regenerate(true); };
      return wrap;
    }

    const total = plan.items.reduce((a,i)=>a+i.estMin,0);
    const done = plan.items.filter(i=>i.done).length;
    const head = h(`<header class="day-head">
      <div><h1>${esc(dateStr)}</h1>
      <p class="sub">${plan.items.length} exercises · ~${total} min · ${done}/${plan.items.length} done</p></div>
      <button class="icon-btn" id="regen" title="Reshuffle today">🔄</button>
    </header>`);
    head.querySelector('#regen').onclick = ()=>{ if(confirm('Reshuffle today\'s session?')) App.regenerate(true); };
    wrap.appendChild(head);

    const list = h('<div class="cards"></div>');
    for (const item of plan.items) list.appendChild(UI.exerciseCard(item));
    wrap.appendChild(list);

    if (done === plan.items.length) {
      wrap.appendChild(h(`<div class="celebrate">💪 Session complete. See you tomorrow.</div>`));
    } else {
      wrap.appendChild(h(`<p class="legend"><span class="lg green">✓ clean</span> = too easy, we'll add load · <span class="lg red">✓ failed</span> = perfect, that's the target</p>`));
    }
    return wrap;
  },

  exerciseCard(item) {
    const p = item.prescription;
    const card = h(`<div class="card ${item.done?('done '+item.done):''}">
      <button class="card-tap">
        <div class="card-img">${p.emoji}</div>
        <div class="card-body">
          <div class="card-title">${esc(p.name)} <span class="card-gear">${esc(DB.KIND_LABEL[p.kind]||'')}</span></div>
          <div class="card-presc">${esc(p.line)}</div>
          <div class="card-tags">${p.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
        </div>
      </button>
      <div class="card-actions"></div>
    </div>`);
    card.querySelector('.card-tap').onclick = ()=>UI.cardMenu(item);
    const actions = card.querySelector('.card-actions');
    if (item.done) {
      const badge = h(`<div class="result ${item.done}">✓</div>`);
      const undo = h('<button class="undo">undo</button>');
      undo.onclick = ()=>App.undo(item.movementId);
      actions.appendChild(badge); actions.appendChild(undo);
    } else {
      const g = h('<button class="check green" title="Done — felt easy">✓</button>');
      const r = h('<button class="check red" title="Done — hit failure (ideal!)">✓</button>');
      g.onclick = ()=>App.mark(item.movementId,'green');
      r.onclick = ()=>App.mark(item.movementId,'red');
      actions.appendChild(g); actions.appendChild(r);
    }
    return card;
  },

  // ---- card popup: switch equipment / reroll / adjust --------------------
  cardMenu(item) {
    const mv = DB.MOVEMENT_BY_ID[item.movementId];
    const wrap = h('<div class="menu"></div>');
    let back;
    const row = (label, desc, fn) => {
      const b = h(`<button class="menu-row"><b>${esc(label)}</b><small>${esc(desc)}</small></button>`);
      b.onclick = () => { back.remove(); fn(); };
      wrap.appendChild(b);
    };
    const usable = Algo.rankOptions(App.state, mv).all;
    if (usable.length > 1) row('Switch equipment', 'Use different gear for this motion', () => UI.switchDialog(item));
    row('Reroll exercise', 'Mark this as used and swap in a new one', () => App.reroll(item.movementId));
    row('Adjust weight / reps', 'Set your real numbers as the new baseline', () => UI.adjustDialog(item));
    back = UI.modal(`${mv.name} · ${item.prescription.line}`, wrap, [['Close', null]]);
  },

  switchDialog(item) {
    const mv = DB.MOVEMENT_BY_ID[item.movementId];
    const ranked = Algo.rankOptions(App.state, mv).all
      .slice().sort((a,b)=>a.matchError-b.matchError);
    const wrap = h('<div class="opt-list"></div>');
    let back;
    for (const presc of ranked) {
      const opt = mv.options.find(o=>o.id===presc.optionId);
      const gear = opt.label || DB.KIND_LABEL[presc.kind] || 'Option';
      const cur = presc.optionId === item.optionId;
      const m = UI.matchBadge(presc.matchError, presc.cat);
      const b = h(`<button class="opt-row ${cur?'cur':''}">
        <span class="opt-main"><b>${esc(gear)}</b><small>${esc(presc.line)}</small></span>
        <span class="opt-badge ${m.cls}">${esc(m.label)}${cur?' · current':''}</span>
      </button>`);
      b.onclick = ()=>{ back.remove(); App.switchEquip(item.movementId, presc.optionId); };
      wrap.appendChild(b);
    }
    back = UI.modal('Switch equipment', wrap, [['Cancel', null]]);
  },

  matchBadge(err, cat) {
    if (cat === 'cardio') return { label:'available', cls:'ok' };
    if (err == null)   return { label:'—', cls:'ok' };
    if (err <= 0.10)   return { label:'ideal match', cls:'good' };
    if (err <= 0.25)   return { label:'good match', cls:'ok' };
    return { label:'rough match', cls:'warn' };
  },

  adjustDialog(item) {
    const mv = DB.MOVEMENT_BY_ID[item.movementId];
    const p = item.prescription;
    const opt = mv.options.find(o=>o.id===item.optionId) || mv.options[0];
    const weighted = mv.cat !== 'cardio' && !['bodyweight','hold','time'].includes(opt.kind);
    const wrap = h('<div class="adjust"></div>');
    let loadIn=null, repsIn=null;

    if (weighted) {
      wrap.appendChild(h(`<label class="field"><span>Weight (${esc(p.unit)})${p.each?' — per hand':''}</span></label>`));
      loadIn = h(`<input type="number" inputmode="decimal" step="2.5" value="${p.load}">`);
      wrap.querySelector('label').appendChild(loadIn);
      const rl = h(`<label class="field"><span>Reps</span></label>`);
      repsIn = h(`<input type="number" inputmode="numeric" step="1" value="${p.reps}">`);
      rl.appendChild(repsIn); wrap.appendChild(rl);
    } else if (mv.cat === 'cardio' && opt.kind === 'time') {
      wrap.appendChild(h(`<label class="field"><span>Minutes</span></label>`));
      loadIn = h(`<input type="number" inputmode="numeric" step="1" value="${p.load}">`);
      wrap.querySelector('label').appendChild(loadIn);
    } else if (opt.kind === 'hold') {
      wrap.appendChild(h(`<label class="field"><span>Seconds</span></label>`));
      loadIn = h(`<input type="number" inputmode="numeric" step="5" value="${p.load}">`);
      wrap.querySelector('label').appendChild(loadIn);
    } else { // bodyweight reps / cardio intervals
      wrap.appendChild(h(`<label class="field"><span>Reps</span></label>`));
      repsIn = h(`<input type="number" inputmode="numeric" step="1" value="${p.reps}">`);
      wrap.querySelector('label').appendChild(repsIn);
    }
    wrap.appendChild(h(`<p class="hint">These become your new baseline for ${esc(DB.MUSCLES[mv.primary].label)} — future sessions build from here.</p>`));

    UI.modal('Adjust', wrap, [
      ['Save', () => {
        const patch = {};
        if (loadIn) patch.load = Number(loadIn.value) || undefined;
        if (repsIn) patch.reps = Number(repsIn.value) || undefined;
        App.adjustBaseline(item.movementId, patch);
      }],
      ['Cancel', null],
    ]);
  },

  // ======================================================================
  // STATS
  // ======================================================================
  stats() {
    const s = App.state;
    const wrap = h('<div class="stats"></div>');
    wrap.appendChild(h('<header class="day-head"><h1>Strength</h1></header>'));
    wrap.appendChild(h(`<p class="hint">Each muscle has a strength score that drives your prescribed loads. Two clean checks raise it; three failed checks lower it.</p>`));

    const groups = [...new Set(Object.values(DB.MUSCLES).map(m=>m.group))];
    for (const grp of groups) {
      const box = h(`<div class="stat-group"><h3>${esc(grp)}</h3></div>`);
      for (const [id,m] of Object.entries(DB.MUSCLES).filter(([,mm])=>mm.group===grp)) {
        const val = s.muscleStrength[id] ?? Algo.seedValue(s,id);
        const seed = Algo.seedValue(s,id);
        const pct = Math.min(100, Math.round(val/ (seed*2.2) *100));
        const row = h(`<div class="stat-row">
          <div class="stat-top"><span>${esc(m.label)}</span><span class="stat-lvl">${Algo.strengthLevel(s,id)} · ${val}</span></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>`);
        box.appendChild(row);
      }
      wrap.appendChild(box);
    }

    const totalSessions = new Set(s.history.map(x=>x.date)).size;
    wrap.appendChild(h(`<div class="stat-foot">${s.history.length} exercises logged across ${totalSessions} day(s).</div>`));
    return wrap;
  },

  // ======================================================================
  // SETTINGS
  // ======================================================================
  settings() {
    const wrap = h('<div class="settings"></div>');
    wrap.appendChild(h('<header class="day-head"><h1>Setup</h1></header>'));

    const edits = [
      ['Equipment & weights','equipment',1],
      ['Time available','time',2],
      ['Goals','goals',3],
      ['Bodyweight','welcome',0],
    ];
    const grp = h('<div class="set-list"></div>');
    for (const [label,,step] of edits) {
      const r = h(`<button class="set-row"><span>${esc(label)}</span><span class="chev">›</span></button>`);
      r.onclick = ()=>{ App.editing=true; App.onboardStep=step; App.view='onboard'; UI.render(); };
      grp.appendChild(r);
    }
    wrap.appendChild(grp);

    const data = h(`<div class="set-list">
      <button class="set-row" id="exp"><span>Export my data (JSON)</span><span class="chev">⤓</span></button>
      <button class="set-row" id="imp"><span>Import data (JSON)</span><span class="chev">⤒</span></button>
      <button class="set-row danger" id="reset"><span>Reset everything</span><span class="chev">⟲</span></button>
    </div>`);
    data.querySelector('#exp').onclick = ()=>UI.exportDialog();
    data.querySelector('#imp').onclick = ()=>UI.importDialog();
    data.querySelector('#reset').onclick = ()=>{ if(confirm('Erase all data and start over?')){ App.reset(); } };
    wrap.appendChild(data);

    wrap.appendChild(h(`<p class="hint">Your entire profile is one JSON object. Export it for backup; later, an AI assistant will be able to tweak it for you ("lower my bicep strength").</p>`));
    return wrap;
  },

  exportDialog() {
    const text = Store.exportState(App.state);
    const ta = h(`<textarea class="json-area" readonly>${esc(text)}</textarea>`);
    UI.modal('Your data', ta, [['Copy',()=>{navigator.clipboard?.writeText(text); }],['Close',null]]);
  },
  importDialog() {
    const ta = h('<textarea class="json-area" placeholder="Paste exported JSON here"></textarea>');
    UI.modal('Import data', ta, [['Load',()=>{
      try { App.state = Store.importState(ta.value); App.save(); App.view='today'; UI.render(); }
      catch(e){ alert('Invalid JSON: '+e.message); return true; } // keep modal open
    }],['Cancel',null]]);
  },

  modal(title, contentEl, buttons) {
    const back = h(`<div class="modal-back"><div class="modal"><h2>${esc(title)}</h2></div></div>`);
    const m = back.querySelector('.modal');
    m.appendChild(contentEl);
    const row = h('<div class="modal-btns"></div>');
    for (const [label,fn] of buttons) {
      const b = h(`<button class="btn ${fn?'primary':'ghost'}">${esc(label)}</button>`);
      b.onclick = ()=>{ const keep = fn && fn(); if(!keep) back.remove(); };
      row.appendChild(b);
    }
    m.appendChild(row);
    back.onclick = e=>{ if(e.target===back) back.remove(); };
    document.body.appendChild(back);
    return back;
  },
};

function fmtHours(x){ if(!x) return 'rest'; return (x%1===0?x:x.toFixed(2).replace(/0+$/,'').replace(/\.$/,''))+'h'; }

window.UI = UI;
