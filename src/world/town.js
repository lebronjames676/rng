// The town: ground, roads, buildings and scenery. Rebuilt whenever town upgrades change.
import * as THREE from '../../vendor/three.module.min.js';
import { LANES, PATH_WIDTH, WALL_HALF, SLOT_POS, LOTS, LUMBER_POS, distToPaths, seeded } from './layout.js';
import { grassTex, dirtTex, cobbleTex, plankTex, thatchTex, stoneTex, soilTex, stripeTex, portalTex, glowTex, ringTex } from './textures.js';
import { boxGeo, lambert, basic, Rig } from './models.js';
import { HERO_BY_ID } from '../data/heroes.js';

// Box whose UVs repeat the texture once per `tile` world units.
const uvCache = new Map();
function boxUV(w, h, d, tile = 1) {
  const k = [w, h, d, tile].join('|');
  if (uvCache.has(k)) return uvCache.get(k);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * dims[f][0] / tile, uv.getY(idx) * dims[f][1] / tile);
    }
  }
  uvCache.set(k, g);
  return g;
}

function gableGeo(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

// Bake every static mesh under `group` into one mesh per material to cut draw calls.
// Objects flagged userData.dynamic (turrets, flags, farmers...) are left alone.
const inv = new THREE.Matrix4();
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  inv.copy(group.matrixWorld).invert();
  const meshes = [];
  const walk = (o) => {
    if (o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && !o.material.transparent) meshes.push(o);
    for (const c of o.children) walk(c);
  };
  for (const c of group.children) walk(c);
  const buckets = new Map();
  const m = new THREE.Matrix4();
  for (const o of meshes) {
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
    m.multiplyMatrices(inv, o.matrixWorld);
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m);
    buckets.get(key).geos.push(g);
    o.parent.remove(o);
  }
  for (const b of buckets.values()) {
    let n = 0;
    for (const g of b.geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let i = 0;
    for (const g of b.geos) {
      pos.set(g.attributes.position.array, i * 3);
      nor.set(g.attributes.normal.array, i * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, i * 2);
      i += g.attributes.position.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.userData.merged = true;
    group.add(mesh);
  }
}

function disposeMerged(group) {
  group.traverse((o) => { if (o.userData.merged) o.geometry.dispose(); });
}

const MAT = {};
function mats() {
  if (MAT.grass) return MAT;
  MAT.grass = new THREE.MeshLambertMaterial({ map: grassTex() });
  MAT.dirt = new THREE.MeshLambertMaterial({ map: dirtTex() });
  MAT.cobble = new THREE.MeshLambertMaterial({ map: cobbleTex() });
  MAT.plank = new THREE.MeshLambertMaterial({ map: plankTex('#b07a43') });
  MAT.plankDark = new THREE.MeshLambertMaterial({ map: plankTex('#7a4f2a') });
  MAT.thatch = new THREE.MeshLambertMaterial({ map: thatchTex() });
  MAT.stone = new THREE.MeshLambertMaterial({ map: stoneTex() });
  MAT.soil = new THREE.MeshLambertMaterial({ map: soilTex() });
  MAT.stripe = new THREE.MeshLambertMaterial({ map: stripeTex() });
  MAT.stripeBlue = new THREE.MeshLambertMaterial({ map: stripeTex('#2f6fd6', '#ffffff') });
  MAT.beam = lambert('#6b4423');
  MAT.door = lambert('#3b2414');
  MAT.window = lambert('#2a3a52');
  MAT.frame = lambert('#e9c44c');
  MAT.iron = lambert('#4d5866');
  MAT.log = lambert('#c58a54');
  MAT.logEnd = lambert('#e8b98a');
  MAT.leaf = lambert('#4caf2f');
  return MAT;
}

function add(parent, geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = !!opts.receive;
  parent.add(m);
  return m;
}

// ---------------- Buildings ----------------
function buildHouse(rnd) {
  const M = mats();
  const g = new THREE.Group();
  add(g, boxUV(3.0, 0.3, 2.8), M.stone, 0, 0.15, 0, { receive: true });
  add(g, boxUV(2.6, 1.7, 2.4), M.plank, 0, 1.15, 0);
  for (const [x, z] of [[-1.3, -1.2], [1.3, -1.2], [-1.3, 1.2], [1.3, 1.2]]) add(g, boxGeo(0.22, 1.75, 0.22), M.beam, x, 1.17, z);
  add(g, boxGeo(2.7, 0.18, 2.5), M.beam, 0, 2.06, 0);
  const roof = add(g, gableGeo(3.4, 1.55, 3.0), M.thatch, 0, 2.12, 0);
  roof.rotation.y = rnd() > 0.5 ? 0 : Math.PI / 2;
  add(g, boxUV(0.45, 1.3, 0.45), M.stone, 0.75, 2.9, -0.55);
  add(g, boxGeo(0.72, 1.15, 0.08), M.door, 0, 0.88, 1.22);
  add(g, boxGeo(0.86, 0.1, 0.1), M.frame, 0, 1.5, 1.24);
  for (const s of [-1, 1]) {
    add(g, boxGeo(0.08, 0.55, 0.55), M.window, s * 1.31, 1.35, 0);
    add(g, boxGeo(0.1, 0.08, 0.7), M.frame, s * 1.33, 1.08, 0);
  }
  return g;
}

function buildHall(level) {
  const M = mats();
  const g = new THREE.Group();
  if (level === 0) {
    add(g, boxUV(5.8, 0.4, 5.6), M.stone, 0, 0.2, 0, { receive: true });
    add(g, boxUV(4.8, 2.8, 4.4), M.plank, 0, 1.8, 0);
    for (const [x, z] of [[-2.4, -2.2], [2.4, -2.2], [-2.4, 2.2], [2.4, 2.2]]) add(g, boxGeo(0.34, 2.9, 0.34), M.beam, x, 1.85, z);
    add(g, boxGeo(5.0, 0.26, 4.6), M.beam, 0, 3.25, 0);
    add(g, gableGeo(5.9, 2.6, 5.3), M.thatch, 0, 3.35, 0);
    add(g, boxUV(0.7, 1.8, 0.7), M.stone, 1.4, 4.7, -1.2);
    // Arched door like the one in the reference town.
    add(g, boxGeo(1.4, 1.6, 0.1), M.door, 0, 1.2, 2.22);
    const arch = add(g, new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12, 1, false, 0, Math.PI), M.door, 0, 2.0, 2.22);
    arch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    add(g, boxGeo(1.7, 0.16, 0.14), M.frame, 0, 0.45, 2.26);
    for (const s of [-1, 1]) add(g, boxGeo(0.16, 1.9, 0.14), M.frame, s * 0.82, 1.35, 2.26);
    for (const s of [-1, 1]) {
      add(g, boxGeo(0.08, 0.7, 0.8), M.window, s * 2.42, 2.0, 0);
      add(g, boxGeo(0.7, 0.7, 0.08), M.window, s * 1.6, 2.1, 2.22);
    }
  } else if (level === 1) {
    add(g, boxUV(6.2, 0.5, 6.0), M.stone, 0, 0.25, 0, { receive: true });
    add(g, boxUV(5.0, 3.2, 4.8, 2), M.stone, 0, 2.1, 0);
    for (let i = -2; i <= 2; i++) {
      for (const [x, z] of [[i * 1.0, 2.4], [i * 1.0, -2.4], [2.5, i * 0.96], [-2.5, i * 0.96]]) add(g, boxUV(0.55, 0.5, 0.55), M.stone, x, 3.95, z);
    }
    add(g, gableGeo(4.4, 2.0, 4.0), M.thatch, 0, 3.7, 0);
    // Corner tower
    add(g, boxUV(1.8, 6.2, 1.8, 2), M.stone, -2.1, 3.1, -2.0);
    for (const [x, z] of [[-2.75, -2.65], [-1.45, -2.65], [-2.75, -1.35], [-1.45, -1.35]]) add(g, boxUV(0.5, 0.55, 0.5), M.stone, x, 6.45, z);
    add(g, boxGeo(1.5, 1.7, 0.1), M.door, 0, 1.35, 2.42);
    const arch = add(g, new THREE.CylinderGeometry(0.75, 0.75, 0.1, 12, 1, false, 0, Math.PI), M.door, 0, 2.2, 2.42);
    arch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    for (const s of [-1, 1]) add(g, boxGeo(0.7, 0.8, 0.08), M.window, s * 1.6, 2.4, 2.42);
    // Ivy
    for (const [x, y, z, w, h] of [[1.8, 1.4, 2.43, 0.8, 1.6], [-2.52, 1.6, 1.0, 0.06, 2.0], [2.52, 2.4, -0.8, 0.06, 1.4]]) {
      add(g, boxGeo(w, h, w > 0.1 ? 0.06 : 0.9), M.leaf, x, y, z);
    }
  } else {
    add(g, boxUV(8.0, 0.5, 8.0), M.stone, 0, 0.25, 0, { receive: true });
    add(g, boxUV(5.6, 5.0, 5.6, 2), M.stone, 0, 3.0, 0);
    for (let i = -2; i <= 2; i++) {
      for (const [x, z] of [[i * 1.12, 2.8], [i * 1.12, -2.8], [2.8, i * 1.12], [-2.8, i * 1.12]]) add(g, boxUV(0.6, 0.6, 0.6), M.stone, x, 5.8, z);
    }
    add(g, boxUV(2.6, 2.4, 2.6, 2), M.stone, 0, 6.6, 0);
    const keepRoof = add(g, new THREE.ConeGeometry(2.0, 2.4, 4), lambert('#3a5fc8'), 0, 9.0, 0);
    keepRoof.rotation.y = Math.PI / 4;
    const towerGeo = new THREE.CylinderGeometry(1.15, 1.25, 7, 10);
    const roofGeo = new THREE.ConeGeometry(1.45, 2.2, 10);
    for (const [x, z] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) {
      add(g, towerGeo, M.stone, x, 3.5, z);
      add(g, roofGeo, lambert('#3a5fc8'), x, 8.1, z);
      add(g, boxGeo(0.06, 1.2, 0.06), M.beam, x, 9.6, z);
      const flag = add(g, boxGeo(0.04, 0.5, 0.8), lambert('#d62f2f'), x, 9.9, z + 0.42);
      flag.userData.flag = true;
      flag.userData.dynamic = true;
    }
    add(g, boxGeo(1.8, 2.4, 0.1), M.door, 0, 1.7, 2.82);
    const arch = add(g, new THREE.CylinderGeometry(0.9, 0.9, 0.1, 12, 1, false, 0, Math.PI), M.door, 0, 2.9, 2.82);
    arch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    for (const s of [-1, 1]) {
      add(g, boxGeo(0.7, 1.6, 0.06), lambert('#d62f2f'), s * 1.7, 3.6, 2.83);
      add(g, boxGeo(0.3, 0.3, 0.07), lambert('#f0c040'), s * 1.7, 3.8, 2.85);
    }
  }
  return g;
}

