// ===========================================================================
// algorithm.js — The "brain" (v2: motion + equipment matching).
//
// Pipeline per the new model:
//   muscle strength ──rel──▶ target load (per-limb-equivalent, lb)
//                                      │
//   for each equipment OPTION of the movement, compute the *achievable* load
//   and how closely it matches the target (matchError). Pick the best match;
//   reject options that can't get close (e.g. a bare barbell with no plates).
//
// Difficulty rule unchanged: a RED check is the target; 2 greens in a row →
// muscle up, 3 reds in a row → muscle down.
// ===========================================================================

// ---- date helpers ---------------------------------------------------------
function dateKey(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function daysBetween(a,b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
function clamp(x,lo,hi){ return Math.max(lo,Math.min(hi,x)); }

// ---- equipment helpers ----------------------------------------------------
function hasEquip(state,id){ const v=state.equipment[id]; return v===true || (v && typeof v==='object'); }
function availableDumbbells(state,twoHand){
  const inv=state.equipment.dumbbells; if(!inv||typeof inv!=='object') return [];
  const need=twoHand?2:1;
  return Object.keys(inv).map(Number).filter(w=>inv[w]>=need).sort((a,b)=>a-b);
}
function achievableBar(state,loadType){
  const barId=loadType==='curl_bar'?'curl_bar':'barbell';
  const plateKey=loadType==='curl_bar'?'curl_bar_plates':'barbell_plates';
  if(!hasEquip(state,barId)) return [];
  const bar=DB.BAR_WEIGHTS[barId]||45;
  const inv=state.equipment[plateKey];
  if(!inv||typeof inv!=='object') return [bar];
  const reachable=new Set([0]);
  for(const w of Object.keys(inv).map(Number)){
    const pairs=Math.floor(inv[w]/2); if(pairs<=0) continue;
    const add=2*w, snap=[...reachable];
    for(const base of snap) for(let k=1;k<=pairs;k++) reachable.add(base+add*k);
  }
  return [...reachable].map(a=>bar+a).sort((a,b)=>a-b);
}
function rangeLoads(min,max,step){ const a=[]; for(let v=min;v<=max;v+=step) a.push(v); return a; }
// Closest achievable value to a target (ties favour the lighter weight).
function snapNear(target,sorted){
  if(!sorted||!sorted.length) return null;
  let best=sorted[0],bd=Math.abs(sorted[0]-target);
  for(const v of sorted){ const d=Math.abs(v-target); if(d<bd){bd=d;best=v;} }
  return best;
}

// ---- strength helpers -----------------------------------------------------
function seedValue(state,m){ return Math.max(1,Math.round(state.bodyweight*(DB.MUSCLES[m]?.seedFraction||0.1))); }
function strengthOf(state,m){ return state.muscleStrength[m] ?? seedValue(state,m); }
function strengthRatio(state,m){ return clamp(strengthOf(state,m)/seedValue(state,m),0.5,3); }
function muscleLabels(ids){ return ids.map(m=>DB.MUSCLES[m]?.label||m); }

// ---------------------------------------------------------------------------
// Evaluate ONE equipment option of a movement. Returns a self-contained
// prescription snapshot (directly storable in a plan item), or null if the
// option isn't usable (missing gear / no usable weight).
// ---------------------------------------------------------------------------
function evalOption(state, mv, opt, repsOverride){
  if(!opt.equip.every(id=>hasEquip(state,id))) return null;
  const u=state.units;
  const scheme=opt.scheme||mv.scheme;
  let sets=scheme.sets, reps=scheme.reps;
  const base={ optionId:opt.id, name:opt.label||mv.name, emoji:opt.emoji||mv.emoji,
    primary:mv.primary, tags:muscleLabels([mv.primary,...mv.secondary]).slice(0,3),
    cat:mv.cat, kind:opt.kind, each:false, unit:'', load:null, achievedL:null, targetL:null };

  // ---- cardio ----
  if(mv.cat==='cardio'){
    if(opt.kind==='time'){
      const mins=clamp(Math.round(strengthOf(state,'cardio')*(opt.minMult||1)),5,60);
      return {...base, sets, reps, load:mins, unit:'min', matchError:0,
        line: sets>1?`${sets} × ${mins} min`:`${mins} min`};
    }
    reps=repsOverride ?? Math.max(4,Math.round(reps*strengthRatio(state,'cardio')));
    return {...base, sets, reps, load:null, unit:'', matchError:0, line:`${sets} × ${reps}`};
  }
  // ---- isometric hold (plank) ----
  if(opt.kind==='hold'){
    const secs=repsOverride ?? clamp(Math.round((mv.holdBase||30)*strengthRatio(state,mv.primary)),15,240);
    return {...base, sets, reps:1, load:secs, unit:'sec', matchError:0, line:`${sets} × ${secs} sec hold`};
  }
  // ---- bodyweight (reps scale with strength) ----
  if(opt.kind==='bodyweight'){
    reps=repsOverride ?? Math.max(1,Math.round(reps*strengthRatio(state,mv.primary)));
    return {...base, sets, reps, load:null, unit:'', matchError:0.3, line:`${sets} × ${reps} (bodyweight)`};
  }

  // ---- external load: find the closest achievable weight ----
  const targetL=strengthOf(state,mv.primary)*mv.rel;
  const eff=opt.eff ?? DB.KIND_EFF[opt.kind] ?? 1;
  let achievable, native, achievedL, each=false;
  switch(opt.kind){
    case 'dbpair':   each=true; achievable=availableDumbbells(state,true);  if(!achievable.length) return null;
                     native=snapNear(targetL*eff,achievable); achievedL=native/eff; break;
    case 'dbsingle': achievable=availableDumbbells(state,false); if(!achievable.length) return null;
                     native=snapNear(targetL*eff,achievable); achievedL=native/eff; break;
    case 'barbell':  achievable=achievableBar(state,'barbell'); if(!achievable.length) return null;
                     native=snapNear(targetL*2*eff,achievable); achievedL=native/(2*eff); break;
    case 'curlbar':  achievable=achievableBar(state,'curl_bar'); if(!achievable.length) return null;
                     native=snapNear(targetL*2*eff,achievable); achievedL=native/(2*eff); break;
    case 'cable':    achievable=rangeLoads(10,320,5);  native=snapNear(targetL*2*eff,achievable); achievedL=native/(2*eff); break;
    case 'machine':  achievable=rangeLoads(10,420,10); native=snapNear(targetL*2*eff,achievable); achievedL=native/(2*eff); break;
    default: return null;
  }
  reps=repsOverride ?? reps;
  const matchError=Math.abs(achievedL-targetL)/targetL;
  return {...base, sets, reps, load:native, unit:u, each, achievedL, targetL, matchError,
    line:`${sets} × ${reps} @ ${native}${u}${each?' each':''}`};
}

// All usable options for a movement, with their prescriptions (best match first).
function rankOptions(state, mv, repsOverride){
  const cands=mv.options.map(o=>evalOption(state,mv,o,repsOverride)).filter(Boolean);
  const order=id=>mv.options.findIndex(o=>o.id===id);
  // Prefer well-matched options; only fall back to poor matches if nothing good.
  const good=cands.filter(c=>c.matchError<=0.4);
  const ranked=(good.length?good:cands).slice().sort((a,b)=> a.matchError-b.matchError || order(a.optionId)-order(b.optionId));
  return { ranked, all:cands };
}

// The prescription the algorithm would choose for a movement.
function bestPrescription(state, mv){ return rankOptions(state,mv).ranked[0]||null; }

// Prescription honouring an explicit equipment choice and/or rep override.
function prescribe(state, mv, opts={}){
  if(opts.optionId){
    const opt=mv.options.find(o=>o.id===opts.optionId);
    const p=opt?evalOption(state,mv,opt,opts.repsOverride):null;
    if(p) return p;
  }
  return rankOptions(state,mv,opts.repsOverride).ranked[0]||null;
}

function movementAvailable(state, mv){ return !!bestPrescription(state,mv); }

// ---- time estimate --------------------------------------------------------
function estimateMinutes(p){
  if(p.cat==='cardio' && p.kind==='time') return p.load*p.sets+1;
  if(p.cat==='cardio') return p.sets*(p.reps*0.08)+1;
  if(p.kind==='hold') return p.sets*(p.load/60+0.4)+1;
  return 1 + p.sets*(p.reps*0.06 + 1.2);
}

// ---- selection ------------------------------------------------------------
function musclePriorities(state){
  const pri={}; for(const m of Object.keys(DB.MUSCLES)) pri[m]=0;
  const goals=DB.GOALS.filter(g=>state.goals.includes(g.id));
  if(!goals.length){ for(const m in pri) pri[m]=0.5; return pri; }
  for(const g of goals) for(const [m,w] of Object.entries(g.weights)) pri[m]=(pri[m]||0)+w;
  return pri;
}
function daysSince(state, movementId, todayK){
  for(let i=state.history.length-1;i>=0;i--)
    if(state.history[i].movementId===movementId) return daysBetween(state.history[i].date,todayK);
  return 999;
}
function scoreCandidates(state, todayK, excludeIds){
  const pri=musclePriorities(state); const out=[];
  for(const mv of DB.MOVEMENTS){
    if(excludeIds && excludeIds.has(mv.id)) continue;
    const p=bestPrescription(state,mv); if(!p) continue;
    const recency=clamp(daysSince(state,mv.id,todayK)/7,0,1);
    let ms=pri[mv.primary]||0;
    for(const s of mv.secondary) ms+=0.35*(pri[s]||0);
    out.push({ mv, presc:p, estMin:estimateMinutes(p), score: ms*(0.45+0.55*recency) });
  }
  return out;
}

function makeItem(c){ return { movementId:c.mv.id, optionId:c.presc.optionId, repsOverride:null, prescription:c.presc, estMin:Math.round(c.estMin), done:null }; }

function generatePlan(state, date){
  const todayK=dateKey(date), dayKey=DB.DAYS[date.getDay()];
  const hours=state.time[dayKey] ?? 0;
  if(hours<=0) return { date:todayK, dayKey, rest:true, items:[], excluded:[] };

  const budget=hours*60;
  const pool=scoreCandidates(state, todayK, new Set());
  const covered={}, chosen=[]; let used=0;
  while(pool.length && used<budget && chosen.length<10){
    let bi=-1,be=-1;
    for(let i=0;i<pool.length;i++){
      const c=pool[i];
      const eff=c.score*(1/(1+(covered[c.mv.primary]||0)));
      const fits=chosen.length===0 || used+c.estMin<=budget+3;
      if(fits && eff>be){ be=eff; bi=i; }
    }
    if(bi===-1) break;
    const pick=pool.splice(bi,1)[0];
    chosen.push(pick); used+=pick.estMin;
    covered[pick.mv.primary]=(covered[pick.mv.primary]||0)+1;
    for(const s of pick.mv.secondary) covered[s]=(covered[s]||0)+0.5;
  }
  const order={cardio:0,strength:1,core:2,mobility:3};
  chosen.sort((a,b)=>order[a.mv.cat]-order[b.mv.cat]);
  return { date:todayK, dayKey, rest:false, items:chosen.map(makeItem), excluded:[] };
}

// Best replacement movement, excluding what's already used/rerolled today.
function pickReplacement(state, todayK, excludeIds){
  const cands=scoreCandidates(state, todayK, excludeIds);
  if(!cands.length) return null;
  cands.sort((a,b)=>b.score-a.score);
  return makeItem(cands[0]);
}

// ---- progression ----------------------------------------------------------
function adjustStrength(state, muscle, dir){
  const cur=strengthOf(state,muscle);
  let next=Math.round(cur*(dir>0?1.05:0.92));
  if(next===cur) next=cur+(dir>0?1:-1);
  state.muscleStrength[muscle]=Math.max(1,next);
}
function applyResult(state, movementId, result, date){
  const mv=DB.MOVEMENT_BY_ID[movementId]; if(!mv) return;
  const todayK=dateKey(date);
  const item=state.todayPlan?.items?.find(i=>i.movementId===movementId);
  const prescription=item?item.prescription:bestPrescription(state,mv);
  state.history.push({ date:todayK, movementId, optionId:prescription?.optionId, result, prescription });
  if(item) item.done=result;
  const st=state.exerciseState[movementId]||{green:0,red:0};
  if(result==='green'){ st.green++; st.red=0; if(st.green>=2){ adjustStrength(state,mv.primary,+1); st.green=0; } }
  else { st.red++; st.green=0; if(st.red>=3){ adjustStrength(state,mv.primary,-1); st.red=0; } }
  state.exerciseState[movementId]=st;
}

// ---- manual baseline (card "adjust" popup) --------------------------------
// The user's entered numbers become the new baseline for that muscle.
function setBaseline(state, movementId, optionId, patch){
  const mv=DB.MOVEMENT_BY_ID[movementId]; if(!mv) return;
  const opt=mv.options.find(o=>o.id===optionId)||mv.options[0];
  const eff=opt.eff ?? DB.KIND_EFF[opt.kind] ?? 1;
  if(patch.load!=null && patch.load>0){
    if(mv.cat==='cardio' && opt.kind==='time')
      state.muscleStrength.cardio=Math.max(1,Math.round(patch.load/(opt.minMult||1)));         // minutes
    else if(opt.kind==='hold')
      state.muscleStrength[mv.primary]=Math.max(1,Math.round(seedValue(state,mv.primary)*(patch.load/(mv.holdBase||30)))); // seconds
    else { // weighted
      const L=(opt.kind==='dbpair'||opt.kind==='dbsingle') ? patch.load/eff : patch.load/(2*eff);
      state.muscleStrength[mv.primary]=Math.max(1,Math.round(L/mv.rel));
    }
  }
  if(patch.reps!=null && patch.reps>0 && (opt.kind==='bodyweight' || (mv.cat==='cardio'&&opt.kind!=='time'))){
    const ratio=patch.reps/mv.scheme.reps;
    state.muscleStrength[mv.primary]=Math.max(1,Math.round(seedValue(state,mv.primary)*ratio));
  }
}

function strengthLevel(state, muscle){
  const r=strengthOf(state,muscle)/seedValue(state,muscle);
  if(r<0.85) return 'Rebuilding'; if(r<1.15) return 'Baseline';
  if(r<1.6) return 'Developing'; if(r<2.2) return 'Strong'; return 'Elite';
}

window.Algo = {
  dateKey, generatePlan, prescribe, bestPrescription, rankOptions, evalOption,
  movementAvailable, estimateMinutes, musclePriorities, daysSince,
  scoreCandidates, pickReplacement, makeItem, applyResult, adjustStrength,
  setBaseline, strengthLevel, seedValue, strengthOf, availableDumbbells, achievableBar,
};
