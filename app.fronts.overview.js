
/* app.fronts.overview.js (v2) */
(function(){
  function renderFrontsOverview(cfg, order, solved){
    const host = document.getElementById('elements');
    if(!host) return;

    const K = (cfg && (cfg.Kitchen || cfg.kitchen)) || {};
    const wall = K.Wall || {};
    const wallBottom = Number(wall.Bottom || 1450);
    const gapFronts = Number(K.Gap || 2);
    const cabGap = 6;

    let baseWidth = 0, wallWidth = 0;
    (order||[]).forEach((it)=>{
      const w = Number(it.width || 600);
      const isWall = (it.type||'').startsWith('wall_');
      if(isWall){ wallWidth += w + cabGap; } else { baseWidth += w + cabGap; }
    });
    baseWidth = Math.max(0, baseWidth - cabGap);
    wallWidth = Math.max(0, wallWidth - cabGap);

    const ppm = 0.28;
    const marginX = 24, marginY = 24;

    const maxH = Math.max(
      ...solved.map((s,i)=>{
        const isWall = (order[i].type||'').startsWith('wall_');
        const bottom = isWall ? wallBottom : 0;
        return bottom + Number(s.H_carcass||0);
      }),
      wallBottom
    );
    const svgW = Math.max(baseWidth, wallWidth) * ppm + marginX*2;
    const svgH = (maxH * ppm) + marginY*2 + 40;

    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("width", Math.round(svgW));
    svg.setAttribute("height", Math.round(svgH));
    svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
    svg.style.background = "transparent";

    function rect(x,y,w,h, fill, stroke="#202838", sw=0.8){
      const r = document.createElementNS(svgns, "rect");
      r.setAttribute("x", x); r.setAttribute("y", y);
      r.setAttribute("width", w); r.setAttribute("height", h);
      r.setAttribute("rx", 3); r.setAttribute("ry", 3);
      r.setAttribute("fill", fill);
      r.setAttribute("stroke", stroke); r.setAttribute("stroke-width", sw);
      return r;
    }
    function text(x,y,t, size=11, anchor="start"){
      const el = document.createElementNS(svgns, "text");
      el.setAttribute("x", x); el.setAttribute("y", y);
      el.setAttribute("fill", "#dfe5ee");
      el.setAttribute("font-size", size);
      el.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial");
      el.setAttribute("text-anchor", anchor);
      el.setAttribute("dominant-baseline", "middle");
      el.textContent = t;
      return el;
    }

  
// Guides
const gGuides = document.createElementNS(svgns, "g");
const floorY = svgH - marginY - 2;
const wallY = svgH - (marginY + wallBottom*ppm);

const lineFloor = document.createElementNS(svgns,"line");
lineFloor.setAttribute("x1", marginX); 
lineFloor.setAttribute("x2", svgW - marginX);
lineFloor.setAttribute("y1", floorY); 
lineFloor.setAttribute("y2", floorY);
lineFloor.setAttribute("stroke", "#2a3140");
lineFloor.setAttribute("stroke-width", 1.2);

const lineWall = document.createElementNS(svgns,"line");
lineWall.setAttribute("x1", marginX); 
lineWall.setAttribute("x2", svgW - marginX);
lineWall.setAttribute("y1", wallY); 
lineWall.setAttribute("y2", wallY);
lineWall.setAttribute("stroke", "#2a3140");
lineWall.setAttribute("stroke-dasharray","5 5");
lineWall.setAttribute("stroke-width", 1);

gGuides.appendChild(lineFloor);
gGuides.appendChild(lineWall);

// tekst ispod linije
// gGuides.appendChild(text(marginX+4, wallY + 14, "Donja ivica visećih", 11, "start"));
svg.appendChild(gGuides);


    // Cabinets
    let xBase = 0, xWall = 0;
    (order||[]).forEach((it, i)=>{
      const sol = solved[i] || {};
      const isWall = (it.type||'').startsWith('wall_');
      const rowXmm = isWall ? xWall : xBase;
      const x0 = marginX + rowXmm * ppm;
      // Donja ivica visećih treba da leži tačno na liniji wallY
      const yBaseMm = isWall ? wallBottom : 0;
      const yBasePx = isWall
        ? wallY                                   // za viseće – donja ivica leži na isprekidanoj liniji
        : (svgH - marginY - (yBaseMm * ppm));     // za donje elemente kao ranije


      const Wmm = Number(it.width || 600);
      const Hc = Number(sol.H_carcass || 0);

      const gCab = document.createElementNS(svgns, "g");

      // carcass backdrop
      const carcY = yBasePx - (Hc*ppm);
      const carc = rect(x0, carcY, Wmm*ppm, Hc*ppm, "rgba(255,255,255,0.03)", "#3a4356", 0.6);
      gCab.appendChild(carc);
      gCab.appendChild(text(x0+2, carcY - 10, `${it.id} • ${Wmm}mm`, 11, "start"));

      // fronts
      let accum = 0;
      const fronts = (sol.fronts && sol.fronts.length) ? sol.fronts.slice() : [];
      function drawFront(wmm, xOffsetMm, fhmm, suffix){
        const yTopPx = carcY + (accum * ppm);
        const r = rect(x0 + xOffsetMm*ppm, yTopPx, wmm*ppm, fhmm*ppm, "#dfe5ee", "#202838", 0.8);
        gCab.appendChild(r);
        const tx = x0 + (xOffsetMm + wmm/2)*ppm;
        const ty = yTopPx + (fhmm*ppm)/2;
        const t = document.createElementNS(svgns, "text");
        t.setAttribute("x", tx); t.setAttribute("y", ty);
        t.setAttribute("fill", "#111623"); t.setAttribute("font-size", 10);
        t.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial");
        t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "middle");
        t.textContent = `${Math.round(wmm)}×${Math.round(fhmm)}mm${suffix||""}`;
        gCab.appendChild(t);
      }

      if(fronts.length){
        for(let fi=0; fi<fronts.length; fi++){
          const fhmm = Number(fronts[fi]||0);
          if (sol.doors === 2){
            const centerGap = 2;
            const eachW = Math.max(0, (Wmm - centerGap)/2);
            drawFront(eachW, 0, fhmm, " L");
            drawFront(eachW, eachW + centerGap, fhmm, " R");
          } else {
            drawFront(Wmm, 0, fhmm, "");
          }
          accum += fhmm;
          if(fi < fronts.length-1) accum += gapFronts;
        }
      }

      svg.appendChild(gCab);
      if(isWall) xWall += Wmm + cabGap; else xBase += Wmm + cabGap;
    });

    host.innerHTML = "";
    host.appendChild(svg);
  }

  function hookRecompute(){
    try{
      const orig = window.recompute;
      if(typeof orig !== "function") return;
      window.recompute = function(){
        const r = orig.apply(this, arguments);
        if(r && r.cfg && r.order && r.solved){
          window.__lastCfg = r.cfg; window.__lastOrder = r.order; window.__lastSolved = r.solved;
          renderFrontsOverview(r.cfg, r.order, r.solved);
        } else if(window.__lastCfg && window.__lastOrder && window.__lastSolved){
          renderFrontsOverview(window.__lastCfg, window.__lastOrder, window.__lastSolved);
        }
        return r;
      };
      if(window.__lastCfg && window.__lastOrder && window.__lastSolved){
        renderFrontsOverview(window.__lastCfg, window.__lastOrder, window.__lastSolved);
      }
    }catch(e){
      console.warn("fronts overview hook failed:", e);
    }
  }

  window.addEventListener("DOMContentLoaded", hookRecompute);
})();
