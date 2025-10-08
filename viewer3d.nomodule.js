// viewer3d.nomodule.js — mobile-friendly gestures (no ES modules)
(function(){
  if (!window.THREE) { console.error("THREE nije učitan."); return; }
  const THREE = window.THREE;
  const OrbitControlsCtor = THREE.OrbitControls || window.OrbitControls;

  let scene, camera, renderer, controls, root;
  const MM = 0.002; // 1 mm = 0.002 m

  function init3D(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141922);

    const w = Math.max(10, container.clientWidth);
    const h = Math.max(10, container.clientHeight);
    camera = new THREE.PerspectiveCamera(50, w/h, 0.001, 100);
    camera.position.set(2.2, 1.4, 2.4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(w, h);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 🟢 Ključno: spreči scroll stranice preko canvasa (iOS/Android)
    renderer.domElement.style.touchAction = 'none';  // moderne brauzere
    ['touchstart','touchmove','touchend','touchcancel'].forEach(evt => {
      renderer.domElement.addEventListener(evt, function(e){ e.preventDefault(); }, { passive: false });
    });

    if (OrbitControlsCtor) {
      controls = new OrbitControlsCtor(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.update();
    }

    // svetla
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(2,3,2);
    scene.add(dir);

    const grid = new THREE.GridHelper(4, 20, 0x666a73, 0x2a3040);
    grid.position.y = 0;
    scene.add(grid);

    root = new THREE.Group();
    scene.add(root);

    window.addEventListener('resize', () => {
      const w2 = Math.max(10, container.clientWidth);
      const h2 = Math.max(10, container.clientHeight);
      camera.aspect = w2/h2; camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    });

    (function loop(){
      requestAnimationFrame(loop);
      if (controls) controls.update();
      renderer.render(scene, camera);
    })();
  }

  function fitCameraToRoot() {
    if (!root || root.children.length === 0) return;
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI/180);
    let dist = (maxDim/2) / Math.tan(fov/2);
    dist *= 1.6;
    const dir = new THREE.Vector3(1, 0.6, 1).normalize();
    const newPos = center.clone().add(dir.multiplyScalar(dist));
    camera.position.copy(newPos);
    camera.near = Math.max(0.001, dist/50);
    camera.far = dist*50;
    camera.updateProjectionMatrix();
    if (controls) { controls.target.copy(center); controls.update(); }
  }

  function rebuildKitchen(cfg, order, solved) {
    if (!root) return;
    while (root.children.length) root.remove(root.children[0]);

    const matCarcass = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
    const matFront   = new THREE.MeshLambertMaterial({ color: 0xdcdcdc });

    let xCursor = 0;
    const gapMM = (cfg.Kitchen.Gap || 2) * MM;

    order.forEach((it, idx) => {
      const sol = solved[idx];
      const W = (it.width || 600) * MM;
      const D = (it.depth || cfg.Kitchen.Defaults.CarcassDepth || 560) * MM;
      const H = (sol && sol.H_carcass != null ? sol.H_carcass : (cfg.Kitchen.H_total - cfg.Kitchen.H_plinth - cfg.Kitchen.T_top)) * MM;

      const g = new THREE.Group();
      g.position.set(xCursor, 0, 0);
      root.add(g);

      const carcass = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), matCarcass);
      carcass.position.set(W/2, H/2, D/2);
      g.add(carcass);

      let y = 0;
      if (sol && Array.isArray(sol.fronts)) {
        sol.fronts.forEach((fh, i) => {
          const fH = fh * MM;
          const front = new THREE.Mesh(new THREE.BoxGeometry(W, fH, Math.max(0.012, 18*MM)), matFront);
          front.position.set(W/2, y + fH/2, Math.max(0.006, 9*MM));
          g.add(front);
          y += fH;
          if (i < (sol.gaps ? sol.gaps.length : 0)) y += gapMM;
        });
      }

      xCursor += W + 0.03;
    });

    fitCameraToRoot();
  }

  window.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('viewer3d');
    if (!host) return;
    init3D(host);
    const out = window.recompute && window.recompute();
    if (out) rebuildKitchen(out.cfg, out.order, out.solved);

    const orig = window.recompute;
    window.recompute = function(){
      const res = orig ? orig() : null;
      if (res) rebuildKitchen(res.cfg, res.order, res.solved);
      return res;
    };
  });
})();