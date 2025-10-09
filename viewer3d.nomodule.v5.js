// v5 — robusno vezivanje dugmadi + status poruke + ugrađene kontrole
(function(){
  const $ = (id)=>document.getElementById(id);
  const setStatus = (t)=>{ const el=$("viewer3d-status"); if(el) el.textContent=t; };

  if(!window.THREE){ setStatus("Greška: THREE nije učitan"); return; }
  const THREE = window.THREE;

  let scene, camera, renderer, root, dimsGroup;
  let dragging=false, lastX=0, lastY=0, yaw=Math.PI/4, pitch=Math.atan(0.6), dist=2.2;
  const center = new THREE.Vector3(0,0.35,0);
  let exploded=false; const explodeOffset=-0.08; // 80mm
  const MM=0.002;

  const matCar = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
  const matFr  = new THREE.MeshLambertMaterial({ color: 0xdcdcdc });

  function updateCameraPos(){
    camera.position.set(
      center.x + dist*Math.cos(pitch)*Math.sin(yaw),
      center.y + dist*Math.sin(pitch),
      center.z + dist*Math.cos(pitch)*Math.cos(yaw)
    );
    camera.lookAt(center);
  }

  function init(){
    const host = $("viewer3d");
    if(!host){ setStatus("Nema #viewer3d"); return; }

    const w = Math.max(10, host.clientWidth);
    const h = Math.max(10, host.clientHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141922);

    camera = new THREE.PerspectiveCamera(50, w/h, 0.01, 100);
    updateCameraPos();

    renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(window.devicePixelRatio||1);
    renderer.setSize(w,h);
    host.innerHTML=""; host.appendChild(renderer.domElement);

    // svetla + mreža
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7); dir.position.set(2,3,2); scene.add(dir);
    const grid = new THREE.GridHelper(4, 20, 0x666a73, 0x2a3040); scene.add(grid);

    root = new THREE.Group(); scene.add(root);
    dimsGroup = new THREE.Group(); scene.add(dimsGroup);

    // gestovi (drag, wheel, pinch)
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
    let pinch0=null;
    cvs.addEventListener("touchstart", e=>{ if(e.touches.length===2) pinch0 = td(e.touches); }, {passive:false});
    cvs.addEventListener("touchmove",  e=>{
      if(e.touches.length===2 && pinch0){ e.preventDefault(); const p1=td(e.touches); const k=pinch0/(p1||pinch0); dist*=k; dist=Math.min(10, Math.max(0.35, dist)); pinch0=p1; updateCameraPos(); }
    }, {passive:false});
    function td(ts){ const dx=ts[0].clientX-ts[1].clientX, dy=ts[0].clientY-ts[1].clientY; return Math.hypot(dx,dy); }

    window.addEventListener("resize", ()=>{
      const w2=Math.max(10, host.clientWidth), h2=Math.max(10, host.clientHeight);
      camera.aspect=w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2);
    });

    animate();
    setStatus("3D: inicijalizovano — čekam podatke iz app.js");

    // probaj da vežeš dugmad odmah i još par puta kasnije (ako DOM kasni)
    wireToolbar();
    setTimeout(wireToolbar, 200);
    setTimeout(wireToolbar, 800);
  }

  function clear(g){ while(g.children.length) g.remove(g.children[0]); }

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

  function makeLine(points, color=0x7aa2ff){
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
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
  function dimX(x0,y0,z0, W, label){
    const a = new THREE.Vector3(x0, y0+0.001, z0);
    const b = new THREE.Vector3(x0+W, y0+0.001, z0);
    const tick = 0.01, g = new THREE.Group();
    g.add(makeLine([a,b]));
    g.add(makeLine([a.clone().add(new THREE.Vector3(0, tick, 0)), a.clone().add(new THREE.Vector3(0,-tick,0))]));
    g.add(makeLine([b.clone().add(new THREE.Vector3(0, tick, 0)), b.clone().add(new THREE.Vector3(0,-tick,0))]));
    g.add(makeSprite(label, (x0+W/2), y0+0.02, z0)); return g;
  }
  function dimY(x0,y0,z0, H, label){
    const a = new THREE.Vector3(x0, y0, z0+0.001);
    const b = new THREE.Vector3(x0, y0+H, z0+0.001);
    const tick = 0.01, g = new THREE.Group();
    g.add(makeLine([a,b]));
    g.add(makeLine([a.clone().add(new THREE.Vector3( tick,0,0)), a.clone().add(new THREE.Vector3(-tick,0,0))]));
    g.add(makeLine([b.clone().add(new THREE.Vector3( tick,0,0)), b.clone().add(new THREE.Vector3(-tick,0,0))]));
    g.add(makeSprite(label, x0-0.02, y0+H/2, z0+0.001)); return g;
  }

  function applyExplode() {
  root.traverse(o => {
    if (o.userData && o.userData._isFront) {
      o.position.z = exploded ? (o.userData._zBase + explodeOffset) : o.userData._zBase;
    }
  });
  setStatus("3D: explode = " + (exploded ? "ON" : "OFF"));
}


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

      const carc = new THREE.Mesh(new THREE.BoxGeometry(W,Hc,D), matCar);
      carc.position.set(W/2, Hc/2, D/2); g.add(carc);

      // FRONTOVI OD VRHA NADOLE
let remainingY = Hc;              // polazimo od vrha
const tFront = Math.max(0.012, 18*MM);  // debljina fronta ~18 mm
const zFrontFace = D;             // prednja ivica korpusa je na z = D

(sol?.fronts || []).forEach((fh, j) => {
  const fH = fh * MM;

  // spusti se za visinu panela (od vrha do dole)
  remainingY -= fH;

  const front = new THREE.Mesh(
    new THREE.BoxGeometry(W, fH, tFront),
    matFr
  );

  // ✅ front NA PREDNJU RAVAN: z = D + t/2
  const zBase = zFrontFace + tFront / 2;

  front.position.set(W/2, remainingY + fH/2, zBase);
  front.userData = { _zBase: zBase, _isFront: true };
  g.add(front);

  // ubaci luft između frontova
  if (j < (sol?.gaps?.length || 0)) remainingY -= gap;
});


      // dimenzije
      dimsGroup.add(dimX(x, 0, D+0.02, W, `${Math.round(W/MM)}mm`));
      dimsGroup.add(dimY(x-0.02, 0, 0, Hc, `${Math.round(Hc/MM)}mm`));

      x += W + 0.03; built++;
    });

    applyExplode(); // primeni stanje
    fitToRoot();
    setStatus(`3D: izgrađeno elemenata: ${built}`);
  }

  function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera); }

  function wireToolbar(){
    const iso =   ()=>{ yaw=Math.PI/4; pitch=Math.atan(0.6); dist=2.2; updateCameraPos(); setStatus("3D: view = Iso"); };
    const top =   ()=>{ pitch=Math.PI/2-0.001; yaw=0; dist=2.2; updateCameraPos(); setStatus("3D: view = Top"); };
    const front = ()=>{ pitch=0; yaw=0; dist=2.2; updateCameraPos(); setStatus("3D: view = Front"); };
    const explode=()=>{ exploded=!exploded; applyExplode(); };
    const shot =  ()=>{
  renderer.render(scene, camera);               // dodatni render — bitno za PNG
  const url = renderer.domElement.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url; a.download = "3xmeri_3d.png";
  document.body.appendChild(a); a.click(); a.remove();
  setStatus("3D: screenshot ✓");
};


    $("btnIso")    && $("btnIso").addEventListener("click", iso);
    $("btnTop")    && $("btnTop").addEventListener("click", top);
    $("btnFront")  && $("btnFront").addEventListener("click", front);
    $("btnExplode")&& $("btnExplode").addEventListener("click", explode);
    $("btnShot")   && $("btnShot").addEventListener("click", shot);

    // izloži i na window za test u konzoli (ili bookmarklet)
    window._3x = { iso, top, front, explode, shot };
  }

  function hookApp(){
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

  window.addEventListener("DOMContentLoaded", ()=>{
    init();
    hookApp();
  });
})();
