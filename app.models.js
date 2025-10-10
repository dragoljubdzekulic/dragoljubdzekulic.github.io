
/* app.models.js
 * 3xMeri — Centralni registar parametarskih modela i njihove solve funkcije.
 * Učitaj POSLE app.core.js, a PRE app.ui.js
 */
(function () {
  window.App = window.App || {};
  App.Models = App.Models || {};

  // ----- Pomoćni utili -----
  const num = (v, d=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mm = v => num(v);

  // Globalni parametri računanja iz ključa (k)
  function getHCarcass(k, it) {
    // Ako je zidni element, koristi k.Wall.H_carcass ako postoji
    if ((it.type||'').startsWith('wall_')) {
      if (k && k.Wall && k.Wall.H_carcass != null) return mm(k.Wall.H_carcass);
      // fallback na 720 za zidne
      return 720;
    }
    // Donji: H_total - sokla - radna ploča
    const H_total = mm(k?.H_total, 900);
    const H_plinth = mm(k?.H_plinth, 100);
    const T_top = mm(k?.T_top, 38);
    return Math.max(0, H_total - H_plinth - T_top);
  }

  function distributeFronts(H, patternHeights, gap) {
    // Saberi preporučene visine; poslednji front koriguj tako da staje u H - gaps
    const gapsCount = Math.max(0, patternHeights.length - 1);
    const gapsSum = gapsCount * gap;
    let remain = H - gapsSum;
    const fronts = [];
    for (let i = 0; i < patternHeights.length; i++) {
      const h = i === patternHeights.length - 1
        ? Math.max(0, remain - fronts.reduce((a,b)=>a+b,0))
        : Math.max(0, patternHeights[i]);
      fronts.push(h);
    }
    return fronts;
  }

  function parseWidth(it, def=600) {
    // Prihvata it.width ili it.W u mm; fallback na def
    return mm(it?.width ?? it?.W ?? def);
  }

  function ok(res, extra={}) { return Object.assign(res, extra); }

  // ----- REGISTAR -----
  // Svaki model ima: title, defaults, solve(k, it) -> { H_carcass, fronts[], gaps[], notes[], ... }
  const R = App.Models.registry = {

    // 1) Donji ladičar — pattern: "1M2S", "2M1V", "2V", "4M"
    "base_drawer": {
      title: "Donji ladičar",
      defaults: { width: 600, depth: 560, pattern: "1M2S", gap: 2 },
      patternPresets: {
        "1M2S": [180, 140, 140],
        "2M1V": [180, 180, 260],
        "2V":   [260, 260],
        "4M":   [170, 170, 170, 170]
      },
      solve(k, it) {
        const H = getHCarcass(k, it);
        const gap = mm(k?.Gap ?? it?.gap ?? 2);
        const patt = (it?.pattern || "1M2S").toUpperCase();
        const preset = this.patternPresets[patt] || this.patternPresets["1M2S"];
        const fronts = distributeFronts(H, preset, gap);
        return ok({ H_carcass: H, fronts, gaps: Array(Math.max(0, fronts.length-1)).fill(gap), notes: [] }, { width: parseWidth(it) });
      }
    },

    // 2) Ugradna sudomašina — puna
    "base_dishwasher_full": {
      title: "Ugradna sudomašina (puna)",
      defaults: { width: 600, depth: 560, gap: 2, nicheMin: 815, nicheMax: 875 },
      solve(k, it) {
        const H = getHCarcass(k, it);
        const gap = mm(k?.Gap ?? it?.gap ?? 2);
        const notes = [];
        const nMin = mm(it?.nicheMin ?? this.defaults.nicheMin);
        if (H < nMin) notes.push(`Niša (${H}mm) ispod minimuma ${nMin}mm.`);
        // Tipično jedan veliki front
        const fronts = [H];
        return { H_carcass: H, fronts, gaps: [], notes, width: parseWidth(it) };
      }
    },

    // 3) Polu-ugradna sudomašina
    "base_dishwasher_half": {
      title: "Polu-ugr. sudomašina",
      defaults: { width: 600, depth: 560, topFront: 140, gap: 2, nicheMin: 815 },
      solve(k, it) {
        const H = getHCarcass(k, it);
        const gap = mm(k?.Gap ?? it?.gap ?? 2);
        const topFront = mm(it?.topFront ?? this.defaults.topFront);
        const notes = [];
        if (H - topFront - gap <= 0) notes.push("Premalo mesta ispod gornjeg fronta.");
        const fronts = [topFront, Math.max(0, H - topFront - gap)];
        return { H_carcass: H, fronts, gaps: [gap], notes, width: parseWidth(it) };
      }
    },

    // 4) Kućište rerne
    "base_oven_housing": {
      title: "Rerna (kućište)",
      defaults: { width: 600, depth: 560, ovenHeight: 595, topFront: 140, gap: 2 },
      solve(k, it) {
        const H = getHCarcass(k, it);
        const gap = mm(k?.Gap ?? it?.gap ?? 2);
        const ovenH = mm(it?.ovenHeight ?? this.defaults.ovenHeight);
        const top = mm(it?.topFront ?? this.defaults.topFront);
        const remain = Math.max(0, H - top - gap - ovenH);
        const notes = [];
        if (H < ovenH + top + gap) notes.push("Rerna ne staje: proveri visinu niše/karcase.");
        return { H_carcass: H, fronts: [top, remain], gaps: [gap], notes, width: parseWidth(it) };
      }
    },

    // 5) Ugradni mali frižider
    "base_small_fridge": {
      title: "Mali frižider (ugr.)",
      defaults: { width: 600, depth: 560, nicheHeight: 820, gap: 2 },
      solve(k, it) {
        const H = getHCarcass(k, it);
        const gap = mm(k?.Gap ?? it?.gap ?? 2);
        const nH = mm(it?.nicheHeight ?? this.defaults.nicheHeight);
        const notes = [];
        if (H < nH) notes.push(`Niža karcasa (${H}mm) od minimalne niše ${nH}mm.`);
        // Tipično dva fronta (gore manje vrata, dole veća)
        const top = clamp(Math.round(H*0.35), 120, 220);
        const bottom = Math.max(0, H - top - gap);
        return { H_carcass: H, fronts: [top, bottom], gaps: [gap], notes, width: parseWidth(it) };
      }
    },

    // 6) Zidni jednokrilni (H varianta)
    "wall_single": {
      title: "Gornji jednokrilni",
      defaults: { H: 720, width: 600, depth: 320, glass: false, gap: 2 },
      solve(k, it) {
        const H = mm(it?.H ?? this.defaults.H);
        const gap = mm(k?.Gap ?? it?.gap ?? 2);
        // Jedna front ploča jednake visine H
        return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: parseWidth(it) };
      }
    },

    // 7) Zidni dvokrilni (H=720)
    "wall_double": {
      title: "Gornji dvokrilni",
      defaults: { H: 720, width: 800, depth: 320, glass: false, gap: 2 },
      solve(k, it) {
        const H = mm(it?.H ?? this.defaults.H);
        const W = parseWidth(it);
        const shelvesCount = mm(it?.shelvesCount ?? this.defaults.shelvesCount);
        const shelves = computeShelves(H, shelvesCount, 0, 0);
        return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: W, doors: 2, shelves, shelf_thickness: mm(it?.shelf_thickness ?? this.defaults.shelf_thickness) };
    
      }
    },

    // 8) Otvorena polica
    "wall_open_shelf": {
      title: "Otvorena polica",
      defaults: { H: 360, width: 600, depth: 300 },
      solve(k, it) {
        const H = mm(it?.H ?? this.defaults.H);
        return { H_carcass: H, fronts: [], gaps: [], notes: [], width: parseWidth(it) };
      }
    },

    // 9) Ugaoni zidni
    "wall_corner": {
      title: "Gornji ugaoni",
      defaults: { H: 720, width: 600, depth: 600 },
      solve(k, it) {
        const H = mm(it?.H ?? this.defaults.H);
        return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: parseWidth(it) };
      }
    },

    // 10) Aspirator klasik (ormarić 60)
    "wall_hood_classic": {
      title: "Aspirator — klasični",
      defaults: { H: 600, width: 600, depth: 320 },
      solve(k, it) {
        const H = mm(it?.H ?? this.defaults.H);
        return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: parseWidth(it) };
      }
    },

    // 11) Aspirator ugradni (H≈680)
    "wall_hood_built_in": {
      title: "Aspirator — ugradni",
      defaults: { H: 680, width: 600, depth: 320 },
      solve(k, it) {
        const H = mm(it?.H ?? this.defaults.H);
        return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: parseWidth(it) };
      }
    },

    // 12) Visoki dodatak (72), jedno/dvokrilni
    "tall_addon": {
      title: "Visoki dodatak 72",
      defaults: { H: 720, width: 600, doors: "single" },
      solve(k, it) {
        const H = mm(it?.H ?? this.defaults.H);
        return { H_carcass: H, fronts: [H], gaps: [], notes: [], width: parseWidth(it) };
      }
    }
  };

  // ----- UI meta za katalog (opciono) -----
  App.Models.catalog = [
    { type: "base_drawer", variants: ["1M2S","2M1V","2V","4M"] },
    { type: "base_dishwasher_full" },
    { type: "base_dishwasher_half" },
    { type: "base_oven_housing" },
    { type: "base_small_fridge" },
    { type: "wall_single", opts: [{H:360},{H:720}] },
    { type: "wall_double", opts: [{H:720}] },
    { type: "wall_open_shelf", opts: [{H:360},{H:720}] },
    { type: "wall_corner", opts: [{H:720}] },
    { type: "wall_hood_classic" },
    { type: "wall_hood_built_in", opts: [{H:680}] },
    { type: "tall_addon", opts: [{H:720, doors:"single"}, {H:720, doors:"double"}] }
  ];

})();
