// app.budget.js — v2
// Budget kalkulacije i tabela

// === CENE ===
App.Budget.getUnitPrices = function(){
  const num=id=>Number(document.getElementById(id)?.value||0);
  return {
    carcassM2: num('pCarcassM2'),
    frontM2:   num('pFrontM2'),
    hinge:     num('pHinge'),
    rail:      num('pRail'),
    handle:    num('pHandle'),
    screw:     num('pScrew'),
    absLm:     num('pAbsLm'),
    topLm:     num('pTopLm'),
    leg:       num('pLeg'),
  };
};

// === POMOĆNO: prepoznaj tipove ===
function isWallType(t){ return String(t||'').startsWith('wall_'); }
function isBaseDishwasher(t){ return t==='dishwasher_60' || t==='base_dishwasher_full' || t==='base_dishwasher_half'; }
function isDrawerCab(t){ return t==='drawer_3' || t==='drawer_2' || t==='base_drawer'; }

// === BROJANJE ELEMENATA ===
// Ako je dostupno "solutions" (iz Core.solveItem), koristi ga za preciznije brojanje (npr. doors iz res.doors).
App.Budget.countByType = function(order, solutions){
  let doors=0, drawers=0, handles=0, baseBoxes=0, wallBoxes=0;
  const arr = Array.isArray(order) ? order : [];
  const solved = Array.isArray(solutions) ? solutions : [];

  arr.forEach((it, i)=>{
    const t=String(it.type||'');
    const isWall=isWallType(t);
    if(isWall) wallBoxes++; else baseBoxes++;

    const sol = solved[i] || null;

    // --- Vrata (doors) ---
    // Ako model rešava broj vrata (npr. wall_double/base_2door), koristi to
    if (Number.isFinite(Number(sol?.doors))) {
      doors += Number(sol.doors)||0;
    } else {
      if (t==='base_2door' || t==='wall_double') doors += 2;
      else if (t==='base_1door' || t==='sink_1door' || t==='wall_1door' || t==='wall_single') doors += 1;
      // ostali tipovi: 0
    }

    // --- Fioke (drawers) ---
    if (t==='drawer_3') drawers += 3;
    else if (t==='drawer_2') drawers += 2;
    else if (t==='combo_drawer_door') drawers += 1;
    else if (t==='oven_housing' || t==='base_oven_housing') drawers += 1;
    else if (t==='base_drawer') {
      // broj fioka = broj frontova iz rešenja (ako postoji), inače pogodi 3
      const nf = Array.isArray(sol?.fronts) ? sol.fronts.length : 3;
      drawers += nf;
    }

    // --- Ručice (handles) ---
    // Heuristika: jedna ručica po frontu (vrata ili fioka)
    // Dishwashers: bar 1 ručka na dekor panelu
    let h=0;
    if (isBaseDishwasher(t)) h += 1;
    // vrata → po komadu
    if (Number.isFinite(Number(sol?.doors))) h += Number(sol.doors)||0;
    else {
      if (t==='base_2door' || t==='wall_double') h += 2;
      else if (t==='base_1door' || t==='sink_1door' || t==='wall_1door' || t==='wall_single' || t==='combo_drawer_door') h += 1;
    }
    // fioke → po komadu
    if (t==='drawer_3') h += 3;
    else if (t==='drawer_2') h += 2;
    else if (t==='combo_drawer_door') h += 1;
    else if (t==='oven_housing' || t==='base_oven_housing') h += 1;
    else if (t==='base_drawer') {
      const nf = Array.isArray(sol?.fronts) ? sol.fronts.length : 3;
      h += nf;
    }

    handles += h;
    // base_empty_carcass i otvoreni viseći nemaju dodatne ručke
  });

  return {doors, drawers, handles, baseBoxes, wallBoxes};
};

// === POVRŠINE M2 ===
App.Budget.sumAreasM2 = function(agg){
  let carcM2=0, frontM2=0;
  (agg||[]).forEach(r=>{
    const area = (Number(r.w)||0)*(Number(r.h)||0)*(Number(r.qty)||0)/1_000_000; // mm² -> m²
    const mat=(r.material||'').toUpperCase();
    if(mat.includes('PB')) carcM2 += area; else if(mat.includes('MDF')) frontM2 += area;
  });
  return {carcM2, frontM2};
};

