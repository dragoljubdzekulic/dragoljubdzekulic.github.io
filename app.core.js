// app.core.js
// ensure global namespace čak i bez inline scripte (CSP safe)
window.App = window.App || { Core:{}, BOM:{}, Budget:{}, UI:{} };

// Mikro helper
const $ = s => document.querySelector(s);

/* =========================================================
 * App.State — centralni izvor istine za konfiguraciju (cfg)
 * ========================================================= */
App.State = (function(){
  let _cfg = null;

  // Interno: pronađi textarea
  function _ta(){ return document.getElementById('jsonInput'); }

  // Učitaj iz textarea 1x i keširaj
  function loadFromTextarea(){
    if(_cfg) return _cfg;
    const ta = _ta();
    if(!ta){ _cfg = { Kitchen:{} }; return _cfg; }
    try {
      _cfg = JSON.parse(ta.value || '{}') || {};
    } catch(e){
      console.warn('[State] JSON parse failed, making empty cfg', e);
      _cfg = { Kitchen:{} };
    }
    return _cfg;
  }

  // Upis nazad u textarea (pretty)
  function syncToTextarea(){
    const ta = _ta();
    if(!ta) return;
    try {
      ta.value = JSON.stringify(_cfg || {}, null, 2);
    } catch(e){
      console.warn('[State] JSON stringify failed', e);
    }
  }

  // Vrati Kitchen objekat i obezbedi pod-strukture
  function ensureKitchen(){
    const cfg = loadFromTextarea();
    const key = (cfg.Kitchen ? 'Kitchen' : (cfg.kitchen ? 'kitchen' : 'Kitchen'));
    cfg[key] = cfg[key] || {};
    const K = cfg[key];

    K.Defaults = K.Defaults || {};
    K.Drawer   = K.Drawer   || {};
    K.Wall     = K.Wall     || { Defaults:{} };
    K.Wall.Defaults = K.Wall.Defaults || {};
    K.Tall     = K.Tall     || { H_carcass: (Number(K.H_total||0) || 2100) }; // default za visoke

    return K;
  }

  return {
    get(){ return _cfg || loadFromTextarea(); },
    set(next){
      _cfg = next || {};
      syncToTextarea();
      return _cfg;
    },
    loadFromTextarea,
    syncToTextarea,
    ensureKitchen,
    kitchenKey(){
      const cfg = this.get();
      return (cfg.Kitchen ? 'Kitchen' : (cfg.kitchen ? 'kitchen' : 'Kitchen'));
    }
  };
})();

/* =========================================
 * Core: helpers, solve, globals, builder...
 * ========================================= */

// Fallback: ravnomerno raspoređene police (legacy compat)
App.Core.computeShelves = function(H, count, minClear){
  count = Math.max(0, Number(count||0));
  if(!count) return [];
  const gapMin = Number(minClear||180);
  // grubi ravnomerni raspored (bez debljine polica)
  const step = Math.max(gapMin, H/(count+1));
  const pos = [];
  for(let i=1;i<=count;i++) pos.push(Math.round(i*step));
  return pos;
};
// Legacy global ime koje su koristile stare verzije modela
window.computeShelves = window.computeShelves || App.Core.computeShelves;

// Izračun korpusa (H_total - nogice - ploča)
App.Core.computeHCarcass = function(k){
  return (Number(k.H_total||0) - Number(k.H_plinth||0) - Number(k.T_top||0));
};

