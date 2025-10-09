const $=s=>document.querySelector(s);

function computeHCarcass(k){return k.H_total-k.H_plinth-k.T_top}

function solveItem(k,it){
  const N=(x,d=0)=>{x=Number(x);return Number.isFinite(x)?x:d};
  const isWall = (it.type||'').startsWith('wall_');
  const H = isWall ? N(k?.Wall?.H_carcass ?? 720) : N(computeHCarcass(k));
  const gap=N(k.Gap,2), FIRST=N(k.DatumFirstDrawer,170);
  const res={id:it.id,H_carcass:H,fronts:[],gaps:[],notes:[]},push=()=>res.gaps.push(gap);
  switch(it.type){
    case"sink_1door":
    case"combo_drawer_door":{
      const f1=FIRST,f2=H-f1-gap; res.fronts.push(f1); push(); res.fronts.push(f2); break;
    }
    case"dishwasher_60":{
      const n=it.appliance?.nicheMin??815; if(n>H)res.notes.push(`Upozorenje: nicheMin ${n}mm > H_carcass ${H}mm.`); res.fronts.push(H); break;
    }
    case"oven_housing":{
      const on=it.appliance?.ovenNiche??595; const f1=FIRST,rest=H-f1-gap; let top=Math.max(0,rest-on);
      res.fronts.push(f1); push(); res.fronts.push(on); if(top>0){ push(); res.fronts.push(top); } else res.notes.push("Nema top trim panela ili je minimalan; proveri Gap i rernu.");
      break;
    }
    case"drawer_3":{
      const second=(it.drawerHeights&&it.drawerHeights[1]!=null)?it.drawerHeights[1]:200; let third=H-FIRST-second-2*gap; if(third<0){ res.notes.push("Treća fioka < 0 — proveri ulaz"); third=0; }
      res.fronts.push(FIRST); push(); res.fronts.push(second); push(); res.fronts.push(third); break;
    }
    // --- wall units ---
    case"wall_1door":{ res.fronts.push(H); break; }
    case"wall_open":{ /* bez fronta */ break; }
    default: res.notes.push("Nepoznat tip: "+it.type);
  }
  const f=res.fronts.reduce((a,b)=>a+b,0),g=res.gaps.reduce((a,b)=>a+b,0),d=H-(f+g); if(Math.abs(d)>0.5)res.notes.push(`Neusaglašeno: diff=${d.toFixed(1)}mm`);
  return res;
}

function solveOrder(cfg,ord){ const K = (cfg.Kitchen || cfg.kitchen || {}); return ord.map(it=>solveItem(K,it)); }

function renderElementSVG(res,w=120,ppm=0.35){
  const tot=res.H_carcass*ppm; let y=0;
  let s=`<svg width="${w}" height="${Math.round(tot)}" viewBox="0 0 ${w} ${Math.round(tot)}" xmlns="http://www.w3.org/2000/svg">`;
  res.fronts.forEach((h,i)=>{
    const hp=h*ppm;
    s+=`<rect x="0" y="${y}" width="${w}" height="${hp}" fill="white" stroke="black"/>`;
    s+=`<text x="${w/2}" y="${y+hp/2}" font-size="10" text-anchor="middle" dominant-baseline="middle">${Math.round(h)}mm</text>`;
    y+=hp;
    if(i<res.gaps.length){const gp=res.gaps[i]*ppm; s+=`<rect x="${w*0.1}" y="${y}" width="${w*0.8}" height="${gp}" fill="lightgray"/>`; y+=gp;}
  });
  return s+`</svg>`;
}