function buildFarm(rnd, farmers) {
  const M = mats();
  const g = new THREE.Group();
  add(g, boxUV(4.6, 0.25, 3.6), M.soil, 0, 0.12, 0, { receive: true });
  const wheatGeo = boxGeo(0.12, 0.75, 0.12);
  const wheat = new THREE.InstancedMesh(wheatGeo, lambert('#f0c93b'), 48);
  const tips = new THREE.InstancedMesh(boxGeo(0.18, 0.22, 0.18), lambert('#ffdf5e'), 48);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let x = -1.9; x <= 1.95; x += 0.55) {
    for (let z = -1.3; z <= 1.35; z += 0.55) {
      if (i >= 48) break;
      const jx = x + (rnd() - 0.5) * 0.12, jz = z + (rnd() - 0.5) * 0.12;
      m.makeTranslation(jx, 0.6, jz); wheat.setMatrixAt(i, m);
      m.makeTranslation(jx, 1.05, jz); tips.setMatrixAt(i, m);
      i++;
    }
  }
  wheat.count = tips.count = i;
  wheat.castShadow = tips.castShadow = true;
  const sway = new THREE.Group();
  sway.add(wheat, tips);
  sway.userData.sway = true;
  sway.userData.dynamic = true;
  g.add(sway);
  // Little log fence on two sides.
  for (let x = -2.3; x <= 2.31; x += 0.58) add(g, boxGeo(0.14, 0.6, 0.14), M.log, x, 0.3, 1.95);
  add(g, boxGeo(4.7, 0.1, 0.08), M.log, 0, 0.45, 1.95);
  // A farmer in a straw hat tending the crops.
  const farmer = new Rig(HERO_BY_ID.villager.model, { scale: 0.7 });
  farmer.root.position.set(1.0, 0.25, 0.4);
  farmer.root.rotation.y = -0.8;
  farmer.root.userData.dynamic = true;
  g.add(farmer.root);
  farmers.push(farmer);
  return g;
}