// Jedan element → rešavanje frontova/gapova prema tipu
App.Core.solveItem = function(k, it){
  const N=(x,d)=>{ x=Number(x); return Number.isFinite(x)?x:d; };
  const isWall = (it.type||'').startsWith('wall_');
  const isTall = (it.type||'').startsWith('tall_');
  const H = isWall
    ? N(k?.Wall?.H_carcass, 720)
    : (isTall ? N(k?.Tall?.H_carcass, N(k?.H_total, 2100)) : N(App.Core.computeHCarcass(k)));
  const gap = N(k.Gap,2), FIRST = N(k.DatumFirstDrawer,170);

  const res = { id:it.id, H_carcass:H, fronts:[], gaps:[], notes:[], doors: undefined };
  const pushGap = ()=>res.gaps.push(gap);
  const push1   = h=>{ res.fronts.push(Math.max(0, Math.round(h))); };

  switch(it.type){

    // --- BASE / DONJI ---
    case 'sink_1door':
    case 'base_1door':{ push1(H); break; }

    case 'base_2door':{ push1(H); res.doors = 2; break; }

    case 'combo_drawer_door':{
      const f1=FIRST, f2=H - f1 - gap;
      push1(f1); pushGap(); push1(f2);
      break;
    }

    case 'drawer_3':{
      const second=(it.drawerHeights && it.drawerHeights[1]!=null)? Number(it.drawerHeights[1]) : 200;
      let third = H - FIRST - second - 2*gap;
      if(third<0){ res.notes.push('Treća fioka < 0 — proveri ulaz'); third=0; }
      push1(FIRST); pushGap(); push1(second); pushGap(); push1(third);
      break;
    }

    case 'drawer_2':{
      const f1=FIRST; const f2=H - f1 - gap;
      push1(f1); pushGap(); push1(f2);
      break;
    }

    case 'dishwasher_60':{
      const n=it.appliance?.nicheMin??815;
      if(n>H) res.notes.push(`Upozorenje: nicheMin ${n}mm > H_carcass ${H}mm.`);
      push1(H);
      break;
    }

    case 'oven_housing':{
      const on=it.appliance?.ovenNiche??595;
      const f1=FIRST, rest=H - f1 - gap;
      let top=Math.max(0, rest - on);
      push1(f1); pushGap(); push1(on);
      if(top>0){ pushGap(); push1(top); }
      else res.notes.push('Nema top trim panela ili je minimalan; proveri Gap i rernu.');
      break;
    }

    case 'base_open':{
      // otvoreni korpus: bez frontova
      break;
    }
    case 'base_shelf':{
      // otvoreni korpus sa policama
      const n = Number(it.shelves ?? 1);
      res.shelves = App.Core.computeShelves(H, n);
      break;
    }

    // --- WALL / VISEĆI ---
    case 'wall_1door':{ push1(H); break; }
    case 'wall_double':
    case 'wall_2door':{ push1(H); res.doors = 2; break; }
    case 'wall_open':{ break; }
    case 'wall_open_shelf':{
      const n = Number(it.shelves ?? 2);
      res.shelves = App.Core.computeShelves(H, n);
      break;
    }

    // --- TALL / VISOKI ---
    case 'tall_pantry':{
      // “ostava”: jedan visoki front
      push1(H);
      break;
    }
    case 'tall_oven_housing':{
      // visoki sa rernom u sredini
      const on=it.appliance?.ovenNiche??595;
      const mid=Number(it.mid??FIRST); // pozicija prve fioke/podeone
      const top = H - mid - on - 2*gap;
      if(mid<=0 || top<0) res.notes.push('Proveri mid/gap/ovenNiche za tall_oven_housing');
      push1(mid); pushGap(); push1(on); pushGap(); push1(Math.max(0,top));
      break;
    }

    // --- UGLOVI (front logika ostaje bazna; BOM rešava korpus) ---
    case 'corner_base_l':
    case 'corner_base_diag':{
      push1(H);
      break;
    }

    // --- PRAZNI KORPUSI ---
    case 'base_empty_carcass':{ break; } // bez frontova

    default: res.notes.push('Nepoznat tip: '+it.type);
  }

  const sumF = res.fronts.reduce((a,b)=>a+b,0);
  const sumG = res.gaps.reduce((a,b)=>a+b,0);
  const diff = H - (sumF + sumG);
  if(res.fronts.length > 0 && Math.abs(diff)>0.5) res.notes.push(`Neusaglašeno: diff=${diff.toFixed(1)}mm`);

  return res;
};