function bomForItem(cfg,it,sol){
  const K = cfg.Kitchen||cfg.kitchen||{}; const WDEF = K.Defaults||{}; const WDEF_WALL = K.Wall?.Defaults||{};
  const isWall = (it.type||'').startsWith('wall_');
  const out=[],mat="MDF_Lak",th=18,edge="2L+2S",wf=(it.width??600)-4;
  sol.fronts.forEach((h,i)=>out.push({itemId:it.id,part:`FRONT-${i+1}`,qty:1,w:wf,h:Math.round(h),th:th,edge:edge,material:mat,notes:""}));
  const t=WDEF.SideThickness??18, d=isWall ? (it.depth??WDEF_WALL.CarcassDepth??320) : (it.depth??WDEF.CarcassDepth??560), H=sol.H_carcass, netW=(it.width??600)-2*t;
  out.push({itemId:it.id,part:isWall?"BOK-L-W":"BOK-L",qty:1,w:d,h:H,th:t,edge:"2L",material:"PB18",notes:""});
  out.push({itemId:it.id,part:isWall?"BOK-R-W":"BOK-R",qty:1,w:d,h:H,th:t,edge:"2L",material:"PB18",notes:""});
  out.push({itemId:it.id,part:isWall?"DNO-W":"DNO",qty:1,w:netW,h:d,th:t,edge:"2S",material:"PB18",notes:""});
  out.push({itemId:it.id,part:isWall?"TOP-W":"TOP",qty:1,w:netW,h:d,th:t,edge:"2S",material:"PB18",notes:""});
  return out;
}

function aggregateBOM(rows){
  const key=r=>`${r.part}|${r.w}|${r.h}|${r.th}|${r.edge}|${r.material}`;
  const map=new Map();
  rows.forEach(r=>{
    const k=key(r); const prev=map.get(k);
    if(prev) prev.qty+=r.qty; else map.set(k,{...r});
  });
  return Array.from(map.values());
}

function toCSV(rows){
  if(!rows.length) return "";
  const cols=Object.keys(rows[0]);
  const esc=v=>`"${String(v).replace(/"/g,'""')}"`;
  return [cols.join(','), ...rows.map(r=>cols.map(c=>esc(r[c]??"")).join(','))].join('\n');
}

function renderBOM(rows){
  const el=$("#bom");
  el.innerHTML = `<table><thead><tr><th>Part</th><th class="ta-right">Qty</th><th class="ta-right">W</th><th class="ta-right">H</th><th class="ta-right">TH</th><th>Edge</th><th>Material</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td>${r.part}</td><td class="ta-right">${r.qty}</td><td class="ta-right">${r.w}</td><td class="ta-right">${r.h}</td><td class="ta-right">${r.th}</td><td>${r.edge}</td><td>${r.material}</td></tr>`).join('')+
    `</tbody></table>`;
}

function renderCSVPreview(rows){
  const csv=toCSV(rows); const ta=$("#csvRaw"); if(ta) ta.value=csv;
}