function buildStall(rnd, striped) {
  const M = mats();
  const g = new THREE.Group();
  for (const [x, z] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]]) add(g, boxGeo(0.14, 2.2, 0.14), M.beam, x, 1.1, z);
  add(g, boxUV(2.4, 0.9, 0.8), M.plank, 0, 0.45, 0.55);
  const awning = add(g, boxUV(2.7, 0.08, 1.9), striped, 0, 2.25, 0.1);
  awning.rotation.x = 0.22;
  add(g, boxGeo(2.7, 0.3, 0.06), striped, 0, 2.0, 1.04);
  const goods = ['#e23b3b', '#f0c040', '#5fbf2f', '#c87b3a'];
  for (let i = 0; i < 6; i++) add(g, boxGeo(0.28, 0.22, 0.28), lambert(goods[Math.floor(rnd() * goods.length)]), -0.85 + i * 0.34, 1.0, 0.55);
  return g;
}

function buildCannon() {
  const M = mats();
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(1.4, 1.5, 0.3, 10), M.stone, 0, 0.15, 0, { receive: true });
  const turret = new THREE.Group();
  turret.position.y = 0.3;
  turret.userData.dynamic = true;
  g.add(turret);
  add(turret, boxGeo(1.0, 0.45, 1.3), M.plankDark, 0, 0.3, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.16, 10);
  for (const s of [-1, 1]) {
    const w = add(turret, wheelGeo, M.beam, s * 0.6, 0.45, 0);
    w.rotation.z = Math.PI / 2;
  }
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.75, 0);
  turret.add(barrel);
  const tube = add(barrel, new THREE.CylinderGeometry(0.28, 0.36, 1.7, 10), lambert('#4a5a73'), 0, 0, 0.45);
  tube.rotation.x = Math.PI / 2;
  const rim = add(barrel, new THREE.CylinderGeometry(0.34, 0.34, 0.14, 10), lambert('#3a475c'), 0, 0, 1.28);
  rim.rotation.x = Math.PI / 2;
  barrel.rotation.x = -0.25;
  return { group: g, turret, barrel, recoil: 0 };
}

