// viewer3d.nomodule.v4.js — 3D sa ugrađenim kontrolama, preset kamerom, exploded view, dimenzijama i screenshot-om
(function(){
  function $(id){ return document.getElementById(id); }
  function setStatus(msg){ const el=$("viewer3d-status"); if(el) el.textContent = msg; }

  if(!window.THREE){ setStatus("Greška: THREE nije učitan"); return; }
  const THREE = window.THREE;

  // scena
  let scene, camera, renderer, root, dimsGroup;
  // kontrole (ugrađene)
  let dragging=false, lastX=0, lastY=0, yaw=0.9, pitch=0.5, dist=2.2;
  const center = new THREE.Vector3(0,0.35,0);
  // explode
  let exploded = false, explodeOffset = 0.05; // 50 mm

  // materijali
  const matCar = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
  const matFr  = new THREE.MeshLambertMaterial({ color: 0xdcdcdc });

  const MM = 0.002; // 1mm = 0.002m

  function init(){
    const host = $("viewer3d");
    if(!host){ setStatus("Nema #viewer3d"); return; }

    const w = Math.max(10, host.clientWidth);
    const h = Math.max(10, host.clientHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141922);

    camera = new THREE.PerspectiveCamera(50, w/h, 0.01, 100);
    updateCameraPos();

    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(window.devicePixelRatio||1);
    renderer.setSize(w,h);
    host.innerHTML=""; host.appendChild(renderer.domElement);

    // svetla + mreža
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7); dir.position.set(2,3,2); scene.add(dir);
    const grid = new THREE.GridHelper(4, 20, 0x666a73, 0x2a3040); scene.add(grid);

    root = new THREE.Group(); scene.add(root);
    dimsGroup = new THREE.Group(); scene.add(dimsGroup);

    // gestovi
    const cvs = renderer.domElement;
    cvs.style.touchAction = "none";
    cvs.addEventListener("pointerdown", e=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; cvs.setPointerCapture(e.pointerId); });
    cvs.addEventListener("pointerup",   e=>{ dragging=false; cvs.releasePointerCapture?.(e.pointerId); });
    cvs.addEventListener("pointermove", e=>{
      if(!dragging) return;
      const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
      yaw -= dx*0.005; pitch -= dy*0.005;
      const lim=Math.PI/2-0.05; if(pitch>lim)pitch=lim; if(pitch<-lim)pitch=-lim;
      updateCameraPos();
    }, {passive:false});
    cvs.addEventListener("wheel", e=>{ e.preventDefault(); dist*= (1 + Math.sign(e.deltaY)*0.1); dist=Math.min(10, Math.max(0.35, dist)); updateCameraPos(); }, {passive:false});
    // pinch
    let t0=null;
    cvs.addEventListener("touchstart", e=>{ if(e.touches.length===2) t0 = pinchDist(e.touches); }, {passive:false});
    cvs.addEventListener("touchmove",  e=>{
      if(e.touches.length===2 && t0){ e.preventDefault(); const t1=pinchDist(e.touches); const k=t0/(t1||t0); dist*=k; dist=Math.min(10, Math.max(0.35, dist)); t0=t1; updateCameraPos(); }
    }, {passive:false});
    function pinchDist(ts){ const dx=ts[0].clientX-ts[1].clientX, dy=ts[0].clientY-ts[1].clientY; return Math.hypot(dx,dy); }

    // resize
    window.addEventListener("resize", ()=>{
      const w2=Math.max(10, host.clientWidth), h2=Math.max(10, host.clientHeight);
      camera.aspect=w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2);
    });

    // toolbar
    wireToolbar();

    animate();
    setStatus("3D: inicijalizovano — čekam podatke iz app.js");
  }

  function wireToolbar(){
    $("btnIso")   ?.addEventListener("click", ()=>{ yaw=Math.PI/4; pitch=Math.atan(0.6); dist=2.2; updateCameraPos(); });
    $("btnTop")   ?.addEventListener("click", ()=>{ pitch=Math.PI/2-0.001; yaw=0; dist=2.2; updateCameraPos(); });
    $("btnFront") ?.addEventListener("click", ()=>{ pitch=0; yaw=0; dist=2.2; updateCameraPos(); });
    $("btnExplode")?.addEventListener("click", ()=>{ exploded=!exploded; applyExplode(); });
    $("btnShot")  ?.addEventListener("click", ()=>{ const url=renderer.domElement.toDataURL("image/png"); const a=document.createElement("a"); a.href=url; a.download="3xmeri_3d.png"; document.body.appendChild(a); a.click(); a.remove(); });
  }

  function updateCameraPos(){
    camera.position.set(
      center.x + dist*Math.cos(pitch)*Math.sin(yaw),
      center.y + dist*Math.sin(pitch),
      center.z + dist*Math.cos(pitch)*Math.cos(yaw)
    );
    camera.lookAt(center);
  }

  function fitToRoot(){
    if(!root || root.children.length===0) return;
    const box=new THREE.Box3().setFromObject(root);
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x,size.y,size.z);
    const fov = camera.fov*Math.PI/180;
    dist = (maxDim/2)/Math.tan(fov/2)*1.6;
    updateCameraPos();
  }

  function clear(group){ while(group.children.length) group.remove(group.children[0]); }

  function buildFromApp(cfg, order, solved){
    clear(root); clear(dimsGroup);

    let x=0, built=0;
    const gap = (cfg?.Kitchen?.Gap ?? 2)*MM;

    (order||[]).forEach((it, i)=>{
      const sol = solved?.[i];
      const W  = (it.width  || 600)*MM;
      const D  = (it.depth  || cfg?.Kitchen?.Defaults?.CarcassDepth || 560)*MM;
      const Hc = (sol?.H_carcass ?? ((cfg?.Kitchen?.H_total||900)-(cfg?.Kitchen?.H_plinth||110)-(cfg?.Kitchen?.T_top||38)))*MM;

      const g = new THREE.Group(); g.position.set(x,0,0); root.add(g);

      // korpus
      const carc = new THREE.Mesh(new THREE.BoxGeometry(W,Hc,D), matCar);
      carc.position.set(W/2, Hc/2, D/2); g.add(carc);

      // 🔁 FRONTOVI OD VRHA NADOLE (prva fioka = gore)
      let remainingY = Hc; // od vrha na dole
      (sol?.fronts || []).forEach((fh, j)=>{
        const fH = fh*MM;
        const front = new THREE.Mesh(new THREE.BoxGeometry(W,fH, Math.max(0.012, 18*MM)), matFr);
        // pozicija: centar panela na [top - fH/2]
        remainingY -= fH;
        const zBase = Math.max(0.006, 9*MM);
        front.position.set(W/2, remainingY + fH/2, zBase);
        front.userData._zBase = zBase; // za explode
        g.add(front);
        if(j < (sol?.gaps?.length||0)) remainingY -= gap;
      });

      // 📏 dimenzije: W (na podu) + H (sa strane)
      dimsGroup.add(makeDimX(x, 0, D+0.02, W, `${Math.round(W/MM)}mm`));
      dimsGroup.add(makeDimY(x-0.02, 0, 0, Hc, `${Math.round(Hc/MM)}mm`));

      x += W + 0.03; built++;
    });

    applyExplode();
    fitToRoot();
    setStatus(`3D: izgrađeno elemenata: ${built}`);
  }

  // eksplodiraj frontove
  function applyExplode(){
    root.traverse(o=>{
      if(o.isMesh && o.geometry?.parameters?.depth && o.userData._zBase!=null){
        o.position.z = exploded ? (o.userData._zBase + explodeOffset) : o.userData._zBase;
      }
    });
  }

  // jednostavne dimenzione linije (X i Y)
  function makeLine(points, color=0x7aa2ff){
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
  }
  function makeDimX(x0,y0,z0, W, label){
    const a = new THREE.Vector3(x0, y0+0.001, z0);
    const b = new THREE.Vector3(x0+W, y0+0.001, z0);
    const tick = 0.01;
    const g = new THREE.Group();
    g.add(makeLine([a,b]));
    g.add(makeLine([a.clone().add(new THREE.Vector3(0, tick, 0)), a.clone().add(new THREE.Vector3(0,-tick,0))]));
    g.add(makeLine([b.clone().add(new THREE.Vector3(0, tick, 0)), b.clone().add(new THREE.Vector3(0,-tick,0))]));
    g.add(makeSprite(label, (x0+W/2), y0+0.02, z0));
    return g;
  }
  function makeDimY(x0,y0,z0, H, label){
    const a = new THREE.Vector3(x0, y0, z0+0.001);
    const b = new THREE.Vector3(x0, y0+H, z0+0.001);
    const tick = 0.01;
    const g = new THREE.Group();
    g.add(makeLine([a,b]));
    g.add(makeLine([a.clone().add(new THREE.Vector3( tick,0,0)), a.clone().add(new THREE.Vector3(-tick,0,0))]));
    g.add(makeLine([b.clone().add(new THREE.Vector3( tick,0,0)), b.clone().add(new THREE.Vector3(-tick,0,0))]));
    g.add(makeSprite(label, x0-0.02, y0+H/2, z0+0.001));
    return g;
  }
  function makeSprite(text, x,y,z){
    const c = document.createElement('canvas'); const s=256; c.width=c.height=s;
    const ctx=c.getContext('2d'); ctx.fillStyle='rgba(0,0,0,0)'; ctx.fillRect(0,0,s,s);
    ctx.fillStyle='#cfe3ff'; ctx.font='28px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(text, s/2, s/2);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest:false, depthWrite:false });
    const spr = new THREE.Sprite(mat); spr.scale.set(0.35,0.18,1); spr.position.set(x,y,z); return spr;
  }

  function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera); }

  function updateAndHook(){
    try{
      const out = window.recompute && window.recompute();
      if(out) buildFromApp(out.cfg, out.order, out.solved);
      const orig = window.recompute;
      window.recompute = function(){
        const r = orig ? orig() : null;
        if(r) buildFromApp(r.cfg, r.order, r.solved);
        return r;
      };
    }catch(e){ setStatus("3D: greška u povezivanju — "+e.message); }
  }

  // bootstrap
  window.addEventListener("DOMContentLoaded", ()=>{ init(); updateAndHook(); });

})();