// ===== Budget =====
function getUnitPrices(){
  const num=id=>Number(document.getElementById(id)?.value||0);
  return {
    carcassM2: num('pCarcassM2'),
    frontM2:   num('pFrontM2'),
    hinge:     num('pHinge'),
    rail:      num('pRail'),
    handle:    num('pHandle'),
    screw:     num('pScrew'),
    absLm:     num('pAbsLm'),
    leg:       num('pLeg'),
  };
}
function countByType(order){
  let doors=0, drawers=0, handles=0, baseBoxes=0, wallBoxes=0;
  (order||[]).forEach(it=>{
    const t=it.type||'';
    const isWall=t.startsWith('wall_');
    if(isWall) wallBoxes++; else baseBoxes++;
    if(t==='drawer_3'){ drawers+=3; handles+=3; }
    else if(t==='combo_drawer_door'){ drawers+=1; doors+=1; handles+=2; }
    else if(t==='sink_1door'){ doors+=1; handles+=1; }
    else if(t==='dishwasher_60'){ handles+=1; }
    else if(t==='oven_housing'){ drawers+=1; handles+=1; }
    else if(t==='wall_1door'){ doors+=1; handles+=1; }
    // wall_open -> nothing
  });
  return {doors, drawers, handles, baseBoxes, wallBoxes};
}
function sumAreasM2(agg){
  let carcM2=0, frontM2=0;
  (agg||[]).forEach(r=>{
    const area = (Number(r.w)||0)*(Number(r.h)||0)*(Number(r.qty)||0)/1_000_000; // mm² -> m²
    const mat=(r.material||'').toUpperCase();
    if(mat.includes('PB')) carcM2 += area; else if(mat.includes('MDF')) frontM2 += area;
  });
  return {carcM2, frontM2};
}
function computeBudget(cfg, order, agg){
  const P = getUnitPrices();
  const {doors, drawers, handles, baseBoxes, wallBoxes} = countByType(order);
  const {carcM2, frontM2} = sumAreasM2(agg);
  const hinges   = doors * 2;               // 2 hinge/door
  const railPairs= drawers;                 // 1 pair/drawer
  const screws   = baseBoxes*50 + wallBoxes*30; // heuristic
  const absLm    = (typeof sumEdgeLm==='function') ? sumEdgeLm(agg) : 0;
  const legs     = baseBoxes * 4;           // 4 nogice po donjem korpusu (pretpostavka)

  const rows=[
    {item:'Korpus materijal', qty:carcM2.toFixed(2), unit:'m²', price:P.carcassM2, total: carcM2*P.carcassM2},
    {item:'Front materijal',  qty:frontM2.toFixed(2), unit:'m²', price:P.frontM2,   total: frontM2*P.frontM2},
    {item:'Šarke',            qty:hinges, unit:'kom', price:P.hinge,   total: hinges*P.hinge},
    {item:'Šine fioka',       qty:railPairs, unit:'par', price:P.rail, total: railPairs*P.rail},
    {item:'Ručice',           qty:handles, unit:'kom', price:P.handle, total: handles*P.handle},
    {item:'Šrafovi',          qty:screws,    unit:'kom', price:P.screw,  total: screws*P.screw},
    {item:'ABS traka',        qty:absLm.toFixed(2), unit:'m',   price:P.absLm,  total: absLm*P.absLm},
    {item:'Nogice',           qty:legs,     unit:'kom', price:P.leg,    total: legs*P.leg},
  ];
  const sum = rows.reduce((a,r)=>a+(Number(r.total)||0),0);
  return {rows, sum};
}
function renderBudgetTable(items){
  const host=document.getElementById('budget'); if(!host) return;
  const fmt=v=>Number(v).toLocaleString('sr-RS', {maximumFractionDigits:0});
  const fmt2=v=>Number(v).toLocaleString('sr-RS', {minimumFractionDigits:2, maximumFractionDigits:2});
  const {rows, sum} = items;
  host.innerHTML = `<table><thead><tr><th>Stavka</th><th class="ta-right">Količina</th><th>Jedinica</th><th class="ta-right">Cena</th><th class="ta-right">Ukupno</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td>${r.item}</td><td class="ta-right">${r.qty}</td><td>${r.unit}</td><td class="ta-right">${fmt(r.price)}</td><td class="ta-right">${fmt(r.total)}</td></tr>`).join('')+
    `</tbody><tfoot><tr><th colspan="4" class="ta-right">UKUPNO</th><th class="ta-right">${fmt(sum)}</th></tr></tfoot></table>`;
}
function recomputeBudget(){
  const out = { cfg: window.__lastCfg, order: window.__lastOrder, agg: window.__lastAggBOM };
  if(!out.cfg || !out.order || !out.agg) return;
  const budget = computeBudget(out.cfg, out.order, out.agg);
  renderBudgetTable(budget);
}


function renderGlobals(k){
  const wall=k.Wall||{};
  $("#globals").innerHTML = `H_total=${k.H_total} • H_plinth=${k.H_plinth} • T_top=${k.T_top} • Gap=${k.Gap}` +
    (wall.H_carcass? ` • H_wall=${wall.H_carcass}` : '') + (wall.Bottom? ` • WallBottom=${wall.Bottom}` : '');
}

function renderElements(cfg,order,solved){
  const host=$("#elements"); host.innerHTML="";
  solved.forEach((s,i)=>{
    const svg=renderElementSVG(s,120,0.35);
    const card=document.createElement('div'); card.className='card'; card.style.padding='8px'; card.innerHTML =
      `<div class="small" style="margin-bottom:6px; opacity:.8">${order[i].id} — H_carcass=${s.H_carcass}mm</div>`+svg;
    host.appendChild(card);
  });
}

function wireCopyCsv(){ const b=$("#btnCopyCsv"); if(!b) return; b.onclick=()=>{ const t=$("#csvRaw"); t.select(); document.execCommand('copy'); b.textContent='Kopirano ✓'; setTimeout(()=>b.textContent='Copy CSV',900); } }

