/* HSPLIT v2.2 — app.bom.js
 * 3xMeri — BOM + CSV + Rendering + Cutting List
 * Changelog (v2.2):
 * - Krojna lista (toCuttingList) sa korekcijom za trake (L/S)
 * - CSV export za krojnu listu (toCuttingCSV)
 * - Zadržano (v2.1): donji elementi imaju dve vezne umesto TOP, police iz sol.shelves
 * - Ako nema sol, poziva se App.Core.solveItem(cfg, it)
 * - Ako postoji App.Models.get(type).bom, koristi se njegov BOM
 */

(function(){
  const $q = s => document.querySelector(s);

  // ensure namespace
  window.App = window.App || {};
  App.BOM = App.BOM || {};

  // ---- Materijali / ivice (preuzimanje iz cfg) ----
  function getMaterials(cfg){
    const m = cfg?.Materials || {};
    return {
      FRONT:         m.FRONT         || "MDF_Lak",
      CARCASS:       m.CARCASS       || "PB18_White",
      DRAWER_BOTTOM: m.DRAWER_BOTTOM || "HDF3",
      // dodatno: očekujemo opciono m.<NAME>.grain = 'none' | 'long'
      _grainOf: (name)=> (m?.[name]?.grain ?? 'none')
    };
  }
  function getEdges(cfg){
    const e = cfg?.Edges || {};
    return {
      FRONT:               e.FRONT               || "2L+2S",
      CARCASS_SIDE:        e.CARCASS_SIDE        || "2L",
      CARCASS_PLATE:       e.CARCASS_PLATE       || "2S",
      ShelfEdge:           e.ShelfEdge           || "1L",
      CarcassTapeThickness: Number(e.CarcassTapeThickness ?? 0.6), // mm
      FrontTapeThickness:   Number(e.FrontTapeThickness   ?? 1.0)  // mm (ako treba odvojeno)
    };
  }

  // ---- Helpers ----
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mm    = v => Math.round(Number(v)||0);
  const nz    = v => Number(v)||0;

  // Normalizacija jednog reda BOM-a
  function normalizeRow(r){
    return {
      itemId:   r.itemId ?? "",
      part:     String(r.part ?? ""),
      qty:      nz(r.qty),
      w:        mm(r.w),
      h:        mm(r.h),
      th:       mm(r.th),
      edge:     String(r.edge ?? ""),
      material: String(r.material ?? ""),
      notes:    String(r.notes ?? "")
    };
  }

  // Edge parser: "1L+2S" -> {L:1,S:2}
  function parseEdge(code){
    const out = { L:0, S:0 };
    if(!code) return out;
    const mL = String(code).match(/(\d+)\s*L/i); if(mL) out.L = +mL[1];
    const mS = String(code).match(/(\d+)\s*S/i); if(mS) out.S = +mS[1];
    return out;
  }

  // ---- Glavni BOM za jedan element ----
  App.BOM.bomForItem = function(cfg, it, sol){
    const C = cfg || App.State?.get?.() || {};
    const K = C?.Kitchen || C?.kitchen || {};
    const WDEF      = K.Defaults || {};
    const WDEF_WALL = K?.Wall?.Defaults || {};
    const MAT = getMaterials(C);
    const EDGE= getEdges(C);

    // ako nemamo sol, uzmi iz solveItem (izvor istine)
    sol = sol || (App.Core?.solveItem ? App.Core.solveItem(C, it) : {}) || {};
    sol.fronts = Array.isArray(sol.fronts) ? sol.fronts : [];

    const type = String(it?.type || sol?.type || '');
    const tLow = type.toLowerCase();
    const isWall   = tLow.startsWith('wall_');
    const isBase   = tLow.startsWith('base_');
    const isDrawer = tLow.includes('drawer');

    // Ako model ima sopstveni BOM – koristi njega
    try{
      if (App.Models?.get) {
        const def = App.Models.get(type);
        if (def?.bom && typeof def.bom === 'function') {
          const rows = def.bom(it, sol, C) || [];
          return rows.map(normalizeRow);
        }
      }
    } catch(e){
      console.warn('[BOM] model.bom failed for', type, e);
    }
    // === NOVO: specijalni tip — sudopera 60 sa dubokom fiokom i full-frontom ===
    if (tLow === 'base_sink_fullfront_drawer') {
      const rows = [];

      const W_total = mm(it?.width ?? sol?.width ?? 600);
      const thFront = nz(K?.FrontThickness ?? 18);
      const t       = nz(WDEF.SideThickness ?? 18) || 18;

      // dubina (kao i generički)
      const d = mm(it?.depth ?? sol?.depth ?? WDEF.CarcassDepth ?? 560);

      // visina korpusa (bez sokle)
      const H = mm(sol.H_carcass ?? (it?.height ?? (K?.Base?.H_carcass ?? 720)));

      // unutrašnja širina
      const netW = mm(W_total - 2*t);

      // --- KORPUS ---
      if (d > 0 && H > 0) {
        rows.push(normalizeRow({ itemId: it.id, part:"BOK-L", qty:1, w:d, h:H, th:t, edge:EDGE.CARCASS_SIDE,   material:MAT.CARCASS, notes:"korpus" }));
        rows.push(normalizeRow({ itemId: it.id, part:"BOK-R", qty:1, w:d, h:H, th:t, edge:EDGE.CARCASS_SIDE,   material:MAT.CARCASS, notes:"korpus" }));
      }
      if (netW > 0 && d > 0) {
        rows.push(normalizeRow({ itemId: it.id, part:"DNO",   qty:1, w:netW, h:d, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" }));
      }

      const connDepth = mm(
        nz(sol.topConnectorDepth) ||
        nz(it?.topConnectorDepth) ||
        nz(K?.Defaults?.TopConnectorDepth) || 80
      );
      if (netW > 0 && connDepth > 0) {
        rows.push(normalizeRow({ itemId: it.id, part:"VEZNA-FRONT", qty:1, w:netW, h:connDepth, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" }));
        rows.push(normalizeRow({ itemId: it.id, part:"VEZNA-BACK",  qty:1, w:netW, h:connDepth, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" }));
		rows.push(normalizeRow({ itemId: it.id, part:"LEDJA", qty:1, w:netW, h:H, th: nz(WDEF.BackThickness ?? 8), edge:"", material:(C?.Materials?.BACK || "HDF3"), notes:"korpus" }));
      }

      // --- FRONT (puna visina, širina = W_total - 4) ---
      const wf = mm(W_total - 4);
      if (wf > 0 && H > 0) {
        rows.push(normalizeRow({
          itemId: it.id,
          part: "FRONT-FULL",
          qty: 1,
          w: wf,
          h: H,
          th: thFront,
          edge: EDGE.FRONT,
          material: MAT.FRONT,
          notes: "front"
        }));
      }

      // --- FIOKA (duboka, dole) ---
      const Dstd  = Math.min( nz(K?.Drawer?.DepthStd ?? 500), nz(d) );
      const slide = nz(K?.Drawer?.SlideAllowance ?? 26);
      const tD    = t;

      const Wclear_raw = W_total - slide - 2*t;
      const Wrail_raw  = Wclear_raw - 2*tD;
      const Wclear = mm(clamp(Wclear_raw, 80, 2000));
      const Wrail  = mm(clamp(Wrail_raw,  40, 2000));

      const drawerFrontH = mm(Math.max(260, Math.round(H * 0.35)));
      const sideH        = mm(Math.max(90, drawerFrontH - 40));

      if (Dstd > 0 && sideH > 0) {
        rows.push(normalizeRow({ itemId: it.id, part:"DF-BOK-L-1",   qty:1, w:Dstd,   h:sideH, th:tD, edge:"", material:MAT.CARCASS,        notes:"fioka" }));
        rows.push(normalizeRow({ itemId: it.id, part:"DF-BOK-R-1",   qty:1, w:Dstd,   h:sideH, th:tD, edge:"", material:MAT.CARCASS,        notes:"fioka" }));
        rows.push(normalizeRow({ itemId: it.id, part:"DF-LEDJA-1",   qty:1, w:Wrail,  h:sideH, th:tD, edge:"", material:MAT.CARCASS,        notes:"fioka" }));
        rows.push(normalizeRow({ itemId: it.id, part:"DF-PREDNJA-1", qty:1, w:Wrail,  h:sideH, th:tD, edge:"", material:MAT.CARCASS,        notes:"fioka" }));
        rows.push(normalizeRow({ itemId: it.id, part:"DF-DNO-1",     qty:1, w:Wclear, h:Dstd,  th:3,  edge:"", material:MAT.DRAWER_BOTTOM, notes:"fioka" }));
      }

      return rows;
    }

    // ---- Fallback BOM (generički) ----
    const out = [];

    // FRONTOVI — širina fronta = širina - 4 mm
    const W_total = mm(it?.width ?? sol?.width ?? 600);
    const wf = mm(W_total - 4);
    const thFront = nz(K?.FrontThickness ?? 18);

    sol.fronts.forEach((h,i)=>{
      const fh = mm(h);
      if (fh > 0 && wf > 0) {
        out.push(normalizeRow({
          itemId: it.id,
          part: `FRONT-${i+1}`,
          qty: 1,
          w: wf,
          h: fh,
          th: thFront,
          edge: EDGE.FRONT,
          material: MAT.FRONT,
          notes: "front"
        }));
      }
    });

    // KORPUS — bokovi, dno, top/vezne
    const t = nz(WDEF.SideThickness ?? 18) || 18;
    const d = mm( isWall
      ? (it?.depth ?? sol?.depth ?? WDEF_WALL.CarcassDepth ?? 320)
      : (it?.depth ?? sol?.depth ?? WDEF.CarcassDepth     ?? 560)
    );
    const H = mm(sol.H_carcass ?? (it?.height ?? (isWall ? (K?.Wall?.H_carcass ?? 720) : 720)));
    const netW = mm(W_total - 2*t);

    // bokovi
    if (d > 0 && H > 0) {
      out.push(normalizeRow({ itemId: it.id, part: isWall?"BOK-L-W":"BOK-L", qty:1, w:d, h:H, th:t, edge:EDGE.CARCASS_SIDE, material:MAT.CARCASS, notes:"korpus" }));
      out.push(normalizeRow({ itemId: it.id, part: isWall?"BOK-R-W":"BOK-R", qty:1, w:d, h:H, th:t, edge:EDGE.CARCASS_SIDE, material:MAT.CARCASS, notes:"korpus" }));
    }

    // dno (uvek)
    if (netW > 0 && d > 0) {
      out.push(normalizeRow({ itemId: it.id, part: isWall?"DNO-W":"DNO", qty:1, w:netW, h:d, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" }));
    }

    // top vs dve vezne ploče
    const hasTopConnectors = (sol.hasTopConnectors === true) || (isBase && true);
    if (isWall && !hasTopConnectors) {
      // zidni → TOP-W
      if (netW > 0 && d > 0) {
        out.push(normalizeRow({ itemId: it.id, part:"TOP-W", qty:1, w:netW, h:d, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" }));
      }
    } else {
      // donji → dve vezne ploče (prednja i zadnja)
      const connDepth = mm(
        nz(sol.topConnectorDepth) ||
        nz(it?.topConnectorDepth) ||
        nz(K?.Defaults?.TopConnectorDepth) ||
        80
      );
      if (netW > 0 && connDepth > 0) {
        out.push(normalizeRow({ itemId: it.id, part:"VEZNA-FRONT", qty:1, w:netW, h:connDepth, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" }));
        out.push(normalizeRow({ itemId: it.id, part:"VEZNA-BACK",  qty:1, w:netW, h:connDepth, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" }));
      }
    }

// POLICE — iz solve.shelves (augmentirano u models.hook)
const shelfCount = Array.isArray(sol.shelves) ? sol.shelves.length : 0;
const shelfTh = mm(sol.shelf_thickness ?? it?.shelf_thickness ?? (WDEF.ShelfThickness ?? t));

if (shelfCount > 0 && netW > 0 && d > 0) {
  const shelfEdge = EDGE.ShelfEdge || EDGE.CARCASS_PLATE;

  // Unutrašnje mere police (pre krojne trake):
  const backTh   = nz(WDEF.BackThickness ?? 8);
  const doorGap  = nz(WDEF.DoorGap ?? 2);
  const cX       = nz(WDEF.ShelfClearanceX ?? 2); // luft levo/desno ukupno
  const cY       = nz(WDEF.ShelfClearanceY ?? 2); // luft napred/nazad ukupno

  const innerW = mm(Math.max(0, netW - cX));                 // W_total - 2*t - luft
  const innerD = mm(Math.max(0, d - backTh - doorGap - cY)); // d - leđa - gap - luft

  for (let i = 0; i < shelfCount; i++) {
    out.push(normalizeRow({
      itemId: it.id,
      part: isWall ? `POLICA-W-${i+1}` : `POLICA-${i+1}`,
      qty: 1,
      w: innerW,
      h: innerD,
      th: shelfTh,
      edge: shelfEdge,            // npr. '1L' → krojna H će biti umanjena za traku
      material: MAT.CARCASS,
      notes: "polica"
    }));
  }
}


    // FIJOKE — prepoznaj ladičare (i alias-e)
    const hasDrawers =
      tLow === 'drawer_3' || tLow === 'drawer_2' ||
      tLow === 'combo_drawer_door' || tLow === 'oven_housing' ||
      tLow === 'base_oven_housing' || tLow === 'base_drawer';

    if (hasDrawers) {
      const Dstd  = Math.min( nz(K?.Drawer?.DepthStd ?? 500), nz(d) );
      const slide = nz(K?.Drawer?.SlideAllowance ?? 26);
      const tD    = t;

      // unutrašnje širine
      const Wclear_raw = W_total - slide - 2*t;
      const Wrail_raw  = Wclear_raw - 2*tD;

      const Wclear = mm(clamp(Wclear_raw, 80, 2000));
      const Wrail  = mm(clamp(Wrail_raw,  40, 2000));

      // Izvući visine frontova koje odgovaraju fiokama
      let drawerFrontHeights = [];
      if (tLow === 'drawer_3') drawerFrontHeights = sol.fronts.slice(0,3);
      else if (tLow === 'drawer_2') drawerFrontHeights = sol.fronts.slice(0,2);
      else if (tLow === 'combo_drawer_door') drawerFrontHeights = sol.fronts.slice(0,1);
      else if (tLow === 'oven_housing' || tLow === 'base_oven_housing') drawerFrontHeights = [ (sol.fronts[1]||0) ];
      else if (tLow === 'base_drawer') drawerFrontHeights = sol.fronts.slice(); // svi su fioke

      drawerFrontHeights.forEach((fh, idx)=>{
        const frontH = mm(fh);
        if (frontH <= 0) return;

        const sideH = mm(Math.max(90, frontH - 40)); // minimalna visina stranice 90
        if (Dstd > 0 && sideH > 0) {
          out.push(normalizeRow({ itemId: it.id, part:`DF-BOK-L-${idx+1}`,   qty:1, w:Dstd,   h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" }));
          out.push(normalizeRow({ itemId: it.id, part:`DF-BOK-R-${idx+1}`,   qty:1, w:Dstd,   h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" }));
          out.push(normalizeRow({ itemId: it.id, part:`DF-LEDJA-${idx+1}`,   qty:1, w:Wrail,  h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" }));
          out.push(normalizeRow({ itemId: it.id, part:`DF-PREDNJA-${idx+1}`, qty:1, w:Wrail,  h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" }));
          out.push(normalizeRow({ itemId: it.id, part:`DF-DNO-${idx+1}`,     qty:1, w:Wclear, h:Dstd,  th:3,  edge:"", material:MAT.DRAWER_BOTTOM, notes:"fioka" }));
        }
      });
    }

    return out;
  };

  // ---- BOM za celu porudžbinu ----
  App.BOM.bomForOrder = function(cfg, order, solutions){
    const arr = Array.isArray(order) ? order : [];
    const out = [];
    arr.forEach((it, i)=>{
      const sol = Array.isArray(solutions) ? (solutions[i] || {}) : (solutions?.[it.id] || {});
      const rows = App.BOM.bomForItem(cfg, it, sol) || [];
      rows.forEach(r => out.push(normalizeRow(r)));
    });
    return out;
  };

  // Agregiranje (ključ: part|w|h|th|edge|material)
  App.BOM.aggregateBOM = function(rows){
    const safeRows = Array.isArray(rows) ? rows : [];
    const key = r => `${r.part}|${r.w}|${r.h}|${r.th}|${r.edge}|${r.material}`;
    const map = new Map();
    safeRows.forEach(r=>{
      const k = key(r);
      const prev = map.get(k);
      if (prev) prev.qty += (Number(r.qty)||0);
      else map.set(k, { ...r, qty: Number(r.qty)||0 });
    });
    return Array.from(map.values());
  };

  // CSV (kolone po redosledu: part, qty, w, h, th, edge, material, itemId, notes)
  App.BOM.toCSV = function(rows){
    const safe = Array.isArray(rows) ? rows : [];
    if (!safe.length) return "";

    const norm = safe.map(r=>({
      part: r.part ?? "",
      qty:  Number(r.qty)||0,
      w:    Number(r.w)||0,
      h:    Number(r.h)||0,
      th:   Number(r.th)||0,
      edge: r.edge ?? "",
      material: r.material ?? "",
      itemId: r.itemId ?? "",
      notes: r.notes ?? ""
    }));

    const cols = ["part","qty","w","h","th","edge","material","itemId","notes"];
    const esc = v => `"${String(v).replace(/"/g,'""')}"`;
    const header = cols.join(',');
    const lines = norm.map(r=>cols.map(c=>esc(r[c] ?? "")).join(','));
    return [header, ...lines].join('\n');
  };

  // Render u tabelu (BOM)
  App.BOM.renderBOM = function(rows){
    const el = $q("#bom");
    if (!el) return;

    const safe = Array.isArray(rows) ? rows : [];
    el.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: var(--panel); border-bottom: 2px solid var(--line);">
              <th style="padding: 8px; text-align: left;">Part</th>
              <th style="padding: 8px; text-align: right;">Qty</th>
              <th style="padding: 8px; text-align: right;">W</th>
              <th style="padding: 8px; text-align: right;">H</th>
              <th style="padding: 8px; text-align: right;">TH</th>
              <th style="padding: 8px; text-align: left;">Edge</th>
              <th style="padding: 8px; text-align: left;">Material</th>
            </tr>
          </thead>
          <tbody>
            ${safe.map(r => `
              <tr style="border-bottom: 1px solid var(--line);">
                <td style="padding: 6px 8px;">${r.part}</td>
                <td style="padding: 6px 8px; text-align: right;">${r.qty}</td>
                <td style="padding: 6px 8px; text-align: right;">${r.w}</td>
                <td style="padding: 6px 8px; text-align: right;">${r.h}</td>
                <td style="padding: 6px 8px; text-align: right;">${r.th}</td>
                <td style="padding: 6px 8px;">${r.edge}</td>
                <td style="padding: 6px 8px;">${r.material}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  // Popuna CSV preview textarea (#csvRaw)
  App.BOM.renderCSVPreview = function(rows){
    const ta = $q("#csvRaw");
    if (!ta) return;
    const csv = App.BOM.toCSV(Array.isArray(rows) ? rows : []);
    ta.value = csv;
  };

  /* =========================================================
   *                 KROJNA LISTA (CUTTING LIST)
   * ========================================================= */

  // Iz jednog BOM reda napravi korektovan "cut" red uzimajući u obzir trake
  function toCutRow(r, cfg){
    const MAT = getMaterials(cfg);
    const EDGE = getEdges(cfg);

    // debljina trake po materijalu
    const tape = (r.material === (cfg?.Materials?.FRONT || "MDF_Lak"))
      ? EDGE.FrontTapeThickness
      : EDGE.CarcassTapeThickness;

    const e = parseEdge(r.edge);
    const w0 = Math.max(0, Number(r.w)||0);
    const h0 = Math.max(0, Number(r.h)||0);

    // odredi dužu/kratku stranu
    const longIsW = (w0 >= h0);
    const long0   = longIsW ? w0 : h0;
    const short0  = longIsW ? h0 : w0;

    // smanji dužu za L*tape, kratku za S*tape
    const longCut  = Math.max(0, long0  - e.L * tape);
    const shortCut = Math.max(0, short0 - e.S * tape);

    const cutW = longIsW ? longCut  : shortCut;
    const cutH = longIsW ? shortCut : longCut;

    // rotacija: zabranjena ako materijal ima šaru/grain='long'
    const grain = MAT._grainOf(r.material);
    const rot = (grain === 'none'); // PB: može, MDF sa šarom: ne

    return {
      material: r.material,
      th: Number(r.th)||0,
      w: +cutW.toFixed(1),
      h: +cutH.toFixed(1),
      qty: Number(r.qty)||0,
      rot,
      // servisna polja (nisu obavezna u CSV):
      part: r.part,
      sourceEdge: r.edge,
      itemId: r.itemId || "",
      notes: r.notes || ""
    };
  }

  // Krojna lista iz BOM-a (filtrira neupotrebljive, primenjuje trake, grupiše)
  App.BOM.toCuttingList = function(rows, cfg){
    const safe = (Array.isArray(rows)? rows: []).filter(r =>
      r && r.material && (r.w>0) && (r.h>0) && (r.qty>0)
    );

    const cutRows = safe.map(r => toCutRow(r, cfg));

    // Grupisanje po (material|th|w|h|rot)
    const map = new Map();
    for(const r of cutRows){
      const key = [r.material, r.th, r.w, r.h, r.rot?'R':'N'].join('|');
      const prev = map.get(key);
      if (prev) prev.qty += r.qty;
      else map.set(key, {...r});
    }

    // sortiraj (materijal → th → h (duža) → w)
    return Array.from(map.values()).sort((a,b)=>{
      if(a.material!==b.material) return a.material.localeCompare(b.material);
      if(a.th!==b.th) return a.th-b.th;
      if(Math.max(a.w,a.h)!==Math.max(b.w,b.h)) return Math.max(b.w,b.h)-Math.max(a.w,a.h);
      return Math.min(b.w,b.h)-Math.min(a.w,a.h);
    });
  };

  // CSV krojne liste
  // Kolone: material,th,w,h,qty,rot
  App.BOM.toCuttingCSV = function(cutRows){
    const safe = Array.isArray(cutRows) ? cutRows : [];
    if (!safe.length) return "";

    const cols = ["material","th","w","h","qty","rot"];
    const esc = v => `"${String(v).replace(/"/g,'""')}"`;
    const header = cols.join(',');
    const lines = safe.map(r=>cols.map(c=>{
      let v = r[c];
      if (c==="rot") v = r.rot ? "yes" : "no";
      return esc(v ?? "");
    }).join(','));
    return [header, ...lines].join('\n');
  };

  // Render krojne liste u #cutting (opciono)
  App.BOM.renderCutting = function(cutRows){
    const el = $q("#cutting");
    if (!el) return;
    const safe = Array.isArray(cutRows) ? cutRows : [];
    el.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <thead>
            <tr style="background: var(--panel); border-bottom:2px solid var(--line);">
              <th style="padding:8px; text-align:left;">Material</th>
              <th style="padding:8px; text-align:right;">TH</th>
              <th style="padding:8px; text-align:right;">W</th>
              <th style="padding:8px; text-align:right;">H</th>
              <th style="padding:8px; text-align:right;">Qty</th>
              <th style="padding:8px; text-align:left;">Rot</th>
            </tr>
          </thead>
          <tbody>
            ${safe.map(r=>`
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:6px 8px;">${r.material}</td>
                <td style="padding:6px 8px; text-align:right;">${r.th}</td>
                <td style="padding:6px 8px; text-align:right;">${r.w}</td>
                <td style="padding:6px 8px; text-align:right;">${r.h}</td>
                <td style="padding:6px 8px; text-align:right;">${r.qty}</td>
                <td style="padding:6px 8px;">${r.rot ? "yes" : "no"}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  // Popuna CSV preview textarea (#cutCSV)
  App.BOM.renderCuttingCSVPreview = function(cutRows){
    const ta = $q("#cutCSV");
    if (!ta) return;
    const csv = App.BOM.toCuttingCSV(Array.isArray(cutRows) ? cutRows : []);
    ta.value = csv;
  };

})();
