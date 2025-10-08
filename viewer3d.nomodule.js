// viewer3d.nomodule.js — koristi globalni THREE i OrbitControls (UMD)
(function(){
  if (!window.THREE) { console.error("THREE nije učitan."); return; }
  const THREE = window.THREE;
  const OrbitControls = THREE.OrbitControls || window.OrbitControls;

  let scene, camera, renderer, controls, root;
  const MM = 0.002; // 1 mm = 0.002 m

  function init3D(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);

    const w = container.clientWidth, h = container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, w/h, 0.01, 100);
    camera.position.set(1.2, 0.8, 1.4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.35, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.update();

    const light1 = new THREE.HemisphereLight(0xffffff, 0x333333, 0.9);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0xffffff, 0.6);
    light2.position.set(1,2,1);
    scene.add(light2);

    root = new THREE.Group();
    scene.add(root);

    window.addEventListener('resize', () => {
      const w2 = container.clientWidth, h2 = container.clientHeight;
      camera.aspect = w2/h2; camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    });

    (function loop(){
      requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    })();
  }

  function rebuildKitchen(cfg, order, solved) {
    if (!root) return;
    while (root.children.length) root.remove(root.children[0]);

    const matCarcass = new THREE.MeshStandardMaterial({ color: 0x8a8f9a, metalness: 0.1, roughness: 0.9 });
    const matFront   = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.2, roughness: 0.6 });

    let xCursor = 0;
    const gapMM = (cfg.Kitchen.Gap || 2) * MM;

    order.forEach((it, idx) => {
      const sol = solved[idx];
      const W = (it.width || 600) * MM;
      const D = (it.depth || cfg.Kitchen.Defaults.CarcassDepth || 560) * MM;
      const H = (sol?.H_carcass || (cfg.Kitchen.H_total - cfg.Kitchen.H_plinth - cfg.Kitchen.T_top)) * MM;

      const g = new THREE.Group();
      g.position.set(xCursor, 0, 0);
      root.add(g);

      const carcass = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), matCarcass);
      carcass.position.set(W/2, H/2, D/2);
      g.add(carcass);

      let y = 0;
      (sol?.fronts || []).forEach((fh, i) => {
        const fH = fh * MM;
        const front = new THREE.Mesh(new THREE.BoxGeometry(W, fH, 0.018), matFront);
        front.position.set(W/2, y + fH/2, 0.009);
        g.add(front);
        y += fH;
        if (i < (sol.gaps?.length || 0)) y += gapMM;
      });

      xCursor += W + 0.03;
    });
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