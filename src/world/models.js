// Blocky (Roblox-style) character builder for heroes, enemies and townsfolk.
// Characters face +Z with their feet at y = 0.
import * as THREE from '../../vendor/three.module.min.js';
import { faceTextures, ribsTexture, ringTex } from './textures.js';
import { lerp, easeOutCubic } from '../util.js';

const geoCache = new Map();
export function boxGeo(w, h, d) {
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); }
  return g;
}
const coneCache = new Map();
function coneGeo(r, h, seg = 4) {
  const k = `${r}|${h}|${seg}`;
  let g = coneCache.get(k);
  if (!g) { g = new THREE.ConeGeometry(r, h, seg); if (seg === 4) g.rotateY(Math.PI / 4); coneCache.set(k, g); }
  return g;
}
const SPHERE = new THREE.IcosahedronGeometry(1, 1);
const TORUS = new THREE.TorusGeometry(0.42, 0.06, 6, 20);
const RING_PLANE = new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2);

const matCache = new Map();
const keyOf = (extra) => Object.entries(extra).map(([k, v]) => `${k}:${v?.isTexture ? v.uuid : v}`).join(',');
export function lambert(color, extra = {}) {
  const k = 'L' + color + keyOf(extra);
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, ...extra }); matCache.set(k, m); }
  return m;
}
export function basic(color, extra = {}) {
  const k = 'B' + color + keyOf(extra);
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, ...extra }); matCache.set(k, m); }
  return m;
}
// Golden variant: every surface becomes polished gold, keeping light/dark detail.
function goldMat(color) {
  const c = new THREE.Color(color);
  const l = Math.round((0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * 6) / 6;
  const k = 'G' + l;
  let m = matCache.get(k);
  if (!m) {
    const col = new THREE.Color('#9a6a0a').lerp(new THREE.Color('#ffe066'), Math.min(1, l * 1.3 + 0.15));
    m = new THREE.MeshPhongMaterial({ color: col, specular: '#fff1b8', shininess: 70, emissive: '#3d2600' });
    matCache.set(k, m);
  }
  return m;
}

// Head front with the pixel-art face; glowing eyes use an emissive map.
function faceMaterial(model, golden) {
  const tex = faceTextures(model);
  const k = `F${tex.map.uuid}|${golden}|${!!model.ghost}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      map: tex.map,
      color: golden ? '#ffd54a' : '#ffffff',
      transparent: !!model.ghost, opacity: model.ghost ? 0.8 : 1,
      emissive: tex.emissive ? '#ffffff' : '#000000',
      emissiveMap: tex.emissive || null,
      emissiveIntensity: tex.emissive ? 1.3 : 0,
    });
    matCache.set(k, m);
  }
  return m;
}

function makeMat(golden, ghost) {
  return (color) => {
    if (golden) return goldMat(color);
    if (ghost) return lambert(color, { transparent: true, opacity: 0.72 });
    return lambert(color);
  };
}

function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  return m;
}
function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = mesh(geo, mat, shadow);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ---------------- Head gear ----------------
function buildHat(hat, M, head) {
  const c = hat.color;
  const g = new THREE.Group();
  head.add(g);
  const helmet = () => {
    add(g, boxGeo(1.0, 0.4, 0.94), M(c), 0, 0.72, 0);
    add(g, boxGeo(1.04, 0.08, 0.98), M(c), 0, 0.54, 0);
    add(g, boxGeo(0.1, 0.26, 0.06), M(c), 0, 0.42, 0.45);
  };
  const horns = (col, big, tip) => {
    for (const s of [-1, 1]) {
      add(g, boxGeo(0.2, 0.2, 0.2), M(col), s * 0.54, 0.7, 0);
      const h2 = add(g, boxGeo(0.15, big ? 0.42 : 0.32, 0.15), M(col), s * 0.68, big ? 1.0 : 0.94, 0);
      h2.rotation.z = -s * 0.45;
      const h3 = add(g, boxGeo(0.1, big ? 0.32 : 0.22, 0.1), tip ? basic(tip) : M(col), s * (big ? 0.76 : 0.72), big ? 1.32 : 1.18, big ? 0.06 : 0);
      h3.rotation.z = s * 0.2;
      if (big) h3.rotation.x = 0.35;
    }
  };
  switch (hat.type) {
    case 'straw':
      add(g, boxGeo(1.36, 0.07, 1.3), M(c), 0, 0.86, 0);
      add(g, boxGeo(0.82, 0.3, 0.8), M(c), 0, 1.02, 0);
      add(g, boxGeo(0.84, 0.08, 0.82), M('#b5452c'), 0, 0.92, 0);
      break;
    case 'cap': {
      add(g, boxGeo(0.98, 0.24, 0.9), M(c), 0, 0.9, 0);
      add(g, boxGeo(0.8, 0.06, 0.42), M(c), 0, 0.8, 0.55);
      const f = add(g, boxGeo(0.05, 0.45, 0.14), M(hat.accent || '#d63a3a'), 0.45, 1.05, -0.1);
      f.rotation.z = -0.45;
      break;
    }
    case 'helmet': helmet(); break;
    case 'plume': {
      add(g, boxGeo(0.1, 0.14, 0.95), M('#c3ccd5'), 0, 0.9, 0);
      const p = add(g, boxGeo(0.14, 0.5, 0.6), M(c), 0, 1.15, -0.12);
      p.rotation.x = -0.3;
      break;
    }
    case 'hood':
    case 'hoodpeak':
      add(g, boxGeo(1.0, 0.08, 0.94), M(c), 0, 0.88, 0);
      add(g, boxGeo(0.06, 0.92, 0.94), M(c), 0.5, 0.42, 0);
      add(g, boxGeo(0.06, 0.92, 0.94), M(c), -0.5, 0.42, 0);
      add(g, boxGeo(1.0, 0.92, 0.06), M(c), 0, 0.42, -0.46);
      if (hat.type === 'hoodpeak') {
        const p = add(g, coneGeo(0.42, 0.75), M(c), 0, 1.15, -0.22);
        p.rotation.x = -0.55;
      }
      break;
    case 'wizard': {
      add(g, boxGeo(1.3, 0.06, 1.3), M(c), 0, 0.86, 0);
      add(g, boxGeo(0.82, 0.12, 0.82), M(hat.accent || '#ffd23f'), 0, 0.95, 0);
      const cone = add(g, coneGeo(0.56, 1.25), M(c), 0, 1.5, -0.04);
      cone.rotation.x = -0.18;
      break;
    }
    case 'crown': {
      const col = hat.color;
      add(g, boxGeo(0.94, 0.2, 0.08), M(col), 0, 0.92, 0.43);
      add(g, boxGeo(0.94, 0.2, 0.08), M(col), 0, 0.92, -0.43);
      add(g, boxGeo(0.08, 0.2, 0.94), M(col), 0.43, 0.92, 0);
      add(g, boxGeo(0.08, 0.2, 0.94), M(col), -0.43, 0.92, 0);
      for (const [x, z] of [[-0.43, -0.43], [0.43, -0.43], [-0.43, 0.43], [0.43, 0.43], [0, 0.43], [0, -0.43], [0.43, 0], [-0.43, 0]]) {
        add(g, boxGeo(0.12, 0.2, 0.12), M(col), x, 1.1, z);
      }
      add(g, boxGeo(0.16, 0.16, 0.04), basic('#ff3b5c'), 0, 0.92, 0.48, false);
      break;
    }
    case 'horns': horns(c, false); break;
    case 'demonhorns': horns(c, true, '#ff1a3c'); break;
    case 'viking': helmet(); horns('#efe6cf', false); break;
    case 'bandana': {
      add(g, boxGeo(0.96, 0.16, 0.9), M(c), 0, 0.62, 0);
      for (const s of [-1, 1]) {
        const t = add(g, boxGeo(0.08, 0.08, 0.42), M(c), s * 0.1, 0.6, -0.6);
        t.rotation.y = s * 0.35; t.rotation.x = 0.4;
      }
      break;
    }
    case 'halo': {
      const h = add(g, TORUS, basic(c), 0, 1.15, 0, false);
      h.rotation.x = Math.PI / 2;
      g.userData.halo = h;
      break;
    }
    case 'winged':
      helmet();
      for (const s of [-1, 1]) {
        const w = add(g, boxGeo(0.04, 0.32, 0.42), M('#ffffff'), s * 0.54, 0.86, -0.05);
        w.rotation.z = -s * 0.6;
      }
      break;
  }
  return g;
}

// ---------------- Weapons (built along +Y from the grip) ----------------
function buildWeapon(w, M) {
  const g = new THREE.Group();
  const wood = M('#7a4a24');
  const metal = M(w.color || '#c9d1d9');
  const bladeMat = w.glow ? basic(w.blade || w.color) : M(w.blade || w.color || '#c9d1d9');
  let tilt = 0.3;
  switch (w.type) {
    case 'sword':
      add(g, boxGeo(0.09, 0.3, 0.09), M('#5b3a1e'), 0, 0, 0);
      add(g, boxGeo(0.36, 0.08, 0.12), M('#e3b341'), 0, 0.18, 0);
      add(g, boxGeo(0.13, 0.95, 0.05), w.glow ? basic(w.color) : metal, 0, 0.7, 0);
      tilt = 0.7;
      break;
    case 'katana':
      add(g, boxGeo(0.08, 0.36, 0.08), M('#b02020'), 0, 0, 0);
      add(g, boxGeo(0.2, 0.04, 0.2), M('#e3b341'), 0, 0.2, 0);
      add(g, boxGeo(0.07, 1.05, 0.04), metal, 0, 0.75, 0);
      tilt = 0.8;
      break;
    case 'dagger':
      add(g, boxGeo(0.08, 0.2, 0.08), M('#4a2a14'), 0, 0, 0);
      add(g, boxGeo(0.1, 0.42, 0.04), metal, 0, 0.32, 0);
      tilt = 1.0;
      break;
    case 'pitchfork':
      add(g, boxGeo(0.07, 1.9, 0.07), M(w.color), 0, 0.45, 0);
      add(g, boxGeo(0.42, 0.06, 0.06), M('#9aa3ad'), 0, 1.4, 0);
      for (const x of [-0.18, 0, 0.18]) add(g, boxGeo(0.05, 0.36, 0.05), M('#9aa3ad'), x, 1.6, 0);
      tilt = 0.2;
      break;
    case 'bow': {
      const col = M(w.color);
      const segs = [[0, 0, 0.14, 0], [0.32, 0.06, 0.12, -0.35], [-0.32, 0.06, 0.12, 0.35], [0.58, 0.16, 0.12, -0.6], [-0.58, 0.16, 0.12, 0.6]];
      for (const [y, z, s, r] of segs) {
        const m = add(g, boxGeo(0.08, 0.34, s), col, 0, y, z);
        m.rotation.x = r;
      }
      add(g, boxGeo(0.02, 1.3, 0.02), M('#f2f2f2'), 0, 0, 0.26, false);
      tilt = 0.35;
      break;
    }
    case 'crossbow':
      add(g, boxGeo(0.12, 0.12, 0.8), M(w.color), 0, 0.05, 0.3);
      add(g, boxGeo(1.0, 0.07, 0.08), M('#5b3a1e'), 0, 0.08, 0.62);
      add(g, boxGeo(0.9, 0.02, 0.02), M('#f2f2f2'), 0, 0.08, 0.45, false);
      tilt = 0.35;
      break;
    case 'staff':
    case 'skullstaff': {
      add(g, boxGeo(0.09, 2.0, 0.09), M(w.color), 0, 0.55, 0);
      if (w.type === 'skullstaff') {
        add(g, boxGeo(0.34, 0.3, 0.3), M('#f2efe6'), 0, 1.7, 0);
        add(g, boxGeo(0.08, 0.08, 0.02), basic(w.gem), -0.08, 1.72, 0.16, false);
        add(g, boxGeo(0.08, 0.08, 0.02), basic(w.gem), 0.08, 1.72, 0.16, false);
      } else {
        const gem = add(g, boxGeo(0.24, 0.24, 0.24), basic(w.gem || '#7fd0ff'), 0, 1.68, 0, false);
        gem.rotation.set(0.6, 0.6, 0);
        g.userData.gem = gem;
        for (const [x, z] of [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]]) add(g, boxGeo(0.05, 0.22, 0.05), M(w.color), x, 1.55, z);
      }
      tilt = 0.12;
      break;
    }
    case 'hammer':
      add(g, boxGeo(0.09, 1.2, 0.09), wood, 0, 0.35, 0);
      add(g, boxGeo(0.38, 0.38, 0.62), metal, 0, 0.95, 0);
      add(g, boxGeo(0.4, 0.1, 0.64), M('#e3b341'), 0, 0.95, 0);
      tilt = 0.5;
      break;
    case 'axe':
      add(g, boxGeo(0.08, 1.05, 0.08), wood, 0, 0.3, 0);
      add(g, boxGeo(0.06, 0.52, 0.42), metal, 0, 0.72, 0.2);
      tilt = 0.5;
      break;
    case 'scythe':
      add(g, boxGeo(0.09, 2.3, 0.09), M(w.color), 0, 0.65, 0);
      add(g, boxGeo(0.12, 0.14, 0.12), M('#555'), 0, 1.78, 0);
      {
        const b1 = add(g, boxGeo(0.06, 0.2, 0.55), bladeMat, 0, 1.8, 0.3);
        const b2 = add(g, boxGeo(0.06, 0.18, 0.45), bladeMat, 0, 1.7, 0.72);
        b2.rotation.x = 0.4;
        const b3 = add(g, boxGeo(0.06, 0.13, 0.32), bladeMat, 0, 1.52, 1.0);
        b3.rotation.x = 0.85;
        b1.castShadow = b2.castShadow = b3.castShadow = true;
      }
      tilt = 0.1;
      break;
    case 'spear':
      add(g, boxGeo(0.07, 2.2, 0.07), wood, 0, 0.6, 0);
      add(g, coneGeo(0.13, 0.42), M(w.color), 0, 1.9, 0);
      tilt = 0.3;
      break;
    case 'lance':
      add(g, boxGeo(0.1, 0.4, 0.1), M('#5b3a1e'), 0, 0, 0);
      add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 8), M(w.color), 0, 0.24, 0);
      add(g, coneGeo(0.2, 1.8, 6), M(w.color), 0, 1.18, 0);
      tilt = 0.6;
      break;
  }
  g.userData.tilt = tilt;
  return g;
}

function buildOffhand(o, M, rig) {
  const g = new THREE.Group();
  switch (o.type) {
    case 'shield':
      add(g, boxGeo(0.64, 0.78, 0.1), M(o.color), 0, 0.05, 0.22);
      add(g, boxGeo(0.26, 0.32, 0.04), M(o.accent || '#e9c44c'), 0, 0.05, 0.29);
      break;
    case 'flame': {
      const f = new THREE.Group();
      f.position.set(0, 0.0, 0.2);
      const c2 = new THREE.Color(o.color).offsetHSL(0.05, 0, 0.15);
      add(f, boxGeo(0.2, 0.2, 0.2), basic(o.color), 0, 0, 0, false);
      add(f, boxGeo(0.13, 0.16, 0.13), basic('#' + c2.getHexString()), 0.03, 0.16, 0.02, false);
      add(f, boxGeo(0.07, 0.1, 0.07), basic('#ffe0a0'), -0.02, 0.28, 0, false);
      g.add(f);
      rig.flames.push(f);
      break;
    }
    case 'orb': {
      const s = add(g, SPHERE, basic(o.color), 0, 0, 0.2, false);
      s.scale.setScalar(0.17);
      rig.flames.push(s);
      break;
    }
    case 'axe': {
      const a = buildWeapon({ type: 'axe', color: o.color }, M);
      a.rotation.x = 0.8;
      g.add(a);
      break;
    }
  }
  return g;
}

// ---------------- Character rig ----------------
export class Rig {
  constructor(model, { golden = false, scale = 1, shadows = true } = {}) {
    this.model = model;
    const M = makeMat(golden, model.ghost);
    this.flames = [];
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.size = scale * (model.scale || 1);
    this.body.scale.setScalar(this.size);
    this.ghost = !!model.ghost;
    this.zombie = !!model.zombie;
    this.time = Math.random() * 10;
    this.walkPhase = 0;
    this.walkSpeed = 0;
    this.atkT = -1;
    this.hitT = 0;

    const bony = model.bony, chunky = model.chunky;
    const limb = bony ? 0.22 : chunky ? 0.46 : 0.34;
    const torsoW = bony ? 0.64 : chunky ? 1.15 : 0.86;
    const torsoD = chunky ? 0.62 : 0.48;
    const parts = (this.parts = {});
    const core = []; // only the main body blocks cast shadows

    if (!this.ghost) {
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * (torsoW / 4 + 0.01), 0.6, 0);
        core.push(add(pivot, boxGeo(limb + 0.02, 0.6, limb + 0.06), M(model.pants), 0, -0.3, 0));
        this.body.add(pivot);
        parts[s < 0 ? 'legL' : 'legR'] = pivot;
      }
    } else {
      add(this.body, boxGeo(0.72, 0.3, 0.42), M(model.shirt), 0, 0.46, 0);
      add(this.body, boxGeo(0.5, 0.26, 0.32), M(model.shirt), 0, 0.2, -0.04);
      add(this.body, boxGeo(0.28, 0.2, 0.2), M(model.shirt), 0, -0.02, -0.1);
    }

    // Torso, optionally with a printed ribcage on the front.
    let torsoMat = M(model.shirt);
    if (model.ribs && !golden) {
      const side = M(model.shirt);
      const front = lambert('#ffffff', { map: ribsTexture(model.shirt, model.bony ? '#bdb7a8' : '#f2efe6') });
      torsoMat = [side, side, side, side, front, side];
    }
    parts.torso = add(this.body, boxGeo(torsoW, 0.72, torsoD), torsoMat, 0, 0.96, 0);
    core.push(parts.torso);
    if (model.belt) add(this.body, boxGeo(torsoW + 0.03, 0.1, torsoD + 0.03), M(model.belt), 0, 0.68, 0);
    if (model.trim) add(this.body, boxGeo(torsoW + 0.03, 0.08, torsoD + 0.03), golden ? M(model.trim) : basic(model.trim), 0, 0.63, 0);

    // Arms pivot at the shoulder.
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * (torsoW / 2 + limb / 2), 1.27, 0);
      core.push(add(pivot, boxGeo(limb, 0.48, limb), M(model.shirt), 0, -0.22, 0));
      add(pivot, boxGeo(limb * 0.96, 0.24, limb * 0.96), M(model.skin), 0, -0.56, 0);
      const hand = new THREE.Group();
      hand.position.set(0, -0.62, 0);
      pivot.add(hand);
      this.body.add(pivot);
      parts[s < 0 ? 'armL' : 'armR'] = pivot;
      parts[s < 0 ? 'handL' : 'handR'] = hand;
    }

    // Head with a pixel-art face on the front.
    const head = new THREE.Group();
    head.position.y = 1.32;
    this.body.add(head);
    parts.head = head;
    const headColor = model.face === 'hood' ? model.hood : model.skin;
    const faceMat = faceMaterial(model, golden);
    const hm = M(headColor);
    core.push(add(head, boxGeo(0.92, 0.84, 0.84), [hm, hm, hm, hm, faceMat, hm], 0, 0.42, 0));
    if (model.ears) {
      for (const s of [-1, 1]) {
        const e = add(head, boxGeo(0.34, 0.14, 0.08), M(model.skin), s * 0.6, 0.5, 0);
        e.rotation.z = s * 0.35;
      }
    }
    if (model.hair) {
      add(head, boxGeo(0.96, 0.95, 0.14), M(model.hair), 0, 0.4, -0.44);
      add(head, boxGeo(0.16, 0.6, 0.16), M(model.hair), 0, -0.2, -0.46);
    }
    if (model.beard && model.face === 'beard') add(head, boxGeo(0.66, 0.26, 0.12), M(model.beard), 0, -0.02, 0.4);
    if (model.hat) this.hat = buildHat(model.hat, M, head);

    if (model.weapon) {
      const w = buildWeapon(model.weapon, M);
      w.position.z = 0.12;
      parts.handR.add(w);
      parts.weapon = w;
    }
    if (model.offhand) parts.handL.add(buildOffhand(model.offhand, M, this));

    if (model.cape) {
      const cape = new THREE.Group();
      cape.position.set(0, 1.3, -torsoD / 2 - 0.03);
      add(cape, boxGeo(torsoW * 0.95, 1.08, 0.05), M(model.cape), 0, -0.54, 0);
      cape.rotation.x = 0.12;
      this.body.add(cape);
      parts.cape = cape;
    }
    if (model.wings) {
      parts.wings = [];
      for (const s of [-1, 1]) {
        const wing = new THREE.Group();
        wing.position.set(s * 0.18, 1.15, -torsoD / 2 - 0.04);
        const wm = M(model.wings);
        add(wing, boxGeo(0.05, 0.28, 1.05), wm, 0, 0.32, -0.5);
        add(wing, boxGeo(0.05, 0.28, 0.82), wm, 0, 0.04, -0.4);
        add(wing, boxGeo(0.05, 0.28, 0.56), wm, 0, -0.24, -0.28);
        wing.rotation.y = s * -0.9;
        wing.userData.side = s;
        this.body.add(wing);
        parts.wings.push(wing);
      }
    }
    if (model.aura) {
      const aura = new THREE.Group();
      const ring = new THREE.Mesh(RING_PLANE, basic(model.aura, { map: ringTex(), transparent: true, opacity: 0.55, depthWrite: false }));
      ring.position.y = 0.04;
      aura.add(ring);
      this.auraBits = [];
      for (let i = 0; i < 6; i++) {
        const b = add(aura, boxGeo(0.12, 0.12, 0.12), basic(model.aura), 0, 0, 0, false);
        b.userData.phase = i / 6;
        this.auraBits.push(b);
      }
      this.body.add(aura);
    }

    this.restR = this.zombie ? -1.45 : -0.35;
    this.restL = this.zombie ? -1.45 : -0.15;
    if (parts.weapon) parts.weapon.rotation.x = -this.restR + parts.weapon.userData.tilt;
    parts.armR.rotation.x = this.restR;
    parts.armL.rotation.x = this.restL;

    this.root.traverse((o) => { if (o.isMesh) { o.receiveShadow = false; o.castShadow = false; } });
    if (shadows) for (const m of core) m.castShadow = true;
  }

  // kind: 'melee' swings overhead, 'cast' points forward.
  attack(kind = 'melee', duration = 0.45) {
    this.atkT = 0;
    this.atkKind = kind;
    this.atkDur = duration;
  }

  hit() { this.hitT = 1; }

  update(dt) {
    const p = this.parts;
    this.time += dt;
    const t = this.time;
    if (this.walkSpeed > 0) this.walkPhase += dt * this.walkSpeed * 3.4;
    const sw = this.walkSpeed > 0 ? Math.sin(this.walkPhase) : 0;
    if (p.legL) { p.legL.rotation.x = sw * 0.75; p.legR.rotation.x = -sw * 0.75; }
    p.armL.rotation.x = this.restL - sw * (this.zombie ? 0.1 : 0.55);

    let armR = this.restR + sw * (this.zombie ? 0.1 : 0.45);
    if (this.atkT >= 0) {
      this.atkT += dt / this.atkDur;
      const k = Math.min(1, this.atkT);
      if (this.atkKind === 'melee') {
        if (k < 0.35) armR = lerp(this.restR, -2.8, easeOutCubic(k / 0.35));
        else if (k < 0.55) armR = lerp(-2.8, 0.35, (k - 0.35) / 0.2);
        else armR = lerp(0.35, this.restR, (k - 0.55) / 0.45);
      } else {
        if (k < 0.3) armR = lerp(this.restR, -1.55, k / 0.3);
        else if (k < 0.65) armR = -1.55;
        else armR = lerp(-1.55, this.restR, (k - 0.65) / 0.35);
      }
      if (this.atkT >= 1) this.atkT = -1;
    }
    p.armR.rotation.x = armR;

    let y = 0;
    if (this.ghost || this.model.float) y = 0.35 + Math.sin(t * 2.2) * 0.15;
    else y = Math.abs(sw) * 0.07 + Math.sin(t * 2.6) * 0.015;
    this.body.position.y = y;
    p.head.rotation.z = Math.sin(t * 1.3) * 0.03;

    if (this.hitT > 0) {
      this.hitT = Math.max(0, this.hitT - dt * 6);
      const s = this.size * (1 + this.hitT * 0.18);
      this.body.scale.set(s, this.size * (1 - this.hitT * 0.12), s);
    }

    for (const f of this.flames) {
      const s = 1 + Math.sin(t * 13 + f.id) * 0.12;
      f.scale.set(f.isMesh ? 0.17 * s : s, f.isMesh ? 0.17 * s : s * 1.1, f.isMesh ? 0.17 * s : s);
      if (!f.isMesh) f.rotation.y = t * 2;
    }
    if (p.weapon?.userData.gem) p.weapon.userData.gem.rotation.y = t * 2;
    if (p.cape) p.cape.rotation.x = 0.14 + Math.sin(t * 2.2) * 0.05 + (this.walkSpeed > 0 ? 0.25 : 0);
    if (p.wings) for (const w of p.wings) w.rotation.y = w.userData.side * (-0.95 + Math.sin(t * 3) * 0.18);
    if (this.hat?.userData.halo) this.hat.userData.halo.position.y = 1.15 + Math.sin(t * 2) * 0.05;
    if (this.auraBits) {
      for (const b of this.auraBits) {
        const ph = (t * 0.45 + b.userData.phase) % 1;
        const a = b.userData.phase * Math.PI * 2 + t * 1.2;
        b.position.set(Math.cos(a) * 0.75, ph * 2.2, Math.sin(a) * 0.75);
        b.scale.setScalar(1 - ph);
        b.rotation.set(t, t * 1.3, 0);
      }
    }
  }
}
