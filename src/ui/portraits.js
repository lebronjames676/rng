// Renders hero portraits once with a small offscreen renderer and caches them as images.
import * as THREE from '../../vendor/three.module.min.js';
import { Rig } from '../world/models.js';
import { parseKey } from '../data/heroes.js';

let renderer, scene, camera;
const shadowMat = new THREE.MeshBasicMaterial({ color: '#232741' });
const cache = new Map();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(192, 192);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a9bb0', 2.0));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
}

// Returns a data URL for the hero stack key (or a black silhouette when `hidden`).
export function portrait(key, hidden = false) {
  const id = key + (hidden ? '#hidden' : '');
  if (cache.has(id)) return cache.get(id);
  try {
    if (!renderer) setup();
    const { hero, v } = parseKey(key);
    const model = hidden ? { ...hero.model, aura: null } : hero.model;
    const rig = new Rig(model, { golden: !hidden && (v === 'g' || v === 'hg'), shadows: false });
    rig.update(0);
    if (hidden) rig.root.traverse((o) => { if (o.isMesh) o.material = shadowMat; });
    rig.root.rotation.y = -0.45;
    scene.add(rig.root);
    const box = new THREE.Box3().setFromObject(rig.root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const fit = Math.max(size.y, size.x * 0.95) * 0.5 / Math.tan((camera.fov * Math.PI) / 360);
    camera.position.set(center.x + 0.5, center.y + 0.3, center.z + fit * 1.22);
    camera.lookAt(center.x, center.y, center.z);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(rig.root);
    cache.set(id, url);
    return url;
  } catch {
    return '';
  }
}
