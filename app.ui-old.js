/* HSPLIT v1 */
// UI glue: render previews, handle builder, call core/bom/budget
(function(){
  console.log('app.ui.js HSPLIT v1 loaded');
  // build: v13 cache-bust
  console.log('viewer3d.nomodule.v6.js v13 loaded');
const $ = s => document.querySelector(s);

function renderElementSVG(res,w=120,ppm=0.35){
  const tot=res.H_carcass*ppm; let y=0;
  let s=`<svg width="${w}" height="${Math.round(tot)}" viewBox="0 0 ${w} ${Math.round(tot)}" xmlns="http://www.w3.org/2000/svg">`;
  if (res && res.doors===2){
    const halfW = w/2; let y=0;
    (res.fronts && res.fronts.length ? res.fronts : [res.H_carcass||0]).forEach((h,i)=>{
      const hp=h*ppm;
      // left/right doors
      s+=`<rect x="0" y="${y}" width="${halfW}" height="${hp}" fill="white" stroke="black"/>`;
      s+=`<rect x="${halfW}" y="${y}" width="${halfW}" height="${hp}" fill="white" stroke="black"/>`;
      y+=hp; if(i<res.gaps.length){ const gp=res.gaps[i]*ppm; s+=`<rect x="${w*0.1}" y="${y}" width="${w*0.8}" height="${gp}" fill="lightgray"/>`; y+=gp; }
    });
  } else {
    let y=0;
    (res.fronts && res.fronts.length ? res.fronts : [res.H_carcass||0]).forEach((h,i)=>{
      const hp=h*ppm;
      s+=`<rect x="0" y="${y}" width="${w}" height="${hp}" fill="white" stroke="black"/>`;
      s+=`<text x="${w/2}" y="${y+hp/2}" font-size="10" text-anchor="middle" dominant-baseline="middle">${Math.round(h)}mm</text>`;
      y+=hp; if(i<res.gaps.length){const gp=res.gaps[i]*ppm; s+=`<rect x="${w*0.1}" y="${y}" width="${w*0.8}" height="${gp}" fill="lightgray"/>`; y+=gp;}
    });
  }
  return s+`</svg>`;
}

function renderElements(cfg,order,solved){ const host=$("#elements"); host.innerHTML=""; solved.forEach((s,i)=>{ const svg=renderElementSVG(s,120,0.35); const card=document.createElement('div'); card.className='card'; card.style.padding='8px'; card.innerHTML = `<div class="small" style="margin-bottom:6px; opacity:.8">${order[i].id} — H_carcass=${s.H_carcass}mm</div>`+svg; host.appendChild(card); }); }

function wireCopyCsv(){ const b=$("#btnCopyCsv"); if(!b) return; b.onclick=()=>{ const t=$("#csvRaw"); t.select(); document.execCommand('copy'); b.textContent='Kopirano ✓'; setTimeout(()=>b.textContent='Copy CSV',900); } }

function toCSV(rows){ return App.BOM.toCSV(rows); }

function recompute(){
  $("#msg").textContent="";
  try{
    const data=JSON.parse($("#jsonInput").value);
    const cfg=data;
    const solved=App.Core.solveOrder(cfg,data.Order);
    renderElements(cfg,data.Order,solved);

    let all=[]; data.Order.forEach((it,i)=>{ all=all.concat(App.BOM.bomForItem(cfg,it,solved[i])); });
    const agg=App.BOM.aggregateBOM(all);
    App.BOM.renderBOM(agg);
    App.BOM.renderCSVPreview(agg);
    wireCopyCsv();

    const csv=toCSV(agg); const a=$("#csvLink"); if(a){ a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="3xmeri_BOM.csv"; }
    const raw=$("#csvRaw"); if(raw) raw.value=csv;

    const val=[], uniq=new Set(solved.map(s=>s.H_carcass));
    val.push(uniq.size===1?"✔ Svi elementi imaju isti H_carcass.":"⚠ Različite visine korpusa.");
    const notes=solved.flatMap(s=>s.notes.map(n=>s.id+": "+n)); if(notes.length) val.push("⚠ Napomene:<br>"+notes.map(n=>"• "+n).join("<br>"));
    $("#valid").innerHTML=val.join("<br>");

    window.__lastAggBOM=agg; window.__lastOrder=data.Order; window.__lastCfg=cfg;
    App.Budget.recomputeBudget();

    return { cfg, order: data.Order, solved };
  }catch(e){ console.error(e); $("#msg").textContent="Greška u JSON-u: "+e.message; return null; }
}
window.recompute=recompute;

// ===== Order Builder, globals (preuzeto iz postojeće app.js) =====
window.builder = window.builder || [];
const TEMPLATES = App.Core.TEMPLATES;
function nextId(){ return App.Core.nextId(); }

function limitValue(){ const K=App.Core.getKitchenObj(); return Number(K.TotalLength||0); }
function totalWidth(isWall){ return (builder||[]).filter(it=>((it.type||'').startsWith('wall_'))===!!isWall).reduce((a,it)=>a+(Number(it.width)||0),0); }
function canAddWidth(type,w){ const lim=limitValue(); if(!lim) return true; const isWall=(type||'').startsWith('wall_'); return (totalWidth(isWall)+w)<=lim; }
function updateLenInfo(){ const info=document.getElementById('lenInfo'); if(!info) return; const lim=limitValue(); if(!lim){ info.textContent=''; return; } const usedBase=totalWidth(false), usedWall=totalWidth(true); const remBase=lim-usedBase, remWall=lim-usedWall; info.innerHTML=`Dužina donjih: ${usedBase}mm / ${lim}mm — preostalo ${remBase}mm &nbsp; | &nbsp; Dužina visećih: ${usedWall}mm / ${lim}mm — preostalo ${remWall}mm`; info.style.color=(remBase>=0&&remWall>=0)?'#9dd79d':'#f59b9b'; }

function builderToOrder(){ return JSON.parse(JSON.stringify(builder)); }
function syncJSONFromBuilder(){ try{ const data=JSON.parse(document.querySelector('#jsonInput').value); data.Order=builderToOrder(); document.querySelector('#jsonInput').value=JSON.stringify(data,null,2); }catch(e){} }
function syncBuilderFromJSON(){ try{ const data=JSON.parse(document.querySelector('#jsonInput').value); builder=Array.isArray(data.Order)? JSON.parse(JSON.stringify(data.Order)) : []; renumberIds(); renderBuilder(); }catch(e){} }
function renumberIds(){ builder.forEach((it,idx)=>{ it.id='E'+(idx+1); }); }

function addItem(type){ const f=TEMPLATES[type]; if(!f) return; const tmp=f(); const w=tmp.width||600; if(!canAddWidth(type,w)){ const m=$("#msg"); if(m){ const isWall=(type||'').startsWith('wall_'); const used=totalWidth(isWall); m.textContent=`Prekoračen limit dužine (${isWall?'viseći':'donji'}): pokušaj ${used+w}mm > ${limitValue()}mm`; } return; } builder.push(tmp); renderBuilder(); syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }
function delItem(i){ builder.splice(i,1); renumberIds(); renderBuilder(); syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }
function moveItem(i,dir){ const j=i+dir; if(j<0||j>=builder.length) return; const t=builder[i]; builder[i]=builder[j]; builder[j]=t; renumberIds(); renderBuilder(); syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }

function renderBuilder(){ const host=document.querySelector('#builderList'); if(!host) return; if(!builder.length){ host.innerHTML='<em>Nema elemenata – izaberite iz kataloga iznad.</em>'; updateLenInfo(); return; }
  const row=(it,i)=>{ const extra = it.type==='drawer_3'
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
  host.innerHTML = builder.map(row).join(''); updateLenInfo();
}

(function(){ const cat=document.querySelector('#catalog'); if(cat){ cat.addEventListener('click', e=>{ const t=e.target.closest('button[data-type]'); if(!t) return; addItem(t.dataset.type); }); }
  const bl=document.querySelector('#builderList'); if(bl){ bl.addEventListener('click', e=>{ const b=e.target.closest('button[data-act]'); if(!b) return; const i=Number(b.dataset.i); const act=b.dataset.act; if(act==='del') delItem(i); if(act==='up') moveItem(i,-1); if(act==='down') moveItem(i,1); });
    bl.addEventListener('input', e=>{ const inp=e.target; const k=inp.dataset.k; const i=Number(inp.dataset.i); if(k&&Number.isFinite(i)){ const it=builder[i]; const v=Number(inp.value); if(k==='width'||k==='depth'){ it[k]=v; } else if(k==='drawer2'){ it.drawerHeights = Array.isArray(it.drawerHeights)? it.drawerHeights:[170,200]; it.drawerHeights[1]=v; } else if(k==='ovenNiche'){ it.appliance=it.appliance||{}; it.appliance.ovenNiche=v; } else if(k==='nicheMin'){ it.appliance=it.appliance||{}; it.appliance.nicheMin=v; }
      syncJSONFromBuilder(); updateLenInfo(); window.recompute(); }
    });
  }
})();

function downloadCSVMobileAware(name, data){ const url='data:text/csv;charset=utf-8,'+encodeURIComponent(data); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); }

window.addEventListener("DOMContentLoaded",()=>{
  $("#btnRun").addEventListener("click",()=>window.recompute());
  $("#btnReset").addEventListener("click",()=>{ const ta=$("#jsonInput"); ta.value=ta.defaultValue; syncBuilderFromJSON(); if (typeof syncGlobalsToInputs === 'function') syncGlobalsToInputs(); window.recompute(); });
  $("#btnCsv").addEventListener("click",()=>{ const rows=window.__lastAggBOM||[]; const csv=toCSV(rows); downloadCSVMobileAware("3xmeri_BOM.csv",csv); });

  ["pCarcassM2","pFrontM2","pHinge","pRail","pHandle","pScrew","pAbsLm","pTopLm","pLeg"].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('input', ()=>App.Budget.recomputeBudget()); }});

  syncBuilderFromJSON();
  // syncGlobalsToInputs / onGlobalInputsChange ostaju u postojećem fajlu ako ih koristiš; po potrebi možemo ih takođe izvući u Core/UI
  window.recompute();
});
})();