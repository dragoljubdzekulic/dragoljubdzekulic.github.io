// viewer3d.nomodule.v6.js — bolji kontrast + outline ivice + veće/skalirajuće kote
(function(){
  const $ = id => document.getElementById(id);
  const setStatus = t => { const el=$("viewer3d-status"); if(el) el.textContent=t; };

  if(!window.THREE){ setStatus("Greška: THREE nije učitan"); return; }
  const THREE = window.THREE;

  // scena / kamera / renderer
  let scene, camera, renderer, root, dimsGroup;
  // kontrole (naša orbita)
  let dragging=false, lastX=0, lastY=0;
  let yaw=0.0, pitch=Math.atan(0.6), dist=2.2;
  const center = new THREE.Vector3(0,0.35,0);

  // explode
  let exploded=false, explodeOffset=0.08; // povuci frontove ka kameri (negativan Z)

  function init(){
    const host = $("viewer3d"); if(!host){ setStatus("Nema #viewer3d"); return; }
    const w = Math.max(10, host.clientWidth), h = Math.max(10, host.clientHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12151c);

    camera = new THREE.PerspectiveCamera(50, w/h, 0.01, 100);
    updateCam();

    renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(window.devicePixelRatio||1);
    renderer.setSize(w,h);
    host.innerHTML=""; host.appendChild(renderer.domElement);

    // svetla – jači kontrast
    const amb = new THREE.AmbientLight(0xb8c7dd, 0.35); scene.add(amb);
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.85); dir1.position.set(0.7,1,0.6); scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xaad0ff, 0.35); dir2.position.set(-1,0.6,-0.8); scene.add(dir2);

    // grid
    const grid = new THREE.GridHelper(4, 20, 0x5f6d85, 0x273042);
    scene.add(grid);

    root = new THREE.Group(); scene.add(root);
    dimsGroup = new THREE.Group(); scene.add(dimsGroup);

    // gestovi
    const cvs = renderer.domElement;
    cvs.style.touchAction = "none";
    cvs.addEventListener("pointerdown",(e)=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; cvs.setPointerCapture(e.pointerId); });
    cvs.addEventListener("pointerup",(e)=>{ dragging=false; cvs.releasePointerCapture?.(e.pointerId); });
    cvs.addEventListener("pointermove",(e)=>{
      if(!dragging) return;
      const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
      yaw -= dx*0.005; pitch -= dy*0.005; const lim=Math.PI/2-0.05; pitch=Math.max(-lim,Math.min(lim,pitch)); updateCam();
    });
    let pinch0=null; const td=(t)=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    cvs.addEventListener("wheel",(e)=>{ e.preventDefault(); dist *= (1 + Math.sign(e.deltaY)*0.06); dist=Math.min(12,Math.max(0.35,dist)); updateCam(); }, {passive:false});
    cvs.addEventListener("touchstart",e=>{ if(e.touches.length===2) pinch0 = td(e.touches); },{passive:false});
    cvs.addEventListener("touchmove", e=>{
      if(e.touches.length===2 && pinch0){ e.preventDefault(); const d=td(e.touches); const k=d/pinch0; dist/=k; pinch0=d; dist=Math.min(12,Math.max(0.35,dist)); updateCam(); }
    }, {passive:false});

    window.addEventListener("resize",()=>{
      const w2=Math.max(10, host.clientWidth), h2=Math.max(10, host.clientHeight);
      camera.aspect=w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2);
      rescaleDimensionSprites();                                          // kote prilagodi
    });

    // dugmad
    $("btnIso")    ?.addEventListener("click",()=>{ yaw=Math.PI*0.25; pitch=Math.atan(0.6); dist=2.2; updateCam(); setStatus("3D: view = Iso"); });
    $("btnTop")    ?.addEventListener("click",()=>{ yaw=0; pitch=Math.PI/2-0.001; dist=2.2; updateCam(); setStatus("3D: view = Top"); });
    $("btnFront")  ?.addEventListener("click",()=>{ yaw=0; pitch=0; dist=2.2; updateCam(); setStatus("3D: view = Front"); });
    $("btnExplode")?.addEventListener("click",()=>{ exploded=!exploded; applyExplode(); });
    $("btnShot")   ?.addEventListener("click",()=>{ renderer.render(scene,camera); const url=renderer.domElement.toDataURL("image/png"); const a=document.createElement("a"); a.href=url; a.download="3xmeri_3d.png"; document.body.appendChild(a); a.click(); a.remove(); setStatus("3D: screenshot ✓"); });

    animate();
    setStatus("3D: inicijalizovano — čekam podatke iz app.js");
  }

  function updateCam(){
    camera.position.set(
      center.x + dist*Math.cos(pitch)*Math.sin(yaw),
      center.y + dist*Math.sin(pitch),
      center.z + dist*Math.cos(pitch)*Math.cos(yaw)
    );
    camera.lookAt(center);
    rescaleDimensionSprites();
  }

  function clear(g){ while(g.children.length) g.remove(g.children[0]); }

  function fitToRoot(){
    if(!root.children.length) return;
    const box=new THREE.Box3().setFromObject(root);
    box.getCenter(center);
    const size=box.getSize(new THREE.Vector3());
    const maxDim=Math.max(size.x,size.y,size.z);
    const fov=camera.fov*Math.PI/180;
    dist=(maxDim/2)/Math.tan(fov/2)*1.6;
    updateCam();
  }

  // ===== Outline helper
  function addOutline(mesh, color=0x6ea8ff){
    const eg = new THREE.EdgesGeometry(mesh.geometry, 30);
    const ls = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color }));
    ls.position.set(0,0,0);
    ls.rotation.set(0,0,0);
    ls.scale.set(1,1,1);
    mesh.add(ls); // outline je dete meša, pa prati pomeranje (explode itd.)
  }

  // ===== Dimension helpers (veće i skaliraju se)
  function line(points, color=0x7aa2ff){ const g=new THREE.BufferGeometry().setFromPoints(points); return new THREE.Line(g, new THREE.LineBasicMaterial({color})); }
  function sprite(text, size=0.35){
    const s=512, c=document.createElement('canvas'); c.width=c.height=s;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,s,s);
    ctx.font='bold 76px system-ui, Arial';
    // stroke za kontrast
    ctx.lineWidth=10; ctx.strokeStyle='rgba(12,20,30,0.8)'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.strokeText(text, s/2, s/2);
    ctx.fillStyle='#d9e8ff';
    ctx.fillText(text, s/2, s/2);
    const tex=new THREE.CanvasTexture(c); tex.needsUpdate=true;
    const mat=new THREE.SpriteMaterial({ map: tex, depthTest:false, depthWrite:false, transparent:true });
    const sp=new THREE.Sprite(mat); sp.userData._baseScale=size; // baza za auto-scale
    return sp;
  }
  function rescaleDimensionSprites(){
    if(!dimsGroup) return;
    // skaliraj sve spritove prema udaljenosti kamere
    dimsGroup.traverse(o=>{
      if(o.isSprite && o.userData._baseScale){
        const d = camera.position.distanceTo(o.position);
        o.scale.setScalar( o.userData._baseScale * (d/2.5) ); // 2.5 je heuristika
      }
    });
  }
  function dimX(x0,y0,z0,W,label){
    const a=new THREE.Vector3(x0,y0+0.001,z0), b=new THREE.Vector3(x0+W,y0+0.001,z0);
    const t=0.012, g=new THREE.Group();
    g.add(line([a,b]));
    const sp=sprite(label, 0.40); sp.position.set((x0+W/2), y0+0.03, z0); g.add(sp);
    return g;
  }
  function dimY(x0,y0,z0,H,label){
    const a=new THREE.Vector3(x0,y0,z0), b=new THREE.Vector3(x0,y0+H,z0);
    const g=new THREE.Group(); g.add(line([a,b]));
    const sp=sprite(label, 0.40); sp.position.set(x0-0.03, y0+H/2, z0+0.001); g.add(sp);
    return g;
  }

  function buildFromApp(cfg, order, solved){
    const KC = (cfg && (cfg.Kitchen || cfg.kitchen)) || {};
    clear(root);
    if(dimsGroup){ scene.remove(dimsGroup); }
    dimsGroup = new THREE.Group(); scene.add(dimsGroup);
    let xBase=0, xWall=0, built=0;
    const gap = (KC.Gap ?? 2)*MM;
    const wall = KC.Wall || {};
    const wallBottom = (wall.Bottom ?? 1450)*MM;

    (order||[]).forEach((it,i)=>{
      const sol=solved?.[i];
      const isWall = (it.type||'').startsWith('wall_');
      const W=(it.width||600)*MM;
      const D=(isWall ? (it.depth||wall?.Defaults?.CarcassDepth||320) : (it.depth||KC.Defaults?.CarcassDepth||560))*MM;
      const topOver=0.02; // 20mm prepust
      const topD = (!isWall ? (D + topOver) : 0);
      const topT = ((KC.T_top||38)*MM);
      const Hc=( (sol?.H_carcass ?? (isWall ? (wall.H_carcass||720) : ((KC.H_total||900)-(KC.H_plinth||110)-(KC.T_top||38)))) )*MM;

      const x = isWall ? xWall : xBase;
      const g=new THREE.Group(); g.position.set(x, isWall? wallBottom:0, 0); root.add(g);

      // korpus
      const carc=new THREE.Mesh(new THREE.BoxGeometry(W,Hc,D), matCar);
      carc.position.set(W/2,Hc/2,D/2); g.add(carc); addOutline(carc, 0x88a6ff);

      // frontovi (pozicioniranje odozgo nadole)
      let zBase=D+0.001; // front lica na z≈D (ispred korpusa)
      let acc=0;
      (sol?.fronts||[]).forEach((fh,fi)=>{
        const fhm = fh*MM;
        const front=new THREE.Mesh(new THREE.BoxGeometry(W,fhm,0.018), matFront);
        const yCenter = (Hc - (acc + fhm/2));
        front.position.set(W/2, yCenter, zBase);
        front.userData._isFront=true; front.userData._zBase=zBase; g.add(front); addOutline(front, 0xffffff);

        // === vizuelizacija fioka (unutrašnje kutije) ===
        const hasDrawers = (it.type==='drawer_3' || it.type==='combo_drawer_door' || it.type==='oven_housing');
        const isThisFrontDrawer = (
          (it.type==='drawer_3') ||
          (it.type==='combo_drawer_door' && fi===0) ||
          (it.type==='oven_housing' && fi===1)
        );
        if(hasDrawers && isThisFrontDrawer){
          const tmm = ((KC.Defaults?.SideThickness)||18)*MM;
          const Dstd = Math.min(((KC.Drawer?.DepthStd)||500)*MM, D);
          const slide = ((KC.Drawer?.SlideAllowance)||26)*MM;
          const clearW = Math.max(0.05, W - 2*tmm - slide);   // unutrašnja širina
          const sideH = Math.max(0.09, (fh-40)*MM);           // visina zida fioke (heuristika)
          const zBox  = D - Dstd/2 - 0.01;                    // malo odmaknuto od fronta
          const dbox = new THREE.Mesh(new THREE.BoxGeometry(clearW, sideH, Dstd), matDrawer);
          dbox.position.set(W/2, yCenter, zBox);
          dbox.userData._isDrawer = true; dbox.userData._zBase = zBox; // za explode
          g.add(dbox); addOutline(dbox, 0x6ea8ff);
        }

        acc += fhm;
        if (fi < (sol.fronts.length-1)) acc += gap; // dodaj razmak između frontova
      });

      // radna ploča (po segmentu, nad donjim elementima)
      if(!isWall && topT>0){
        const top=new THREE.Mesh(new THREE.BoxGeometry(W, topT, topD), matTop);
        top.position.set(W/2, Hc + topT/2, topD/2);
        g.add(top); addOutline(top, 0xE0E0E0);
      }

      // kote
      const baseY = isWall? wallBottom:0;
      dimsGroup.add(dimX(x,baseY, D+0.03, W, `${Math.round(W/MM)}mm`));
      dimsGroup.add(dimY(x-0.03,baseY,0,  Hc, `${Math.round(Hc/MM)}mm`));

      if(isWall) xWall += W+0.03; else xBase += W+0.03; built++;
    });

    applyExplode();
    fitToRoot();
    setStatus(`3D: izgrađeno elemenata: ${built}`);
  }

  function applyExplode(){
    // pomeri frontove i fioke napolje; olakšaj pogled smanjenjem opacity korpusa
    root.traverse(o=>{
      if(o.userData){
        if(o.userData._isFront){
          o.position.z = exploded ? (o.userData._zBase + explodeOffset) : o.userData._zBase;
        } else if(o.userData._isDrawer){
          // fioke izvedi malo manje od frontova
          o.position.z = exploded ? (o.userData._zBase + explodeOffset*0.6) : o.userData._zBase;
        }
      }
    });
    if(matCar){ matCar.transparent = true; matCar.opacity = exploded ? 0.35 : 1.0; }
    setStatus("3D: explode = " + (exploded?"ON":"OFF"));
  }

  function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera); }

  // hook na app.js
  function hookApp(){
    try{
      const out = window.recompute && window.recompute();
      if(out) buildFromApp(out.cfg, out.order, out.solved);
      const orig=window.recompute;
      window.recompute=function(){ const r=orig?orig():null; if(r) buildFromApp(r.cfg,r.order,r.solved); return r; };
    }catch(e){ setStatus("3D: greška u povezivanju — "+e.message); }
  }

  const MM = 0.001;
  // materijali
  var matCar   = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.2, roughness: 0.85, transparent:true, opacity:1.0 });
  var matFront = new THREE.MeshStandardMaterial({ color: 0x555b66, metalness: 0.05, roughness: 0.9 });
  var matTop   = new THREE.MeshStandardMaterial({ color: 0x80848e, metalness: 0.2, roughness: 0.6 });
  var matDrawer= new THREE.MeshStandardMaterial({ color: 0x6ea8ff, metalness: 0.0, roughness: 0.95, transparent:true, opacity:0.22 });

  window.addEventListener("DOMContentLoaded", ()=>{ init(); hookApp(); });
})();