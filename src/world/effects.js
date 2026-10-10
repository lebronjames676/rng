// Visual effects: cube bursts, projectiles, lightning, shockwaves, and the 2D overlay
// that draws health bars and floating numbers.
import * as THREE from '../../vendor/three.module.min.js';
import { glowTex } from './textures.js';
import { boxGeo, basic, lambert } from './models.js';
import { fmt } from '../util.js';

const glowMats = new Map();
function glowMat(color) {
  let m = glowMats.get(color);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    glowMats.set(color, m);
  }
  return m;
}
const SPHERE = new THREE.IcosahedronGeometry(1, 1);
const CRESCENT = new THREE.TorusGeometry(0.85, 0.09, 4, 14, Math.PI);
const CONE = new THREE.ConeGeometry(0.09, 0.28, 4).rotateX(Math.PI / 2);
const SPEAR_TIP = new THREE.ConeGeometry(0.14, 0.45, 4).rotateX(Math.PI / 2);

export function makeProjectile(kind, color) {
  const g = new THREE.Group();
  const m = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  switch (kind) {
    case 'arrow':
      m(boxGeo(0.05, 0.05, 0.9), lambert('#8b5a2b'));
      m(CONE, lambert('#c9d1d9'), 0, 0, 0.52);
      m(boxGeo(0.16, 0.02, 0.18), lambert(color), 0, 0, -0.4);
      break;
    case 'bolt': {
      const s = m(SPHERE, basic(color)); s.scale.setScalar(0.22);
      const sp = new THREE.Sprite(glowMat(color)); sp.scale.setScalar(1.3); g.add(sp);
      break;
    }
    case 'fireball': {
      const s = m(SPHERE, basic('#ffd27a')); s.scale.setScalar(0.32);
      const sp = new THREE.Sprite(glowMat(color)); sp.scale.setScalar(2.0); g.add(sp);
      break;
    }
    case 'shuriken': {
      const a = m(boxGeo(0.55, 0.04, 0.12), lambert(color));
      const b = m(boxGeo(0.12, 0.04, 0.55), lambert(color));
      g.userData.spin = [a, b];
      break;
    }
    case 'spear':
      m(boxGeo(0.07, 0.07, 1.8), lambert('#7a4a24'));
      m(SPEAR_TIP, lambert(color), 0, 0, 1.05);
      { const sp = new THREE.Sprite(glowMat(color)); sp.scale.setScalar(0.9); sp.position.z = 1.0; g.add(sp); }
      break;
    case 'slash':
    case 'scythe': {
      const big = kind === 'scythe';
      const c = m(CRESCENT, basic(color, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      c.rotation.x = -Math.PI / 2;
      c.scale.setScalar(big ? 1.35 : 0.9);
      const sp = new THREE.Sprite(glowMat(color)); sp.scale.setScalar(big ? 2.4 : 1.4); g.add(sp);
      break;
    }
    case 'cannonball': {
      const s = m(SPHERE, lambert('#2b2f36')); s.scale.setScalar(0.3);
      break;
    }
    case 'ballista':
      m(boxGeo(0.08, 0.08, 1.3), lambert('#6b4423'));
      m(CONE, lambert('#c9d1d9'), 0, 0, 0.72);
      break;
  }
  return g;
}

export class Effects {
  constructor(scene, camera, overlay) {
    this.scene = scene;
    this.camera = camera;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.texts = [];
    this.temps = [];
    this.v = new THREE.Vector3();

    // Pooled cube particles in a single instanced mesh.
    this.max = 700;
    this.cubes = new THREE.InstancedMesh(boxGeo(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), this.max);
    this.cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cubes.setColorAt(0, new THREE.Color());
    this.cubes.count = 0;
    this.cubes.frustumCulled = false;
    scene.add(this.cubes);
    this.parts = [];
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.c = new THREE.Color();
    this.sv = new THREE.Vector3();
  }

  burst(pos, colors, n = 12, { speed = 4, size = 0.22, up = 4, life = 0.9, gravity = 14 } = {}) {
    for (let i = 0; i < n && this.parts.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.6), t: 0,
        size: size * (0.6 + Math.random() * 0.8),
        rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 12,
        color: colors[i % colors.length], gravity,
      });
    }
  }

  // Short-lived meshes: shockwave rings, lightning, muzzle flashes.
  shockwave(pos, radius, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 28), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.25, pos.z);
    this.scene.add(ring);
    this.temps.push({ obj: ring, t: 0, life: 0.35, update: (k) => { ring.scale.setScalar(0.3 + k * radius); mat.opacity = 0.7 * (1 - k); } });
  }

  flash(pos, color, size = 2.5, life = 0.18) {
    const sp = new THREE.Sprite(glowMat(color));
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    this.scene.add(sp);
    this.temps.push({ obj: sp, t: 0, life, update: (k) => sp.scale.setScalar(size * (1 + k)), shared: true });
  }

  lightning(points, color) {
    const pts = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const j = s === 0 || s === steps ? 0 : 0.45;
        pts.push(new THREE.Vector3(
          a.x + (b.x - a.x) * t + (Math.random() - 0.5) * j,
          a.y + (b.y - a.y) * t + (Math.random() - 0.5) * j,
          a.z + (b.z - a.z) * t + (Math.random() - 0.5) * j,
        ));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.temps.push({ obj: line, t: 0, life: 0.22, update: (k) => { mat.opacity = 1 - k; } });
    for (const p of points.slice(1)) this.flash(p, color, 1.6, 0.2);
  }

  text(pos, str, { color = '#ffffff', size = 22, life = 0.9, rise = 1.6 } = {}) {
    if (this.texts.length > 90) this.texts.shift();
    this.texts.push({ x: pos.x + (Math.random() - 0.5) * 0.6, y: pos.y, z: pos.z, str, color, size, life, t: 0, rise });
  }

  damage(pos, amount, crit) {
    this.text(pos, fmt(amount), crit ? { color: '#ffdf3b', size: 30 } : { color: '#ffffff', size: 21 });
  }

  update(dt) {
    // Particles
    const { m4, q, e, c } = this;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.size / 2) { p.y = p.size / 2; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += p.spin * dt;
    }
    for (const p of this.parts) {
      const k = p.t / p.life;
      const s = p.size * (k > 0.7 ? (1 - k) / 0.3 : 1);
      e.set(p.rx, p.ry + p.rx, 0);
      q.setFromEuler(e);
      m4.compose(this.v.set(p.x, p.y, p.z), q, this.sv.set(s, s, s));
      this.cubes.setMatrixAt(n, m4);
      this.cubes.setColorAt(n, c.set(p.color));
      n++;
    }
    this.cubes.count = n;
    this.cubes.instanceMatrix.needsUpdate = true;
    if (this.cubes.instanceColor) this.cubes.instanceColor.needsUpdate = true;

    for (let i = this.temps.length - 1; i >= 0; i--) {
      const t = this.temps[i];
      t.t += dt;
      const k = Math.min(1, t.t / t.life);
      t.update(k);
      if (k >= 1) {
        this.scene.remove(t.obj);
        if (!t.shared) { t.obj.geometry?.dispose(); t.obj.material?.dispose(); }
        this.temps.splice(i, 1);
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
  }

  // Draws HP bars for `bars` ([{pos, frac, boss, golden}]) and all floating texts.
  drawOverlay(bars) {
    const cv = this.overlay, ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const v = this.v;
    const toScreen = (x, y, z) => {
      v.set(x, y, z).project(this.camera);
      if (v.z > 1) return null;
      return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
    };
    for (const b of bars) {
      const s = toScreen(b.pos.x, b.pos.y, b.pos.z);
      if (!s) continue;
      const bw = b.boss ? 90 : 38, bh = b.boss ? 9 : 6;
      const x = s[0] - bw / 2, y = s[1];
      ctx.fillStyle = 'rgba(15,18,28,0.85)';
      ctx.beginPath(); ctx.roundRect(x - 2, y - 2, bw + 4, bh + 4, 4); ctx.fill();
      ctx.fillStyle = b.frac > 0.5 ? '#5ee25b' : b.frac > 0.25 ? '#ffc93b' : '#ff4a4a';
      if (b.golden) ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.roundRect(x, y, Math.max(1, bw * b.frac), bh, 3); ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const k = t.t / t.life;
      const s = toScreen(t.x, t.y + k * t.rise, t.z);
      if (!s) continue;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : k < 0.25 ? 1.1 - (k - 0.15) : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `700 ${Math.round(t.size * pop)}px Fredoka, "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, t.size / 5);
      ctx.strokeStyle = '#1b1530';
      ctx.strokeText(t.str, s[0], s[1]);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, s[0], s[1]);
    }
    ctx.globalAlpha = 1;
  }
}
