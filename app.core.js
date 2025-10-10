// ensure global namespace čak i bez inline scripte (CSP safe)
window.App = window.App || { Core:{}, BOM:{}, Budget:{}, UI:{} };
// Core: solve, globals, builder model (bez BOM/Budget rendera)
const $=s=>document.querySelector(s);

App.Core.computeHCarcass = function(k){
  return (Number(k.H_total||0) - Number(k.H_plinth||0) - Number(k.T_top||0));
};

App.Core.solveItem = function(k,it){
  const N=(x,d)=>{ x=Number(x); return Number.isFinite(x)?x:d; };
  const isWall = (it.type||'').startsWith('wall_');
  const H = isWall ? N(k?.Wall?.H_carcass, 720) : N(App.Core.computeHCarcass(k));
  const gap = N(k.Gap,2), FIRST = N(k.DatumFirstDrawer,170);
  const res={ id:it.id, H_carcass:H, fronts:[], gaps:[], notes:[] };
  const pushGap=()=>res.gaps.push(gap);
  switch(it.type){
    case 'sink_1door':
    case 'base_1door':{ res.fronts.push(H); break; }
    case 'combo_drawer_door':{ const f1=FIRST, f2=H - f1 - gap; res.fronts.push(f1); pushGap(); res.fronts.push(f2); break; }
    case 'dishwasher_60':{ const n=it.appliance?.nicheMin??815; if(n>H) res.notes.push(`Upozorenje: nicheMin ${n}mm > H_carcass ${H}mm.`); res.fronts.push(H); break; }
    case 'oven_housing':{ const on=it.appliance?.ovenNiche??595; const f1=FIRST, rest=H - f1 - gap; let top=Math.max(0, rest - on);
      res.fronts.push(f1); pushGap(); res.fronts.push(on); if(top>0){ pushGap(); res.fronts.push(top); } else res.notes.push('Nema top trim panela ili je minimalan; proveri Gap i rernu.'); break; }
    case 'drawer_3':{ const second=(it.drawerHeights && it.drawerHeights[1]!=null)? Number(it.drawerHeights[1]) : 200; let third = H - FIRST - second - 2*gap; if(third<0){ res.notes.push('Treća fioka < 0 — proveri ulaz'); third=0; } res.fronts.push(FIRST); pushGap(); res.fronts.push(second); pushGap(); res.fronts.push(third); break; }
    case 'drawer_2':{ const f1=FIRST; const f2=H - f1 - gap; res.fronts.push(f1); pushGap(); res.fronts.push(f2); break; }
    case 'wall_1door':{ res.fronts.push(H); break; }
    case 'wall_double':{ res.fronts.push(H); res.doors = 2; break; }
    case 'base_2door':{ res.fronts.push(H); res.doors = 2; break; }

    case 'wall_open':{ break; }
    case 'wall_open_shelf':{ break; }
    default: res.notes.push('Nepoznat tip: '+it.type);
  }
  const sumF = res.fronts.reduce((a,b)=>a+b,0);
  const sumG = res.gaps.reduce((a,b)=>a+b,0);
  const diff = H - (sumF + sumG);
  if(Math.abs(diff)>0.5) res.notes.push(`Neusaglašeno: diff=${diff.toFixed(1)}mm`);
  return res;
};

App.Core.solveOrder = (cfg,ord)=>{
  const K = (cfg.Kitchen || cfg.kitchen || {});
  return ord.map(it=>App.Core.solveItem(K,it));
};

// Globals helpers
App.Core.getKitchenObj = function(){ try{ const data=JSON.parse(document.querySelector('#jsonInput').value); return (data.Kitchen||data.kitchen||{}); }catch(e){ return {}; } };
App.Core.writeKitchenObj = function(fn){ try{ const data=JSON.parse(document.querySelector('#jsonInput').value); const key=(data.Kitchen?'Kitchen':(data.kitchen?'kitchen':'Kitchen')); data[key]=data[key]||{}; fn(data[key]); document.querySelector('#jsonInput').value=JSON.stringify(data,null,2); }catch(e){} };

// Builder state
window.builder = window.builder || [];
App.Core.TEMPLATES = {
  drawer_3: ()=>({ id: nextId(), type: 'drawer_3', width:600, depth:560, drawerHeights:[170,200] }),
  drawer_2: ()=>({ id: nextId(), type: 'drawer_2', width:600, depth:560 }),
  combo_drawer_door: ()=>({ id: nextId(), type: 'combo_drawer_door', width:600, depth:560 }),
  base_1door: ()=>({ id: nextId(), type: 'base_1door', width:600, depth:560 }),
  sink_1door: ()=>({ id: nextId(), type: 'sink_1door', width:600, depth:560 }),
  dishwasher_60: ()=>({ id: nextId(), type: 'dishwasher_60', width:600, depth:560, appliance:{ nicheMin:815 } }),
  oven_housing: ()=>({ id: nextId(), type: 'oven_housing', width:600, depth:560, appliance:{ ovenNiche:595 } }),
  wall_1door: ()=>({ id: nextId(), type: 'wall_1door', width:600, depth:320 }),
  wall_open:  ()=>({ id: nextId(), type: 'wall_open',  width:600, depth:320 }),
  wall_open_shelf: ()=>({ id: nextId(), type: 'wall_open_shelf', width:600, depth:320, shelves:2 })
};
function nextId(){ return 'E'+(builder.length+1); }

// expose some helpers used by UI
App.Core.nextId = nextId;