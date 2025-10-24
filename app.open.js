/* app.open.js — otvaranje .3xmeri / JSON projekta (iOS-friendly)
 * - File input ima accept=".3xmeri,application/json,application/octet-stream"
 * - Pokreće se direktno iz click handlera (iOS uslov)
 * - Pokušava više načina da “ubaci” projekat u app:
 *   A) ako postoji App.loadProject(data)
 *   B) ako postoji window.loadProject(data)
 *   C) ako postoji #jsonInput -> upiše JSON pa pozove recompute()
 */
(function(){
  const $ = (sel,root=document)=>root.querySelector(sel);

  function attach(){
    const btn = $('#btnOpen');
    const inp = $('#openFile');
    if(!btn || !inp) return;

    btn.addEventListener('click', () => {
      // mora direktno iz user gesture-a da bi iOS prikazao picker
      inp.value = ''; // reset izbor
      inp.click();
    });

    inp.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if(!f) return;

      let text = '';
      try {
        text = await f.text();
      } catch (err) {
        alert('Ne mogu da pročitam fajl: ' + (err && err.message ? err.message : err));
        return;
      }

      // Probaj JSON parse (ako .3xmeri sadrži JSON)
      let data = null;
      try { data = JSON.parse(text); } catch(_){}

      // A) Ako app ima eksplicitni loader
      try {
        if (window.App && typeof window.App.loadProject === 'function') {
          await Promise.resolve(window.App.loadProject(data ?? text));
          toast('Projekat učitan (App.loadProject).');
          return;
        }
      } catch (e) { console.warn('App.loadProject fail', e); }

      try {
        if (typeof window.loadProject === 'function') {
          await Promise.resolve(window.loadProject(data ?? text));
          toast('Projekat učitan (loadProject).');
          return;
        }
      } catch (e) { console.warn('loadProject fail', e); }

      // B) Fallback: upiši u #jsonInput i recompute
      const ta = $('#jsonInput');
      if (ta) {
        ta.value = typeof data === 'object' ? JSON.stringify(data, null, 2) : text;
        // pošalji eventove ako app sluša na input/change
        try { ta.dispatchEvent(new Event('input', {bubbles:true})); } catch(_){}
        try { ta.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
        // recompute ako postoji
        if (typeof window.recompute === 'function') {
          try { window.recompute(); } catch(e){ console.warn('recompute() error', e); }
        }
        toast('Projekat učitan (JSON textarea).');
      } else {
        alert('Učitano, ali ne postoji #jsonInput niti loader funkcija. Dodaj App.loadProject ili #jsonInput.');
      }
    });
  }

  function toast(msg){
    // jednostavno obaveštenje, ne koristi inline stilove (CSP ok — style je inline ali kao string; ako želiš, ukloni)
    try {
      const n = document.createElement('div');
      n.textContent = msg;
      n.style.position='fixed'; n.style.bottom='14px'; n.style.right='14px';
      n.style.background='#0f1726'; n.style.border='1px solid #1e2636';
      n.style.color='#e9eef5'; n.style.padding='8px 10px'; n.style.borderRadius='8px';
      n.style.fontSize='12px'; n.style.zIndex='9999';
      document.body.appendChild(n);
      setTimeout(()=>{ n.remove(); }, 1800);
    }catch(_){}
  }

  document.addEventListener('DOMContentLoaded', attach);
})();
