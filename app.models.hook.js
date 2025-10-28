/* app.models.hook.js
 * „Lepak” koji povezuje App.Models sa postojećim App.Core i (po želji) UI-jem.
 * Učitaj POSLE app.models.js, POSLE app.core.js, a PRE app.ui.js
 */
(function () {
  window.App = window.App || {};
  if (!App.Core) return;

  const hasRegistry = !!(App.Models && App.Models.get && App.Models.list);
  const types = hasRegistry ? (App.Models.list() || []) : [];

  // 1) Proširi TEMPLATES iz registra (bez brisanja postojećih)
  App.Core.TEMPLATES = App.Core.TEMPLATES || {};
  types.forEach(type => {
    if (!App.Core.TEMPLATES[type]) {
      const def = App.Models.get(type) || {};
      const defaults = def.defaults || {};
      App.Core.TEMPLATES[type] = function () {
        const id = (typeof App.Core.nextId === 'function')
          ? App.Core.nextId()
          : Math.random().toString(36).slice(2);
        // plitko kopiranje defaults-a da ne delimo referencu
        const base = Object.assign({}, defaults);
        base.id = id;
        base.type = type;
        return base;
      };
    }
  });

  // 2) Hook za solveItem — prvo probaj registar, pa fallback na original
  const originalSolve = (typeof App.Core.solveItem === 'function')
    ? App.Core.solveItem.bind(App.Core)
    : null;

  // --- pomoćne funkcije za augmentaciju ---
  function getTopConnectorDepth(cfg, it, res){
    // prioritet: res -> it -> Kitchen.Defaults.TopConnectorDepth -> 80
    const K = (cfg && (cfg.Kitchen || cfg.kitchen)) || {};
    const DEF = (K.Defaults || {});
    return Number(
      res?.topConnectorDepth ??
      it?.topConnectorDepth ??
      DEF.TopConnectorDepth ??
      80
    );
  }
  function computeShelves(res, it, cfg){
    // pravila:
    // - wall_*  => 2 police (prioritetno)
    // - base_* bez "drawer" u tipu => 1 polica
    // - ostalo: ako nije fiokarnik => 1 polica
    const t = String(it?.type || res?.type || "").toLowerCase();
    const isWall   = t.startsWith("wall_");
    const isBase   = t.startsWith("base_");
    const isDrawer = t.includes("drawer");

    let shelfCount = 0;
    if (isWall) {
      shelfCount = 2;
    } else if (!isDrawer) {
      // za sve ne-fiokarnike
      shelfCount = isBase ? 1 : 1;
    }

    // H_carcass može doći iz res, iz it ili default 720
    const H = Number(res?.H_carcass ?? it?.H ?? 720);
    const shelf_thickness = Number(it?.shelf_thickness ?? res?.shelf_thickness ?? 18);

    if (shelfCount <= 0 || H <= 0) return { shelves: res?.shelves, shelf_thickness: res?.shelf_thickness };

    // ravnomerno rasporedi
    const shelves = [];
    const step = H / (shelfCount + 1);
    for (let i = 1; i <= shelfCount; i++) shelves.push(Math.round(i * step));

    return { shelves, shelf_thickness };
  }

  App.Core.solveItem = function (k, it) {
    let res = null;

    // 2a) pokušaj kroz registar modela
    try {
      if (hasRegistry && it && it.type) {
        const m = App.Models.get(it.type);
        if (m && typeof m.solve === 'function') {
          res = m.solve(k, it) || {};
        }
      }
    } catch (e) {
      console.warn("[models.hook] Models.solve error for", it?.type, e);
    }

    // 2b) fallback na postojeći Core solve
    if (!res) {
      if (originalSolve) res = originalSolve(k, it);
      else res = { type: it?.type, id: it?.id, H_carcass: 0, fronts: [], gaps: [], notes: ["Nema solve funkcije."] };
    }

    // --- Normalizacija očekivanih polja (pre augmentacije) ---
    res = res || {};
    res.type   = it?.type ?? res.type;
    res.id     = res.id ?? it?.id;
    res.width  = res.width ?? (it?.width ?? it?.W);
    res.gaps   = Array.isArray(res.gaps)   ? res.gaps   : [];
    res.fronts = Array.isArray(res.fronts) ? res.fronts : [];
    res.notes  = Array.isArray(res.notes)  ? res.notes  : [];

    // --- AUGMENTACIJA PO TVOM PRAVILU ---
    try {
      const t = String(res.type || "").toLowerCase();
      const isBase   = t.startsWith("base_");
      const isWall   = t.startsWith("wall_");
      const isDrawer = t.includes("drawer");

      // 1) Donji elementi: dve vezne top ploče (forsiramo true)
      if (isBase) {
        res.hasTopConnectors = true;
        res.topConnectorDepth = getTopConnectorDepth(k, it, res); // mm
      }

      // 2) Police: svi ne-fiokarnici imaju 1 policu; svi gornji 2 police (prioritet)
      const shelvesInfo = computeShelves(res, it, k);
      if (Array.isArray(shelvesInfo.shelves) && shelvesInfo.shelves.length > 0) {
        res.shelves = shelvesInfo.shelves;
        res.shelf_thickness = shelvesInfo.shelf_thickness;
      }

      // Ako je model već eksplicitno zadao police i želiš da ih zadržiš,
      // zakomentariši gornji blok i ostavi postojeći res.shelves kako jeste.

    } catch (e) {
      console.warn("[models.hook] augmentacija nije uspela:", e);
    }

    return res;
  };

  // 3) (Opciono) Dinamički katalog dugmadi — samo ako postoji App.UI && App.UI.addTemplateButton
  if (App.UI && typeof App.UI.addTemplateButton === 'function') {
    try {
      const cat = App.Models.catalog || [];
      cat.forEach(entry => {
        const type  = entry.type;
        const def   = hasRegistry ? App.Models.get(type) : null;
        const title = def?.title || type;
        const defaults = def?.defaults || {};
        App.UI.addTemplateButton(type, title, defaults);
      });
    } catch (e) {
      console.warn("[models.hook] Catalog UI hookup failed:", e);
    }
  }

  // (Opciono) izvoz malog helpera za pristup definiciji modela iz drugih modula
  App.Core.getModelDef = function(type){
    return hasRegistry ? App.Models.get(type) : null;
  };
})();