// Niz elemenata → solve
App.Core.solveOrder = (cfg, ord)=>{
  const C = cfg || App.State.get() || {};
  const K = (C.Kitchen || C.kitchen || {});
  return (ord||[]).map(it=>App.Core.solveItem(K, it));
};

/* =====================
 * Globals helpers (CSP)
 * ===================== */

App.Core.getKitchenObj = function(){
  const K = App.State.ensureKitchen();
  return K;
};

App.Core.writeKitchenObj = function(fn){
  const cfg = App.State.get() || {};
  const key = App.State.kitchenKey();
  cfg[key] = cfg[key] || {};
  try {
    fn(cfg[key]);
  } catch(e){
    console.warn('[Core.writeKitchenObj] user fn failed', e);
  }
  App.State.set(cfg); // set → sync u textarea
};

App.Core.getConfig = function(){ return App.State.get(); };
App.Core.setConfig = function(next){ return App.State.set(next); };

/* ==============
 * Builder state
 * ============== */
window.builder = window.builder || [];

function nextId(){ return 'E'+(builder.length+1); }
// expose some helpers used by UI
App.Core.nextId = nextId;

// ***** ŠABLONI / TEMPLATES *****
// Napomena: dodali smo osnovne stare tipove koji su nedostajali.
App.Core.TEMPLATES = {
  // Base / donji
  drawer_3: ()=>({ id: nextId(), type: 'drawer_3', width:600, depth:560, drawerHeights:[170,200] }),
  drawer_2: ()=>({ id: nextId(), type: 'drawer_2', width:600, depth:560 }),
  combo_drawer_door: ()=>({ id: nextId(), type: 'combo_drawer_door', width:600, depth:560 }),
  base_1door: ()=>({ id: nextId(), type: 'base_1door', width:600, depth:560 }),
  base_2door: ()=>({ id: nextId(), type: 'base_2door', width:800, depth:560 }),
  base_open: ()=>({ id: nextId(), type: 'base_open', width:600, depth:560 }),
  base_shelf: ()=>({ id: nextId(), type: 'base_shelf', width:600, depth:560, shelves:1 }),
  base_empty_carcass: ()=>({ id: nextId(), type: 'base_empty_carcass', width:600, depth:560, topConnectorDepth:80 }),
  sink_1door: ()=>({ id: nextId(), type: 'sink_1door', width:600, depth:560 }),
  dishwasher_60: ()=>({ id: nextId(), type: 'dishwasher_60', width:600, depth:560, appliance:{ nicheMin:815 } }),
  oven_housing: ()=>({ id: nextId(), type: 'oven_housing', width:600, depth:560, appliance:{ ovenNiche:595 } }),

  // Wall / viseći
  wall_1door: ()=>({ id: nextId(), type: 'wall_1door', width:600, depth:320 }),
  wall_2door: ()=>({ id: nextId(), type: 'wall_2door', width:800, depth:320 }), // alias “double”
  wall_double: ()=>({ id: nextId(), type: 'wall_double', width:800, depth:320 }), // legacy key
  wall_open:  ()=>({ id: nextId(), type: 'wall_open',  width:600, depth:320 }),
  wall_open_shelf: ()=>({ id: nextId(), type: 'wall_open_shelf', width:600, depth:320, shelves:2 }),

  // Tall / visoki
  tall_pantry: ()=>({ id: nextId(), type: 'tall_pantry', width:600, depth:560 }),
  tall_oven_housing: ()=>({ id: nextId(), type: 'tall_oven_housing', width:600, depth:560, appliance:{ ovenNiche:595 }, mid: 170 }),

  // Corner / uglovi (korpusi, front jedan visok)
  corner_base_l: ()=>({ id: nextId(), type: 'corner_base_l', width:900, depth:560 }),
  corner_base_diag: ()=>({ id: nextId(), type: 'corner_base_diag', width:950, depth:950 })
};

// Pomoćno: spisak tipova (za auto-katalog)
App.Core.TYPES = function(){
  try { return Object.keys(App.Core.TEMPLATES||{}); }
  catch(_){ return []; }
};
