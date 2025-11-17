/* app.ui.catalog.icons.js
 * Ikonice + (opciono) auto-generisanje kataloga iz App.Models registra.
 * Radi i za dinamički dodate dugmiće (MutationObserver).
 */
(function () {
  // Jedinstvena paleta (usklađena sa postojećim ikonama)
  const C = {
    body:  '#cfd6df',
    line:  '#212938',
    shelf: '#9aa7b8',
    panel: '#e9eef5',
    dark:  '#b7c2d0'
  };

  // SVG -> data URI
  const S = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

  // ====== IKONE ======
  const ICONS = {
    // === DONJI / BAZA ===
    'drawer_3': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="26" width="40" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="40" width="40" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),
    'base_drawer': 'drawer_3',

    'drawer_2': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="14" width="40" height="14" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="34" width="40" height="14" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Donji jednokrilni
    'base_1door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="40" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Donji dvokrilni
    'base_2door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="40" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <line x1="32" y1="12" x2="32" y2="52" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Donji OPEN — prazna karakasa (bez fronta)
    'base_open': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="#f4f7fb" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="14" width="36" height="36" fill="none" stroke="${C.line}" stroke-width="1" stroke-dasharray="3 2" opacity="0.65"/>
    </svg>`),
    'base_empty_carcass': 'base_open',

    // Donji shelf — otvoren + jedna polica
    'base_open_shelf': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="#f4f7fb" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="14" width="36" height="36" fill="none" stroke="${C.line}" stroke-width="1" stroke-dasharray="3 2" opacity="0.65"/>
      <rect x="16" y="32" width="32" height="2" fill="${C.shelf}" opacity="0.85"/>
    </svg>`),

    // Sudopera 60 – full front + fioka dole
    'base_sink_fullfront_drawer': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="40" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="14" y="14" width="36" height="16" fill="none" stroke="${C.line}" stroke-width="1" stroke-dasharray="3 2" opacity="0.7"/>
      <rect x="12" y="38" width="40" height="14" fill="${C.dark}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="26" y="44.5" width="12" height="2" rx="1" fill="${C.line}"/>
    </svg>`),

    // Korpuse + fioke
    'combo_drawer_door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="14" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="12" y="28" width="40" height="28" fill="${C.dark}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Mašina za sudove 60
    'dishwasher_60': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="8" width="44" height="48" rx="4" ry="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="14" width="36" height="16" rx="2" ry="2" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <circle cx="22" cy="22" r="2.8" fill="${C.shelf}"/>
      <circle cx="30" cy="22" r="2.8" fill="${C.shelf}"/>
      <circle cx="38" cy="22" r="2.8" fill="${C.shelf}"/>
      <rect x="18" y="36" width="28" height="12" rx="2" ry="2" fill="${C.dark}"/>
    </svg>`),
    'base_dishwasher_full': 'dishwasher_60',
    'base_dishwasher_half': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <!-- spoljašnji korpus -->
      <rect x="10" y="8" width="44" height="48" rx="4" ry="4"
            fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <!-- gornji vidljivi panel (kontrole / front fioka) -->
      <rect x="14" y="12" width="36" height="10" rx="2" ry="2"
            fill="${C.panel}" stroke="${C.line}" stroke-width="1.3"/>
      <!-- tri "lampice" / dugmeta na gornjoj lajsni -->
      <circle cx="22" cy="17" r="1.4" fill="${C.shelf}"/>
      <circle cx="28" cy="17" r="1.4" fill="${C.shelf}"/>
      <circle cx="34" cy="17" r="1.4" fill="${C.shelf}"/>
      <!-- donji veliki dekor panel -->
      <rect x="14" y="26" width="36" height="26" rx="2" ry="2"
            fill="${C.panel}" stroke="${C.line}" stroke-width="1.3"/>
    </svg>`),

    // Sudopera jednokrilna (Sink 1D)
    'sink_1door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="12" y="12" width="40" height="18" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="18" y="16" width="18" height="10" fill="#ffffff" stroke="${C.line}" stroke-width="1"/>
      <circle cx="40" cy="18" r="2" fill="${C.line}"/>
      <rect x="12" y="34" width="40" height="18" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // Rerna u donjem elementu
    'base_oven_housing': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="8" width="48" height="48" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="12" width="36" height="16" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="14" y="30" width="36" height="20" fill="${C.dark}" stroke="${C.line}" stroke-width="1.5"/>
      <circle cx="22" cy="20" r="2" fill="${C.line}"/>
      <circle cx="30" cy="20" r="2" fill="${C.line}"/>
      <circle cx="38" cy="20" r="2" fill="${C.line}"/>
    </svg>`),
    'oven_housing': 'base_oven_housing',

    // === GORNJI / VISEĆI ===
    'wall_1door': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="34" rx="4" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
    </svg>`),
    'wall_single': 'wall_1door',

    'wall_double': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8"  y="10" width="48" height="34" rx="4" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <line x1="32" y1="10" x2="32" y2="44" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),
    'viseci2door': 'wall_double', // alias malim slovima

    'wall_open': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="34" rx="4" fill="#f4f7fb" stroke="${C.line}" stroke-width="2"/>
    </svg>`),

    'wall_open_shelf': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="34" rx="4" fill="#f4f7fb" stroke="${C.line}" stroke-width="2"/>
      <rect x="14" y="22" width="36" height="2" fill="${C.shelf}"/>
      <rect x="14" y="30" width="36" height="2" fill="${C.shelf}"/>
    </svg>`),

    'wall_corner': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M12 12 H44 a8 8 0 0 1 8 8 V44 H12 Z" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
    </svg>`),
    'gornji_ugaoni': 'wall_corner',

    // Aspiratori
	    'wall_hood_built_in': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <!-- gornji viseći element (korpus/front) -->
      <rect x="10" y="10" width="44" height="26" rx="4"
            fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <!-- donja utisnuta zona gde je sakriven aspirator -->
      <rect x="14" y="30" width="36" height="6" rx="2"
            fill="${C.dark}" stroke="${C.line}" stroke-width="1.2"/>
      <!-- tri sitne “rešetke”/linije -->
      <rect x="18" y="32" width="8"  height="1.2" rx="0.6" fill="${C.body}" opacity="0.8"/>
      <rect x="28" y="32" width="8"  height="1.2" rx="0.6" fill="${C.body}" opacity="0.8"/>
      <rect x="38" y="32" width="8"  height="1.2" rx="0.6" fill="${C.body}" opacity="0.8"/>
    </svg>`),

    'wall_hood_classic': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="14" y="10" width="36" height="8" fill="${C.dark}" stroke="${C.line}" stroke-width="1.5"/>
      <polygon points="16,18 48,18 40,34 24,34" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    'wall_hood_modern': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="24" y="10" width="16" height="18" fill="${C.dark}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="18" y="28" width="28" height="10" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    // === TOTEMI (visoki) ===
    'tall_totem_oven': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="14" y="4" width="36" height="56" rx="4" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <rect x="18" y="8"  width="28" height="16" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="18" y="26" width="28" height="16" fill="${C.dark}" stroke="${C.line}" stroke-width="1.5"/>
      <rect x="18" y="44" width="28" height="12" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    'tall_pantry': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="14" y="4" width="36" height="56" rx="4" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
      <rect x="30" y="10" width="4" height="12" rx="2" fill="${C.line}" opacity="0.6"/>
      <rect x="30" y="30" width="4" height="12" rx="2" fill="${C.line}" opacity="0.6"/>
      <rect x="30" y="50" width="4" height="6"  rx="2" fill="${C.line}" opacity="0.6"/>
    </svg>`),
	    'tall_totem': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <!-- spoljašnji visoki korpus -->
      <rect x="14" y="4" width="36" height="56" rx="4"
            fill="${C.body}" stroke="${C.line}" stroke-width="2"/>

      <!-- gornji deo (vrata / ormarić) -->
      <rect x="18" y="8" width="28" height="14" rx="2"
            fill="${C.panel}" stroke="${C.line}" stroke-width="1.3"/>

      <!-- srednji deo – univerzalni “aparatski” segment (može biti rerna ili frižider) -->
      <rect x="18" y="24" width="28" height="18" rx="2"
            fill="${C.dark}" stroke="${C.line}" stroke-width="1.3"/>
      <!-- unutrašnji okvir kao staklo/prozor -->
      <rect x="21" y="27" width="22" height="12" rx="2"
            fill="#dfe5ee" stroke="${C.line}" stroke-width="0.9"/>

      <!-- donji deo (fioka / vrata) -->
      <rect x="18" y="44" width="28" height="12" rx="2"
            fill="${C.panel}" stroke="${C.line}" stroke-width="1.3"/>
      <!-- mala ručkica dole -->
      <rect x="28" y="49" width="8" height="2" rx="1"
            fill="${C.line}" opacity="0.8"/>
    </svg>`),


    // === DONJI UGAONI ===
    'base_corner_diag': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M10 54 L10 10 L54 10 L40 24 L40 54 Z" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <path d="M14 50 L14 14 L46 14 L36 24 L36 50 Z" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`),

    'corner_base_l': S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M10 10 H38 V22 H22 V54 H10 Z" fill="${C.body}" stroke="${C.line}" stroke-width="2"/>
      <path d="M14 14 H34 V20 H20 V50 H14 Z" fill="${C.panel}" stroke="${C.line}" stroke-width="1.5"/>
    </svg>`)
  };

  // Dodatni aliasi po traženim nazivima (tvoja dugmad koriste baš ove stringove)
  ICONS['Donji open']         = 'base_open';
  ICONS['Donji shelf']        = 'base_open_shelf';
  ICONS['Viseci2door']        = 'wall_double';
  ICONS['Gornji ugaoni']      = 'wall_corner';
  ICONS['Totem oven housing'] = 'tall_totem_oven';
  ICONS['Totem pantry']       = 'tall_pantry';
  ICONS['corner base diag']   = 'base_corner_diag';
  ICONS['corner base I']      = 'base_corner_L';
  ICONS['Mali frižider (ugr.)']        = 'base_open_shelf';
  ICONS['Viseći 2door']       = 'wall_double';
  
  // ====== RENDER LOGIKA ======

  function resolveIcon(typeOrAlias) {
    if (!typeOrAlias) return null;
    const key = String(typeOrAlias);
    const v = ICONS[key];
    if (!v) return null;
    // ako je alias -> referenca na drugi ključ
    return (typeof v === 'string' && !v.startsWith('data:image'))
      ? (ICONS[v] || null)
      : v;
  }

  function decorate(btn) {
    if (!btn || btn.__hasIcon) return;

    // primarno po data-type, fallback na tekst (ako nekad koristiš alias kao labelu)
    const type = btn.getAttribute('data-type') || '';
    let src = resolveIcon(type) || resolveIcon(btn.textContent.trim());
    if (!src) return;

    // nađi ili kreiraj span.icon
    let iconSpan = btn.querySelector('.icon');
    if (!iconSpan) {
      iconSpan = document.createElement('span');
      iconSpan.className = 'icon';
      const label = btn.querySelector('.label');
      if (label) {
        btn.insertBefore(iconSpan, label);
      } else {
        btn.insertBefore(iconSpan, btn.firstChild);
      }
    }

    iconSpan.style.display = 'inline-block';
    iconSpan.style.backgroundImage = `url("${src}")`;
    iconSpan.style.backgroundRepeat = 'no-repeat';
    iconSpan.style.backgroundPosition = 'center';
    iconSpan.style.backgroundSize = 'contain';

    btn.__hasIcon = true;
  }

  function scanAll() {
    const host = document.getElementById('catalog');
    if (!host) return;
    const buttons = host.querySelectorAll('button[data-type]');
    buttons.forEach(decorate);
  }

  // Auto-dekoracija i za dinamički dodate elemente
  function observeCatalog() {
    const host = document.getElementById('catalog');
    if (!host || !window.MutationObserver) return;

    const mo = new MutationObserver((mutList) => {
      mutList.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('button[data-type]')) {
            decorate(node);
          } else {
            const inside = node.querySelectorAll
              ? node.querySelectorAll('button[data-type]')
              : [];
            inside.forEach(decorate);
          }
        });
      });
    });

    mo.observe(host, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      scanAll();
      observeCatalog();
    } catch (e) {
      console.warn('[CatalogIcons] init failed', e);
    }
  });
})();
