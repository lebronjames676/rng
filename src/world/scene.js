// Renderer, camera, lights and an orbit-style camera you can drag and zoom.
import * as THREE from '../../vendor/three.module.min.js';
import { clamp } from '../util.js';

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = new THREE.Color('#9fd8ff');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 85, 170);

  const hemi = new THREE.HemisphereLight('#e6f4ff', '#6a8f3a', 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4dc', 2.1);
  sun.position.set(30, 55, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 5; sc.far = 160;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
  // The target sits a little toward the camera so the town shows above the roll reel.
  const view = { yaw: 0.0, pitch: 0.88, dist: 46, target: new THREE.Vector3(0, 0, 4.5) };

  function placeCamera() {
    const { yaw, pitch, dist, target } = view;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait screens need to back off so the whole town fits.
    camera.fov = w < h ? 58 : 42;
    camera.updateProjectionMatrix();
    placeCamera();
  }
  window.addEventListener('resize', resize);
  resize();

  // Drag to rotate, wheel or pinch to zoom. Small movements count as clicks.
  const el = renderer.domElement;
  const pointers = new Map();
  let dragDist = 0, pinchStart = 0, distStart = 0;
  el.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragDist = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      distStart = view.dist;
    }
  });
  window.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart > 0) view.dist = clamp(distStart * pinchStart / d, 25, 95);
      dragDist += 10;
    } else {
      dragDist += Math.abs(dx) + Math.abs(dy);
      if (dragDist > 6) {
        view.yaw -= dx * 0.006;
        view.pitch = clamp(view.pitch + dy * 0.004, 0.45, 1.4);
      }
    }
    placeCamera();
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = 0; };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.dist = clamp(view.dist * (1 + Math.sign(e.deltaY) * 0.08), 25, 95);
    placeCamera();
  }, { passive: false });

  return {
    renderer, scene, camera, sun, view,
    wasDrag: () => dragDist > 6,
    setShadows(on) {
      renderer.shadowMap.enabled = on;
      sun.castShadow = on;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    },
    resetView() { view.yaw = 0; view.pitch = 0.88; view.dist = 46; placeCamera(); },
  };
}
