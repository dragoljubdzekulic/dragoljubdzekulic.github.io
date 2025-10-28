/* HSPLIT v2.1 — app.bom.js
 * 3xMeri — BOM + CSV + Rendering
 * Changelog (v2.1):
 * - BOM sada poštuje solve: donji elementi imaju dve vezne ploče umesto TOP
 * - Police se generišu iz sol.shelves (+ shelf_thickness)
 * - Ako nema sol, uzima se iz App.Core.solveItem(cfg, it)
 * - Integracija sa App.Models: koristi model.bom(it, sol, cfg) kad postoji
 */

(function(){
  const $q = s => document.querySelector(s);

  // ensure namespace
  window.App = window.App || {};
  App.BOM = App.BOM || {};

  // ---- Materijali / ivice (mogu se prepisati iz cfg.Materials / cfg.Edges) ----
  function getMaterials(cfg){
    const m = cfg?.Materials || {};
    return {
      FRONT:         m.FRONT         || "MDF_Lak",
      CARCASS:       m.CARCASS       || "PB18_White",
      DRAWER_BOTTOM: m.DRAWER_BOTTOM || "HDF3"
    };
  }
  function getEdges(cfg){
    const e = cfg?.Edges || {};
    return {
      FRONT:         e.FRONT         || "2L+2S",
      CARCASS_SIDE:  e.CARCASS_SIDE  || "2L",
      CARCASS_PLATE: e.CARCASS_PLATE || "2S"
    };
  }

  // Mali pomoćnici
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
      // zidni → TOP-W kao i do sada
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
    const shelfTh = mm(sol.shelf_thickness ?? it?.shelf_thickness ?? 18);
    if (shelfCount > 0 && netW > 0 && d > 0) {
      for (let i = 0; i < shelfCount; i++) {
        out.push(normalizeRow({
          itemId: it.id,
          part: isWall ? `POLICA-W-${i+1}` : `POLICA-${i+1}`,
          qty: 1,
          w: netW,
          h: d,
          th: shelfTh,
          edge: EDGE.CARCASS_PLATE,
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

  // Render u tabelu
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

})();