function buildTower() {
  const M = mats();
  const g = new THREE.Group();
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) add(g, boxGeo(0.24, 4.6, 0.24), M.beam, x, 2.3, z);
  for (const s of [-1, 1]) {
    const b1 = add(g, boxGeo(0.12, 2.6, 0.12), M.log, s * 0.9, 1.8, 0);
    b1.rotation.x = 0.6;
    const b2 = add(g, boxGeo(0.12, 2.6, 0.12), M.log, 0, 1.8, s * 0.9);
    b2.rotation.z = 0.6;
  }
  add(g, boxUV(2.6, 0.25, 2.6), M.plank, 0, 4.6, 0);
  for (const s of [-1, 1]) {
    add(g, boxGeo(2.6, 0.5, 0.1), M.plankDark, 0, 5.0, s * 1.25);
    add(g, boxGeo(0.1, 0.5, 2.6), M.plankDark, s * 1.25, 5.0, 0);
  }
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) add(g, boxGeo(0.14, 1.6, 0.14), M.beam, x, 5.5, z);
  const roof = add(g, new THREE.ConeGeometry(2.1, 1.3, 4), M.thatch, 0, 6.9, 0);
  roof.rotation.y = Math.PI / 4;
  const turret = new THREE.Group();
  turret.position.y = 4.95;
  turret.userData.dynamic = true;
  g.add(turret);
  add(turret, boxGeo(0.14, 0.14, 1.2), M.beam, 0, 0.2, 0.1);
  add(turret, boxGeo(1.3, 0.08, 0.1), M.beam, 0, 0.22, 0.55);
  add(turret, boxGeo(0.18, 0.4, 0.18), M.beam, 0, 0, 0);
  return { group: g, turret, recoil: 0 };
}

