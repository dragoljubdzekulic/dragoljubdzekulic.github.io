
/* app.models.hook.js
 * „Lepak” koji povezuje App.Models sa postojećim App.Core i (po želji) UI-jem.
 * Učitaj POSLE app.models.js, POSLE app.core.js, a PRE app.ui.js
 */
(function () {
  window.App = window.App || {};
  const Models = App.Models?.registry || {};
  if (!App.Core) return;

  // 1) Proširi TEMPLATES iz registra (bez brisanja postojećih)
  App.Core.TEMPLATES = App.Core.TEMPLATES || {};
  Object.keys(Models).forEach(type => {
    if (!App.Core.TEMPLATES[type]) {
      const defaults = Models[type].defaults || {};
      App.Core.TEMPLATES[type] = function () {
        const id = (App.Core.nextId ? App.Core.nextId() : Math.random().toString(36).slice(2));
        return Object.assign({ id, type }, defaults);
      };
    }
  });

  // 2) Hook za solveItem — prvo probaj registar, pa fallback na original
  const originalSolve = App.Core.solveItem ? App.Core.solveItem.bind(App.Core) : null;
  App.Core.solveItem = function (k, it) {
    try {
      const m = Models[it?.type];
      if (m && typeof m.solve === 'function') {
        const res = m.solve(k, it);
        // Normalizuj polja koja BOM/UI očekuju
        res.type = it.type;
        res.width = res.width ?? (it?.width || it?.W);
        return res;
      }
    } catch (e) {
      console.warn("Models.solve error for", it?.type, e);
    }
    // Fallback na postojeći switch
    if (originalSolve) return originalSolve(k, it);
    // Ako ni original ne postoji, vrati minimalni odgovor
    return { H_carcass: 0, fronts: [], gaps: [], notes: ["Nema solve funkcije."] };
  };

  // 3) (Opciono) Dinamički katalog dugmadi — samo ako postoji App.UI && App.UI.addTemplateButton
  if (App.UI && typeof App.UI.addTemplateButton === 'function') {
    try {
      const cat = App.Models.catalog || [];
      cat.forEach(entry => {
        const type = entry.type;
        const title = Models[type]?.title || type;
        App.UI.addTemplateButton(type, title, Models[type]?.defaults || {});
      });
    } catch (e) {
      console.warn("Catalog UI hookup failed:", e);
    }
  }
})();