// === ABS dužni metri iz kolone edge ===
App.Budget.sumEdgeLm = function(agg){
  let mm=0;
  (agg||[]).forEach(r=>{
    const w=Number(r.w)||0, h=Number(r.h)||0, q=Number(r.qty)||0; if(!r.edge) return;
    const L=Math.max(w,h), S=Math.min(w,h);
    String(r.edge).split('+').forEach(tokRaw=>{
      const tok=String(tokRaw).trim().toUpperCase(); if(!tok) return;
      if(tok==='ALL'){ mm += (2*L+2*S)*q; return; }
      const last=tok.slice(-1); const num=parseInt(tok.slice(0,-1),10);
      if(Number.isFinite(num)) mm += (last==='L'? num*L : last==='S'? num*S : 0)*q;
    });
  });
  return mm/1000; // m
};

// === GLAVNI OBRAČUN ===
App.Budget.computeBudget = function(cfg, order, agg){
  const P = App.Budget.getUnitPrices();

  // Probaj da pribaviš i rešenja (ako postoje) radi tačnijeg brojanja
  const solutions = (Array.isArray(window.__lastSolved) ? window.__lastSolved : null);

  const {doors, drawers, handles, baseBoxes, wallBoxes} = App.Budget.countByType(order, solutions);
  const {carcM2, frontM2} = App.Budget.sumAreasM2(agg);

  const hinges    = doors * 2;       // 2 šarke po vratima
  const railPairs = drawers;         // 1 par šina po fioci
  const screws    = baseBoxes*50 + wallBoxes*30; // gruba metrika
  const absLm     = App.Budget.sumEdgeLm(agg);
  const legs      = baseBoxes * 4;

  // dužina radne ploče = suma širina svih donjih (bez tall_totem)
  const topLm = (order||[])
    .filter(it => !isWallType(it.type) && (it.type !== 'tall_totem'))
    .reduce((a,it)=>a+(Number(it.width)||0),0)/1000;

  const rows=[
    {item:'Korpus materijal', qty:carcM2.toFixed(2), unit:'m²',  price:P.carcassM2, total: carcM2*P.carcassM2},
    {item:'Front materijal',  qty:frontM2.toFixed(2),unit:'m²',  price:P.frontM2,   total: frontM2*P.frontM2},
    {item:'Šarke',            qty:hinges,            unit:'kom', price:P.hinge,     total: hinges*P.hinge},
    {item:'Šine fioka',       qty:railPairs,         unit:'par', price:P.rail,      total: railPairs*P.rail},
    {item:'Ručice',           qty:handles,           unit:'kom', price:P.handle,    total: handles*P.handle},
    {item:'Šrafovi',          qty:screws,            unit:'kom', price:P.screw,     total: screws*P.screw},
    {item:'ABS traka',        qty:absLm.toFixed(2),  unit:'m',   price:P.absLm,     total: absLm*P.absLm},
    {item:'Nogice',           qty:legs,              unit:'kom', price:P.leg,       total: legs*P.leg},
    {item:'Radna ploča',      qty:topLm.toFixed(2),  unit:'m',   price:P.topLm,     total: topLm*P.topLm},
  ];
  const sum = rows.reduce((a,r)=>a+(Number(r.total)||0),0);
  return {rows, sum};
};

// === RENDER TABELA ===
App.Budget.renderBudgetTable = function(items){
  const host=document.getElementById('budget'); if(!host) return;
  const fmt=v=>Number(v).toLocaleString('sr-RS', {maximumFractionDigits:0});
  const {rows, sum} = items;
  host.innerHTML = `<table><thead><tr><th>Stavka</th><th class="ta-right">Količina</th><th>Jedinica</th><th class="ta-right">Cena</th><th class="ta-right">Ukupno</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td>${r.item}</td><td class="ta-right">${r.qty}</td><td>${r.unit}</td><td class="ta-right">${fmt(r.price)}</td><td class="ta-right">${fmt(r.total)}</td></tr>`).join('')+
    `</tbody><tfoot><tr><th colspan="4" class="ta-right">UKUPNO</th><th class="ta-right">${fmt(sum)}</th></tr></tfoot></table>`;
};

// === DRIVER ===
App.Budget.recomputeBudget = function(){
  const out = { cfg: window.__lastCfg, order: window.__lastOrder, agg: window.__lastAggBOM };
  if(!out.cfg || !out.order || !out.agg) return;
  const budget = App.Budget.computeBudget(out.cfg, out.order, out.agg);
  App.Budget.renderBudgetTable(budget);
};