// recompute + hook za viewer
function recompute(){
  $("#msg").textContent="";
  try{
    const data=JSON.parse($("#jsonInput").value);
    const cfg=data;

    // proračun
    renderGlobals(cfg.Kitchen || cfg.kitchen || {});
    const solved=solveOrder(cfg,data.Order);
    renderElements(cfg,data.Order,solved);

    // BOM + CSV + preview
    let all=[];
    data.Order.forEach((it,i)=>{ all=all.concat(bomForItem(cfg,it,solved[i])); });
    const agg=aggregateBOM(all);
    renderBOM(agg);
    renderCSVPreview(agg);
    wireCopyCsv();

    const csv=toCSV(agg);
    const a=$("#csvLink"); if(a){ a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="3xmeri_BOM.csv"; }
    const raw=$("#csvRaw"); if(raw) raw.value=csv;

    // validacije
    const val=[], uniq=new Set(solved.map(s=>s.H_carcass));
    val.push(uniq.size===1?"✔ Svi elementi imaju isti H_carcass.":"⚠ Različite visine korpusa.");
    const notes=solved.flatMap(s=>s.notes.map(n=>s.id+": "+n));
    if(notes.length) val.push("⚠ Napomene:<br>"+notes.map(n=>"• "+n).join("<br>"));
    $("#valid").innerHTML=val.join("<br>");

    // za dugmad i 3D i budžet
    window.__lastAggBOM=agg; window.__lastOrder=data.Order; window.__lastCfg=cfg;
    recomputeBudget();

    // ➜ VRATI podatke za 3D viewer
    return { cfg, order: data.Order, solved };
  }catch(e){
    console.error(e);
    $("#msg").textContent="Greška u JSON-u: "+e.message;
    return null;
  }
}


// izloži globalno, da 3D viewer može da pozove i dobije podatke
window.recompute = recompute;

// ===== Global controls helpers (Kitchen <-> inputs)
function getKitchenObj(){
  try{ const data=JSON.parse(document.querySelector('#jsonInput').value);
       return (data.Kitchen||data.kitchen||{}); }catch(e){ return {}; }
}
function writeKitchenObj(fn){
  try{
    const data=JSON.parse(document.querySelector('#jsonInput').value);
    const key = (data.Kitchen? 'Kitchen' : (data.kitchen? 'kitchen' : 'Kitchen'));
    data[key]=data[key]||{};
    fn(data[key]);
    document.querySelector('#jsonInput').value=JSON.stringify(data,null,2);
  }catch(e){}
}
function limitValue(){ const K=getKitchenObj(); return Number(K.TotalLength||0); }
function totalWidth(isWall){
  return (builder||[])
    .filter(it => ((it.type||'').startsWith('wall_')) === !!isWall)
    .reduce((a,it)=> a + (Number(it.width)||0), 0);
}
function canAddWidth(type,w){
  const lim=limitValue(); if(!lim) return true;
  const isWall = (type||'').startsWith('wall_');
  return (totalWidth(isWall)+w) <= lim;
}
function updateLenInfo(){ const info=document.getElementById('lenInfo'); if(!info) return; const lim=limitValue(); if(!lim){ info.textContent=''; return; }
  const usedBase=totalWidth(false), usedWall=totalWidth(true);
  const remBase=lim-usedBase, remWall=lim-usedWall;
  info.innerHTML = `Dužina donjih: ${usedBase}mm / ${lim}mm — preostalo ${remBase}mm &nbsp; | &nbsp; Dužina visećih: ${usedWall}mm / ${lim}mm — preostalo ${remWall}mm`;
  info.style.color = (remBase>=0 && remWall>=0) ? '#9dd79d' : '#f59b9b'; }
function syncGlobalsToInputs(){
  const K=getKitchenObj();
  const Hc=(Number(K.H_total||0)-Number(K.H_plinth||0)-Number(K.T_top||0))||0;
  const depth= Number(K.Defaults?.CarcassDepth ?? 560);
  const totalLen = Number(K.TotalLength||'') || '';
  const ih=document.getElementById('inpHCarcass'); if(ih) ih.value = Math.round(Hc);
  const idp=document.getElementById('inpDepth'); if(idp) idp.value = Math.round(depth);
  const itl=document.getElementById('inpTotalLen'); if(itl) itl.value = totalLen;
  // wall globals
  const Hw = Number(K.Wall?.H_carcass ?? 720);
  const Wb = Number(K.Wall?.Bottom ?? 1450);
  const Wd = Number(K.Wall?.Defaults?.CarcassDepth ?? 320);
  const ihw=document.getElementById('inpHWall'); if(ihw) ihw.value = Hw;
  const ib=document.getElementById('inpWallBottom'); if(ib) ib.value = Wb;
  const iwd=document.getElementById('inpWallDepth'); if(iwd) iwd.value = Wd;
  updateLenInfo(); }
