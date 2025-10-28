/* app.offer.js – Offer/PDF generator (A4 print via Print Preview) – v2
 * Mobilni fix: SVG frontalni prikaz se konvertuje u PNG (async) pre ubacivanja u HTML
 * - Varijanta C: 3D snapshot + frontalni prikaz
 * - CSP-friendly: nema blob:, nema inline <script>
 * - Otvaranje bez noopener/noreferrer (treba pristup prozoru radi print)
 */
(function(){
  const NS  = (window.App = window.App || {});
  const log = (...a)=>console.log('[Offer]', ...a);

  // === Helpers ===
  const num = v => { const n = Number(v); return Number.isFinite(n)? n : 0; };
  const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const svgToDataUri = xml => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

  function moneyMaker(cfg){
    const cur = (cfg?.Currency?.code || 'RSD').toUpperCase();
    const loc = cfg?.Currency?.locale || 'sr-RS';
    const style = (cfg?.Currency?.style || 'decimal');
    const maxfd = Number(cfg?.Currency?.maxFractionDigits ?? (style==='currency'?0:0));
    const useIntl = (style==='currency');
    return function money(v){
      const n = Number(v);
      if(!Number.isFinite(n)) return '0';
      try{
        if(useIntl){
          return n.toLocaleString(loc, { style:'currency', currency:cur, maximumFractionDigits:maxfd });
        }else{
          return n.toLocaleString(loc, { maximumFractionDigits:maxfd });
        }
      }catch(_){
        return n.toLocaleString('sr-RS', { maximumFractionDigits:0 });
      }
    };
  }

  // Konverzija SVG (DOM node) -> PNG dataURL preko offscreen canvasa (radi i na mobilnim)
  function svgNodeToPngDataUrl(svgNode, maxWidthPx){
    return new Promise((resolve) => {
      try{
        const s = svgNode.cloneNode(true);
        if (!s.getAttribute('xmlns')) s.setAttribute('xmlns','http://www.w3.org/2000/svg');
        if (!s.getAttribute('xmlns:xlink')) s.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');

        const xml = new XMLSerializer().serializeToString(s);
        const svgUrl = svgToDataUri(xml);
        const img = new Image();
        img.onload = function(){
          try{
            const ratio = maxWidthPx ? Math.min(1, maxWidthPx / img.width) : 1;
            const W = Math.max(1, Math.round(img.width * ratio));
            const H = Math.max(1, Math.round(img.height * ratio));
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, W, H);
            resolve(canvas.toDataURL('image/png'));
          }catch(e){ console.warn('[Offer] svg->png draw fail', e); resolve(''); }
        };
        img.onerror = function(){ resolve(''); };
        img.src = svgUrl;
      }catch(e){
        console.warn('[Offer] svg->png build fail', e);
        resolve('');
      }
    });
  }

  async function getFrontImageDataUrl(){
    // 1) Forsiraj crtanje u #elements (čak i kad tab nije otvoren)
    try {
      if (window.App?.Fronts?.renderIntoElements) {
        await Promise.resolve(window.App.Fronts.renderIntoElements());
      }
    } catch(_){}

    const host = document.getElementById('elements');
    if (!host) return '';

    // 2) Ako ima canvas – uzmi PNG odmah
    const canvas = host.querySelector('canvas');
    if (canvas && canvas.toDataURL) {
      try { return canvas.toDataURL('image/png'); } catch(_) {}
    }

    // 3) Ako postoji SVG – konvertuj u PNG (mobilni-safe)
    const svg = host.querySelector('svg');
    if (svg) {
      // max širina PNG-a (A4 razumno ~ 1200px)
      return await svgNodeToPngDataUrl(svg, 1200);
    }

    return '';
  }

  function get3DSnapshot(){
    try{
      const canvas = document.querySelector('#viewer3d canvas');
      if (canvas && canvas.toDataURL) return canvas.toDataURL('image/png');
    }catch(e){ console.warn('[Offer] 3D snapshot fail', e); }
    return '';
  }

  // --- tabela elemenata (sa rešenjima ako postoje) ---
  function buildOrderSummaryTable(order, solutions){
    const rows = [];
    const arr = Array.isArray(order) ? order : [];
    const sol = Array.isArray(solutions) ? solutions : [];
    arr.forEach((it,i)=>{
      const s = sol[i] || {};
      const H = num(s.H_carcass ?? it.height);
      const fronts = Array.isArray(s.fronts) ? s.fronts.filter(v=>num(v)>0) : [];
      rows.push({
        id: it.id || ('E'+(i+1)),
        type: it.type || '',
        w: num(it.width||0),
        d: num(it.depth||0),
        h: H,
        fronts: fronts.length ? fronts.join(' + ') : '—'
      });
    });
    if(!rows.length) return '';
    const body = rows.map(r=>`
      <tr>
        <td>${esc(r.id)}</td>
        <td>${esc(r.type)}</td>
        <td class="ta-right">${r.w}</td>
        <td class="ta-right">${r.d}</td>
        <td class="ta-right">${r.h}</td>
        <td>${esc(r.fronts)}</td>
      </tr>
    `).join('');
    return `
      <h2>Sažetak elemenata</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>Tip</th><th class="ta-right">W</th><th class="ta-right">D</th><th class="ta-right">H</th><th>Frontovi (mm)</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  NS.Offer = {
    collect(){
      const cfg    = window.__lastCfg   || {};
      const order  = window.__lastOrder || [];
      const rows   = window.__lastRows  || [];
      const solved = window.__lastSolved || [];

      const agg    = (NS.BOM?.aggregateBOM ? NS.BOM.aggregateBOM(rows) : rows) || [];
      const budget = NS.Budget?.computeBudget
        ? NS.Budget.computeBudget(cfg, order, agg)
        : { rows: [], sum: 0 };

      const K = (cfg.Kitchen || cfg.kitchen || {});
      const totalLen = Number(K.TotalLength || 0) || order.reduce((a,it)=>a+(+it.width||0),0);

      const project = String(K.ProjectName||'').trim();
      const client  = (cfg.Client && (cfg.Client.name||cfg.Client.company)) ? cfg.Client : null;

      return {
        meta: {
          project,
          clientName: client ? String(client.name||client.company) : '',
          clientRef: client ? String(client.ref||client.email||'') : '',
          hTotal:  num(K.H_total),
          hPlinth: num(K.H_plinth),
          tTop:    num(K.T_top),
          totalLen,
          itemCount: order.length,
          dateStr: new Date().toLocaleDateString('sr-RS')
        },
        cfg,
        order,
        solved,
        bom: agg,
        budget
      };
    },

    styleTag(){
      return `
        <style>
          @page { size: A4; margin: 14mm; }
          html,body { background:#fff; }
          body { font: 12px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#111; }
          h1 { margin:0 0 6px; font-size:18px; }
          h2 { margin:16px 0 6px; font-size:14px; }
          .muted { color:#555; } .sum{font-weight:700}
          .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
          .mb-12{ margin-bottom:12px } .mt-8{ margin-top:8px } .mt-16{ margin-top:16px }
          table { width:100%; border-collapse:collapse; }
          th,td{ padding:6px 8px; border:1px solid #ddd; vertical-align:top; }
          th { background:#f3f5f8; text-align:left; }
          .ta-right { text-align:right; }
          .img-wrap { margin:10px 0 14px; text-align:center; }
          .img-wrap img { max-width:100%; height:auto; border:1px solid #ccc; border-radius:8px; }
          .caption { font-size:11px; color:#555; margin-top:4px; }
          .hdr { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
          .brand { font-size:12px; color:#333; }
          .brand b { font-size:14px; }
          @media print{
            .break-before{ break-before: page; page-break-before: always; }
          }
        </style>
      `;
    },

    buildHTML({img3D, imgFront}){
      const { meta, cfg, order, solved, bom, budget } = this.collect();
      const money = moneyMaker(cfg);

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
          <td class="ta-right">${esc(r.qty)}</td>
          <td>${esc(r.unit||'')}</td>
          <td class="ta-right">${money(r.price)}</td>
          <td class="ta-right">${money(r.total)}</td>
        </tr>
      `).join('');

      const orderSummary = buildOrderSummaryTable(order, solved);

      const title = meta.project ? `Ponuda – ${esc(meta.project)}` : 'Ponuda – 3xMeri';
      const clientLine = (meta.clientName || meta.clientRef)
        ? `<div class="brand"><b>Klijent:</b> ${esc(meta.clientName)} ${meta.clientRef?('• '+esc(meta.clientRef)):""}</div>`
        : '';

      return `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><title>${title}</title>${this.styleTag()}</head>
<body>
  <div class="hdr">
    <div>
      <h1>${title}</h1>
      <div class="muted">Datum: ${meta.dateStr} • Generisano iz konfiguratora</div>
    </div>
    <div class="brand">
      ${clientLine}
    </div>
  </div>

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

  ${orderSummary}

  <h2 class="mt-16">BOM (agregat)</h2>
  <table>
    <thead><tr>
      <th>Part</th><th class="ta-right">Qty</th><th class="ta-right">W</th>
      <th class="ta-right">H</th><th class="ta-right">TH</th><th>Edge</th><th>Material</th>
    </tr></thead>
    <tbody>${bomRows}</tbody>
  </table>

  ${imgFront ? `
    <h2 class="break-before" style="margin-top:18px;">Frontalni izgled kuhinje</h2>
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

    // === EXPORT/PRINT (ASYNC) ===
    async export(){
      try{
        // 1) Pripremi slike (async PNG za front – radi i na mobilnim)
        const [img3D, imgFront] = await Promise.all([
          Promise.resolve(get3DSnapshot()),
          getFrontImageDataUrl()
        ]);

        // 2) Sastavi HTML
        const html = this.buildHTML({img3D, imgFront});

        // 3) Otvori novi tab BEZ 'noopener'/'noreferrer'
        const w = window.open('about:blank', '_blank');
        if (!w) { alert('Popup je blokiran. Dozvolite iskačuće prozore za ovaj sajt.'); return; }

        w.document.open('text/html');
        w.document.write(html);
        w.document.close();

        // 4) Auto-print (kad se dokument učita)
        const start = Date.now();
        const tick = setInterval(() => {
          try{
            if (!w || w.closed) { clearInterval(tick); return; }
            const rs = w.document && w.document.readyState;
            if (rs === 'complete' || rs === 'interactive') {
              clearInterval(tick);
              try { w.focus(); } catch(_){}
              try { w.print(); } catch(_){}
            } else if (Date.now() - start > 6000) {
              clearInterval(tick);
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

  document.addEventListener('DOMContentLoaded', ()=> NS.Offer.init());
})();
