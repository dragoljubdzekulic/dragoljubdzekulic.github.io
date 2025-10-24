/* app.fronts.tab.js — frontal tab with bottom height label + mirror into #elements */
(function(){
  var svgns = "http://www.w3.org/2000/svg";
  var ppm = 0.28;
  var padX = 24, padY = 24;
  var DEFAULT_LEG = 100, DEFAULT_TOP = 30;

  function $(sel,root){ return (root||document).querySelector(sel); }

  function makeEl(tag, attrs, text){
    var el = document.createElement(tag);
    if(attrs){ for(var k in attrs){ if(attrs[k]!==null) el.setAttribute(k, attrs[k]); } }
    if(text!=null){ el.textContent = text; }
    return el;
  }

  function rect(x,y,w,h, fill, stroke, sw){
    var r=document.createElementNS(svgns,'rect');
    r.setAttribute('x',x); r.setAttribute('y',y);
    r.setAttribute('width',w); r.setAttribute('height',h);
    r.setAttribute('rx',3); r.setAttribute('ry',3);
    r.setAttribute('fill', fill || "#ffffff05");
    r.setAttribute('stroke', stroke || "#202838");
    r.setAttribute('stroke-width', sw!=null? sw : 0.8);
    return r;
  }
  function text(x,y,t, size, anchor, fill){
    var el=document.createElementNS(svgns,'text');
    el.setAttribute('x',x); el.setAttribute('y',y);
    el.setAttribute('fill', fill || '#dfe5ee');
    el.setAttribute('font-size', size!=null? size : 11);
    el.setAttribute('font-family','ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial');
    el.setAttribute('text-anchor', anchor || 'start');
    el.setAttribute('dominant-baseline','middle');
    el.textContent=String(t);
    return el;
  }
  function drawDimensionLine(svg, x1, x2, y, label){
    var g=document.createElementNS(svgns,'g');
    var arrowSize=6;
    var line=document.createElementNS(svgns,'line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y);
    line.setAttribute('x2',x2); line.setAttribute('y2',y);
    line.setAttribute('stroke','#6ea8ff'); line.setAttribute('stroke-width','1.2');
    g.appendChild(line);
    function mk(x,dir){
      var a=document.createElementNS(svgns,'path');
      a.setAttribute('d','M '+x+' '+(y-arrowSize/2)+' L '+(x+(dir*arrowSize))+' '+y+' L '+x+' '+(y+arrowSize/2)+' Z');
      a.setAttribute('fill','#6ea8ff');
      g.appendChild(a);
    }
    mk(x1,1); mk(x2,-1);
    var t=text((x1+x2)/2, y-6, label, 12, 'middle', '#9dc6ff');
    g.appendChild(t);
    svg.appendChild(g);
  }
  function drawVerticalDim(svg, x, yTop, yBottom, label){
    var g=document.createElementNS(svgns,'g');
    var line=document.createElementNS(svgns,'line');
    line.setAttribute('x1',x); line.setAttribute('y1',yTop);
    line.setAttribute('x2',x); line.setAttribute('y2',yBottom);
    line.setAttribute('stroke','#6ea8ff'); line.setAttribute('stroke-width','1.1');
    g.appendChild(line);
    function cap(yy){
      var c=document.createElementNS(svgns,'line');
      c.setAttribute('x1',x-4); c.setAttribute('y1',yy);
      c.setAttribute('x2',x+4); c.setAttribute('y2',yy);
      c.setAttribute('stroke','#6ea8ff'); c.setAttribute('stroke-width','1.1');
      g.appendChild(c);
    }
    cap(yTop); cap(yBottom);
    if (label){
      var tx=x+14, ty=(yTop+yBottom)/2;
      var t=text(tx, ty, label, 12, 'start', '#e9f2ff');
      g.appendChild(t);
      try {
        var bb=t.getBBox();
        var bg=document.createElementNS(svgns,'rect');
        bg.setAttribute('x', bb.x - 5);
        bg.setAttribute('y', bb.y - 2);
        bg.setAttribute('width', bb.width + 10);
        bg.setAttribute('height', bb.height + 4);
        bg.setAttribute('rx', 4); bg.setAttribute('ry', 4);
        bg.setAttribute('fill', 'rgba(20,30,50,0.9)');
        bg.setAttribute('stroke', '#3a4a66');
        bg.setAttribute('stroke-width', '0.6');
        g.insertBefore(bg, t);
      } catch(e){}
    }
    svg.appendChild(g);
  }

  function buildSVG(cfg, order, solved){
    var K = (cfg && (cfg.Kitchen||cfg.kitchen)) || {};
    var wall = K.Wall || {};
    var wallBottom = Number(wall.Bottom!=null ? wall.Bottom : 1450);
    var gapFronts = Number(K.Gap!=null ? K.Gap : 2);
    var cabGapMm = 6;

    var baseWidth=0, wallWidth=0;
    (order||[]).forEach(function(it){
      var w = Number(it.width||600);
      var isWall = ((it.type||'')+'').indexOf('wall_')===0;
      if(isWall) wallWidth += w + cabGapMm; else baseWidth += w + cabGapMm;
    });
    if(baseWidth>0) baseWidth -= cabGapMm;
    if(wallWidth>0) wallWidth -= cabGapMm;

    var maxH = wallBottom;
    (solved||[]).forEach(function(s,i){
      var isWall = ((order[i].type||'')+'').indexOf('wall_')===0;
      var bottom = isWall ? wallBottom : 0;
      var Hc = Number(s.H_carcass||0);
      var h = bottom + Hc;
      if(h>maxH) maxH=h;
    });

    var EXTRA_RIGHT = 140;
    var svgW = Math.max(baseWidth, wallWidth) * ppm + padX*2 + EXTRA_RIGHT;
    var svgH = maxH*ppm + padY*2 + 98;
    var svg=document.createElementNS(svgns,'svg');
    svg.setAttribute('width', Math.round(svgW));
    svg.setAttribute('height', Math.round(svgH));
    svg.setAttribute('viewBox', '0 0 '+svgW+' '+svgH);
    svg.style.background='transparent';

    var floorY = svgH - padY - 40;
    var wallY  = svgH - (padY + wallBottom*ppm);

    function line(x1,y1,x2,y2,dash,w){
      var L=document.createElementNS(svgns,'line');
      L.setAttribute('x1',x1); L.setAttribute('y1',y1);
      L.setAttribute('x2',x2); L.setAttribute('y2',y2);
      L.setAttribute('stroke','#2a3140'); L.setAttribute('stroke-width', w!=null? w : 1.2);
      if(dash) L.setAttribute('stroke-dasharray', dash);
      return L;
    }
    var gGuides=document.createElementNS(svgns,'g');
    gGuides.appendChild(line(padX, floorY, svgW - padX, floorY, null, 1.4));
    gGuides.appendChild(line(padX, wallY,  svgW - padX, wallY,  "5 5", 1.1));
    gGuides.appendChild(text(padX+4, wallY+14, "Donja ivica visecih", 11, "start", null));
    svg.appendChild(gGuides);

    // Gornja ivica visećih
    var wallHConfig = Number((K.Wall && K.Wall.H_carcass != null) ? K.Wall.H_carcass : NaN);
    var maxWallH = 0;
    (solved || []).forEach(function(s, i){
      var it = (order || [])[i] || {};
      var isWallIt = ((it.type || '') + '').indexOf('wall_') === 0;
      if (isWallIt) {
        var hc = Number(s && s.H_carcass || 0);
        if (hc > maxWallH) maxWallH = hc;
      }
    });
    var wallHForTop = Number.isFinite(wallHConfig) ? wallHConfig : (maxWallH || 720);
    var wallTopY = wallY - wallHForTop * ppm;

    var xBase=0, xWall=0;
    (order||[]).forEach(function(it,i){
      var sol = solved[i] || {};
      var isWall = ((it.type||'')+'').indexOf('wall_')===0;
      var rowXmm = isWall ? xWall : xBase;
      var x0 = padX + rowXmm*ppm;

      var yBasePx = isWall ? wallY : floorY;
      var Wmm = Number(it.width||600);
      var Hc  = Number(sol.H_carcass||0);

      var typeStr = ((it.type || '') + '').toLowerCase();
      var isHood  = typeStr.indexOf('aspirator') >= 0 || typeStr.indexOf('hood') >= 0;

      var g=document.createElementNS(svgns,'g');
      var carcY = (isWall && isHood) ? wallTopY : (yBasePx - Hc*ppm);

      var carc  = rect(x0, carcY, Wmm*ppm, Hc*ppm, "rgba(255,255,255,0.03)", "#3a4356", 0.6);
      g.appendChild(carc);
      g.appendChild(text(x0+2, carcY-10, (it.id||'')+" • "+Wmm+"mm", 11, "start", null));

      var acc=0;
      var fronts = (sol.fronts && sol.fronts.length) ? sol.fronts.slice() : [];
      function drawFront(wmm, xOffMm, fhmm, suffix){
        var yTopPx = carcY + acc*ppm;
        var r = rect(x0 + xOffMm*ppm, yTopPx, wmm*ppm, fhmm*ppm, "#dfe5ee", "#202838", 0.8);
        g.appendChild(r);
        var tx = x0 + (xOffMm + wmm/2)*ppm;
        var ty = yTopPx + (fhmm*ppm)/2;
        g.appendChild(text(tx, ty, Math.round(wmm)+"×"+Math.round(fhmm)+"mm"+(suffix||""), 10, "middle", "#111623"));
      }

      if(fronts.length){
        for(var fi=0; fi<fronts.length; fi++){
          var fhmm = Number(fronts[fi]||0);
          if (Number(sol.doors||0)===2){
            var centerGap = 2;
            var eachW = Math.max(0,(Wmm - centerGap)/2);
            drawFront(eachW, 0, fhmm, " L");
            drawFront(eachW, eachW+centerGap, fhmm, " R");
          } else {
            drawFront(Wmm, 0, fhmm, "");
          }
          acc += fhmm;
          if(fi<fronts.length-1) acc += gapFronts;
        }
      }

      svg.appendChild(g);

      if (Hc > 0) {
        var xDim = x0 + Wmm*ppm + 14;
        var yTop = carcY;
        var yBot = carcY + Hc*ppm;
        drawVerticalDim(svg, xDim, yTop, yBot, Math.round(Hc)+" mm");
      }

      if(isWall) xWall += Wmm + 6; else xBase += Wmm + 6;
    });

    // Total base length
    var totalBaseWidthMm = (order||[]).filter(function(it){ return ((it.type||'')+'').indexOf('wall_')!==0; })
      .reduce(function(a,it){ return a + (Number(it.width)||0); }, 0);
    var yFloorDim = floorY + 20;
    var xStart = padX;
    var xEnd = padX + totalBaseWidthMm * ppm;
    if (totalBaseWidthMm > 0) drawDimensionLine(svg, xStart, xEnd, yFloorDim, Math.round(totalBaseWidthMm)+" mm ukupna duzina");

    // Floor -> countertop (vertikalna dimenzija + tekst ispod)
    var legMm = Number(K.H_plinth!=null ? K.H_plinth : DEFAULT_LEG);
    var topMm = Number(K.T_top!=null ? K.T_top : DEFAULT_TOP);
    var baseSolved = (solved||[]).map(function(s,ii){ return {s:s, it:(order||[])[ii]}; })
      .filter(function(p){ return p && ((p.it.type||'')+'').indexOf('wall_')!==0; });
    var baseHCarcass = 0;
    if (baseSolved.length) baseHCarcass = Number(baseSolved[0].s.H_carcass||0);
    else {
      var H_total = Number(K.H_total!=null ? K.H_total : (legMm + 720 + topMm));
      baseHCarcass = Math.max(0, H_total - legMm - topMm);
    }
    var totalToCounterMm = legMm + baseHCarcass + topMm;
    if (totalToCounterMm > 0){
      var baseHeightPx = totalToCounterMm * ppm;
      var xVert = padX - 25; var y1 = floorY; var y2 = floorY - baseHeightPx;
      drawVerticalDim(svg, xVert, y2, y1, ""); // bez labela na liniji

      // Centrirana donja etiketa, ispod horizontalne dužine
      var Hplinth = Number(K.H_plinth ?? 110);
      var Ttop    = Number(K.T_top ?? 38);
      var Hcar    = Math.max(0, Math.round(totalToCounterMm - Hplinth - Ttop));
      var label   = `${Math.round(totalToCounterMm)} mm ukupna visina donjih (front ${Hcar} + nogice ${Hplinth} + ploča ${Ttop})`;

      var centerX = (xStart + xEnd) / 2;
      var ty = yFloorDim + 18;
      var tnode = text(centerX, ty, label, 12, 'middle', '#9dc6ff');
      svg.appendChild(tnode);
      try {
        var bb = tnode.getBBox();
        var minX = padX + 4;
        if (bb.x < minX) {
          tnode.setAttribute('text-anchor', 'start');
          tnode.setAttribute('x', String(minX));
        }
      } catch(e){}
    }

    // (info) maksimalna visina visećih — ostavljeno za dalje potrebe
    // ...

    return svg;
  }

  // === Render koji crta i u tab i u #elements (mirror) ===
  function render(cfg, order, solved){
    // 1) Tab prikaz
    var host = $('#frontsHost'); 
    if(host){
      host.innerHTML='';
      var svg1 = buildSVG(cfg, order, solved);
      host.appendChild(svg1);
      var scale = $('#fronts-scale'); if(scale){ scale.textContent = "1 px ~ "+(1/ppm).toFixed(1)+" mm"; }
    }
    // 2) Mirror u #elements (skriven) — uvek, radi PDF-a
    var mirror = $('#elements');
    if(mirror){
      mirror.innerHTML = '';
      var svg2 = buildSVG(cfg, order, solved);
      mirror.appendChild(svg2);
    }
  }

  function renderFromLast(){
    var cfg = window.__lastCfg, order=window.__lastOrder, solved=window.__lastSolved;
    if(cfg && order && solved) render(cfg, order, solved);
  }

  function currentSVG(){
    var host=$('#frontsHost'); return host && host.querySelector('svg');
  }
  function saveSVG(){
    var svg=currentSVG(); if(!svg) return;
    var ser = new XMLSerializer().serializeToString(svg);
    var blob = new Blob([ser], {type:'image/svg+xml'});
    var url  = URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download='3xmeri_fronts.svg';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function savePNG(){
    var svg=currentSVG(); if(!svg) return;
    var ser = new XMLSerializer().serializeToString(svg);
    var img = new Image();
    var blob = new Blob([ser], {type:'image/svg+xml'});
    var url  = URL.createObjectURL(blob);
    img.onload = function(){
      var canvas = document.createElement('canvas');
      canvas.width  = img.width; canvas.height = img.height;
      var ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0);
      URL.revokeObjectURL(url);
      canvas.toBlob(function(b){
        var u = URL.createObjectURL(b);
        var a=document.createElement('a'); a.href=u; a.download='3xmeri_fronts.png';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
      }, 'image/png');
    };
    img.src = url;
  }

  // === Tab i hook za recompute ===
  function ensureTabNow(){
    var tabs = $('.tabs[role="tablist"]');
    if(!tabs) return false;
    if($('#tabbtn-fronts')) return true;

    var btn = makeEl('button', {'class':'tabbtn','id':'tabbtn-fronts','role':'tab','aria-selected':'false','aria-controls':'tab-fronts'}, 'Frontalni prikaz');
    tabs.appendChild(btn);

    var tabConfig  = $('#tab-config');
    var tabSummary = $('#tab-summary');
    var wrap = (tabSummary && tabSummary.parentElement) || (tabConfig && tabConfig.parentElement) || document.body;

    var panel = makeEl('section', {'id':'tab-fronts','class':'tabpanel stack','role':'tabpanel','aria-hidden':'true','aria-labelledby':'tabbtn-fronts'});
    var card = makeEl('div', {'class':'card'});
    var h2 = makeEl('h2', null, 'Frontalni prikaz (realna srazmera)');
    var small = makeEl('div', {'class':'small'}); small.style.display='flex'; small.style.gap='8px'; small.style.alignItems='center'; small.style.marginBottom='6px';
    small.appendChild(makeEl('span', null, 'Skala:'));
    var codeEl = makeEl('code', {'id':'fronts-scale'}, '1 px ~ '+(1/ppm).toFixed(1)+' mm');
    small.appendChild(codeEl);
    var dot = makeEl('span', null, '•'); dot.style.opacity='.7'; small.appendChild(dot);
    var b1 = makeEl('button', {'id':'btnFrontsSaveSvg'}, 'Sačuvaj SVG');
    var b2 = makeEl('button', {'id':'btnFrontsSavePng'}, 'Sačuvaj PNG');
    small.appendChild(b1); small.appendChild(b2);
    var hostWrap = makeEl('div', {'id':'frontsHostWrap'}); hostWrap.style.overflow='auto'; hostWrap.style.border='1px solid var(--line)'; hostWrap.style.borderRadius='10px'; hostWrap.style.background='#0a1220';
    var host = makeEl('div', {'id':'frontsHost'}); host.style.minHeight='200px';
    hostWrap.appendChild(host);
    var legend = makeEl('div', {'class':'small'}, 'Donja puna linija = pod • Isprekidana linija = donja ivica visecih'); legend.style.marginTop='6px'; legend.style.opacity='.85';

    card.appendChild(h2); card.appendChild(small); card.appendChild(hostWrap); card.appendChild(legend);
    panel.appendChild(card); wrap.appendChild(panel);

    function activate(which){
      var isConfig = which==='config', isSummary = which==='summary', isFronts = which==='fronts';
      var tbc=$('#tabbtn-config'), tbs=$('#tabbtn-summary');
      if(tbc) tbc.setAttribute('aria-selected', String(isConfig));
      if(tbs) tbs.setAttribute('aria-selected', String(isSummary));
      var pc=$('#tab-config'), ps=$('#tab-summary');
      if(pc) pc.setAttribute('aria-hidden', String(!isConfig));
      if(ps) ps.setAttribute('aria-hidden', String(!isSummary));
      $('#tabbtn-fronts') && $('#tabbtn-fronts').setAttribute('aria-selected', String(isFronts));
      $('#tab-fronts') && $('#tab-fronts').setAttribute('aria-hidden', String(!isFronts));
      var newHash = isConfig ? '#config' : (isSummary ? '#summary' : '#fronts');
      try{ if(location.hash !== newHash) history.replaceState(null,'',newHash); }catch(e){}
      if(isFronts) renderFromLast();
    }
    btn.addEventListener('click', function(){ activate('fronts'); });
    b1.addEventListener('click', saveSVG);
    b2.addEventListener('click', savePNG);

    var h=(location.hash||'').toLowerCase();
    if(h==='#fronts') activate('fronts');
    var tbc=$('#tabbtn-config'), tbs=$('#tabbtn-summary');
    if(tbc) tbc.addEventListener('click', function(){ activate('config'); });
    if(tbs) tbs.addEventListener('click', function(){ activate('summary'); });
    window.addEventListener('hashchange', function(){
      var hh=(location.hash||'').toLowerCase();
      if(hh==='#fronts') activate('fronts');
      if(hh==='#summary') activate('summary');
      if(hh==='#config')  activate('config');
    });

    hookRecompute();
    return true;
  }

  function waitForTabs(){
    if (ensureTabNow()) return;
    var tries = 0;
    var id = setInterval(function(){
      tries++;
      if (ensureTabNow() || tries>12) clearInterval(id);
    }, 150);
    var mo = new MutationObserver(function(){
      if (ensureTabNow()) mo.disconnect();
    });
    mo.observe(document.body, {childList:true, subtree:true});
  }

  function hookRecompute(){
    try{
      var orig = window.recompute;
      if(typeof orig!=='function') return;
      if (window.__frontsHooked) return;
      window.__frontsHooked = true;
      window.recompute = function(){
        var r = orig.apply(this, arguments);
        if(r && r.cfg && r.order && r.solved){
          window.__lastCfg=r.cfg; window.__lastOrder=r.order; window.__lastSolved=r.solved;
          render(r.cfg, r.order, r.solved);
        } else { renderFromLast(); }
        return r;
      };
      renderFromLast();
    }catch(e){ console.warn('fronts tab hook failed:', e); }
  }

  // === Expose mini API za forsiranje crtanja u #elements (za Ponudu/PDF) ===
  (window.App = window.App || {}).Fronts = {
    renderIntoElements: function(){
      var cfg = window.__lastCfg, order=window.__lastOrder, solved=window.__lastSolved;
      if(!(cfg && order && solved)) return false;
      var mirror = document.getElementById('elements');
      if(!mirror) return false;
      mirror.innerHTML = '';
      mirror.appendChild(buildSVG(cfg, order, solved));
      return true;
    },
    buildSVG: buildSVG
  };

  window.addEventListener('DOMContentLoaded', waitForTabs);
})();