function onGlobalInputsChange(){
  const ih=document.getElementById('inpHCarcass');
  const idp=document.getElementById('inpDepth');
  const itl=document.getElementById('inpTotalLen');
  const ihw=document.getElementById('inpHWall');
  const ib=document.getElementById('inpWallBottom');
  const iwd=document.getElementById('inpWallDepth');
  writeKitchenObj(K=>{
    if(idp && idp.value){ K.Defaults=K.Defaults||{}; K.Defaults.CarcassDepth=Number(idp.value); }
    if(ih && ih.value){ const Hc=Number(ih.value)||0; const Hp=Number(K.H_plinth||0), Tt=Number(K.T_top||0); K.H_total = Hc + Hp + Tt; }
    if(itl){ const v=Number(itl.value); if(Number.isFinite(v) && v>0) K.TotalLength=v; else delete K.TotalLength; }
    // wall
    K.Wall = K.Wall || {};
    if(ihw && ihw.value){ K.Wall.H_carcass = Number(ihw.value)||720; }
    if(ib && ib.value){ K.Wall.Bottom = Number(ib.value)||1450; }
    if(iwd && iwd.value){ K.Wall.Defaults = K.Wall.Defaults || {}; K.Wall.Defaults.CarcassDepth = Number(iwd.value)||320; }
  });
  syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }

