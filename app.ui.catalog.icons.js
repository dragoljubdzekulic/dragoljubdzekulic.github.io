/* app.ui.catalog.icons.js
 * Ikonice za SVE elemente (core + models registry).
 * Dodaje ikonice u #catalog button[data-type] i radi i za dinamički dodate dugmiće (MutationObserver).
 * Stil: isti vizuelni jezik kao postojeće ikone (svetlosivo telo, tamni outline, svetlije ploče/frontovi).
 */
(function () {
  // Jedinstvena paleta (usklađena sa postojećim ikonama)
  const C = {
    body:   '#cfd6df',
    line:   '#212938',
    shelf:  '#9aa7b8',
    panel:  '#e9eef5',
    dark:   '#b7c2d0'
  };

  // Helper za pravljenje data URI iz SVG stringa
  const S = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

  // Piktogrami po tipu
  const ICONS = {
    // === DONJI ELEMENTI / BAZA ===
    // 3 fioke (koristi i kao generički za base_drawer)
    'drawer_3': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="26" width="40" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="40" width="40" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),
    'base_drawer': 'drawer_3',

    // 2 fioke
    'drawer_2': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="14" width="40" height="14" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="34" width="40" height="14" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Kombinacija fioka + vrata
    'combo_drawer_door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="14" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="28" width="40" height="28" fill="${C.dark}"  stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Jednokrilna baza
    'base_1door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="40" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Sudopera 1D (gornja ploča naznačena)
    'sink_1door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8"  y="8"  width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="10" fill="${C.dark}"  stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="24" width="40" height="28" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Mašine za sudove
    'dishwasher_60': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="8" width="44" height="48" rx="4" ry="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="14" width="36" height="16" rx="2" ry="2" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <circle cx="22" cy="22" r="2.8" fill="${C.shelf}"/><circle cx="30" cy="22" r="2.8" fill="${C.shelf}"/><circle cx="38" cy="22" r="2.8" fill="${C.shelf}"/>
      <rect x="18" y="36" width="28" height="12" rx="2" ry="2" fill="${C.dark}"/>
    </svg>`),
    'base_dishwasher_full': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="8" width="44" height="48" rx="4" ry="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="34" width="36" height="18" rx="2" ry="2" fill="${C.dark}"/>
    </svg>`),
    'base_dishwasher_half': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="8" width="44" height="48" rx="4" ry="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="12" width="36" height="10" rx="2" ry="2" fill="${C.panel}"/>
      <rect x="14" y="26" width="36" height="26" rx="2" ry="2" fill="${C.dark}"/>
    </svg>`),

    // Kućište rerne
    'oven_housing': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8"  y="8"  width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="16" width="36" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="14" y="30" width="36" height="20" fill="${C.dark}"  stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),
    'base_oven_housing': 'oven_housing',

    // Ugradni mali frižider
    'base_small_fridge': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="14" width="36" height="16" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="14" y="34" width="36" height="18" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <line x1="14" y1="32" x2="50" y2="32" stroke="${C.line}" stroke-width="1"/>
    </svg>`),

    // === GORNJI ELEMENTI / VISEĆI ===
    // Jednokrilni (koristi se i kao wall_single i wall_1door)
    'wall_1door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="34" rx="4" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
    </svg>`),
    'wall_single': 'wall_1door',

    // Dvokrilni
    'wall_double': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8"  y="10" width="48" height="34" rx="4" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <line x1="32" y1="10" x2="32" y2="44" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Otvoren (bez fronta)
    'wall_open': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="34" rx="4" fill="#f4f7fb" stroke="${C.line}" stroke-width="2"/>
    </svg>`),

    // Otvorene police
    'wall_open_shelf': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="34" rx="4" fill="#f4f7fb" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="22" width="36" height="2" fill="${C.shelf}"/>
      <rect x="14" y="30" width="36" height="2" fill="${C.shelf}"/>
    </svg>`),

    // Ugaoni
    'wall_corner': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M12 12 H44 a8 8 0 0 1 8 8 V44 H12 Z" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
    </svg>`),

    // Aspiratori
    'wall_hood_classic': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="12" width="44" height="18" rx="3" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <rect x="18" y="32" width="28" height="12" rx="2" fill="${C.dark}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),
    'wall_hood_built_in': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="16" rx="3" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="28" width="36" height="10" rx="2" fill="${C.dark}"/>
    </svg>`),

    // Visoki dodatak (72), generički (1 ili 2 krila)
    'tall_addon': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="12" y="6" width="40" height="52" rx="4" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <line x1="32" y1="6" x2="32" y2="58" stroke="${C.line}" stroke-width="1.5" opacity="0.6"/>
    </svg>`)
  };

  // Ako mapirana vrednost upućuje na drugi ključ, razreši „alias”
  function resolveIcon(type) {
    const v = ICONS[type];
    if (!v) return null;
    return v.startsWith('data:image') ? v : (ICONS[v] || null);
  }

  function decorate(btn) {
    if (!btn || btn.__hasIcon) return;
    const type = btn.dataset.type;
    const src  = resolveIcon(type);
    if (!src) return;

    const img = document.createElement('img');
    img.src = src;
    img.alt = type;
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.display = 'block';
    img.style.margin = '0 auto 4px';

    btn.classList.add('catalog-item');

    const label = document.createElement('div');
    label.textContent = btn.textContent.trim();
    label.style.whiteSpace = 'normal';

    btn.textContent = '';
    btn.appendChild(img);
    btn.appendChild(label);

    // pristupačnost
    btn.setAttribute('aria-label', label.textContent);

    btn.__hasIcon = true;
  }

  function scanAll() {
    document.querySelectorAll('#catalog button[data-type]').forEach(decorate);
  }

  function injectHoverStyles() {
    const css = `
      #catalog .catalog-item img { filter: brightness(.95); transition: transform .2s ease, filter .2s ease; }
      #catalog .catalog-item:hover img { transform: scale(1.08); filter: brightness(1.15); }
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  window.addEventListener('DOMContentLoaded', () => {
    injectHoverStyles();
    scanAll();
    const cat = document.querySelector('#catalog');
    if (!cat) return;
    const mo = new MutationObserver(() => scanAll());
    mo.observe(cat, { childList: true, subtree: true });
  });
})();
