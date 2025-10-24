/* app.offer.js – Offer/PDF generator (A4 print via Print Preview)
 * - U PDF ubacuje dve slike:
 *   1) 3D prikaz elemenata (snapshot iz #viewer3d canvas)
 *   2) Frontalni izgled kuhinje (forsira App.Fronts.renderIntoElements() pa uzima #elements kao SVG/PNG)
 * - CSP-friendly: nema blob:, nema inline <script>
 * - Print se trigeruje iz parent prozora nakon učitavanja novog taba
 */
(function(){
  const NS  = (window.App = window.App || {});
  const log = (...a)=>console.log('[Offer]', ...a);
// Pretvara SVG XML u data URI bez base64 (radi sa Unicode)
function svgToDataUri(xml){
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}
  

  NS.Offer = {
    collect(){
      const cfg    = window.__lastCfg   || {};
      const order  = window.__lastOrder || [];
      const rows   = window.__lastRows  || [];

      const agg    = (NS.BOM?.aggregateBOM ? NS.BOM.aggregateBOM(rows) : rows) || [];
      const budget = NS.Budget?.computeBudget
        ? NS.Budget.computeBudget(cfg, order, agg)
        : { rows: [], sum: 0 };

      const K = (cfg.Kitchen || cfg.kitchen || {});
      const totalLen = Number(K.TotalLength || 0) || order.reduce((a,it)=>a+(+it.width||0),0);

      return {
        meta: {
          hTotal:  Number(K.H_total ?? 0),
          hPlinth: Number(K.H_plinth ?? 0),
          tTop:    Number(K.T_top ?? 0),
          totalLen,
          itemCount: order.length,
          dateStr: new Date().toLocaleDateString('sr-RS')
        },
        bom: agg,
        budget
      };
    },

    // === SNAPSHOTS ===
    snapshot3D(){
      try{
        const canvas = document.querySelector('#viewer3d canvas');
        if (canvas && canvas.toDataURL) return canvas.toDataURL('image/png');
      }catch(e){ console.warn('[Offer] 3D snapshot fail', e); }
      return '';
    },

    snapshotFront(){
      try{
        // Forsiraj da se SVG iscrta u #elements (i kad tab nije otvoren)
        if (window.App?.Fronts?.renderIntoElements) {
          try { window.App.Fronts.renderIntoElements(); } catch(_){}
        }

        const host = document.getElementById('elements');
        if (!host) return '';

        // Ako postoji canvas – uzmi PNG
        const canvas = host.querySelector('canvas');
        if (canvas && canvas.toDataURL) {
          return canvas.toDataURL('image/png');
        }

        // Ako postoji SVG – base64 data URL
        const svg = host.querySelector('svg');
        if (svg) {
          const s = svg.cloneNode(true);
          if (!s.getAttribute('xmlns')) s.setAttribute('xmlns','http://www.w3.org/2000/svg');
          const xml = new XMLSerializer().serializeToString(s);
		  return svgToDataUri(xml); // bez btoa, Unicode-safe

        }
      }catch(e){ console.warn('[Offer] front snapshot fail', e); }
      return '';
    },

    // === STIL I HTML ===
    styleTag(){
      return `
        <style>
          @page { size: A4; margin: 16mm; }
          html,body { background:#fff; }
          body { font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#111; }
          h1 { margin:0 0 6px; font-size:18px; }
          h2 { margin:16px 0 6px; font-size:14px; }
          .muted { color:#555; } .sum{font-weight:700}
          .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
          .mb-12{ margin-bottom:12px } .mt-8{ margin-top:8px }
          table { width:100%; border-collapse:collapse; }
          th,td{ padding:6px 8px; border:1px solid #ddd; vertical-align:top; }
          th { background:#f3f5f8; text-align:left; }
          .ta-right { text-align:right; }
          .img-wrap { margin:12px 0; text-align:center; }
          .img-wrap img { max-width:100%; border:1px solid #ccc; border-radius:8px; }
          .caption { font-size:11px; color:#555; margin-top:4px; }
		  .break-before{ break-before: page; page-break-before: always; }
        </style>
      `;
    },

    buildHTML(){
      const { meta, bom, budget } = this.collect();

      // Snapshot slike
      const img3D    = this.snapshot3D();      // može biti ''
      const imgFront = this.snapshotFront();   // može biti ''

      const bomRows = (bom||[]).map(r=>`
        <tr>
          <td>${esc(r.part)}</td>
          <td class="ta-right">${num(r.qty)}</td>
          <td class="ta-right">${num(r.w)}</td>
          <td class="ta-right">${num(r.h)}</td>
          <td class="ta-right">${num(r.th)}</td>
          <td>${esc(r.edge||'')}</td>
          <td>${esc(r.material||'')}</td>
        </tr>
      `).join('');

      const budgetRows = (budget.rows||[]).map(r=>`
        <tr>
          <td>${esc(r.item)}</td>
          <td class="ta-right">${num(r.qty)}</td>
          <td>${esc(r.unit||'')}</td>
          <td class="ta-right">${money(r.price)}</td>
          <td class="ta-right">${money(r.total)}</td>
        </tr>
      `).join('');

      return `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><title>Ponuda – 3xMeri</title>${this.styleTag()}</head>
<body>
  <h1>Ponuda – 3xMeri</h1>
  <div class="muted mb-12">Datum: ${meta.dateStr} • Generisano iz konfiguratora</div>

  <div class="grid mb-12">
    <div>
      <h2>Parametri</h2>
      <div class="mt-8">Ukupna visina donjih: <b>${num(meta.hTotal)} mm</b> (front + nogice ${num(meta.hPlinth)} + ploča ${num(meta.tTop)})</div>
      <div>Ukupna dužina baze: <b>${num(meta.totalLen)} mm</b></div>
      <div>Broj elemenata: <b>${num(meta.itemCount)}</b></div>
    </div>
    <div>
      <h2>Napomene</h2>
      <div class="mt-8 muted">* Dimenzije su u milimetrima. Cene su informativne, bez transporta i montaže.</div>
    </div>
  </div>

  ${img3D ? `
    <h2>3D prikaz elemenata</h2>
    <div class="img-wrap">
      <img alt="3D prikaz elemenata" src="${img3D}">
      <div class="caption">Aktuelni prikaz iz 3D pregleda</div>
    </div>
  ` : ''}

  <h2>BOM (agregat)</h2>
  <table>
    <thead><tr>
      <th>Part</th><th class="ta-right">Qty</th><th class="ta-right">W</th>
      <th class="ta-right">H</th><th class="ta-right">TH</th><th>Edge</th><th>Material</th>
    </tr></thead>
    <tbody>${bomRows}</tbody>
  </table>

  ${imgFront ? `
    <h2 class="break-before" style="margin-top:18px;">Frontalni izgled kuhinje:</h2>
    <div class="img-wrap">
      <img alt="Frontalni prikaz sa dimenzijama" src="${imgFront}">
      <div class="caption">Tehnički front (kote u mm)</div>
    </div>
  ` : ''}

  <h2>Budžetski obračun</h2>
  <table>
    <thead><tr>
      <th>Stavka</th><th class="ta-right">Količina</th><th>Jedinica</th>
      <th class="ta-right">Cena</th><th class="ta-right">Ukupno</th>
    </tr></thead>
    <tbody>${budgetRows}</tbody>
    <tfoot><tr><th colspan="4" class="ta-right">UKUPNO</th><th class="ta-right sum">${money(budget.sum)}</th></tr></tfoot>
  </table>
</body></html>`;
    },

    // === EXPORT/PRINT ===
    export(){
      try{
        const html = this.buildHTML();

        // Otvori novi tab BEZ 'noopener'/'noreferrer' (treba pristup prozoru)
        const w = window.open('about:blank', '_blank');
        if (!w) { alert('Popup je blokiran. Dozvolite iskačuće prozore za ovaj sajt.'); return; }

        w.document.open('text/html');
        w.document.write(html);
        w.document.close();

        // Auto-print iz parenta po učitavanju
        const start = Date.now();
        const tick = setInterval(() => {
          try{
            if (!w || w.closed) { clearInterval(tick); return; }
            const rs = w.document && w.document.readyState;
            if (rs === 'complete' || rs === 'interactive') {
              clearInterval(tick);
              try { w.focus(); } catch(_){}
              try { w.print(); } catch(_){}
            } else if (Date.now() - start > 5000) {
              clearInterval(tick); // odustani posle 5s
            }
          }catch(_){ clearInterval(tick); }
        }, 150);

      }catch(e){
        console.warn('[Offer] export error', e);
        alert('Greška pri generisanju ponude: '+e.message);
      }
    },

    init(){
      const btn = document.getElementById('btnOfferPdf');
      if (btn) btn.addEventListener('click', ()=> this.export());
      log('initialized');
    }
  };

  // utils
  function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
  function money(v){ const n=Number(v); return Number.isFinite(n)?n.toLocaleString('sr-RS'):'0'; }
  function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  document.addEventListener('DOMContentLoaded', ()=> NS.Offer.init());
})();