// ===== Order Builder (UI -> JSON)
let builder = [];
const TEMPLATES = {
  drawer_3: ()=>({ id: nextId(), type: 'drawer_3', width:600, depth:560, drawerHeights:[170,200] }),
  combo_drawer_door: ()=>({ id: nextId(), type: 'combo_drawer_door', width:600, depth:560 }),
  sink_1door: ()=>({ id: nextId(), type: 'sink_1door', width:600, depth:560 }),
  dishwasher_60: ()=>({ id: nextId(), type: 'dishwasher_60', width:600, depth:560, appliance:{ nicheMin:815 } }),
  oven_housing: ()=>({ id: nextId(), type: 'oven_housing', width:600, depth:560, appliance:{ ovenNiche:595 } }),
  // --- wall units ---
  wall_1door: ()=>({ id: nextId(), type: 'wall_1door', width:600, depth:320 }),
  wall_open:  ()=>({ id: nextId(), type: 'wall_open',  width:600, depth:320 })
};
function nextId(){ return 'E'+(builder.length+1); }
function addItem(type){ const f=TEMPLATES[type]; if(!f) return; const tmp=f(); const w=tmp.width||600; if(!canAddWidth(type,w)){ const m=$("#msg"); if(m){ const isWall=(type||'').startsWith('wall_'); const used=totalWidth(isWall); m.textContent=`Prekoračen limit dužine (${isWall?'viseći':'donji'}): pokušaj ${used+w}mm > ${limitValue()}mm`; } return; } builder.push(tmp); renderBuilder(); syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }
function delItem(i){ builder.splice(i,1); renumberIds(); renderBuilder(); syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }
function moveItem(i,dir){ const j=i+dir; if(j<0||j>=builder.length) return; const t=builder[i]; builder[i]=builder[j]; builder[j]=t; renumberIds(); renderBuilder(); syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }
function renumberIds(){ builder.forEach((it,idx)=>{ it.id='E'+(idx+1); }); }
function builderToOrder(){ return JSON.parse(JSON.stringify(builder)); }
function syncJSONFromBuilder(){ try{ const data=JSON.parse(document.querySelector('#jsonInput').value); data.Order=builderToOrder(); document.querySelector('#jsonInput').value = JSON.stringify(data,null,2); }catch(e){ /* ignore, textarea might be invalid while typing */ } }
function syncBuilderFromJSON(){ try{ const data=JSON.parse(document.querySelector('#jsonInput').value); builder = Array.isArray(data.Order)? JSON.parse(JSON.stringify(data.Order)) : []; renumberIds(); renderBuilder(); }catch(e){ /* ignore */ } }
function renderBuilder(){ const host=document.querySelector('#builderList'); if(!host) return; if(!builder.length){ host.innerHTML='<em>Nema elemenata – izaberite iz kataloga iznad.</em>'; updateLenInfo(); return; }
  const row=(it,i)=>{
    const extra = it.type==='drawer_3'
      ? `<label>2. fioka (mm): <input data-k="drawer2" data-i="${i}" type="number" value="${it.drawerHeights?.[1]??200}" style="width:80px"></label>`
      : it.type==='oven_housing'
        ? `<label>Oven niche (mm): <input data-k="ovenNiche" data-i="${i}" type="number" value="${it.appliance?.ovenNiche??595}" style="width:90px"></label>`
        : it.type==='dishwasher_60'
          ? `<label>Niche min (mm): <input data-k="nicheMin" data-i="${i}" type="number" value="${it.appliance?.nicheMin??815}" style="width:90px"></label>`
          : (it.type?.startsWith('wall_')? `<em>viseći</em>` : '');
    return `<div class="flex" style="gap:10px; align-items:center; padding:6px 0; border-bottom:1px dashed #2a3140">
      <strong>#${i+1}</strong>
      <span class="mono">${it.id}</span>
      <span>${it.type}</span>
      <label>W: <input data-k="width" data-i="${i}" type="number" value="${it.width??600}" style="width:70px"></label>
      <label>D: <input data-k="depth" data-i="${i}" type="number" value="${it.depth??(it.type?.startsWith('wall_')?320:560)}" style="width:70px"></label>
      ${extra}
      <span class="spacer"></span>
      <button data-act="up" data-i="${i}">↑</button>
      <button data-act="down" data-i="${i}">↓</button>
      <button data-act="del" data-i="${i}">✕</button>
    </div>`; };
  host.innerHTML = builder.map(row).join('');
  updateLenInfo();
}
// Delegacija događaja
(function(){ const cat=document.querySelector('#catalog'); if(cat){ cat.addEventListener('click', e=>{ const t=e.target.closest('button[data-type]'); if(!t) return; addItem(t.dataset.type); }); }
  const bl=document.querySelector('#builderList'); if(bl){ bl.addEventListener('click', e=>{ const b=e.target.closest('button[data-act]'); if(!b) return; const i=Number(b.dataset.i); const act=b.dataset.act; if(act==='del') delItem(i); if(act==='up') moveItem(i,-1); if(act==='down') moveItem(i,1); });
    bl.addEventListener('input', e=>{ const inp=e.target; const k=inp.dataset.k; const i=Number(inp.dataset.i); if(k&&Number.isFinite(i)){ const it=builder[i]; const v=Number(inp.value); if(k==='width'||k==='depth'){ it[k]=v; } else if(k==='drawer2'){ it.drawerHeights = Array.isArray(it.drawerHeights)? it.drawerHeights:[170,200]; it.drawerHeights[1]=v; } else if(k==='ovenNiche'){ it.appliance=it.appliance||{}; it.appliance.ovenNiche=v; } else if(k==='nicheMin'){ it.appliance=it.appliance||{}; it.appliance.nicheMin=v; }
      syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }
    });
  }
})();

/* boot */
window.addEventListener("DOMContentLoaded",()=>{
  $("#btnRun").addEventListener("click",()=>window.recompute());
  $("#btnReset").addEventListener("click",()=>{
    const ta=$("#jsonInput"); ta.value=ta.defaultValue; syncBuilderFromJSON(); syncGlobalsToInputs(); window.recompute();
  });
  $("#btnCsv").addEventListener("click",()=>{ const rows=window.__lastAggBOM||[]; const csv=toCSV(rows); downloadCSVMobileAware("3xmeri_BOM.csv",csv); });

  ["inpHCarcass","inpDepth","inpTotalLen","inpHWall","inpWallBottom","inpWallDepth"].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input', onGlobalInputsChange); }});

  // budžet inputs auto-recalc
  ["pCarcassM2","pFrontM2","pHinge","pRail","pHandle","pScrew","pAbsLm","pLeg"].forEach(id=>{
    const el=document.getElementById(id); if(el){ el.addEventListener('input', ()=>recomputeBudget()); }
  });

  syncBuilderFromJSON();
  syncGlobalsToInputs();
  window.recompute();
});

function downloadCSVMobileAware(name, data){
  const url='data:text/csv;charset=utf-8,'+encodeURIComponent(data);
  const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
}