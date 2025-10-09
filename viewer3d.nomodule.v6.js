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
  let yaw=Math.PI, pitch=Math.atan(0.6), dist=2.2;
  const center = new THREE.Vector3(0,0.35,0);

  // explode
  let exploded=false, explodeOffset=-0.08; // povuci frontove ka kameri (negativan Z)

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
    $("btnIso")    ?.addEventListener("click",()=>{ yaw=Math.PI*0.75; pitch=Math.atan(0.6); dist=2.2; updateCam(); setStatus("3D: view = Iso"); });
    $("btnTop")    ?.addEventListener("click",()=>{ yaw=0; pitch=-Math.PI/2-0.001; dist=2.2; updateCam(); setStatus("3D: view = Top"); });
    $("btnFront")  ?.addEventListener("click",()=>{ yaw=Math.PI; pitch=0; dist=2.2; updateCam(); setStatus("3D: view = Front"); });
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
    const eg = new THREE.EdgesGeometry(mesh.geometry, 30); // thresholdAngle
    const ls = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color }));
    ls.position.copy(mesh.position);
    ls.rotation.copy(mesh.rotation);
    ls.scale.copy(mesh.scale);
    mesh.parent.add(ls);
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
    clear(root);
    if(dimsGroup){ scene.remove(dimsGroup); }
    dimsGroup = new THREE.Group(); scene.add(dimsGroup);
    let x=0, built=0;
    const gap = (cfg?.Kitchen?.Gap ?? 2)*MM;

    (order||[]).forEach((it,i)=>{
      const sol=solved?.[i];
      const W=(it.width||600)*MM, D=(it.depth||cfg?.Kitchen?.Defaults?.CarcassDepth||560)*MM;
      const Hc=(sol?.H_carcass ?? ((cfg?.Kitchen?.H_total||900)-(cfg?.Kitchen?.H_plinth||110)-(cfg?.Kitchen?.T_top||38)))*MM;

      const g=new THREE.Group(); g.position.set(x,0,0); root.add(g);

      // korpus
      const carc=new THREE.Mesh(new THREE.BoxGeometry(W,Hc,D), matCar);
      carc.position.set(W/2,Hc/2,D/2); g.add(carc); addOutline(carc, 0x88a6ff);

      // frontovi (po dubini ih guramo napred iz baze)
      let zBase=D+0.001;
      (sol?.fronts||[]).forEach((fh,fi)=>{
        const front=new THREE.Mesh(new THREE.BoxGeometry(W,fh*MM,0.018), matFront);
        front.position.set(W/2, (fi===0? fh*MM/2 : (sol.fronts.slice(0,fi).reduce((a,b)=>a+b,0)*MM + fi*gap*MM + fh*MM/2)), zBase);
        front.userData._isFront=true; front.userData._zBase=zBase; g.add(front); addOutline(front, 0xffffff);
      });

      // kote
      dimsGroup.add(dimX(x,0,D+0.03, W, `${Math.round(W/MM)}mm`));
      dimsGroup.add(dimY(x-0.03,0,0,  Hc, `${Math.round(Hc/MM)}mm`));

      x+=W+0.03; built++;
    });

    applyExplode();
    fitToRoot();
    setStatus(`3D: izgrađeno elemenata: ${built}`);
  }

  function applyExplode(){
    root.traverse(o=>{
      if(o.userData && o.userData._isFront){
        o.position.z = exploded ? (o.userData._zBase + explodeOffset) : o.userData._zBase;
      }
    });
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

  const MM=0.001;
  const matCar = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.2, roughness: 0.85 });
  const matFront = new THREE.MeshStandardMaterial({ color: 0x555b66, metalness: 0.05, roughness: 0.9 });

  window.addEventListener("DOMContentLoaded", ()=>{ init(); hookApp(); });
})();
