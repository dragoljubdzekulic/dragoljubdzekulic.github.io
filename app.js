const $=s=>document.querySelector(s);

function computeHCarcass(k){return k.H_total-k.H_plinth-k.T_top}

function solveItem(k,it){
  const N=(x,d=0)=>{x=Number(x);return Number.isFinite(x)?x:d};
  const H=N(computeHCarcass(k)), gap=N(k.Gap,2), FIRST=N(k.DatumFirstDrawer,170);
  const res={id:it.id,H_carcass:H,fronts:[],gaps:[],notes:[]},push=()=>res.gaps.push(gap);
  switch(it.type){
    case"sink_1door":
    case"combo_drawer_door":{
      const f1=FIRST,f2=H-f1-gap;
      res.fronts.push(f1); push(); res.fronts.push(f2); break;
    }
    case"dishwasher_60":{
      const n=it.appliance?.nicheMin??815;
      if(n>H)res.notes.push(`Upozorenje: nicheMin ${n}mm > H_carcass ${H}mm.`);
      res.fronts.push(H); break;
    }
    case"oven_housing":{
      const on=it.appliance?.ovenNiche??595;
      const f1=FIRST,rest=H-f1-gap; let top=Math.max(0,rest-on);
      res.fronts.push(f1); push(); res.fronts.push(on);
      if(top>0){ push(); res.fronts.push(top); }
      else res.notes.push("Nema top trim panela ili je minimalan; proveri Gap i rernu.");
      break;
    }
    case"drawer_3":{
      const second=(it.drawerHeights&&it.drawerHeights[1]!=null)?it.drawerHeights[1]:200;
      let third=H-FIRST-second-2*gap; if(third<0){ res.notes.push("Treća fioka < 0 — proveri ulaz"); third=0; }
      res.fronts.push(FIRST); push(); res.fronts.push(second); push(); res.fronts.push(third);
      break;
    }
    default: res.notes.push("Nepoznat tip: "+it.type);
  }
  const f=res.fronts.reduce((a,b)=>a+b,0),g=res.gaps.reduce((a,b)=>a+b,0),d=H-(f+g);
  if(Math.abs(d)>0.5)res.notes.push(`Neusaglašeno: diff=${d.toFixed(1)}mm`);
  return res;
}

function solveOrder(cfg,ord){return ord.map(it=>solveItem(cfg.Kitchen,it))}

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
  const out=[],mat="MDF_Lak",th=18,edge="2L+2S",wf=(it.width??600)-4;
  sol.fronts.forEach((h,i)=>out.push({itemId:it.id,part:`FRONT-${i+1}`,qty:1,w:wf,h:Math.round(h),th:th,edge:edge,material:mat,notes:""}));
  const t=cfg.Kitchen.Defaults.SideThickness,d=it.depth??cfg.Kitchen.Defaults.CarcassDepth,H=sol.H_carcass,netW=(it.width??600)-2*t;
  out.push({itemId:it.id,part:"BOK-L",qty:1,w:d,h:H,th:t,edge:"2L",material:"PB18",notes:""});
  out.push({itemId:it.id,part:"BOK-R",qty:1,w:d,h:H,th:t,edge:"2L",material:"PB18",notes:""});
  out.push({itemId:it.id,part:"DNO",qty:1,w:netW,h:d,th:t,edge:"2S",material:"PB18",notes:""});
  out.push({itemId:it.id,part:"TOP",qty:1,w:netW,h:d,th:t,edge:"2S",material:"PB18",notes:""});
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

function renderGlobals(k){
  $("#globals").innerHTML = `H_total=${k.H_total} • H_plinth=${k.H_plinth} • T_top=${k.T_top} • Gap=${k.Gap}`;
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
    renderGlobals(cfg.Kitchen);
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

    // za dugmad i 3D
    window.__lastAggBOM=agg;

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

/* boot */
window.addEventListener("DOMContentLoaded",()=>{
  $("#btnRun").addEventListener("click",recompute);
  $("#btnReset").addEventListener("click",()=>{
    const ta=$("#jsonInput"); ta.value=ta.defaultValue; recompute();
  });
  $("#btnCsv").addEventListener("click",()=>{
    const rows=window.__lastAggBOM||[]; const csv=toCSV(rows);
    downloadCSVMobileAware("3xmeri_BOM.csv",csv);
  });
  recompute();
});

function downloadCSVMobileAware(name, data){
  const url='data:text/csv;charset=utf-8,'+encodeURIComponent(data);
  const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
}
