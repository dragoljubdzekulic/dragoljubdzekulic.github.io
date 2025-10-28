/* app.models.js
 * 3xMeri — Centralni registar parametarskih modela i njihove solve funkcije.
 * Učitaj POSLE app.core.js, a PRE app.ui.js
 */
(function () {
  window.App = window.App || {};
  App.Models = App.Models || {};

  /* =====================
   * Centralni registar
   * ===================== */
  const _map = new Map();

  App.Models.register = function(id, def){
    if(!id) throw new Error("Model id required");
    _map.set(id, def);
    return def;
  };
  App.Models.get  = id => _map.get(id);
  App.Models.list = () => Array.from(_map.keys());

  /* =====================
   * Pomoćni utili
   * ===================== */
  const num   = (v, d=0) => Number.isFinite(+v) ? +v : d;
  const mm    = v => num(v);
  const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

  // Dubina korpusa po podrazumevanim vrednostima kuhinje
  function defaultDepth(it){
    const cfg = (App.State?.get?.() || {});
    const K   = (cfg.Kitchen || cfg.kitchen || {});
    const isWall = String(it.type||'').toLowerCase().startsWith('wall_');
    return isWall ? (it.depth ?? K.Wall?.Defaults?.CarcassDepth ?? 320)
                  : (it.depth ?? K.Defaults?.CarcassDepth     ?? 560);
  }

  // Visina korpusa zavisno od tipa (zidni vs donji)
  function getHCarcass(k, it){
    if (String(it.type||'').toLowerCase().startsWith('wall_')) {
      if (k && k.Wall && k.Wall.H_carcass != null) return mm(k.Wall.H_carcass);
      return 720; // fallback za zidne
    }
    const H_total  = mm(k?.H_total, 900);
    const H_plinth = mm(k?.H_plinth, 100);
    const T_top    = mm(k?.T_top, 38);
    return Math.max(0, H_total - H_plinth - T_top);
  }

  // Izračun pozicija polica po visini (nije broj polica, već koordinate)
  function computeShelves(H, count = 2, topGap = 0, bottomGap = 0) {
    const usable  = Math.max(0, H - topGap - bottomGap);
    if (count <= 0 || usable <= 0) return [];
    const spacing = usable / (count + 1);
    const shelves = [];
    for (let i = 1; i <= count; i++) shelves.push(Math.round(bottomGap + spacing * i));
    return shelves;
  }

  // Raspodela frontova po obrascu, poslednji front upija ostatak
  function distributeFronts(H, patternHeights, gap) {
    const gapsCount = Math.max(0, patternHeights.length - 1);
    const gapsSum   = gapsCount * gap;
    let remain      = H - gapsSum;
    const fronts    = [];
    for (let i = 0; i < patternHeights.length; i++) {
      const h = (i === patternHeights.length - 1)
        ? Math.max(0, remain - fronts.reduce((a,b)=>a+b,0))
        : Math.max(0, patternHeights[i]);
      fronts.push(h);
    }
    return fronts;
  }

  // Jedini izvor istine za police (dimenzije + visine)
  function computeShelfPack(it, H, isWall){
    const cfg         = (App.State?.get?.() || {});
    const K           = (cfg.Kitchen || cfg.kitchen || {});
    const WDEF_BASE   = (K.Defaults || {});
    const WDEF_WALL   = (K.Wall && K.Wall.Defaults) || {};
    const sideT       = Number(WDEF_BASE.SideThickness ?? 18);
    const backInset   = Number(cfg.Shelves?.BackInset ?? 10);
    const thickness   = Number(cfg.Shelves?.Thickness ?? 18);

    const Wmm = Number(it?.width ?? (isWall ? 600 : 600));
    const Dmm = isWall
      ? Number(it?.depth ?? WDEF_WALL.CarcassDepth ?? 320)
      : Number(it?.depth ?? WDEF_BASE.CarcassDepth ?? 560);

    const shelfW = Math.max(0, Math.round(Wmm - 2*sideT));   // W - 2*18
    const shelfD = Math.max(0, Math.round(Dmm - backInset)); // D - 10

    // default: 1 polica u donjim (sa vratima), 2 u visećim
    let count = isWall ? 2 : 1;
    if (Number.isFinite(it?.shelvesCount)) count = Math.max(0, it.shelvesCount|0);

    // eksplicitne visine (ako su zadate u item-u)
    let heights = Array.isArray(it?.shelves) ? it.shelves.slice() : null;
    if (!heights && count>0){
      heights = computeShelves(H, count, 0, 0);
    }

    return {
      shelves: heights || [],
      shelfSpec: {
        width: shelfW,
        depth: shelfD,
        thickness: Math.round(thickness),
        material: (cfg.Materials?.SHELF) || (cfg.Materials?.CARCASS) || "PB18_White",
        edge: (cfg.Edges?.SHELF) || "2L+2S"
      }
    };
  }

  const ok = (res, extra={}) => Object.assign(res, extra);

  /* =====================
   * REGISTAR MODELA
   * ===================== */

  // 1) Donji ladičar — BEZ polica
  App.Models.register("base_drawer", {
    title: "Donji ladičar",
    defaults: { width: 600, depth: 560, pattern: "1M2S", gap: 2 },
    patternPresets: {
      "1M2S": [180, 140, 140],
      "2M1V": [180, 180, 260],
      "2V":   [260, 260],
      "4M":   [170, 170, 170, 170]
    },
    solve(k, it) {
      const H     = getHCarcass(k, it);
      const gap   = mm(k?.Gap ?? it?.gap ?? this.defaults.gap ?? 2);
      const patt  = (it?.pattern || this.defaults.pattern).toUpperCase();
      const preset= this.patternPresets[patt] || this.patternPresets["1M2S"];
      const fronts = distributeFronts(H, preset, gap);
      return ok(
        { H_carcass: H, fronts, gaps: Array(Math.max(0, fronts.length-1)).fill(gap), notes: [] },
        { width: it?.width ?? 600, depth: defaultDepth(it) }
      );
    }
  });

  // 2) Ugradna sudomašina — BEZ polica
  App.Models.register("base_dishwasher_full", {
    title: "Ugradna sudomašina (puna)",
    defaults: { width: 600, depth: 560, gap: 2, nicheMin: 815, nicheMax: 875 },
    solve(k, it) {
      const H   = getHCarcass(k, it);
      const nMin= mm(it?.nicheMin ?? this.defaults.nicheMin);
      const notes = [];
      if (H < nMin) notes.push(`Niša (${H}mm) ispod minimuma ${nMin}mm.`);
      const fronts = [H];
      return { H_carcass: H, fronts, gaps: [], notes, width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 3) Polu-ugradna sudomašina — BEZ polica
  App.Models.register("base_dishwasher_half", {
    title: "Polu-ugr. sudomašina",
    defaults: { width: 600, depth: 560, topFront: 140, gap: 2, nicheMin: 815 },
    solve(k, it) {
      const H    = getHCarcass(k, it);
      const gap  = mm(k?.Gap ?? it?.gap ?? this.defaults.gap);
      const top  = mm(it?.topFront ?? this.defaults.topFront);
      const notes= [];
      if (H - top - gap <= 0) notes.push("Premalo mesta ispod gornjeg fronta.");
      const fronts = [top, Math.max(0, H - top - gap)];
      return { H_carcass: H, fronts, gaps: [gap], notes, width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 4) Kućište rerne — BEZ polica
  App.Models.register("base_oven_housing", {
    title: "Rerna (kućište)",
    defaults: { width: 600, depth: 560, ovenHeight: 595, topFront: 140, gap: 2 },
    solve(k, it) {
      const H     = getHCarcass(k, it);
      const gap   = mm(k?.Gap ?? it?.gap ?? this.defaults.gap);
      const ovenH = mm(it?.ovenHeight ?? this.defaults.ovenHeight);
      const top   = mm(it?.topFront   ?? this.defaults.topFront);
      const remain= Math.max(0, H - top - gap - ovenH);
      const notes = [];
      if (H < ovenH + top + gap) notes.push("Rerna ne staje: proveri visinu niše/karcase.");
      return { H_carcass: H, fronts: [top, remain], gaps: [gap], notes, width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 5) Ugradni mali frižider — BEZ polica
  App.Models.register("base_small_fridge", {
    title: "Mali frižider (ugr.)",
    defaults: { width: 600, depth: 560, nicheHeight: 820, gap: 2 },
    solve(k, it) {
      const H  = getHCarcass(k, it);
      const gap= mm(k?.Gap ?? it?.gap ?? this.defaults.gap);
      const nH = mm(it?.nicheHeight ?? this.defaults.nicheHeight);
      const notes = [];
      if (H < nH) notes.push(`Niža karcasa (${H}mm) od minimalne niše ${nH}mm.`);
      const top    = clamp(Math.round(H*0.35), 120, 220);
      const bottom = Math.max(0, H - top - gap);
      return { H_carcass: H, fronts: [top, bottom], gaps: [gap], notes, width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 6) Zidni jednokrilni (bez default polica)
  App.Models.register("wall_single", {
    title: "Gornji jednokrilni",
    defaults: { H: 720, width: 600, depth: 320, glass: false, gap: 2 },
    solve(k, it) {
      const H = mm(it?.H ?? this.defaults.H);
      return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 7) Zidni dvokrilni — SA policama (izvor istine)
  App.Models.register("wall_double", {
    title: "Gornji dvokrilni",
    defaults: { H: 720, width: 800, depth: 320, glass: false, gap: 2, shelvesCount: 2, shelf_thickness: 18 },
    solve(k, it) {
      const H = mm(it?.H ?? this.defaults.H);
      const W = it?.width ?? this.defaults.width;
      // iz modela: standardizovan izlaz
      const pack = computeShelfPack({ ...it, width: W }, H, true);
      // poštuj eksplicitnu debljinu ako je zadato na item-u
      if (Number.isFinite(it?.shelf_thickness)) {
        pack.shelfSpec.thickness = Math.round(it.shelf_thickness);
      }
      return {
        H_carcass: H,
        fronts: [H],
        gaps: [],
        notes: [],
        width: W,
        depth: defaultDepth(it),
        doors: 2,
        shelves: pack.shelves,
        shelfSpec: pack.shelfSpec
      };
    }
  });

  // 8) Otvorena polica (zidna)
  App.Models.register("wall_open_shelf", {
    title: "Otvorena polica",
    defaults: { H: 360, width: 600, depth: 300 },
    solve(k, it) {
      const H = mm(it?.H ?? this.defaults.H);
      return { H_carcass: H, fronts: [], gaps: [], notes: [], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 9) Ugaoni zidni
  App.Models.register("wall_corner", {
    title: "Gornji ugaoni",
    defaults: { H: 720, width: 600, depth: 600 },
    solve(k, it) {
      const H = mm(it?.H ?? this.defaults.H);
      return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 10) Aspirator klasik
  App.Models.register("wall_hood_classic", {
    title: "Aspirator — klasični",
    defaults: { H: 600, width: 600, depth: 320 },
    solve(k, it) {
      const H = mm(it?.H ?? this.defaults.H);
      return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 11) Aspirator ugradni
  App.Models.register("wall_hood_built_in", {
    title: "Aspirator — ugradni",
    defaults: { H: 680, width: 600, depth: 320 },
    solve(k, it) {
      const H = mm(it?.H ?? this.defaults.H);
      return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 12) Visoki dodatak (72), jedno/dvokrilni
  App.Models.register("tall_addon", {
    title: "Visoki dodatak 72",
    defaults: { H: 720, width: 600, doors: "single" },
    solve(k, it) {
      const H = mm(it?.H ?? this.defaults.H);
      return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // 13) Prazan donji korpus (bez frontova)
  App.Models.register("base_empty_carcass", {
    title: "Prazan korpus element",
    defaults: { width: 600, depth: 560, topConnectorDepth: 80 },
    solve(k, it) {
      const H = getHCarcass(k, it);
      return {
        H_carcass: H,
        fronts: [],
        gaps: [],
        notes: [],
        width: it?.width ?? 600,
        depth: defaultDepth(it),
        hasBackPanel: true,
        hasTopConnectors: true,
        topConnectorDepth: mm(it?.topConnectorDepth ?? this.defaults.topConnectorDepth)
      };
    }
  });

  // 14) Totem – visoki element za rernu ili frižider (bez generičnih polica)
  App.Models.register("tall_totem", {
    title: "Totem (rurna / frižider)",
    defaults: { width: 600, depth: 560, variant: "fridge", gap: 2 },
    solve(k, it) {
      const K = k?.Kitchen || k;
      const wallTop = (K?.Wall?.Bottom ?? 1450) + (K?.Wall?.H_carcass ?? 720);
      const H = wallTop; // ukupna visina do vrha visećih
      const gap = mm(k?.Gap ?? it?.gap ?? this.defaults.gap);
      const variant = String(it?.variant || this.defaults.variant).toLowerCase();
      let fronts;
      if (variant === "fridge") {
        const bottom = 1220, top = Math.max(0, H - bottom - gap);
        fronts = [bottom, top];
      } else {
        const ovenH = 595, topFront = 350, bottomFront = 180;
        const remain = Math.max(0, H - (ovenH + topFront + bottomFront + gap * 2));
        fronts = [bottomFront, ovenH, remain + topFront];
      }
      return { H_carcass: H, fronts, gaps: Array(Math.max(0, fronts.length - 1)).fill(gap), notes: [], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  /* ==========================================================
   * Alias modeli — kompatibilnost sa starim tipovima iz Core-a
   * ========================================================== */

  // base_1door → donji jednokrilni SA policama
  App.Models.register("base_1door", {
    title: "Donji jednokrilni",
    defaults: { width: 600, depth: 560, shelvesCount: 1 },
    solve(k, it){
      const H = getHCarcass(k, it);
      const pack = computeShelfPack(it, H, /*isWall*/false);
      return {
        H_carcass:H,
        fronts:[H],
        gaps:[],
        notes:[],
        width: it?.width ?? 600,
        depth: defaultDepth(it),
        shelves: pack.shelves,
        shelfSpec: pack.shelfSpec
      };
    }
  });
  // sink_1door (alias): ako želiš da sudopera NEMA police, javi pa ću override-ovati shelvesCount=0.
  App.Models.register("sink_1door", App.Models.get("base_1door"));

  // base_2door → donji dvokrilni SA policama
  App.Models.register("base_2door", {
    title: "Donji dvokrilni",
    defaults: { width: 800, depth: 560, shelvesCount: 1 },
    solve(k, it){
      const H = getHCarcass(k, it);
      const pack = computeShelfPack({ ...it, width: (it?.width ?? 800) }, H, /*isWall*/false);
      return {
        H_carcass:H,
        fronts:[H],
        gaps:[],
        notes:[],
        width: it?.width ?? 800,
        depth: defaultDepth(it),
        doors:2,
        shelves: pack.shelves,
        shelfSpec: pack.shelfSpec
      };
    }
  });

  // drawer_3 / drawer_2 — BEZ polica (kompatibilno sa starom logikom FIRST/gap)
  App.Models.register("drawer_3", {
    title: "Ladičar (3 fioke)",
    defaults: { width: 600, depth: 560, second: 200 },
    solve(k, it){
      const H     = getHCarcass(k, it);
      const gap   = mm(k?.Gap ?? 2);
      const FIRST = mm(k?.DatumFirstDrawer ?? 170);
      const second= (it.drawerHeights && it.drawerHeights[1]!=null) ? mm(it.drawerHeights[1]) : this.defaults.second;
      let third   = H - FIRST - second - 2*gap;
      const notes = [];
      if(third<0){ notes.push('Treća fioka < 0 — proveri ulaz'); third=0; }
      return { H_carcass:H, fronts:[FIRST, second, third], gaps:[gap, gap], notes, width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  App.Models.register("drawer_2", {
    title: "Ladičar (2 fioke)",
    defaults: { width: 600, depth: 560 },
    solve(k, it){
      const H     = getHCarcass(k, it);
      const gap   = mm(k?.Gap ?? 2);
      const FIRST = mm(k?.DatumFirstDrawer ?? 170);
      const f2    = Math.max(0, H - FIRST - gap);
      return { H_carcass:H, fronts:[FIRST, f2], gaps:[gap], notes:[], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // combo_drawer_door — BEZ polica
  App.Models.register("combo_drawer_door", {
    title: "Fioka + Vrata",
    defaults: { width: 600, depth: 560 },
    solve(k, it){
      const H     = getHCarcass(k, it);
      const gap   = mm(k?.Gap ?? 2);
      const FIRST = mm(k?.DatumFirstDrawer ?? 170);
      const f2    = Math.max(0, H - FIRST - gap);
      return { H_carcass:H, fronts:[FIRST, f2], gaps:[gap], notes:[], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  // dishwasher_60 → puna sudomašina (alias)
  App.Models.register("dishwasher_60", App.Models.get("base_dishwasher_full"));

  // oven_housing → istoimeni
  App.Models.register("oven_housing", App.Models.get("base_oven_housing"));

  // wall_1door i wall_open (bez frontova)
  App.Models.register("wall_1door", App.Models.get("wall_single"));
  App.Models.register("wall_open", {
    title: "Zidni otvoreni (bez frontova)",
    defaults: { H: 360, width: 600, depth: 300 },
    solve(k, it){
      const H = mm(it?.H ?? this.defaults.H);
      return { H_carcass:H, fronts:[], gaps:[], notes:[], width: it?.width ?? 600, depth: defaultDepth(it) };
    }
  });

  /* =========================
   * UI meta za katalog (opciono)
   * ========================= */
  App.Models.catalog = [
    { type: "base_drawer", variants: ["1M2S","2M1V","2V","4M"] },
    { type: "base_dishwasher_full" },
    { type: "base_dishwasher_half" },
    { type: "base_oven_housing" },
    { type: "base_small_fridge" },
    { type: "base_empty_carcass" },
    { type: "wall_single",     opts: [{H:360},{H:720}] },
    { type: "wall_double",     opts: [{H:720}] },
    { type: "wall_open_shelf", opts: [{H:360},{H:720}] },
    { type: "wall_corner",     opts: [{H:720}] },
    { type: "wall_hood_classic" },
    { type: "wall_hood_built_in", opts: [{H:680}] },
    { type: "tall_addon", opts: [{H:720, doors:"single"}, {H:720, doors:"double"}] },
    { type: "tall_totem", opts: [{variant:"fridge"},{variant:"oven"}] }
  ];

})();