function buildLumberMill(rnd) {
  const M = mats();
  const g = new THREE.Group();
  const cabin = buildHouse(rnd);
  g.add(cabin);
  const logGeo = new THREE.CylinderGeometry(0.25, 0.25, 2.2, 8);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const l = add(g, logGeo, M.log, 2.6, 0.25 + row * 0.44, -0.6 + i * 0.5 + row * 0.25);
      l.rotation.x = Math.PI / 2;
    }
  }
  for (let i = 0; i < 3; i++) add(g, new THREE.CylinderGeometry(0.35, 0.4, 0.4, 8), M.log, -2.4 + i * 0.4, 0.2, 2.0 - i);
  return g;
}

function buildPortal() {
  const M = mats();
  const g = new THREE.Group();
  for (const s of [-1, 1]) add(g, boxUV(0.9, 4.2, 0.9), M.stone, s * 2.2, 2.1, 0);
  add(g, boxUV(5.3, 0.9, 1.0), M.stone, 0, 4.5, 0);
  add(g, boxUV(1.2, 0.6, 1.1), M.stone, 0, 5.1, 0);
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshBasicMaterial({ map: portalTex(), transparent: true, opacity: 0.92 }));
  swirl.position.y = 2.1;
  swirl.scale.y = 1.05;
  g.add(swirl);
  const back = swirl.clone();
  back.rotation.y = Math.PI;
  g.add(back);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#b46bff', transparent: true, opacity: 0.6, depthWrite: false }));
  glow.scale.set(7, 7, 1);
  glow.position.y = 2.1;
  g.add(glow);
  g.userData.swirls = [swirl, back];
  mergeStatic(g);
  return g;
}

// ---------------- Instanced scenery ----------------
function forest(trees) {
  const n = trees.length;
  const group = new THREE.Group();
  const trunk = new THREE.InstancedMesh(boxGeo(0.45, 1.4, 0.45), lambert('#7a4f2a'), n);
  const layers = [
    [new THREE.ConeGeometry(1.6, 1.9, 4), 1.9],
    [new THREE.ConeGeometry(1.25, 1.6, 4), 3.0],
    [new THREE.ConeGeometry(0.85, 1.3, 4), 3.95],
  ].map(([geo, y]) => {
    geo.rotateY(Math.PI / 4);
    const im = new THREE.InstancedMesh(geo, lambert('#ffffff'), n);
    im.userData.y = y;
    return im;
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const greens = ['#3fae2c', '#4cbd35', '#36a02a', '#5ac83f'].map((c) => new THREE.Color(c));
  trees.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
    s.setScalar(t.scale);
    p.set(t.x, 0.7 * t.scale, t.z);
    m.compose(p, q, s);
    trunk.setMatrixAt(i, m);
    const col = greens[t.c % greens.length];
    for (const im of layers) {
      p.set(t.x, im.userData.y * t.scale, t.z);
      m.compose(p, q, s);
      im.setMatrixAt(i, m);
      im.setColorAt(i, col);
    }
  });
  for (const im of [trunk, ...layers]) { im.castShadow = true; group.add(im); }
  return group;
}

function scatter(geo, mat, items, { cast = false, colors } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  items.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x, it.y || 0, it.z), q, new THREE.Vector3(it.sx || 1, it.sy || 1, it.sz || 1));
    im.setMatrixAt(i, m);
    if (colors) im.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  });
  im.castShadow = cast;
  return im;
}

