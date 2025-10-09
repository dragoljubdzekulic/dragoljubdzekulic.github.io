// viewer3d.nomodule.v4.js — self-contained 3D sa ugrađenim kontrolama + statusom (bez OrbitControls)
(function(){
  function $(id){ return document.getElementById(id); }
  function setStatus(msg){ const el=$("viewer3d-status"); if(el) el.textContent = msg; }

  if(!window.THREE){ setStatus("Greška: THREE nije učitan"); return; }
  const THREE = window.THREE;

  let scene, camera, renderer, root;
  let dragging=false, lastX=0, lastY=0, yaw=0.9, pitch=0.5, dist=2.2; // “orbita” kamere
  const center = new THREE.Vector3(0,0.35,0);

  function init() {
    const host = $("viewer3d");
    if(!host){ setStatus("Nema #viewer3d elemenata u DOM-u"); return; }

    // canvas
    const w = Math.max(10, host.clientWidth);
    const h = Math.max(10, host.clientHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141922);

    camera = new THREE.PerspectiveCamera(50, w/h, 0.01, 100);
    updateCameraPos();

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(window.devicePixelRatio||1);
    renderer.setSize(w,h);
    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    // svetla + mreža
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7); dir.position.set(2,3,2); scene.add(dir);
    const grid = new THREE.GridHelper(4, 20, 0x666a73, 0x2a3040); scene.add(grid);

    // korenski čvor
    root = new THREE.Group(); scene.add(root);

    // gestovi (bez blokiranja cele strane)
    const cvs = renderer.domElement;
    cvs.style.touchAction = "none";
    cvs.addEventListener("pointerdown", e=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; cvs.setPointerCapture(e.pointerId); });
    cvs.addEventListener("pointerup",   e=>{ dragging=false; cvs.releasePointerCapture?.(e.pointerId); });
    cvs.addEventListener("pointermove", e=>{
      if(!dragging) return;
      const dx=(e.clientX-lastX), dy=(e.clientY-lastY);
      lastX=e.clientX; lastY=e.clientY;
      yaw -= dx*0.005; pitch -= dy*0.005;
      const lim = Math.PI/2-0.05; if(pitch>lim) pitch=lim; if(pitch<-lim) pitch=-lim;
      updateCameraPos();
    }, {passive:false});
    cvs.addEventListener("wheel", e=>{ e.preventDefault(); dist *= (1 + Math.sign(e.deltaY)*0.1); dist = Math.min(10, Math.max(0.4, dist)); updateCameraPos(); }, {passive:false});

    // pinch zoom (mobilni)
    let t0=null;
    cvs.addEventListener("touchstart", e=>{ if(e.touches.length===2){ t0 = touchDist(e.touches); } }, {passive:false});
    cvs.addEventListener("touchmove",  e=>{
      if(e.touches.length===2 && t0){ e.preventDefault(); const t1 = touchDist(e.touches); const scale = t0/(t1||t0); dist *= scale; dist = Math.min(10, Math.max(0.4, dist)); t0 = t1; updateCameraPos(); }
    }, {passive:false});
    function touchDist(ts){ const dx=ts[0].clientX-ts[1].clientX, dy=ts[0].clientY-ts[1].clientY; return Math.hypot(dx,dy); }

    window.addEventListener("resize", ()=>{
      const w2 = Math.max(10, host.clientWidth), h2 = Math.max(10, host.clientHeight);
      camera.aspect = w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2);
    });

    animate();
    setStatus("3D: inicijalizovano — čekam podatke iz app.js");
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
    const box = new THREE.Box3().setFromObject(root);
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x,size.y,size.z);
    // “dist” na osnovu veličine
    const fov = camera.fov*Math.PI/180;
    dist = (maxDim/2)/Math.tan(fov/2)*1.6;
    updateCameraPos();
  }

  function buildFromApp(cfg, order, solved){
    // očisti
    while(root.children.length) root.remove(root.children[0]);

    const MM = 0.002;
    const matCar = new THREE.MeshLambertMaterial({color:0x8a8f9a});
    const matFr  = new THREE.MeshLambertMaterial({color:0xdcdcdc});

    let x=0, built=0;
    const gap = (cfg?.Kitchen?.Gap ?? 2)*MM;

    (order||[]).forEach((it, i)=>{
      const sol = solved?.[i];
      const W = (it.width || 600)*MM;
      const D = (it.depth || cfg?.Kitchen?.Defaults?.CarcassDepth || 560)*MM;
      const Hc = (sol?.H_carcass ?? ((cfg?.Kitchen?.H_total||900)-(cfg?.Kitchen?.H_plinth||110)-(cfg?.Kitchen?.T_top||38)))*MM;

      const g = new THREE.Group(); g.position.set(x,0,0); root.add(g);

      const carc = new THREE.Mesh(new THREE.BoxGeometry(W,Hc,D), matCar);
      carc.position.set(W/2, Hc/2, D/2); g.add(carc);

      let y=0;
      (sol?.fronts || [200, Hc/MM-200]).forEach((fh, j)=>{
        const fH = fh*MM;
        const front = new THREE.Mesh(new THREE.BoxGeometry(W,fH, Math.max(0.012, 18*MM)), matFr);
        front.position.set(W/2, y+fH/2, Math.max(0.006, 9*MM)); g.add(front);
        y += fH; if(j < (sol?.gaps?.length||0)) y += gap;
      });

      x += W + 0.03; // 30 mm raster
      built++;
    });

    fitToRoot();
    setStatus(`3D: izgrađeno elemenata: ${built}`);
  }

  function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera); }

  // bootstrap
  window.addEventListener("DOMContentLoaded", ()=>{
    init();
    // pozovi app.js proračun i poveži hook
    try{
      const out = window.recompute && window.recompute();
      if(out) buildFromApp(out.cfg, out.order, out.solved);
      const orig = window.recompute;
      window.recompute = function(){
        const r = orig ? orig() : null;
        if(r) buildFromApp(r.cfg, r.order, r.solved);
        return r;
      };
    }catch(err){ setStatus("3D: greška u povezivanju — "+err.message); }
  });
})();
