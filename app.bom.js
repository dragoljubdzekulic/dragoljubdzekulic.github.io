// BOM + CSV
const $q=s=>document.querySelector(s);

App.BOM.bomForItem = function(cfg,it,sol){
  const K = cfg.Kitchen||cfg.kitchen||{}; const WDEF = K.Defaults||{}; const WDEF_WALL = K.Wall?.Defaults||{};
  const isWall = (it.type||'').startsWith('wall_');
  const out=[]; const matFront="MDF_Lak", thFront=18, edgeFront="2L+2S", wf=(it.width??600)-4;
  // FRONTOVI
  if (sol && sol.doors === 2) {
    const DOOR_GAP_MM = 2; // total center gap between doors
    const wf = (it.width ?? 600) - 4; // existing side clearance in project
    const eachW = Math.round((wf - DOOR_GAP_MM) / 2);
    (sol.fronts && sol.fronts.length ? sol.fronts : [sol.H_carcass||0]).forEach((h,i)=>{
      const hh = Math.round(h);
      out.push({itemId:it.id,part:`FRONT-L`,qty:1,w:eachW,h:hh,th:thFront,edge:edgeFront,material:matFront,notes:""});
      out.push({itemId:it.id,part:`FRONT-R`,qty:1,w:eachW,h:hh,th:thFront,edge:edgeFront,material:matFront,notes:""});
    });
  } else {
    const wf = (it.width ?? 600) - 4;
    (sol.fronts || []).forEach((h,i)=>out.push({itemId:it.id,part:`FRONT`,qty:1,w:wf,h:Math.round(h),th:thFront,edge:edgeFront,material:matFront,notes:""}));
  }
// KORPUS (PB18_White)
  const t=WDEF.SideThickness??18;
  const d=isWall ? (it.depth??WDEF_WALL.CarcassDepth??320) : (it.depth??WDEF.CarcassDepth??560);
  const H=sol.H_carcass, netW=(it.width??600)-2*t;
  out.push({itemId:it.id,part:isWall?"BOK-L-W":"BOK-L",qty:1,w:d,h:H,th:t,edge:"2L",material:"PB18_White",notes:"korpus"});
  out.push({itemId:it.id,part:isWall?"BOK-R-W":"BOK-R",qty:1,w:d,h:H,th:t,edge:"2L",material:"PB18_White",notes:"korpus"});
  out.push({itemId:it.id,part:isWall?"DNO-W":"DNO",qty:1,w:netW,h:d,th:t,edge:"2S",material:"PB18_White",notes:"korpus"});
  out.push({itemId:it.id,part:isWall?"TOP-W":"TOP",qty:1,w:netW,h:d,th:t,edge:"2S",material:"PB18_White",notes:"korpus"});

  // FIJOKE (PB bele kao korpus) + HDF dno
  const hasDrawers = (it.type==='drawer_3' || it.type==='drawer_2' || it.type==='combo_drawer_door' || it.type==='oven_housing');
  if(hasDrawers){
    const Dstd = Math.min( Number(K.Drawer?.DepthStd ?? 500), Number(d) );
    const slide = Number(K.Drawer?.SlideAllowance ?? 26);
    const tD = t;
    const Wclear = (it.width??600) - slide - 2*t;
    const Wrail  = Wclear - 2*tD;

    let drawerFrontHeights=[];
    if(it.type==='drawer_3') drawerFrontHeights = sol.fronts.slice(0,3);
    else if(it.type==='drawer_2') drawerFrontHeights = sol.fronts.slice(0,2);
    else if(it.type==='combo_drawer_door') drawerFrontHeights = sol.fronts.slice(0,1);
    else if(it.type==='oven_housing') drawerFrontHeights = [ (sol.fronts[1]||0) ];

    drawerFrontHeights.forEach((fh,idx)=>{
      const sideH = Math.max(90, Math.round(fh - 40));
      out.push({itemId:it.id, part:`DF-BOK-L-${idx+1}`, qty:1, w:Dstd, h:sideH, th:tD, edge:"", material:"PB18_White", notes:"fioka"});
      out.push({itemId:it.id, part:`DF-BOK-R-${idx+1}`, qty:1, w:Dstd, h:sideH, th:tD, edge:"", material:"PB18_White", notes:"fioka"});
      out.push({itemId:it.id, part:`DF-LEDJA-${idx+1}`, qty:1, w:Wrail, h:sideH, th:tD, edge:"", material:"PB18_White", notes:"fioka"});
      out.push({itemId:it.id, part:`DF-PREDNJA-${idx+1}`, qty:1, w:Wrail, h:sideH, th:tD, edge:"", material:"PB18_White", notes:"fioka"});
      out.push({itemId:it.id, part:`DF-DNO-${idx+1}`, qty:1, w:Wclear, h:Dstd, th:3, edge:"", material:"HDF3", notes:"fioka"});
    });
  }

  return out;
};

App.BOM.aggregateBOM = function(rows){
  const key=r=>`${r.part}|${r.w}|${r.h}|${r.th}|${r.edge}|${r.material}`;
  const map=new Map();
  rows.forEach(r=>{ const k=key(r); const prev=map.get(k); if(prev) prev.qty+=r.qty; else map.set(k,{...r}); });
  return Array.from(map.values());
};

App.BOM.toCSV = function(rows){
  if(!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = v => `"${String(v).replace(/"/g,'""')}"`;
  const NL = '\n';
  const header = cols.join(',');
  const lines = rows.map(r=>cols.map(c=>esc(r[c]??"")).join(','));
  return [header, ...lines].join(NL);
};


App.BOM.renderBOM = function(rows){
  const el=$q("#bom");
  el.innerHTML = `<table><thead><tr><th>Part</th><th class="ta-right">Qty</th><th class="ta-right">W</th><th class="ta-right">H</th><th class="ta-right">TH</th><th>Edge</th><th>Material</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td>${r.part}</td><td class="ta-right">${r.qty}</td><td class="ta-right">${r.w}</td><td class="ta-right">${r.h}</td><td class="ta-right">${r.th}</td><td>${r.edge}</td><td>${r.material}</td></tr>`).join('')+
    `</tbody></table>`;
};

App.BOM.renderCSVPreview = function(rows){ const csv=App.BOM.toCSV(rows); const ta=$q("#csvRaw"); if(ta) ta.value=csv; };