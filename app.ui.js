/* app.ui.js – v2.8
 * Bezbedan start (čeka App.Core), inicijalni JSON bootstrap,
 * centralni state (App.State) – 1x parse,
 * debounce za recompute i cene, BOM/Budget/3D integracija + Budget table beautify (guard),
 * Save/Open .3xmeri projekata + persist Prices & UI Params.
 * NOVO: bezbedan reset 3D viewera kada se elementi uklone + ručni "Reset 3D".
 */
(function(){
  const log = (...a)=>console.log('[ui]', ...a);
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  // ---------- Debounce helper ----------
  const debounce = (fn,ms=140)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  // ---------- Bootstrap JSON ako je prazan ----------
  function bootstrapIfEmpty(){
    const ta = document.getElementById('jsonInput');
    if(!ta) return;
    let hasKitchen = false;
    try { hasKitchen = !!JSON.parse(ta.value||'{}').Kitchen; } catch(_){}
    if(hasKitchen) return;

    const initial = {
      Kitchen: {
        H_plinth: 110,
        T_top: 38,
        H_total: 110 + 38 + 720,
        Defaults: { CarcassDepth: 560 },
        Wall: { H_carcass: 720, Bottom: 1450, Defaults: { CarcassDepth: 320 } },
        Drawer: { DepthStd: 500, SlideAllowance: 26 },
        TotalLength: 3000,
        Builder: []
      }
    };
    ta.value = JSON.stringify(initial, null, 2);
    try{ App.State && App.State.set(initial); }catch(_){}
  }

  // ---------- JSON helpers (preko App.State) ----------
  function getConfig(){
    try{ return (App.State && App.State.get()) || {}; } catch(_){ return {}; }
  }
  function setConfig(cfg){
    try{ App.State && App.State.set(cfg||{}); } catch(_){}
  }
  function ensureKitchenShape(cfg){
    const C = cfg || getConfig();
    const key = (C.Kitchen?'Kitchen':(C.kitchen?'kitchen':'Kitchen'));
    C[key] = C[key] || {};
    const K = C[key];
    K.Defaults = K.Defaults || {};
    K.Drawer   = K.Drawer   || {};
    K.Wall     = K.Wall     || {};
    K.Wall.Defaults = K.Wall.Defaults || {};
    setConfig(C);
    return { cfg:C, K, key };
  }

  // ---------- Prices & Params helpers ----------
  function collectPricesFromUI(){
    try{
      const p = window.App?.Budget?.getUnitPrices?.();
      if (p && typeof p==='object') return { ...p };
    }catch(_){}

    const ids = ['pCarcassM2','pFrontM2','pHinge','pRail','pHandle','pScrew','pAbsLm','pTopLm','pLeg'];
    const out = {};
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el && el.value!=='') out[idToKey(id)] = numOrNull(el.value);
    });
    $$('#tab-summary [data-price], [data-price]').forEach(el=>{
      const key = (el.name || el.id || '').trim();
      if(!key) return;
      const k = sanitizeKey(key);
      const v = (el.type==='checkbox'||el.type==='radio') ? (el.checked?1:0) : numOrNull(el.value);
      if (v!=null) out[k] = v;
    });
    return out;

    function idToKey(id){ return sanitizeKey(id.replace(/^p/,'').replace(/^price_/,'').replace(/^unit_/,'').toLowerCase()); }
    function sanitizeKey(k){ return String(k).replace(/[^\w]+/g,'_'); }
    function numOrNull(v){ const n = Number(String(v).replace(',','.')); return Number.isFinite(n) ? n : null; }
  }

  function applyPricesToInputs(prices){
    if(!prices || typeof prices!=='object') return;
    const set = (id,val)=>{ const el=document.getElementById(id); if(el!=null && val!=null) el.value=String(val); };
    set('pCarcassM2', prices.carcassM2 ?? prices.carcassm2 ?? prices.carcass ?? prices.pb_m2);
    set('pFrontM2',   prices.frontM2   ?? prices.frontm2   ?? prices.front);
    set('pHinge',     prices.hinge);
    set('pRail',      prices.rail);
    set('pHandle',    prices.handle);
    set('pScrew',     prices.screw);
    set('pAbsLm',     prices.absLm ?? prices.abs_lm ?? prices.edge_lm);
    set('pTopLm',     prices.topLm ?? prices.top_lm);
    set('pLeg',       prices.leg);

    $$('#tab-summary [data-price], [data-price]').forEach(el=>{
      const key = (el.name || el.id || '').trim();
      if(!key) return;
      const k = key.replace(/[^\w]+/g,'_');
      if (prices.hasOwnProperty(k)) {
        if (el.type==='checkbox'||el.type==='radio') el.checked = !!prices[k];
        else el.value = String(prices[k]);
      }
    });
  }

  function collectUIParams(){
    const params = {};
    $$('[data-param]').forEach(el=>{
      const key = el.getAttribute('data-param') || el.name || el.id;
      if(!key) return;
      let val;
      if(el.type==='checkbox' || el.type==='radio') val = !!el.checked;
      else val = el.value;
      params[String(key).replace(/[^\w]+/g,'_')] = val;
    });
    return params;
  }
  function applyUIParams(params){
    if(!params || typeof params!=='object') return;
    $$('[data-param]').forEach(el=>{
      const key = el.getAttribute('data-param') || el.name || el.id;
      if(!key) return;
      const k = String(key).replace(/[^\w]+/g,'_');
      if(!params.hasOwnProperty(k)) return;
      if(el.type==='checkbox' || el.type==='radio') el.checked = !!params[k];
      else el.value = String(params[k]);
    });
  }

  // ---------- Save / Open .3xmeri ----------
  function onSaveClick(){
    try{
      if (typeof pushBuilderToJSON === 'function') pushBuilderToJSON();
      const cfg = getConfig();

      try {
        cfg.Prices = collectPricesFromUI();
        const uiParams = collectUIParams();
        if (uiParams && Object.keys(uiParams).length) cfg.Params = uiParams;
        cfg.__meta = { version: '3xmeri-1.0', savedAt: new Date().toISOString() };
      } catch(_){}

      const nameBase = (cfg?.Kitchen?.ProjectName ? String(cfg.Kitchen.ProjectName) : '3xmeri_project');
      const name = nameBase.endsWith('.3xmeri') ? nameBase : (nameBase + '.3xmeri');
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      const m = document.getElementById('msg'); if(m) m.textContent = 'Sačuvano: ' + name;
    }catch(e){
      const m = document.getElementById('msg'); if(m) m.textContent = 'Greška pri čuvanju: ' + e.message;
    }
  }

  function onOpenClick(){
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.3xmeri,application/json';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if(!f) return;
      try{
        const txt  = await f.text();
        const data = JSON.parse(txt);

        setConfig(data);

        try {
          applyPricesToInputs(data.Prices);
          applyUIParams(data.Params);
        } catch(_){}

        if (typeof syncGlobalsToInputs === 'function') syncGlobalsToInputs();
        if (typeof syncBuilderFromJSON === 'function') syncBuilderFromJSON();
        if (typeof renderBuilderList === 'function') renderBuilderList();

        softRecompute();
        if (window.App?.Budget?.recomputeBudget) window.App.Budget.recomputeBudget();

        const m = document.getElementById('msg'); if(m) m.textContent = 'Učitan fajl: ' + (f.name||'');
      }catch(e){
        const m = document.getElementById('msg'); if(m) m.textContent = 'Greška pri učitavanju: ' + e.message;
      }
    });
    inp.click();
  }

  function initSaveOpenButtons(){
    const bSave = document.getElementById('btnRun');
    const bOpen = document.getElementById('btnReset');
    if (bSave){ bSave.textContent = 'Save'; bSave.title = 'Sačuvaj .3xmeri projekat'; bSave.onclick = onSaveClick; }
    if (bOpen){ bOpen.textContent = 'Open'; bOpen.title = 'Otvori .3xmeri projekat'; bOpen.onclick = onOpenClick; }
  }

  // ---------- Dinamička etiketa visine ----------
  function updateBottomTotLabel(){
    const host = document.getElementById('bottomTotNote');
    if(!host) return;
    let K={}; try{ K = (getConfig().Kitchen||getConfig().kitchen||{}); }catch(_){ }
    const Hplinth = Number(K.H_plinth ?? 110);
    const Ttop    = Number(K.T_top    ?? 38);
    let Hcar = 0;
    try{ Hcar = Number(window.App?.Core?.computeHCarcass(K))||0; }catch(_){}
    const Htot = Number(K.H_total ?? (Hplinth + Ttop + Hcar)) || 0;
    host.textContent = `Ukupna visina donjih: ${Htot} mm  =  front (H_carcass ${Math.round(Hcar)} mm) + nogice ${Hplinth} mm + ploča ${Ttop} mm`;
  }

  // ---------- Builder state ----------
  window.builder = window.builder || [];

  function syncBuilderFromJSON(){
    try{
      const cfg = getConfig();
      const K = (cfg.Kitchen||cfg.kitchen||{});

      // Fallback: ako nema Kitchen.Builder, uzmi cfg.Order
      const src = Array.isArray(K.Builder) ? K.Builder
                : Array.isArray(cfg.Order) ? cfg.Order
                : [];

      if (src.length){
        window.builder = src.map((it,i)=>({
          id: it.id || (App.Core?.nextId ? App.Core.nextId() : ('E'+(i+1))),
          type: it.type,
          width: Number(it.width||600),
          depth: Number(
            it.depth ??
            (String(it.type||'').startsWith('wall_')
              ? (K.Wall?.Defaults?.CarcassDepth ?? 320)
              : (K.Defaults?.CarcassDepth ?? 560))
          ),
          ...it
        }));

        // Ako je došlo iz Order-a, prespi u Kitchen.Builder i ukloni stari Order
        if (!Array.isArray(K.Builder) && src === cfg.Order) {
          const { K: KK } = ensureKitchenShape(cfg);
          KK.Builder = window.builder.map(x=>({ ...x }));
          delete cfg.Order;
          setConfig(cfg);
        }
      }
    }catch(e){ console.warn('syncBuilderFromJSON failed', e); }
  }

  function pushBuilderToJSON(){
    try{
      const cfg = getConfig();
      const {K} = ensureKitchenShape(cfg);
      K.Builder = (window.builder||[]).map(it=>({ ...it }));
      setConfig(cfg);
    }catch(e){ console.warn('pushBuilderToJSON failed', e); }
  }

  // ---------- Globals sync ----------
  function el(id){ return document.getElementById(id); }

  function syncGlobalsToInputs(){
    try{
      const data = getConfig();
      const K = (data.Kitchen||data.kitchen||{});
      const W = (K.Wall||{});
      let HcarBase = 0;
      try{ HcarBase = Number(App.Core.computeHCarcass(K)) || 0; }catch(_){}
      if(el('inpHCarcass'))      el('inpHCarcass').value      = isFinite(HcarBase) ? Math.max(0, Math.round(HcarBase)) : '';
      if(el('inpDepth'))         el('inpDepth').value         = K.Defaults?.CarcassDepth ?? 560;
      if(el('inpTopThickness'))  el('inpTopThickness').value  = K.T_top ?? 38;
      if(el('selDrawerDepth'))   el('selDrawerDepth').value   = (K.Drawer?.DepthStd ?? 500);
      if(el('inpSlideAllowance'))el('inpSlideAllowance').value= (K.Drawer?.SlideAllowance ?? 26);
      if(el('inpTotalLength'))   el('inpTotalLength').value   = (K.TotalLength ?? '');
      if(el('inpHWall'))         el('inpHWall').value         = (W.H_carcass ?? 720);
      if(el('inpWallBottom'))    el('inpWallBottom').value    = (W.Bottom ?? 1450);
      if(el('inpWallDepth'))     el('inpWallDepth').value     = (W.Defaults?.CarcassDepth ?? 320);
    }catch(e){ /* ignore */ }
    updateBottomTotLabel();
  }

  function onGlobalInputsChange(){
    try{
      const data = getConfig();
      const {K}  = ensureKitchenShape(data);

      const Hplinth = Number(K.H_plinth ?? 110);
      const Ttop    = Number(el('inpTopThickness')?.value || K.T_top || 38);
      const HcIn    = Number(el('inpHCarcass')?.value);
      if (Number.isFinite(HcIn)) {
        K.T_top   = Ttop;
        K.H_total = Math.max(0, Hplinth + Ttop + HcIn);
      }

      const depthBase = Number(el('inpDepth')?.value);
      if (Number.isFinite(depthBase)) K.Defaults.CarcassDepth = depthBase;
      const dStd = Number(el('selDrawerDepth')?.value);
      if (Number.isFinite(dStd)) K.Drawer.DepthStd = dStd;
      const slide = Number(el('inpSlideAllowance')?.value);
      if (Number.isFinite(slide)) K.Drawer.SlideAllowance = slide;

      const totLen = Number(el('inpTotalLength')?.value);
      if (Number.isFinite(totLen)) K.TotalLength = totLen;
      const Hwall = Number(el('inpHWall')?.value);
      if (Number.isFinite(Hwall)) K.Wall.H_carcass = Hwall;
      const Wbot  = Number(el('inpWallBottom')?.value);
      if (Number.isFinite(Wbot))  K.Wall.Bottom = Wbot;
      const Dwall = Number(el('inpWallDepth')?.value);
      if (Number.isFinite(Dwall)) K.Wall.Defaults.CarcassDepth = Dwall;

      setConfig(data);
      softRecompute();
    }catch(e){
      const m = document.getElementById('msg'); if(m) m.textContent = 'Greška (globals): '+e.message;
    }
    updateBottomTotLabel();
  }

  // ---------- Catalog -> Builder ----------
  function onCatalogClick(e){
    const btn = e.target.closest('button[data-type]');
    if(!btn) return;
    const type = btn.dataset.type;
    const factory = App?.Core?.TEMPLATES?.[type];
    if(!factory){ console.warn('No factory for', type); return; }
    const item = factory();
    const cfg = getConfig(); const K = (cfg.Kitchen||cfg.kitchen||{});
    if(item && item.depth==null){
      item.depth = (String(type).startsWith('wall_') ? (K.Wall?.Defaults?.CarcassDepth ?? 320) : (K.Defaults?.CarcassDepth ?? 560));
    }
    window.builder.push(item);
    pushBuilderToJSON();
    renderBuilderList();
    softRecompute();
  }

  // ---------- Budget table beautify (guard) ----------
  let _beautifyInProgress = false;
  function enhanceBudgetTable(){
    if(_beautifyInProgress) return;
    _beautifyInProgress = true;
    try{
      const host = document.getElementById('budget');
      if(!host) return;
      const tbl = host.querySelector('table');
      if(!tbl) return;

      tbl.classList.add('budget-table');

      const rows = Array.from(tbl.querySelectorAll('thead tr, tbody tr, tfoot tr'));
      rows.forEach(tr=>{
        const cells = Array.from(tr.children);
        cells.forEach((td, i)=>{
          const raw = td.textContent.trim();
          const test = raw.replace(/\s+/g,'');
          if (i >= 2 || /^[\d\.\,\-]+(?:RSD)?$/i.test(test)) td.classList.add('num');
          if (/RSD$/i.test(test)) td.classList.add('muted');
        });
        const first = (cells[0]?.textContent||'').toLowerCase();
        if (first.includes('ukupno') || first.includes('total')) tr.classList.add('total-row');
      });
    } finally {
      _beautifyInProgress = false;
    }
  }

  // ---------- Viewer3D reset helper ----------
  let __lastRenderIds = new Set();
  function resetViewerIfNeeded(order){
    try{
      const nowIds = new Set((order||[]).map(it=>it.id));
      let needReset = false;
      __lastRenderIds.forEach(id => { if(!nowIds.has(id)) needReset = true; });

      if (needReset && window.Viewer3D){
        if (typeof Viewer3D.clear === 'function') {
          Viewer3D.clear();
        } else if (typeof Viewer3D.reset === 'function') {
          Viewer3D.reset();
        } else {
          const host = document.getElementById('viewer3d');
          if (host && host.parentNode){
            const repl = host.cloneNode(false);
            host.parentNode.replaceChild(repl, host);
            if (typeof Viewer3D.init === 'function') Viewer3D.init(repl);
          }
        }
      }
      __lastRenderIds = nowIds;
    }catch(e){
      console.warn('[UI] resetViewerIfNeeded fail', e);
    }
  }

  // ---------- Builder list ----------
  function renderBuilderList(){
    const host = $('#builderList');
    if(!host) return;
    const list = window.builder || [];
    host.innerHTML = '';
    if(!list.length){
      host.textContent = 'Nema elemenata. Dodajte ih iz kataloga iznad.';
      updateLenInfo(); return;
    }

    const makeBtn = (cls, title, onClick)=>{
      const b = document.createElement('button');
      b.className = 'btn-icon ' + cls;
      b.type = 'button';
      b.title = title;
      b.addEventListener('click', onClick);
      return b;
    };

    const frag = document.createDocumentFragment();
    list.forEach((it, idx)=>{
      const row = document.createElement('div');
      row.className = 'builder-row';

      const colId = document.createElement('div');
      colId.className = 'builder-id';
      colId.textContent = (it.id || ('E'+(idx+1)));
      row.appendChild(colId);

      const colType = document.createElement('div');
      colType.className = 'builder-type';
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = it.type || '—';
      colType.appendChild(chip);
      row.appendChild(colType);

      const colW = document.createElement('div');
      colW.className = 'field';
      const inpW = document.createElement('input');
      inpW.type='number'; inpW.min='1';
      inpW.value = Number(it.width||600);
      inpW.addEventListener('change', ()=>{
        it.width = Number(inpW.value)||it.width;
        pushBuilderToJSON(); softRecompute(); updateLenInfo();
      });
      const unitW = document.createElement('span'); unitW.className='unit'; unitW.textContent='mm';
      colW.append(inpW, unitW);
      row.appendChild(colW);

      const colD = document.createElement('div');
      colD.className = 'field';
      const inpD = document.createElement('input');
      inpD.type='number'; inpD.min='1';
      inpD.value = Number(it.depth || ((String(it.type).startsWith('wall_'))?320:560));
      inpD.addEventListener('change', ()=>{
        it.depth = Number(inpD.value)||it.depth;
        pushBuilderToJSON(); softRecompute();
      });
      const unitD = document.createElement('span'); unitD.className='unit'; unitD.textContent='mm';
      colD.append(inpD, unitD);
      row.appendChild(colD);

      const colA = document.createElement('div');
      colA.className = 'builder-actions';

      colA.appendChild(makeBtn('i-dup', 'Dupliraj', ()=>{
        const copy = { ...it, id: undefined };
        list.splice(idx+1, 0, copy);
        pushBuilderToJSON(); renderBuilderList(); softRecompute();
      }));

      colA.appendChild(makeBtn('i-up', 'Pomeri gore', ()=>{
        if (idx<=0) return;
        const tmp = list[idx-1]; list[idx-1] = list[idx]; list[idx] = tmp;
        pushBuilderToJSON(); renderBuilderList(); softRecompute();
      }));

      colA.appendChild(makeBtn('i-down', 'Pomeri dole', ()=>{
        if (idx>=list.length-1) return;
        const tmp = list[idx+1]; list[idx+1] = list[idx]; list[idx] = tmp;
        pushBuilderToJSON(); renderBuilderList(); softRecompute();
      }));

      colA.appendChild(makeBtn('i-del', 'Ukloni', ()=>{
        list.splice(idx,1);
        pushBuilderToJSON(); renderBuilderList(); softRecompute();
      }));

      row.appendChild(colA);
      frag.appendChild(row);
    });

    host.appendChild(frag);
    updateLenInfo();
  }

  function updateLenInfo(){
    const elInfo = $('#lenInfo'); if(!elInfo) return;
    const sum = (window.builder||[]).reduce((a,it)=>a+Number(it.width||0),0);
    const K = (getConfig().Kitchen||getConfig().kitchen||{});
    const lim = Number(K.TotalLength||0) || null;
    elInfo.textContent = lim ? `Ukupna širina: ${sum} mm / limit ${lim} mm` : `Ukupna širina: ${sum} mm`;
  }

  // ---------- BOM / Budget / 3D ----------
  function hardRecompute(){
    const cfg = getConfig(); ensureKitchenShape(cfg);
    const K = (cfg.Kitchen||cfg.kitchen||{});
    const order = (window.builder || []);
    const solved = [];
    if (App && App.Core && typeof App.Core.solveItem === 'function') {
      for(const it of order){ try{ solved.push(App.Core.solveItem(K, it)); }catch(e){ console.warn('solve fail', e); } }
    }
    window.__lastCfg = cfg; window.__lastOrder = order; window.__lastSolved = solved;

    try{
      // >>> reset viewera ako su neki prethodni elementi uklonjeni
      resetViewerIfNeeded(order);
      if (window.Viewer3D?.render) window.Viewer3D.render(order, cfg, solved);
    }catch(e){}

    try {
      let rows = [];
      if(App?.BOM?.bomForItem) {
        order.forEach((it,i) => {
          rows = rows.concat(App.BOM.bomForItem(cfg,it,solved[i])||[]);
        });
        const aggregatedRows = App.BOM.aggregateBOM(rows);
        App.BOM.renderBOM(aggregatedRows);
        window.__lastAggBOM = aggregatedRows;
        if (App?.Budget?.recomputeBudget) App.Budget.recomputeBudget();
        enhanceBudgetTable();
      }
      window.__lastRows = rows;
    } catch(e) {
      console.warn('BOM/Budget', e);
    }
    updateBottomTotLabel();
    return {cfg, order, solved};
  }
  const softRecompute = debounce(() => {
  if (typeof window.recompute === 'function') return window.recompute();
  return hardRecompute(); // fallback ako viewer još nije „uhvatio” hook
}, 140);

  window.recompute = hardRecompute;

  // ---------- Start ----------
  window.addEventListener('DOMContentLoaded', ()=>{
    log('UI start v2.8');
    bootstrapIfEmpty();
    initSaveOpenButtons();

    const cat = $('#catalog'); if(cat) cat.addEventListener('click', onCatalogClick);

    ['inpHCarcass','inpDepth','inpTopThickness','selDrawerDepth','inpSlideAllowance',
     'inpTotalLength','inpHWall','inpWallBottom','inpWallDepth']
     .forEach(id=>{ const e=document.getElementById(id); if(e){ e.addEventListener('input', onGlobalInputsChange); e.addEventListener('change', onGlobalInputsChange); } });

    const ta = $('#jsonInput');
    if(ta){
      ta.addEventListener('input', ()=>{
        try{ App.State && App.State.loadFromTextarea && App.State.loadFromTextarea(); }catch(_){}
        syncGlobalsToInputs(); syncBuilderFromJSON(); renderBuilderList();
      });
    }

    const priceIds = ['pCarcassM2','pFrontM2','pHinge','pRail','pHandle','pScrew','pAbsLm','pTopLm','pLeg'];
    const priceInputs = new Set();
    priceIds.forEach(id => { const el = document.getElementById(id); if (el) priceInputs.add(el); });
    $$('#tab-summary [data-price], [data-price]').forEach(el => priceInputs.add(el));

    const onPriceChange = debounce(()=>{
      try{
        if (window.App?.Budget?.recomputeBudget) App.Budget.recomputeBudget();
        enhanceBudgetTable();
      }catch(e){ console.warn('Budget recompute fail', e); }
    }, 160);
    priceInputs.forEach(el=>{
      el.addEventListener('input', onPriceChange);
      el.addEventListener('change', onPriceChange);
    });

    const btnSummary = document.getElementById('tabbtn-summary');
    if (btnSummary) btnSummary.addEventListener('click', onPriceChange);

    const budgetHost = document.getElementById('budget');
    if (budgetHost && 'MutationObserver' in window){
      const mo = new MutationObserver(()=> enhanceBudgetTable());
      mo.observe(budgetHost, { childList:true, subtree:true });
    }

    // Ručni "Reset 3D" na postojeće dugme #btnShot
    const btnShot = document.getElementById('btnShot');
    if (btnShot){
      btnShot.title = 'Reset 3D';
      btnShot.textContent = 'Reset 3D';
      btnShot.onclick = ()=>{
        try{
          __lastRenderIds = new Set();               // zaboravi stare
          resetViewerIfNeeded([]);                   // natera clear/reset
          const cfg = getConfig();
          const order = (window.builder||[]);
          if (typeof Viewer3D?.render === 'function'){
            Viewer3D.render(order, cfg, window.__lastSolved||[]);
          }
        }catch(e){ console.warn('manual 3D reset fail', e); }
      };
    }

    function initAfterCore(){
      if (window.App?.Core && typeof window.App.Core.solveItem === 'function'){
        log('App.Core ready, init full UI');
        try {
          const cfg = getConfig();
          applyPricesToInputs(cfg.Prices);
          applyUIParams(cfg.Params);
        } catch(_){}
        syncBuilderFromJSON(); syncGlobalsToInputs(); renderBuilderList(); window.recompute();
      } else {
        setTimeout(initAfterCore, 200);
      }
    }
    initAfterCore();
  });
})();
