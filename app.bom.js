/* HSPLIT v1 — app.bom.js
 * 3xMeri — BOM + CSV + Rendering
 * Changelog:
 * - robustni fallbackovi kad nema sol/fronts
 * - normalizacija dimenzija (zaokruživanja i min/max)
 * - centralizovani materijali/ivice
 * - zaštita od negativnih dimenzija kod fioka
 * - agregatni BOM + CSV + render tabele + CSV preview
 */

(function(){
  const $q = s => document.querySelector(s);

  // ensure namespace
  window.App = window.App || {};
  App.BOM = App.BOM || {};

  // ---- Konstante materijala / ivica (po potrebi kasnije čitaj iz cfg) ----
  const MAT = {
    FRONT: "MDF_Lak",
    CARCASS: "PB18_White",
    DRAWER_BOTTOM: "HDF3"
  };
  const EDGE = {
    FRONT: "2L+2S",
    CARCASS_SIDE: "2L",
    CARCASS_PLATE: "2S",
  };

  // Mali pomoćnici
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mm = v => Math.round(Number(v)||0);

  // Glavni BOM za jedan element
  App.BOM.bomForItem = function(cfg, it, sol){
    const K = cfg?.Kitchen || cfg?.kitchen || {};
    const WDEF = K.Defaults || {};
    const WDEF_WALL = K?.Wall?.Defaults || {};

    // Tip elementa
    const type = (it?.type || '');
    const isWall = type.startsWith('wall_');

    // Ako nema rešenja, napravi minimalni skeleton da se ne ruši
    sol = sol || {};
    sol.fronts = Array.isArray(sol.fronts) ? sol.fronts : [];

    const out = [];

    // ---- FRONTOVI ----
    // širina fronta: širina korpusa - 4 mm (po tvojoj postojećoj računici)
    const wf = mm((it?.width ?? 600) - 4);
    const thFront = 18;

    sol.fronts.forEach((h,i)=>{
      const fh = mm(h);
      if (fh > 0 && wf > 0) {
        out.push({
          itemId: it.id,
          part: `FRONT-${i+1}`,
          qty: 1,
          w: wf,
          h: fh,
          th: thFront,
          edge: EDGE.FRONT,
          material: MAT.FRONT,
          notes: ""
        });
      }
    });

    // ---- KORPUS ----
    const t = Number(WDEF.SideThickness ?? 18) || 18;
    const d = mm( isWall
      ? (it?.depth ?? WDEF_WALL.CarcassDepth ?? 320)
      : (it?.depth ?? WDEF.CarcassDepth ?? 560)
    );
    const H = mm(sol.H_carcass ?? (it?.height ?? 720));
    const netW = mm((it?.width ?? 600) - 2*t);

    if (d > 0 && H > 0) {
      out.push({ itemId: it.id, part: isWall?"BOK-L-W":"BOK-L", qty:1, w:d, h:H, th:t, edge:EDGE.CARCASS_SIDE, material:MAT.CARCASS, notes:"korpus" });
      out.push({ itemId: it.id, part: isWall?"BOK-R-W":"BOK-R", qty:1, w:d, h:H, th:t, edge:EDGE.CARCASS_SIDE, material:MAT.CARCASS, notes:"korpus" });
    }
    if (netW > 0 && d > 0) {
      out.push({ itemId: it.id, part: isWall?"DNO-W":"DNO", qty:1, w:netW, h:d, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" });
      out.push({ itemId: it.id, part: isWall?"TOP-W":"TOP", qty:1, w:netW, h:d, th:t, edge:EDGE.CARCASS_PLATE, material:MAT.CARCASS, notes:"korpus" });
    }

    // ---- FIJOKE (kada postoje) ----
    const hasDrawers = (
      type === 'drawer_3' || type === 'drawer_2' ||
      type === 'combo_drawer_door' || type === 'oven_housing'
    );

    if (hasDrawers) {
      const Dstd = Math.min( Number(K?.Drawer?.DepthStd ?? 500), Number(d) || 0 );
      const slide = Number(K?.Drawer?.SlideAllowance ?? 26);
      const tD = t;

      // unutrašnje širine
      const Wclear_raw = (it?.width ?? 600) - slide - 2*t;
      const Wrail_raw  = Wclear_raw - 2*tD;

      // obezbedi da nisu negativne
      const Wclear = mm(clamp(Wclear_raw, 80, 2000));
      const Wrail  = mm(clamp(Wrail_raw,  40, 2000));

      let drawerFrontHeights = [];
      if (type === 'drawer_3') drawerFrontHeights = sol.fronts.slice(0,3);
      else if (type === 'drawer_2') drawerFrontHeights = sol.fronts.slice(0,2);
      else if (type === 'combo_drawer_door') drawerFrontHeights = sol.fronts.slice(0,1);
      else if (type === 'oven_housing') drawerFrontHeights = [ (sol.fronts[1]||0) ];

      drawerFrontHeights.forEach((fh, idx)=>{
        const frontH = mm(fh);
        if (frontH <= 0) return;

        const sideH = mm(Math.max(90, frontH - 40)); // minimalna visina stranice 90
        if (Dstd > 0 && sideH > 0) {
          out.push({ itemId: it.id, part:`DF-BOK-L-${idx+1}`,   qty:1, w:Dstd,   h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" });
          out.push({ itemId: it.id, part:`DF-BOK-R-${idx+1}`,   qty:1, w:Dstd,   h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" });
          out.push({ itemId: it.id, part:`DF-LEDJA-${idx+1}`,   qty:1, w:Wrail,  h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" });
          out.push({ itemId: it.id, part:`DF-PREDNJA-${idx+1}`, qty:1, w:Wrail,  h:sideH, th:tD, edge:"", material:MAT.CARCASS, notes:"fioka" });
          out.push({ itemId: it.id, part:`DF-DNO-${idx+1}`,     qty:1, w:Wclear, h:Dstd,  th:3,  edge:"", material:MAT.DRAWER_BOTTOM, notes:"fioka" });
        }
      });
    }

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
    
    // Add a container with scrolling support
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
            ${rows.map(r => `
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