// ---------------- Town ----------------
export class Town {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.dynamic = new THREE.Group();
    this.root.add(this.dynamic);
    this.cannons = [];
    this.towers = [];
    this.farmers = [];
    this.pads = [];
    this.portals = [];
    this.swaying = [];
    this.key = '';
    this.buildStatic();
  }

  buildStatic() {
    const M = mats();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    M.grass.map.repeat.set(55, 55);
    this.root.add(ground);

    const rnd = seeded(42);
    const free = (x, z, r) => {
      if (distToPaths(x, z) < PATH_WIDTH / 2 + r + 0.6) return false;
      for (const lane of LANES) if (Math.hypot(x - lane[0][0], z - lane[0][1]) < 5 + r) return false;
      return true;
    };
    const trees = [];
    // Dense forest outside the walls.
    for (let i = 0; i < 900 && trees.length < 260; i++) {
      const x = (rnd() - 0.5) * 120, z = (rnd() - 0.5) * 120;
      if (Math.max(Math.abs(x), Math.abs(z)) < WALL_HALF + 2.5) continue;
      if (Math.hypot(x - LUMBER_POS[0], z - LUMBER_POS[1]) < 6) continue;
      const scale = 0.8 + rnd() * 0.7;
      if (!free(x, z, 1.4 * scale)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2)) continue;
      trees.push({ x, z, scale, rot: rnd() * Math.PI, c: Math.floor(rnd() * 4) });
    }
    // A few trees inside the walls, away from lots, pads and the hall.
    const lots = Object.values(LOTS).flat();
    for (let i = 0; i < 400 && trees.length < 290; i++) {
      const x = (rnd() - 0.5) * 2 * (WALL_HALF - 2), z = (rnd() - 0.5) * 2 * (WALL_HALF - 2);
      if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
      if (!free(x, z, 1.4)) continue;
      if (lots.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 4.2)) continue;
      if (SLOT_POS.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 3)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue;
      trees.push({ x, z, scale: 0.7 + rnd() * 0.3, rot: rnd() * Math.PI, c: Math.floor(rnd() * 4) });
    }
    this.root.add(forest(trees));

    // Flowers, rocks and grass tufts.
    const flowers = [], rocks = [], tufts = [];
    for (let i = 0; i < 1400; i++) {
      const x = (rnd() - 0.5) * 100, z = (rnd() - 0.5) * 100;
      if (!free(x, z, 0.2)) continue;
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      const r = rnd();
      if (r < 0.22) flowers.push({ x, z, y: 0.12, sx: 0.22, sy: 0.22, sz: 0.22, ry: rnd() });
      else if (r < 0.235 && Math.max(Math.abs(x), Math.abs(z)) > WALL_HALF + 2) rocks.push({ x, z, y: 0.25, sx: 1.2 + rnd() * 1.4, sy: 0.5 + rnd() * 0.6, sz: 1.0 + rnd() * 1.2, ry: rnd() * 3 });
      else tufts.push({ x, z, y: 0.15, sx: 0.12, sy: 0.3 + rnd() * 0.2, sz: 0.12, ry: rnd() * 3 });
    }
    this.root.add(scatter(boxGeo(1, 1, 1), lambert('#ffffff'), flowers, { colors: ['#ff5c8a', '#ffd23f', '#ffffff', '#b46bff', '#ff8a3d'] }));
    this.root.add(scatter(boxGeo(1, 1, 1), lambert('#9aa0a8'), rocks, { cast: true }));
    this.root.add(scatter(boxGeo(1, 1, 1), lambert('#4fa828'), tufts));

    // Enemy portals at the start of each road.
    for (const lane of LANES) {
      const p = buildPortal();
      const [x, z] = lane[0], [nx, nz] = lane[1];
      p.position.set(x, 0, z);
      p.rotation.y = Math.atan2(nx - x, nz - z);
      this.root.add(p);
      this.portals.push(p);
    }

    // Lumber camp in the forest corner.
    this.lumber = buildLumberMill(seeded(5));
    this.lumber.position.set(LUMBER_POS[0], 0, LUMBER_POS[1]);
    this.lumber.rotation.y = Math.PI / 4;
    this.root.add(this.lumber);
    mergeStatic(this.lumber);

    // Hero pads.
    const padGeo = new THREE.CylinderGeometry(1.15, 1.3, 0.3, 18);
    SLOT_POS.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const base = add(g, padGeo, M.stone, 0, 0.15, 0, { receive: true });
      base.castShadow = false;
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, depthWrite: false, color: '#ffffff' }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.32;
      g.add(ring);
      this.root.add(g);
      this.pads.push({ group: g, ring, index: i });
    });
  }

  // Rebuild buildings when town upgrades change. `t` is stats.town.
  build(t, stats) {
    const key = JSON.stringify([t, stats.cannons, stats.towers]);
    if (key === this.key) return;
    this.key = key;
    const M = mats();
    this.farmers = [];
    disposeMerged(this.dynamic);
    this.root.remove(this.dynamic);
    this.dynamic = new THREE.Group();
    this.root.add(this.dynamic);
    const D = this.dynamic;
    const rnd = seeded(99);

    // Roads
    const roadMat = t.roads ? M.cobble : M.dirt;
    LANES.forEach((lane, li) => {
      for (let i = 1; i < lane.length; i++) {
        const [ax, az] = lane[i - 1], [bx, bz] = lane[i];
        const len = Math.hypot(bx - ax, bz - az) + PATH_WIDTH;
        const horiz = Math.abs(bx - ax) > Math.abs(bz - az);
        const geo = boxUV(horiz ? len : PATH_WIDTH, 0.1, horiz ? PATH_WIDTH : len, 2);
        add(D, geo, roadMat, (ax + bx) / 2, 0.05 + li * 0.002 + i * 0.001, (az + bz) / 2, { cast: false, receive: true });
      }
    });
    const plaza = t.roads ? 10 : 7.4;
    add(D, boxUV(plaza, 0.1, plaza, 2), roadMat, 0, 0.06, 0, { cast: false, receive: true });

    // Town hall
    const hall = buildHall(t.hall);
    D.add(hall);
    mergeStatic(hall);
    hall.userData.dynamic = true;
    this.hall = hall;
    this.flags = [];
    hall.traverse((o) => { if (o.userData.flag) this.flags.push(o); });

    const face = (g, x, z) => {
      g.position.set(x, 0, z);
      g.rotation.y = Math.round(Math.atan2(-x, -z) / (Math.PI / 2)) * (Math.PI / 2);
    };
    for (let i = 0; i < Math.min(t.houses, LOTS.house.length); i++) {
      const h = buildHouse(rnd);
      face(h, ...LOTS.house[i]);
      D.add(h);
    }
    for (let i = 0; i < Math.min(t.farms, LOTS.farm.length); i++) {
      const f = buildFarm(rnd, this.farmers);
      face(f, ...LOTS.farm[i]);
      D.add(f);
    }
    for (let i = 0; i < Math.min(t.market, LOTS.market.length); i++) {
      const s = buildStall(rnd, i % 2 ? M.stripeBlue : M.stripe);
      face(s, ...LOTS.market[i]);
      D.add(s);
    }
    this.cannons = [];
    for (let i = 0; i < Math.min(stats.cannons, LOTS.cannon.length); i++) {
      const c = buildCannon();
      c.group.position.set(LOTS.cannon[i][0], 0, LOTS.cannon[i][1]);
      c.pos = new THREE.Vector3(LOTS.cannon[i][0], 1.0, LOTS.cannon[i][1]);
      D.add(c.group);
      this.cannons.push(c);
    }
    this.towers = [];
    for (let i = 0; i < Math.min(stats.towers, LOTS.tower.length); i++) {
      const c = buildTower();
      c.group.position.set(LOTS.tower[i][0], 0, LOTS.tower[i][1]);
      c.pos = new THREE.Vector3(LOTS.tower[i][0], 5.2, LOTS.tower[i][1]);
      D.add(c.group);
      this.towers.push(c);
    }
    this.lumber.visible = !!t.lumber;
    this.swaying = [];
    D.traverse((o) => { if (o.userData.sway) this.swaying.push(o); });

    if (t.walls) D.add(t.walls >= 2 ? this.stoneWalls() : this.palisade());
    if (t.roads) D.add(this.lamps());
    mergeStatic(D);
  }

  wallSpots(step) {
    // Positions around the wall square, leaving gaps where roads pass.
    const gaps = LANES.map((l) => l[0]);
    const spots = [];
    const H = WALL_HALF;
    for (let s = -H; s <= H + 0.001; s += step) {
      for (const [x, z, horiz] of [[s, -H, true], [s, H, true], [-H, s, false], [H, s, false]]) {
        const gap = gaps.some(([gx, gz]) => (horiz ? Math.abs(gx - x) < 2.6 && Math.sign(gz) === Math.sign(z) : Math.abs(gz - z) < 2.6 && Math.sign(gx) === Math.sign(x)));
        if (!gap) spots.push({ x, z, horiz });
      }
    }
    return spots;
  }

  palisade() {
    const M = mats();
    const spots = this.wallSpots(0.62);
    const g = new THREE.Group();
    const logs = scatter(new THREE.CylinderGeometry(0.3, 0.3, 1.9, 7), M.log, spots.map((s) => ({ x: s.x, z: s.z, y: 0.95, sy: 0.9 + ((s.x * 7 + s.z * 3) % 1 + 1) % 1 * 0.25 })), { cast: true });
    const tips = scatter(new THREE.ConeGeometry(0.3, 0.55, 7), M.logEnd, spots.map((s) => ({ x: s.x, z: s.z, y: 2.05 })), { cast: true });
    g.add(logs, tips);
    return g;
  }

  stoneWalls() {
    const M = mats();
    const g = new THREE.Group();
    const spots = this.wallSpots(1.0);
    g.add(scatter(boxUV(1.02, 2.8, 1.02, 2), M.stone, spots.map((s) => ({ x: s.x, z: s.z, y: 1.4 })), { cast: true }));
    const crenel = spots.filter((_, i) => i % 2 === 0);
    g.add(scatter(boxUV(0.6, 0.55, 1.0), M.stone, crenel.map((s) => ({ x: s.x, z: s.z, y: 3.05, ry: s.horiz ? 0 : Math.PI / 2 })), { cast: true }));
    // Gate towers beside each road and corner towers.
    const towers = [];
    for (const [gx, gz] of LANES.map((l) => l[0])) {
      const horiz = Math.abs(gz) > Math.abs(gx);
      const cx = horiz ? gx : Math.sign(gx) * WALL_HALF, cz = horiz ? Math.sign(gz) * WALL_HALF : gz;
      for (const s of [-1, 1]) towers.push({ x: cx + (horiz ? s * 3.1 : 0), z: cz + (horiz ? 0 : s * 3.1) });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) towers.push({ x: sx * WALL_HALF, z: sz * WALL_HALF });
    g.add(scatter(boxUV(2.2, 4.2, 2.2, 2), M.stone, towers.map((t) => ({ ...t, y: 2.1 })), { cast: true }));
    g.add(scatter(new THREE.ConeGeometry(1.7, 1.6, 4), lambert('#d62f2f'), towers.map((t) => ({ ...t, y: 5.0, ry: Math.PI / 4 })), { cast: true }));
    return g;
  }

  lamps() {
    const M = mats();
    const g = new THREE.Group();
    const spots = [[2.2, -9], [-2.2, -12.5], [9, 2.2], [12.5, -2.2], [-2.2, 9], [2.2, 12.5], [-9, -2.2], [-12.5, 2.2]];
    for (const [x, z] of spots) {
      const l = new THREE.Group();
      l.position.set(x, 0, z);
      add(l, boxGeo(0.16, 2.6, 0.16), M.beam, 0, 1.3, 0);
      add(l, boxGeo(0.7, 0.12, 0.12), M.beam, 0.3, 2.55, 0);
      add(l, boxGeo(0.3, 0.38, 0.3), basic('#ffd77a'), 0.55, 2.25, 0, { cast: false });
      add(l, boxGeo(0.36, 0.08, 0.36), M.iron, 0.55, 2.47, 0);
      g.add(l);
    }
    return g;
  }

  // Ring colour on each hero pad.
  setPads(slots, colors) {
    this.pads.forEach((p) => {
      const unlocked = p.index < slots;
      p.group.visible = p.index <= slots && p.index < 8;
      p.ring.material.color.set(unlocked ? colors[p.index] || '#ffffff' : '#555555');
      p.ring.material.opacity = unlocked ? (colors[p.index] ? 0.95 : 0.45) : 0.25;
    });
  }

  update(dt, t) {
    for (const f of this.farmers) {
      f.update(dt);
      if (f.atkT < 0 && Math.random() < dt * 0.4) f.attack('melee', 0.9);
    }
    for (const p of this.portals) {
      p.userData.swirls[0].rotation.z = t * 1.5;
      p.userData.swirls[1].rotation.z = -t * 1.5;
    }
    if (this.flags) for (const f of this.flags) f.rotation.y = Math.sin(t * 3 + f.position.x) * 0.25;
    for (const s of this.swaying) s.rotation.z = Math.sin(t * 1.6 + s.parent.position.x) * 0.03;
    for (const c of [...this.cannons, ...this.towers]) {
      if (c.recoil > 0) c.recoil = Math.max(0, c.recoil - dt * 4);
      if (c.barrel) c.barrel.position.z = -c.recoil * 0.35;
    }
  }
}
