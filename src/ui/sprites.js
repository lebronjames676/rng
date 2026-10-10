// 2D cartoon hero sprites: chunky blocky chibis in a slight 3/4 view with thick ink outlines,
// flat cel shading and a glowing ground ring. Drawn once per stack key and size, cached as blob URLs.
//
// Note: the sprites follow the 2D reference art, so the weapon is in the viewer's LEFT hand and the
// off-hand item on the right. The 3D rig (world/models.js) holds the weapon in its +x hand, which is the
// viewer's RIGHT. The mirroring is deliberate; do not "fix" one to match the other.
import { parseKey, HEROES, RARITIES } from '../data/heroes.js';
import { faceTextures } from '../world/textures.js';

const INK = '#1b1530';
const SILHOUETTE = '#0b0d1f';  // darker than every index card, so undiscovered heroes still read
const KX = 0.27, KY = 0.2;     // oblique projection: depth runs up and to the right
const HEAD = 1.12;             // chibi head scale relative to the 3D rig
// Stamp offsets (px) that grow the figure: a 3px ink contour, then a light rim outside it so dark heroes
// still read on the navy UI. Whole pixels keep the stamps cheap plain copies.
const CONTOUR = [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [2, -2], [-2, 2], [-2, -2]];
const RIM = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const RIM_SMALL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Two layouts: the 256 card (drawn at k = 1, or k = 2 for the 512 reveal) and a 128 card for the reel and
// team slots, where the hero fills more of the frame and keeps the same 3px contour so it stays chunky.
// `pad` is the margin of the geometry (outline, contour and rim come on top), `center` caps how far a
// lopsided hero may slide sideways, `blur` and `fade` are the glow blur and the edge fade.
const FULL = { size: 256, feet: 214, feetHuge: 222, pad: 12, base: 59, huge: 1.25, minFit: 0.92, center: 10, rim: RIM, blur: 12, fade: 12, small: false };
const SMALL = { size: 128, feet: 112, feetHuge: 112, pad: 10, base: 36.5, huge: 1.14, minFit: 0.84, center: 5, rim: RIM_SMALL, blur: 7, fade: 6, small: true };
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const cache = new Map();

// ---------------- Colour ----------------
function rgb(c) {
  let h = c.slice(1);
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (c) => { const [r, g, b] = rgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const rgba = (c, a) => `rgba(${rgb(c).join(',')},${a})`;
const RAINBOW = ['#ff4778', '#ffb52e', '#fff36b', '#6ee36f', '#43b0ff', '#bd6bff'];

// Golden variant: map each colour's brightness onto a dark-gold..light-gold ramp. Dark parts land on a
// deep gold (not bronze) and the spread keeps shirts, pants and skin apart.
const GOLD = ['#7a4a00', '#c98a10', '#f2b51e', '#ffe066'];
function gold(c) {
  const t = Math.min(1, 0.22 + lum(c) * 0.95) * (GOLD.length - 1);
  const i = Math.min(GOLD.length - 2, Math.floor(t));
  return mix(GOLD[i], GOLD[i + 1], t - i);
}
// Near-black surfaces are lifted a little so the ink outlines still read against them.
function lift(c) {
  const l = lum(c);
  return l < 0.18 ? mix(c, '#6b6584', ((0.18 - l) / 0.18) * 0.6) : c;
}

// Plain CPU-backed canvases (willReadFrequently): sprites are small and encoded to PNG right away, so
// GPU canvases would only add readbacks (about 10x slower overall in headless Chrome).
function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

// Scratch canvases are pooled per size and cleared on reuse; only the encoded PNGs are kept. A failed
// render drops the pools, since it may have left a clip or a save() behind.
const pools = new Map();
function scratch(D, name) {
  let pool = pools.get(D);
  if (!pool) pools.set(D, (pool = new Map()));
  let entry = pool.get(name);
  if (!entry) pool.set(name, (entry = canvas(D)));
  const ctx = entry[1];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0; ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.imageSmoothingEnabled = true;
  ctx.filter = 'none';
  ctx.clearRect(0, 0, D, D);
  return entry;
}

// ---------------- Tiny 3D math (x right, y up, z towards the viewer) ----------------
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const VIEW = unit([KX, KY, 1]);
const LIGHT = unit([-0.35, 0.75, 0.55]);

function mmul(a, b) {
  const r = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return r;
}
const mvec = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const det = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);

// Local transform: scale, then Euler XYZ rotation (like three.js), then translate.
function tf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const [sx, sy, sz] = Array.isArray(s) ? s : [s, s, s];
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const r = mmul(mmul([1, 0, 0, 0, ca, -sa, 0, sa, ca], [cb, 0, sb, 0, 1, 0, -sb, 0, cb]), [cc, -sc, 0, sc, cc, 0, 0, 0, 1]);
  return { m: mmul(r, [sx, 0, 0, 0, sy, 0, 0, 0, sz]), t: [x, y, z] };
}
const chain = (a, b) => ({ m: mmul(a.m, b.m), t: mvec(a.m, b.t).map((v, i) => v + a.t[i]) });
const apply = (T, v) => mvec(T.m, v).map((x, i) => x + T.t[i]);
const at = (T, ...args) => chain(T, tf(...args));

// Newell's method: outward normal of a counter-clockwise face.
function normal(pts) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit([x, y, z]);
}

// ---------------- Meshes ----------------
const area = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);

// A flat 2D outline (x, y) extruded along z by `d`, centred on z = 0. Works for concave shapes too.
function slabMesh(pts, d) {
  if (area(pts) < 0) pts = pts.slice().reverse();
  const n = pts.length;
  const v = [...pts.map(([x, y]) => [x, y, d / 2]), ...pts.map(([x, y]) => [x, y, -d / 2])];
  const f = [pts.map((_, i) => i), pts.map((_, i) => 2 * n - 1 - i)];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; f.push([i, n + i, n + j, j]); }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { v, f, thin: Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) };
}
const rect = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
const boxMesh = (w, h, d) => slabMesh(rect(w, h), d);

// Square pyramid on y = -h/2 with its apex at y = h/2.
function pyramidMesh(w, d, h) {
  const y = -h / 2;
  const v = [[-w / 2, y, d / 2], [w / 2, y, d / 2], [w / 2, y, -d / 2], [-w / 2, y, -d / 2], [0, h / 2, 0]];
  return { v, f: [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]], thin: Math.min(w, h) };
}

// ---------------- Display list ----------------
// Parts are drawn in insertion order. Consecutive parts sharing a `group` get one merged outline.
// fx parts draw on the 'body' layer (gets the outer contour), 'under' (thin cords, no contour)
// or 'over' (particles); `glow` callbacks paint the blurred glow layer. Only `solid` fx feed the framing.
class Sketch {
  constructor(golden, hidden, small, big) {
    this.parts = [];
    this.hidden = hidden;
    this.golden = golden;
    this.small = small;  // 128 card: no particles except golden sparkles
    this.big = big;      // model.scale > 1: long reach is trimmed so the hero frames like the rest
    this.dark = golden ? '#5c3400' : INK;
    this.ink = hidden ? SILHOUETTE : INK;
    this.tone = hidden ? () => SILHOUETTE : golden ? gold : lift;
    this.light = hidden ? () => SILHOUETTE : (c) => c;
  }

  // `band` skips upward faces (belts and hat bands wrap a box); `ring` skips side faces (upright rings).
  // `edge` recolours the thin inner edges, e.g. a darker rim on a pale gem.
  mesh(T, m, color, { glow = false, group = null, thin, band = false, ring = false, edge = null, glowColor } = {}) {
    const flip = det(T.m) < 0;
    const v = m.v.map((p) => apply(T, p));
    const base = glow ? this.light(color) : this.tone(color);
    const faces = [];
    for (let f of m.f) {
      if (flip) f = f.slice().reverse();
      const pts = f.map((i) => v[i]);
      const n = normal(pts);
      const facing = dot(n, VIEW);
      if (facing <= 1e-4 || (band && n[1] > 0.7) || (ring && Math.abs(n[0]) > 0.7)) continue;
      faces.push({ pts, facing, color: this.hidden ? base : this.shade(base, n, glow) });
    }
    faces.sort((a, b) => a.facing - b.facing);
    const k = Math.cbrt(Math.abs(det(T.m)));
    const lit = glow && !this.hidden;
    this.parts.push({
      faces, pts: v, r: lit ? 0.45 : 0, core: 0, glow: lit ? glowColor || base : null, group,
      thin: (thin ?? m.thin) * k, edge: edge && !this.hidden ? edge : null,
    });
  }

  shade(c, n, glow) {
    const k = dot(n, LIGHT) - LIGHT[2];
    if (glow) return k > 0 ? mix(c, '#ffffff', k * 0.8) : mix(c, this.dark, -k * 0.15);
    return k > 0 ? mix(c, '#ffffff', k * 0.6) : mix(c, this.dark, -k * 0.4);
  }

  box(T, w, h, d, color, opts) { this.mesh(T, boxMesh(w, h, d), color, opts); }
  slab(T, pts, d, color, opts) { this.mesh(T, slabMesh(pts, d), color, opts); }
  pyramid(T, w, d, h, color, opts) { this.mesh(T, pyramidMesh(w, d, h), color, opts); }

  // Custom 2D drawing; `pts` (world) and `r` (units, glow included) feed the framing only when `solid`.
  // `core` is the radius without the glow. draw(ctx, P, S, F) gets the projection, scale and layout.
  fx(pts, draw, { r = 0, core = r, solid = false, layer = 'body', glow = null } = {}) {
    this.parts.push({ pts, r, core, solid, layer, draw, glowFx: this.hidden ? null : glow });
  }

  // Unoutlined white highlight polygon in a local plane.
  shine(T, pts, alpha = 0.45) {
    if (this.hidden) return;
    const w = pts.map(([x, y]) => apply(T, [x, y, 0]));
    this.fx(w, (ctx, P) => { path(ctx, w.map(P)); ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill(); });
  }

  // Thin cord such as a bowstring. Kept off the contour layer so it stays thin.
  line(T, pts, color) {
    const w = pts.map(([x, y, z = 0]) => apply(T, [x, y, z]));
    const col = this.light(color);
    this.fx(w, (ctx, P) => {
      path(ctx, w.map(P), false);
      for (const [lw, c] of [[3.6, this.ink], [1.5, col]]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.stroke(); }
    }, { layer: 'under' });
  }
}

function path(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

// Closed curve through the midpoints of `pts`; points listed in `sharp` stay pointy.
function smooth(ctx, pts, sharp = []) {
  const n = pts.length;
  const mid = (i) => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  ctx.beginPath();
  ctx.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) {
    if (sharp.includes(i)) { ctx.lineTo(...pts[i]); ctx.lineTo(...mid(i)); }
    else ctx.quadraticCurveTo(...pts[i], ...mid(i));
  }
  ctx.closePath();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.26 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function diamond(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
}

function glowDot(ctx, x, y, r, color, alpha = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.4));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// Keeps a decorative particle (and its glow of radius m) inside the frame.
const inFrame = (F, x, y, m) => {
  const lo = F.pad + m, hi = F.size - F.pad - m;
  return [Math.min(hi, Math.max(lo, x)), Math.min(hi, Math.max(lo, y))];
};

// ---------------- Faces ----------------
// The 3D pixel-art face, recoloured like the body, plus a mask of the glowing eye pixels.
const faceCache = new Map();
function faceImages(model, tone, golden) {
  const key = JSON.stringify([model.face, model.skin, model.eye, model.hood, model.beard, model.glowEyes, model.hair, model.aura, golden]);
  let res = faceCache.get(key);
  if (res) return res;
  const tex = faceTextures(model);
  // The texture canvases are read through a throwaway canvas: they may be GPU-backed, and drawing a
  // canvas that once received GPU content made every later render several times slower in Chrome.
  const [, tctx] = canvas(64);
  let em = null;
  if (tex.emissive) {
    tctx.drawImage(tex.emissive.image, 0, 0);
    em = tctx.getImageData(0, 0, 64, 64).data;
    tctx.clearRect(0, 0, 64, 64);
  }
  tctx.drawImage(tex.map.image, 0, 0);
  const img = tctx.getImageData(0, 0, 64, 64);
  const eimg = tctx.createImageData(64, 64);
  // Golden faces keep their dark details (eyes, mouth, visor and mask slits, skull teeth) dark brown and
  // the white eye glints cream; the face background matches the gold head.
  const base = (model.face === 'hood' ? model.hood : model.skin || '').toLowerCase();
  const goldFace = (c) => {
    if (c === base) return gold(c);
    if (lum(c) < 0.25) return '#4a2a00';
    return c === '#ffffff' ? '#fff6d0' : gold(c);
  };
  const faceTone = golden ? goldFace : tone;
  // White-hot skull eyes would vanish into the bone: the sockets glow in the aura colour around white pupils.
  const hot = model.face === 'skull' && model.aura && lum(model.eye || '#000000') > 0.9 ? rgb(mix(model.aura, '#ffffff', 0.25)) : null;
  const pupil = (i) => {
    const x = ((i >> 2) % 64) >> 2, y = (i >> 2) >> 8;
    return (x === 4 || x === 5 || x === 10 || x === 11) && (y === 6 || y === 7);
  };
  const d = img.data, memo = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (em && em[i] + em[i + 1] + em[i + 2] > 30) {
      if (hot && !pupil(i)) { d.set(hot, i); eimg.data.set([...hot, 255], i); }
      else eimg.data.set([em[i], em[i + 1], em[i + 2], 255], i);
      continue;
    }
    const c = toHex([d[i], d[i + 1], d[i + 2]]);
    let t = memo.get(c);
    if (!t) memo.set(c, (t = rgb(faceTone(c))));
    d.set(t, i);
  }
  const [face, fctx] = canvas(64);
  fctx.putImageData(img, 0, 0);
  let eyes = null;
  if (em) {
    const [c, ectx] = canvas(64);
    ectx.putImageData(eimg, 0, 0);
    eyes = c;
  }
  res = { face, eyes };
  faceCache.set(key, res);
  return res;
}

// ---------------- Head gear (head-local coordinates of the 3D rig) ----------------
// Tall hats sit a little lower than in 3D so every hero frames at the same size.
function headwear(sk, H, hat, phase) {
  const c = hat.color;
  const back = phase === 'back';
  const h = (...a) => at(H, ...a);
  const helmet = () => {
    sk.box(h(0, 0.81, 0), 1.0, 0.4, 0.94, c);
    sk.box(h(0, 0.655, 0), 1.06, 0.09, 1.0, c, { band: true });
    sk.box(h(0, 0.5, 0.49), 0.12, 0.3, 0.06, c);
  };
  // Left-side pieces go behind the head, right-side pieces in front of it.
  const sides = (fn) => { for (const s of back ? [-1] : [1]) fn(s); };
  const horns = (col, big, tip) => sides((s) => {
    const g = 'horn' + s;
    sk.box(h(s * 0.56, 0.7, 0), 0.24, 0.24, 0.24, col, { group: g });
    if (big) {
      sk.box(h(s * 0.76, 0.96, 0, 0, 0, -s * 0.7), 0.2, 0.44, 0.2, col, { group: g });
      sk.box(h(s * 0.92, 1.18, 0, 0, 0, -s * 0.12), 0.16, 0.36, 0.16, col, { group: g });
      sk.box(h(s * 0.89, 1.4, 0, 0, 0, s * 0.35), 0.11, 0.24, 0.11, tip, { group: g, glow: true });
      return;
    }
    sk.box(h(s * 0.71, 0.94, 0, 0, 0, -s * 0.45), 0.19, 0.36, 0.19, col, { group: g });
    sk.box(h(s * 0.75, 1.19, 0, 0, 0, s * 0.22), 0.14, 0.26, 0.14, col, { group: g });
  });

  switch (hat.type) {
    case 'straw':
      if (back) break;
      sk.box(h(0, 0.87, 0), 1.42, 0.08, 1.34, c);
      sk.box(h(0, 1.04, 0), 0.84, 0.32, 0.82, c);
      sk.box(h(0, 0.94, 0), 0.87, 0.1, 0.85, '#b5452c', { band: true });
      break;
    case 'cap':
      if (back) break;
      sk.box(h(0, 0.92, 0), 0.98, 0.26, 0.9, c);
      sk.box(h(0, 0.81, 0.6), 0.84, 0.07, 0.46, c);
      sk.box(h(0.44, 1.14, -0.1, 0, 0, -0.55), 0.11, 0.5, 0.14, hat.accent || '#d63a3a');
      break;
    case 'helmet':
      if (!back) helmet();
      break;
    case 'plume':
      if (back) break;
      sk.box(h(0, 0.91, 0), 0.14, 0.16, 0.96, '#c3ccd5');
      sk.box(h(0, 1.12, -0.05, -0.25, 0, 0), 0.2, 0.44, 0.66, c, { group: 'plume' });
      sk.box(h(0, 1.22, -0.36, -0.75, 0, 0), 0.2, 0.32, 0.38, c, { group: 'plume' });
      break;
    case 'wizard': {
      if (back) break;
      // A pale hat on a pale face merges into one block at reel size: tone it towards the accent.
      const hc = lum(c) > 0.8 ? mix(c, hat.accent || '#5aa9e6', 0.35) : c;
      sk.box(h(0, 0.87, 0), 1.34, 0.07, 1.34, hc);
      sk.pyramid(h(0, 1.33, -0.06, -0.2, 0, 0), 0.82, 0.82, 0.78, hc);
      sk.box(h(0, 0.97, 0), 0.86, 0.14, 0.86, hat.accent || '#ffd23f', { band: true });
      break;
    }
    case 'crown': {
      if (back) break;
      // Pointed corner posts plus one tall front post above the gem: a crown, not battlements.
      const band = (x, z, w, d) => sk.box(h(x, 0.93, z), w, 0.22, d, c);
      const post = (x, z, ht = 0.22) => sk.pyramid(h(x, 1.02 + ht / 2, z), 0.16, 0.16, ht, c);
      band(0, -0.44, 0.98, 0.09);
      band(-0.44, 0, 0.09, 0.98);
      post(-0.44, -0.44); post(0.44, -0.44);
      band(0.44, 0, 0.09, 0.98);
      band(0, 0.44, 0.98, 0.09);
      post(-0.44, 0.44); post(0.44, 0.44); post(0, 0.44, 0.3);
      sk.box(h(0, 0.93, 0.5), 0.22, 0.2, 0.05, '#ff3b5c', { glow: true });
      break;
    }
    case 'horns': horns(c, false); break;
    case 'demonhorns': horns(c, true, '#ff1a3c'); break;
    case 'viking':
      if (!back) helmet();
      horns('#efe6cf', false);
      break;
    case 'bandana':
      if (back) {
        sk.box(h(0.66, 0.58, -0.44, 0, 0, -0.3), 0.5, 0.12, 0.06, c, { group: 'tails' });
        sk.box(h(0.6, 0.44, -0.44, 0, 0, -0.8), 0.44, 0.11, 0.06, c, { group: 'tails' });
      } else {
        sk.box(h(0, 0.63, 0), 0.98, 0.17, 0.92, c);
        sk.box(h(0.5, 0.6, -0.2), 0.08, 0.2, 0.2, c);
      }
      break;
    case 'halo':
      if (!back) halo(sk, apply(H, [0, 1.04, 0]), 0.44 * HEAD, c);
      break;
    case 'winged':
      if (!back) helmet();
      sides((s) => {
        const g = 'wing' + s;
        sk.box(h(s * 0.58, 0.82, -0.06, 0, 0, s * 0.35), 0.3, 0.12, 0.06, '#ffffff', { group: g });
        sk.box(h(s * 0.66, 0.93, -0.06, 0, 0, s * 0.55), 0.38, 0.13, 0.06, '#ffffff', { group: g });
        sk.box(h(s * 0.66, 1.05, -0.06, 0, 0, s * 0.85), 0.32, 0.12, 0.06, '#ffffff', { group: g });
      });
      break;
    // 'hood' and 'hoodpeak' are the head shell itself (see buildHero).
  }
}

function halo(sk, c, rx, color) {
  const col = sk.light(color);
  const [outer, inner] = sk.small ? [8, 4] : [10, 5];
  const ring = (ctx, P, S) => { const [x, y] = P(c); ctx.beginPath(); ctx.ellipse(x, y, rx * S, rx * S * 0.3, 0, 0, Math.PI * 2); };
  sk.fx([c], (ctx, P, S) => {
    ring(ctx, P, S); ctx.lineWidth = outer; ctx.strokeStyle = sk.ink; ctx.stroke();
    ring(ctx, P, S); ctx.lineWidth = inner; ctx.strokeStyle = col; ctx.stroke();
    if (sk.hidden) return;
    const [x, y] = P(c);
    ctx.beginPath(); ctx.ellipse(x, y - 1, rx * S, rx * S * 0.3, 0, Math.PI * 1.1, Math.PI * 1.6);
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  }, {
    r: rx + 0.35, core: rx + 0.1, solid: true,
    glow: (g, P, S) => { ring(g, P, S); g.lineWidth = 12; g.strokeStyle = col; g.stroke(); },
  });
}

// ---------------- Weapons (grip at the origin, pointing up +y, blades face outward -x) ----------------
function weapon(sk, W, w) {
  const p = (...a) => at(W, ...a);
  const wood = '#7a4a24';
  const metal = w.color || '#c9d1d9';
  const glow = !!w.glow;
  // A long pole from y0 to y1. Very dark wood is lifted towards grey so it does not merge with the ink,
  // and a thin highlight runs down its lit side, like the mid-grey pole of the reference scythe.
  const pole = (y0, y1, wd, color) => {
    const c = lum(color) < 0.2 ? mix(color, '#8c8698', 0.45) : color;
    sk.box(p(0, (y0 + y1) / 2), wd, y1 - y0, wd, c);
    const a = -wd * 0.32, b = -wd * 0.05;
    sk.shine(p(0, 0, wd / 2 + 0.005), [[a, y0 + 0.08], [b, y0 + 0.08], [b, y1 - 0.06], [a, y1 - 0.06]], 0.3);
  };
  switch (w.type) {
    case 'sword':
      sk.box(p(0, -0.22), 0.17, 0.1, 0.13, '#e3b341');
      sk.box(p(0, -0.02), 0.12, 0.34, 0.11, '#5b3a1e');
      sk.slab(p(), [[-0.09, 0.22], [0.09, 0.22], [0.09, 1.02], [0, 1.18], [-0.09, 1.02]], 0.07, metal, { glow });
      sk.shine(p(0, 0, 0.04), [[-0.06, 0.3], [-0.02, 0.3], [-0.02, 1.02], [-0.06, 0.98]]);
      sk.box(p(0, 0.2), 0.48, 0.1, 0.15, '#e3b341');
      break;
    case 'katana':
      sk.box(p(0, -0.04), 0.11, 0.42, 0.1, '#b02020');
      sk.slab(p(), [[-0.05, 0.2], [0.05, 0.2], [0.055, 0.62], [0.07, 0.98], [0.11, 1.28], [0.14, 1.44], [0.03, 1.32], [-0.015, 1.0], [-0.05, 0.62]], 0.05, metal, { glow, thin: 0.1 });
      sk.shine(p(0, 0, 0.03), [[-0.035, 0.3], [-0.01, 0.3], [0.01, 1.0], [-0.01, 1.0]]);
      sk.box(p(0, 0.19), 0.26, 0.06, 0.22, '#e3b341');
      break;
    case 'dagger':
      sk.box(p(0, -0.02), 0.1, 0.24, 0.1, '#4a2a14');
      sk.slab(p(), [[-0.075, 0.13], [0.075, 0.13], [0.075, 0.44], [0, 0.58], [-0.075, 0.44]], 0.05, metal, { glow });
      sk.box(p(0, 0.12), 0.28, 0.07, 0.12, '#9aa3ad');
      break;
    case 'pitchfork':
      pole(-0.58, 1.42, 0.1, w.color);
      for (const x of [-0.21, 0, 0.21]) sk.slab(p(x), [[-0.045, 1.42], [0.045, 1.42], [0.045, 1.74], [0, 1.85], [-0.045, 1.74]], 0.06, '#9aa3ad', { group: 'fork' });
      sk.box(p(0, 1.44), 0.54, 0.1, 0.09, '#9aa3ad', { group: 'fork' });
      break;
    case 'bow':
      sk.line(W, [[-0.355, 0.81], [-0.355, -0.81]], '#f2f2f2');
      for (const s of [1, -1]) {
        sk.box(p(-0.06, s * 0.33, 0, 0, 0, s * 0.38), 0.13, 0.38, 0.1, w.color, { group: 'bow' });
        sk.box(p(-0.22, s * 0.66, 0, 0, 0, s * 0.75), 0.11, 0.38, 0.09, w.color, { group: 'bow' });
      }
      sk.box(p(0, 0), 0.15, 0.34, 0.11, w.color, { group: 'bow' });
      break;
    case 'crossbow': {
      // Held level at the waist, nose pointing outward (-x), prod standing upright at the front.
      sk.box(p(-0.42, 0), 0.95, 0.14, 0.14, w.color);
      for (const s of [1, -1]) sk.box(p(-0.82, s * 0.22, 0, 0, 0, s * 1.3), 0.5, 0.12, 0.11, '#9aa3ad', { group: 'prod' });
      const tip = (s) => [-0.82 + 0.25 * Math.cos(1.3), s * (0.22 + 0.25 * Math.sin(1.3)), 0.06];
      sk.line(W, [tip(1), [-0.45, 0.04, 0.08], tip(-1)], '#f2f2f2');
      sk.box(p(-0.66, 0.1, 0.02), 0.5, 0.05, 0.05, '#c9a36b');
      sk.slab(p(0, 0, 0.02), [[-0.88, 0.22], [-1.1, 0.1], [-0.88, -0.02]], 0.05, '#c9d1d9');
      break;
    }
    case 'staff':
    case 'skullstaff': {
      pole(-0.5, 1.5, 0.11, w.color);
      const gem = w.gem || '#7fd0ff';
      if (w.type === 'skullstaff') {
        // A big skull reads as a skull even in the 64px reel.
        sk.box(p(0, 1.48), 0.36, 0.12, 0.3, '#dcd6c6');
        sk.box(p(0, 1.72), 0.5, 0.42, 0.4, '#f2efe6');
        skullFace(sk, apply(W, [-0.25, 1.93, 0.2]), apply(W, [0.25, 1.51, 0.2]), gem);
        twinkles(sk, apply(W, [0, 1.74, 0.22]), gem);
      } else {
        // Octahedral gem. Pale gems are drawn bigger with a darker rim so they still read on a pale staff;
        // a white-gold gem (Celestial) gets a warm core and glow so it reads as light, not a sugar cube.
        const holy = lum(gem) > 0.95;
        const core = holy ? '#fff3a0' : gem;
        const pale = lum(core) > 0.8;
        const [r, , b] = rgb(core);
        const rim = pale ? mix(core, b > r ? '#2b8bd6' : '#ff9f1a', 0.5) : null;
        const glowColor = holy ? '#ffd84a' : pale ? mix(core, rim, 0.5) : null;
        const gs = pale ? 0.42 : 0.34;
        const gw = gs * 1.1, gh = gs * 0.75, gy = 1.74 + gs / 8;
        sk.box(p(0, 1.56, -0.13), 0.07, 0.26, 0.07, w.color);
        sk.box(p(-0.13, 1.58, 0, 0, 0, 0.35), 0.07, 0.3, 0.07, w.color);
        const o = { glow: true, group: 'gem', edge: rim, glowColor };
        sk.pyramid(p(0, gy + gh / 2, 0, 0, 0.5, 0), gw, gw, gh, core, o);
        sk.pyramid(p(0, gy - gh / 2, 0, Math.PI, -0.5, 0), gw, gw, gh, core, o);
        sk.box(p(0.13, 1.58, 0, 0, 0, -0.35), 0.07, 0.3, 0.07, w.color);
        sk.box(p(0, 1.56, 0.13), 0.07, 0.26, 0.07, w.color);
        if (holy) gemStar(sk, apply(W, [0, gy, gw / 2]), gs * 0.85);
        twinkles(sk, apply(W, [0, 1.76, 0]), holy ? '#ffd84a' : pale ? rim : gem);
      }
      break;
    }
    case 'hammer': {
      // A T-shaped head across the handle with two upright gold rings.
      sk.box(p(0, 0.36), 0.13, 1.3, 0.13, wood);
      sk.box(p(0, 1.02), 0.7, 0.42, 0.42, mix(metal, INK, 0.15));
      for (const s of [-1, 1]) sk.box(p(s * 0.24, 1.02), 0.07, 0.46, 0.46, '#e3b341', { ring: true });
      break;
    }
    case 'axe':
      sk.box(p(0, 0.3), 0.1, 1.16, 0.1, wood);
      sk.slab(p(), [[0.05, 0.92], [-0.1, 0.87], [-0.44, 1.06], [-0.49, 0.76], [-0.44, 0.46], [-0.1, 0.63], [0.05, 0.58]], 0.08, metal, { glow });
      sk.shine(p(0, 0, 0.045), [[-0.41, 0.99], [-0.36, 0.95], [-0.4, 0.55], [-0.43, 0.52]]);
      break;
    case 'scythe': {
      // A plain scythe is grey metal like the reference; a glowing one keeps its own colours.
      const steel = !glow;
      pole(-0.57, 1.89, 0.11, steel ? '#6d6d78' : w.color);
      const C = [0.03, 1.15], RX = sk.big ? 0.88 : 1.02, RY = 0.73;
      const outer = [], inner = [], edge = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, a = Math.PI / 2 + t * Math.PI * 0.68;
        const th = 0.24 * Math.pow(1 - t, 0.7);
        outer.push([C[0] + RX * Math.cos(a), C[1] + RY * Math.sin(a)]);
        inner.push([C[0] + (RX - th * 1.15) * Math.cos(a), C[1] + (RY - th) * Math.sin(a)]);
        if (t > 0.08 && t < 0.86) edge.push([C[0] + (RX - th * 1.15 + 0.06) * Math.cos(a), C[1] + (RY - th + 0.05) * Math.sin(a)]);
      }
      const blade = [[0.12, 1.86], ...outer, ...inner.slice(0, -1).reverse(), [0.12, 1.64]];
      sk.slab(p(), blade, 0.07, steel ? '#4a4a55' : w.blade || w.color, { glow, thin: 0.18 });
      sk.shine(p(0, 0, 0.04), [...edge, ...inner.filter((_, i) => i / 12 > 0.08 && i / 12 < 0.86).reverse()], glow ? 0.5 : 0.6);
      sk.box(p(0, 1.75), 0.17, 0.2, 0.17, '#555555');
      break;
    }
    case 'spear':
      pole(-0.59, 1.71, 0.09, wood);
      sk.slab(p(), [[0, 2.14], [0.13, 1.9], [0.07, 1.7], [-0.07, 1.7], [-0.13, 1.9]], 0.07, metal, { glow });
      sk.shine(p(0, 0, 0.04), [[0, 2.06], [-0.08, 1.9], [-0.04, 1.76], [-0.02, 1.76], [-0.02, 2.0]]);
      sk.box(p(0, 1.68), 0.15, 0.1, 0.13, mix(metal, '#000000', 0.25));
      break;
    case 'lance':
      sk.box(p(0, -0.02), 0.12, 0.42, 0.12, '#5b3a1e');
      sk.pyramid(p(0, 1.16), 0.3, 0.3, 1.7, metal, { glow });
      sk.slab(p(0, 0, 0.02), [[-0.3, 0.34], [0.3, 0.34], [0.13, 0.17], [-0.13, 0.17]], 0.14, metal);
      break;
  }
}

function skullFace(sk, tl, br, eye) {
  if (sk.hidden) return;
  const cells = (ctx, P, scale = 1) => {
    const [x0, y0] = P(tl), [x1, y1] = P(br);
    const cw = (x1 - x0) / 8, ch = (y1 - y0) / 8;
    for (const x of [1, 4.6]) ctx.fillRect(x0 + (x - (scale - 1)) * cw, y0 + (2 - (scale - 1)) * ch, 2.4 * scale * cw, 2.4 * scale * ch);
    return [x0, y0, cw, ch];
  };
  sk.fx([tl, br], (ctx, P) => {
    ctx.fillStyle = eye;
    const [x0, y0, cw, ch] = cells(ctx, P);
    ctx.fillStyle = INK;
    ctx.fillRect(x0 + 3.5 * cw, y0 + 5 * ch, cw, 1.2 * ch);
    for (let x = 1.5; x < 7; x += 1.5) ctx.fillRect(x0 + x * cw, y0 + 7 * ch, 0.7 * cw, ch);
  }, { glow: (g, P) => { g.fillStyle = eye; cells(g, P, 1.6); } });
}

function twinkles(sk, c, color) {
  if (sk.hidden || sk.small) return;
  sk.fx([c], (ctx, P, S, F) => {
    const [x, y] = P(c);
    for (const [dx, dy, r] of [[-0.26, -0.2, 0.09], [0.24, 0.1, 0.065]]) {
      const [px, py] = inFrame(F, x + dx * S, y + dy * S, r * S * 1.6);
      glowDot(ctx, px, py, r * S * 1.6, color, 0.7);
      ctx.fillStyle = '#ffffff';
      star(ctx, px, py, r * S); ctx.fill();
    }
  }, { layer: 'over' });
}

// A white four-point glint on a holy gem.
function gemStar(sk, c, r) {
  if (sk.hidden || sk.small) return;
  sk.fx([c], (ctx, P, S, F) => {
    const [x, y] = inFrame(F, ...P(c), r * S);
    glowDot(ctx, x, y, r * S * 0.9, '#fff6c0', 0.9);
    ctx.fillStyle = '#ffffff';
    star(ctx, x, y, r * S); ctx.fill();
  }, { layer: 'over' });
}

// ---------------- Off-hand items ----------------
function flame(sk, base, size, color) {
  const F = [[0, 0], [0.3, 0.05], [0.4, 0.28], [0.32, 0.48], [0.44, 0.74], [0.18, 0.6], [0.05, 1], [-0.14, 0.72], [-0.34, 0.82], [-0.28, 0.52], [-0.4, 0.28], [-0.3, 0.05]];
  const tips = [4, 6, 8];
  const col = sk.light(color), dark = mix(color, INK, 0.55);
  const mid = [base[0], base[1] + size * 0.45, base[2]];
  const shape = (ctx, P, S, k, rise = 0) => {
    const [x, y] = P(base), h = size * S;
    smooth(ctx, F.map(([fx, fy]) => [x + fx * h * k, y - (fy * k + rise) * h]), tips);
  };
  sk.fx([mid], (ctx, P, S) => {
    if (sk.hidden) {
      shape(ctx, P, S, 1); ctx.lineWidth = 5; ctx.strokeStyle = SILHOUETTE; ctx.stroke(); ctx.fillStyle = SILHOUETTE; ctx.fill();
      return;
    }
    shape(ctx, P, S, 1); ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = dark; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
    shape(ctx, P, S, 0.66, 0.05); ctx.fillStyle = mix(color, '#ffd36b', 0.6); ctx.fill();
    shape(ctx, P, S, 0.36, 0.1); ctx.fillStyle = '#fff4c8'; ctx.fill();
  }, {
    r: size * 0.8, core: size * 0.55, solid: true,
    glow: (g, P, S) => { const [x, y] = P(mid); glowDot(g, x, y, size * S * 0.8, color, 0.95); },
  });
  if (sk.hidden || sk.small) return;
  // Embers drift above the flame.
  sk.fx([base], (ctx, P, S, Fr) => {
    const [x, y] = P(base), h = size * S;
    for (const [ex, ey, er] of [[0.34, 1.12, 0.075], [-0.26, 1.28, 0.06], [0.12, 1.45, 0.045]]) {
      const r = er * h, [px, py] = inFrame(Fr, x + ex * h, y - ey * h, r * 3);
      glowDot(ctx, px, py, r * 3, color, 0.6);
      diamond(ctx, px, py, r);
      ctx.fillStyle = col; ctx.fill();
    }
  }, { layer: 'over' });
}

function orb(sk, c, r, color) {
  const col = sk.light(color);
  const bright = lum(color) > 0.8;
  sk.fx([c], (ctx, P, S) => {
    const [x, y] = P(c), R = r * S;
    const disc = () => { ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); };
    if (sk.hidden) { disc(); ctx.lineWidth = 6; ctx.strokeStyle = SILHOUETTE; ctx.stroke(); ctx.fillStyle = SILHOUETTE; ctx.fill(); return; }
    disc(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, mix(col, '#ffffff', 0.45));
    g.addColorStop(1, bright ? mix(col, '#ff9f1a', 0.3) : mix(col, INK, 0.25));
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - R * 0.38, y - R * 0.42, R * 0.22, R * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  }, {
    r: r * 2.4, core: r * 1.1, solid: true,
    glow: (g, P, S) => { const [x, y] = P(c); glowDot(g, x, y, r * S * 2.4, bright ? mix(color, '#ffb52e', 0.35) : color, bright ? 0.9 : 0.8); },
  });
  if (sk.hidden || sk.small) return;
  sk.fx([c], (ctx, P, S, F) => {
    const [x, y] = P(c), R = r * S;
    ctx.fillStyle = '#ffffff';
    star(ctx, ...inFrame(F, x + R * 1.25, y - R * 0.9, R * 0.32), R * 0.32); ctx.fill();
    star(ctx, ...inFrame(F, x - R * 1.15, y + R * 0.7, R * 0.24), R * 0.24); ctx.fill();
  }, { layer: 'over' });
}

function offhand(sk, R, o, x, y) {
  switch (o.type) {
    case 'shield': {
      const T = at(R, x + 0.06, y + 0.04, 0.3);
      const heater = [[-0.37, 0.42], [0.37, 0.42], [0.37, 0.02], [0.25, -0.28], [0, -0.47], [-0.25, -0.28], [-0.37, 0.02]];
      sk.slab(T, heater, 0.1, o.color);
      const accent = sk.tone(o.accent || '#e9c44c');
      const trim = heater.map(([a, b]) => apply(T, [a * 0.78, b * 0.78 + 0.01, 0.05]));
      if (!sk.hidden) sk.fx(trim, (ctx, P, S) => { path(ctx, trim.map(P)); ctx.lineWidth = S * 0.06; ctx.strokeStyle = accent; ctx.stroke(); });
      sk.box(at(T, 0, 0.02, 0.07), 0.24, 0.28, 0.06, o.accent || '#e9c44c');
      break;
    }
    case 'flame': flame(sk, apply(R, [x + 0.08, y + 0.16, 0.25]), 0.62, o.color); break;
    case 'orb': orb(sk, apply(R, [x + 0.06, y + 0.38, 0.25]), 0.2, o.color); break;
    case 'axe': weapon(sk, at(R, x, y, 0.16, 0, 0, -0.38, [-1, 1, 1]), { type: 'axe', color: o.color }); break;
  }
}

// ---------------- Effects (decorative: not part of the framing, clamped into the frame) ----------------
const MOTES = [[-0.98, 0.4, -0.3, 0.1], [0.98, 0.78, -0.25, 0.09], [-0.86, 1.5, 0.3, 0.075], [0.92, 1.8, 0.3, 0.07], [-0.95, 2.1, -0.2, 0.06], [0.6, 2.25, -0.3, 0.05], [0.3, 0.12, 0.6, 0.07]];

function motes(sk, R, color, front) {
  if (sk.hidden || sk.small) return;
  for (const [x, y, z, s] of MOTES) {
    if ((z > 0) !== front) continue;
    const c = apply(R, [x, y, z]);
    sk.fx([c], (ctx, P, S, F) => {
      const r = s * S, [px, py] = inFrame(F, ...P(c), r * 3);
      glowDot(ctx, px, py, r * 3, color, 0.55);
      diamond(ctx, px, py, r);
      ctx.fillStyle = mix(color, '#ffffff', 0.3); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = mix(color, INK, 0.5); ctx.stroke();
    }, { layer: 'over' });
  }
}

// Golden sparkles; the 128 card keeps only the two biggest.
function sparkles(sk, R) {
  const all = [[-0.78, 1.95, 0.2], [0.92, 1.5, 0.16], [-0.95, 0.85, 0.13], [0.78, 0.4, 0.12], [0.22, 2.2, 0.1]];
  for (const [x, y, s] of sk.small ? all.slice(0, 2) : all) {
    const c = apply(R, [x, y, 0.6]);
    sk.fx([c], (ctx, P, S, F) => {
      const [px, py] = inFrame(F, ...P(c), s * S * 1.3);
      glowDot(ctx, px, py, s * S * 1.3, '#fff3a0', 0.8);
      ctx.fillStyle = '#ffffff';
      star(ctx, px, py, s * S); ctx.fill();
    }, { layer: 'over' });
  }
}

// ---------------- The hero ----------------
const POLES = ['scythe', 'staff', 'skullstaff', 'spear', 'pitchfork'];
const GRIP_LIFT = { bow: 0.22 };  // the bow is held higher so its lower tip clears the ring
const WEAPON_SCALE = { bow: 0.9 };

function buildHero(model, golden, hidden, small) {
  const scale = model.scale || 1;
  const sk = new Sketch(golden, hidden, small, scale > 1);
  const R = tf(0, 0, 0, 0, 0, 0, scale);
  const { bony, chunky, hat } = model;
  const limb = bony ? 0.24 : chunky ? 0.44 : 0.34;
  const torsoW = bony ? 0.66 : chunky ? 1.1 : 0.86;
  const torsoD = chunky ? 0.62 : 0.5;
  const legH = 0.44, torsoH = 0.68, top = legH + torsoH;
  const armX = torsoW / 2 + limb / 2 + 0.01;
  const handY = top - 0.55;
  const H = at(R, 0, top, 0, 0, 0, 0, HEAD);
  const hooded = hat && (hat.type === 'hood' || hat.type === 'hoodpeak');

  // Behind the body.
  if (model.aura) motes(sk, R, model.aura, false);
  if (model.wings) wings(sk, R, model.wings, top, torsoD);
  if (model.cape) {
    // A straight hang to the calves, flaring a little towards the visible right side.
    const w0 = torsoW / 2 + 0.05;
    sk.slab(at(R, 0, 0, -torsoD / 2 - 0.06), [[-w0, top + 0.02], [w0, top + 0.02], [w0 + 0.12, 0.2], [-w0, 0.2]], 0.06, model.cape);
  }
  if (model.hair) sk.box(at(H, 0, 0.34, -0.36), 1.08, 1.02, 0.2, model.hair);
  if (hat) headwear(sk, H, hat, 'back');

  // Weapon arm (the hero's right hand, on the viewer's left). Poles stand clear of the body.
  const wt = model.weapon?.type;
  const gx = -(armX + (POLES.includes(wt) ? 0.1 : 0)), gy = handY + (GRIP_LIFT[wt] || 0);
  const arm = (s) => {
    sk.box(at(R, s * armX, top - 0.25, 0), limb, 0.4, limb, model.shirt);
    if (model.trim) sk.box(at(R, s * armX, top - 0.42, 0), limb + 0.03, 0.07, limb + 0.03, model.trim, { band: true });
  };
  const hand = (x, y) => sk.box(at(R, x, y, 0), limb * 0.96, 0.2, limb * 0.96, model.skin);
  arm(-1);
  if (model.weapon) weapon(sk, at(R, gx, gy, 0.16, 0, 0, weaponTilt(wt), WEAPON_SCALE[wt] || 1), model.weapon);
  hand(gx, gy);

  // Legs, boots and torso.
  for (const s of [-1, 1]) {
    const x = s * (torsoW / 4 + 0.01);
    sk.box(at(R, x, legH / 2, 0), limb + 0.02, legH, limb + 0.06, model.pants);
    sk.box(at(R, x, 0.06, 0.01), limb + 0.05, 0.12, limb + 0.1, mix(model.pants, '#000000', 0.3), { band: true });
  }
  sk.box(at(R, 0, legH + torsoH / 2, 0), torsoW, torsoH, torsoD, model.shirt);
  if (model.ribs && !hidden) ribs(sk, R, torsoW, torsoD, legH, top, bony);
  if (model.belt) sk.box(at(R, 0, legH + 0.1, 0), torsoW + 0.04, 0.11, torsoD + 0.04, model.belt, { band: true });
  if (model.trim) sk.box(at(R, 0, legH + 0.04, 0), torsoW + 0.04, 0.08, torsoD + 0.04, model.trim, { band: true });
  // Off-hand arm, then the cape's mantle across both shoulders: the cape itself mostly hides behind the
  // body (and the shield), so this is where its colour shows.
  arm(1);
  if (model.cape) sk.box(at(R, 0, top - 0.07, -0.01), 2 * armX + limb + 0.06, 0.14, torsoD + 0.08, model.cape);
  hand(armX, handY);
  if (model.offhand) offhand(sk, R, model.offhand, armX, handY);

  // Head. A peaked hood is a taller, flat-topped shell like the reference reaper.
  const headCol = model.face === 'hood' ? model.hood : model.skin;
  const ear = (s) => sk.box(at(H, s * 0.6, 0.5, 0, 0, 0, s * 0.35), 0.34, 0.14, 0.08, model.skin);
  if (model.ears) ear(-1);
  let tl, br;
  if (hooded) {
    if (hat.type === 'hoodpeak') sk.box(at(H, 0, 0.53, -0.02), 1.04, 1.12, 0.94, hat.color);
    else sk.box(at(H, 0, 0.45, -0.02), 1.04, 0.95, 0.94, hat.color);
    tl = apply(H, [-0.42, 0.84, 0.45]); br = apply(H, [0.42, 0.03, 0.45]);
  } else {
    sk.box(at(H, 0, 0.42, 0), 0.92, 0.84, 0.84, headCol);
    tl = apply(H, [-0.46, 0.84, 0.42]); br = apply(H, [0.46, 0, 0.42]);
  }
  if (!hidden) face(sk, model, tl, br, hooded, golden);
  if (model.ears) ear(1);
  if (model.hair && !hooded) {
    // Long hair: a lock over the visible side of the head and a braid over the hero's right shoulder
    // (the viewer's left; the left shoulder hides behind the shield).
    sk.box(at(H, 0.49, 0.4, -0.04), 0.06, 0.72, 0.78, model.hair);
    for (const [y, w, h, c] of [[-0.16, 0.18, 0.46, model.hair], [-0.43, 0.21, 0.08, '#3a66c4'], [-0.53, 0.14, 0.12, model.hair]]) {
      sk.box(at(H, -0.4, y, 0.12), w, h, w, c, { group: 'braid' });
    }
  }
  if (model.beard && model.face === 'beard') {
    sk.slab(at(H, 0, 0, 0.42), [[-0.34, 0.16], [0.34, 0.16], [0.32, -0.02], [0.14, -0.13], [-0.14, -0.13], [-0.32, -0.02]], 0.12, model.beard);
  }
  if (hat) headwear(sk, H, hat, 'front');

  if (model.aura) motes(sk, R, model.aura, true);
  if (golden) sparkles(sk, R);
  return sk;
}

function weaponTilt(type) {
  return { sword: 0.38, katana: 0.5, dagger: 0.45, pitchfork: 0.22, bow: 0.1, crossbow: -0.12, staff: 0.15, skullstaff: 0.12, hammer: 0.42, axe: 0.36, scythe: 0.08, spear: 0.14, lance: 0.42 }[type] ?? 0.3;
}

// Feathered wings are stepped slats; dark wings (Dragon Knight) are bat wings with a darker membrane
// and pale bones, so they don't merge with a body of the same red.
function wings(sk, R, color, top, torsoD) {
  for (const s of [-1, 1]) {
    const g = 'wing' + s;
    if (lum(color) < 0.4) {
      const W = at(R, s * 0.22, top - 0.3, -torsoD / 2 - 0.1);
      const m = (pts) => pts.map(([a, b]) => [a * s, b]);
      const membrane = [[0, 0.1], [0.35, 0.45], [0.8, 0.72], [1.2, 0.8], [1.1, 0.45], [0.92, 0.12], [0.7, 0.28], [0.5, -0.05], [0.28, 0.12], [0.08, -0.12]];
      sk.slab(W, m(membrane), 0.08, mix(color, INK, 0.25), { group: g });
      const bone = mix(color, '#ffb02e', 0.35);
      sk.slab(at(W, 0, 0, 0.03), m([[0.02, 0.06], [0.06, 0.16], [0.9, 0.18], [0.92, 0.11]]), 0.04, bone, { group: g });
      sk.slab(at(W, 0, 0, 0.03), m([[0.02, 0.06], [0.08, 0.13], [0.52, 0.0], [0.48, -0.05]]), 0.04, bone, { group: g });
      continue;
    }
    // Each wing's slats share one outline; wings hang a little low to keep the head area clear.
    const W = at(R, s * 0.2, top - 0.12, -torsoD / 2 - 0.1, 0, 0, s * 0.42);
    [[0.62, -0.27], [0.88, 0], [1.12, 0.27]].forEach(([len, y], i) => {
      const pts = [[0, y - 0.14], [len - 0.12, y - 0.14], [len, y + 0.02], [len - 0.06, y + 0.14], [0, y + 0.14]];
      sk.slab(W, pts.map(([a, b]) => [a * s, b]), 0.08, mix(color, '#000000', 0.08 * (2 - i)), { group: g });
    });
  }
}

// Ribs printed on the torso front.
function ribs(sk, R, torsoW, torsoD, legH, top, bony) {
  const bone = sk.tone(bony ? '#bdb7a8' : '#f2efe6');
  const tl = apply(R, [-torsoW / 2, top, torsoD / 2]), br = apply(R, [torsoW / 2, legH, torsoD / 2]);
  sk.fx([tl, br], (ctx, P) => {
    const [x0, y0] = P(tl), [x1, y1] = P(br);
    const cw = (x1 - x0) / 16, ch = (y1 - y0) / 16;
    const cells = [[7, 1.5, 2, 13]];
    // The 128 card gets two fat ribs instead of three thin ones.
    if (sk.small) cells.push([3, 3.5, 10, 2.2], [3, 8.5, 10, 2.2]);
    else for (let y = 3; y < 12; y += 3.4) cells.push([3, y, 10, 1.5], [2, y + 1, 1.2, 1.6], [12.8, y + 1, 1.2, 1.6]);
    for (const pass of [0, 1]) {
      for (const [x, y, w, h] of cells) {
        ctx.beginPath(); ctx.rect(x0 + x * cw, y0 + y * ch, w * cw, h * ch);
        if (pass) { ctx.fillStyle = bone; ctx.fill(); } else { ctx.lineWidth = sk.small ? 2 : 3; ctx.strokeStyle = INK; ctx.stroke(); }
      }
    }
  });
}

// The pixel-art face on the head front, with glowing eyes.
function face(sk, model, tl, br, hooded, golden) {
  const img = faceImages(model, sk.tone, golden);
  // White eyes glow in the aura colour so they still read on pale skulls.
  const eye = lum(model.eye || '#ffffff') > 0.9 && model.aura ? model.aura : model.eye || '#ffffff';
  sk.fx([tl, br], (ctx, P, S) => {
    // Snap to device pixels so the 16x16 face keeps whole-pixel cells; the 128 card stretches it to fill
    // the head instead, as a 2px-cell face would leave a wide skin border at that size.
    const k = ctx.getTransform().a;
    const [x0, y0] = P(tl), [x1, y1] = P(br);
    const x = Math.round(x0 * k), y = Math.round(y0 * k), w = Math.round(x1 * k) - x, h = Math.round(y1 * k) - y;
    const cw = sk.small ? w / 16 : Math.max(1, Math.round(w / 16)), ch = sk.small ? h / 16 : Math.max(1, Math.round(h / 16));
    const fx = x + Math.round((w - cw * 16) / 2), fy = y + Math.round((h - ch * 16) / 2);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img.face, fx, fy, cw * 16, ch * 16);
    if (img.eyes) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = eye; ctx.shadowBlur = S * 0.2 * k;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(img.eyes, fx, fy, cw * 16, ch * 16);
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = S * 0.12 * k;
      ctx.globalAlpha = 1;
      ctx.drawImage(img.eyes, fx, fy, cw * 16, ch * 16);
    }
    ctx.restore();
    ctx.lineWidth = hooded ? 3 : 2.2; ctx.strokeStyle = INK;
    ctx.strokeRect(x / k, y / k, w / k, h / k);
  });
}

// ---------------- Framing ----------------
// Real geometry only: meshes plus solid fx (halo, flame, orb). Particles never move the frame.
// `glow` adds the reach of glowing parts.
function bounds(parts, glow = true) {
  const b = { minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity };
  for (const p of parts) {
    if (!p.faces && !p.solid) continue;
    const r = glow ? p.r : p.core;
    for (const [x, y, z] of p.pts) {
      const u = x - KX * z, v = y - KY * z;
      b.minU = Math.min(b.minU, u - r); b.maxU = Math.max(b.maxU, u + r);
      b.minV = Math.min(b.minV, v - r); b.maxV = Math.max(b.maxV, v + r);
    }
  }
  return b;
}

// Largest scale in [minFit, 1] x base that keeps `b` inside the frame, with its x offset (at most
// F.center px off centre) and ground line (raised when something hangs below the feet); null if none.
function fitBounds(b, F, base, ground, minFit) {
  const { size, pad, center } = F;
  const place = (s) => {
    const feet = Math.min(ground, size - pad + b.minV * s);
    if (feet - b.maxV * s < pad) return null;
    let ox = size / 2;
    if (ox + b.minU * s < pad) ox = pad - b.minU * s;
    if (ox + b.maxU * s > size - pad) ox = size - pad - b.maxU * s;
    if (ox + b.minU * s < pad - 0.5 || ox + b.maxU * s > size - pad + 0.5 || Math.abs(ox - size / 2) > center) return null;
    return { S: s, ox, feet };
  };
  for (let s = base; s >= base * minFit; s -= 0.25) {
    const l = place(s);
    if (l) return l;
  }
  return null;
}

// Every hero shares one scale per layout (HUGE is bigger) and only shrinks, down to minFit, when it must.
// Framing comes from the plain build, so golden and hidden copies line up with the normal one.
// Glows stay inside the frame when they can; otherwise only the geometry does and the glow fades out.
const layouts = new Map();
function layout(hero, huge, F) {
  const id = hero.id + (huge ? '|h@' : '|n@') + F.size;
  let l = layouts.get(id);
  if (!l) {
    const feet = huge ? F.feetHuge : F.feet, base = F.base * (huge ? F.huge : 1);
    // Oversized heroes (model.scale > 1) may shrink a little further.
    const minFit = (hero.model.scale || 1) > 1 ? Math.min(F.minFit, 0.88) : F.minFit;
    const parts = buildHero(hero.model, false, false, F.small).parts;
    const core = bounds(parts, false);
    // Last resort (a lopsided HUGE hero on the 128 card): shrink further rather than slide off centre.
    l = fitBounds(bounds(parts), F, base, feet, minFit) || fitBounds(core, F, base, feet, minFit)
      || fitBounds(core, F, base, feet, 0.5) || { S: base * 0.5, ox: F.size / 2, feet };
    // A HUGE hero is never drawn smaller than its normal self (tall heroes on the 128 card have no room).
    if (huge) { const n = layout(hero, false, F); if (l.S < n.S) l = n; }
    layouts.set(id, l);
  }
  return l;
}

// ---------------- Rendering ----------------
// Ground ring under the feet, kept inside the frame (the edge fade softens its glow). HUGE heroes get a
// rarity-tinted, thicker ring.
function ring(ctx, x, y, S, F, { color, huge, rarity, hidden }) {
  const lw = F.small ? [3, 2] : [4, 2.4];
  const edge = F.fade + 3;
  const rx = Math.min(S * (huge ? 1.2 : 1.42) * (F.small ? 0.9 : 1), x - edge, F.size - edge - x);
  const ry = Math.min(rx * (F.small ? 0.22 : huge ? 0.24 : 0.26), F.size - F.fade / 2 - lw[0] - y);
  const oval = (k) => { ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2); };
  const shadow = () => { oval(0.62); ctx.fillStyle = 'rgba(27,21,48,0.35)'; ctx.fill(); };
  ctx.save();
  if (hidden) {
    // Undiscovered heroes share the ground line, very faintly.
    oval(1); ctx.lineWidth = lw[0]; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
  } else if (huge) {
    const tint = rarity.rainbow ? '#ffffff' : rarity.color;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(tint, 0.75)); g.addColorStop(0.7, rgba(tint, 0.35)); g.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    shadow();
    let stroke = mix('#ffffff', tint, 0.45);
    if (rarity.rainbow) {
      stroke = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
      RAINBOW.forEach((c, i) => stroke.addColorStop(i / (RAINBOW.length - 1), mix(c, '#ffffff', 0.25)));
    }
    // The 128 card has no room for two rings, so it gets one thick one.
    const rings = F.small ? [[1, 5, 1.5]] : [[1, 7, 2], [0.78, 5, 1.5]];
    ctx.shadowColor = tint; ctx.shadowBlur = F.small ? 6 : 12;
    ctx.strokeStyle = stroke;
    for (const [k, w] of rings) { oval(k); ctx.lineWidth = w; ctx.stroke(); }
    ctx.strokeStyle = '#ffffff'; ctx.shadowBlur = 0;
    for (const [k, , w] of rings) { oval(k); ctx.lineWidth = w; ctx.stroke(); }
  } else {
    shadow();
    ctx.shadowColor = color; ctx.shadowBlur = F.small ? 5 : 10;
    ctx.strokeStyle = mix('#ffffff', color, 0.35);
    oval(1); ctx.lineWidth = lw[0]; ctx.stroke();
    oval(F.small ? 0.66 : 0.74); ctx.lineWidth = lw[1]; ctx.stroke();
    if (!F.small) {
      ctx.globalAlpha = 0.45;
      oval(0.5); ctx.lineWidth = 1.6; ctx.stroke();
    }
  }
  ctx.restore();
}

// Pooled offscreen layers at `k`x resolution, cleared on first use in a render; names outside `names` are off.
function layers(D, k, names) {
  const used = new Map();
  return {
    ctx(name) {
      if (!names.includes(name)) return null;
      let l = used.get(name);
      if (!l) {
        const [c, ctx] = scratch(D, 'layer:' + name);
        ctx.scale(k, k);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        used.set(name, (l = { c, ctx }));
      }
      return l.ctx;
    },
    canvas: (name) => used.get(name)?.c,
  };
}

// Paints the parts: meshes and most fx on 'body' (which gets the outer contour), cords on 'under',
// particles on 'over' and every glowing shape once on 'glow' (blurred when composited).
function drawParts(L, sk, S, ox, oy, F) {
  const P = (p) => [ox + (p[0] - KX * p[2]) * S, oy - (p[1] - KY * p[2]) * S];
  const ink = sk.ink;
  const ctx = L.ctx('body');
  const parts = sk.parts;
  for (let i = 0; i < parts.length;) {
    let j = i + 1;
    while (parts[i].group && j < parts.length && parts[j].group === parts[i].group) j++;
    const run = parts.slice(i, j);
    for (const p of run) {
      if (!p.faces) continue;
      p.scr = p.faces.map((f) => f.pts.map(P));
      p.ow = Math.max(1.8, Math.min(3.2, p.thin * S * 0.3));
      const g = p.glow && L.ctx('glow');
      if (g) {
        g.fillStyle = g.strokeStyle = p.glow; g.lineWidth = 6;
        for (const f of p.scr) { path(g, f); g.fill(); g.stroke(); }
      }
    }
    for (const p of run) {
      if (!p.faces) continue;
      ctx.lineWidth = p.ow * 2; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      for (const f of p.scr) { path(ctx, f); ctx.stroke(); ctx.fill(); }
    }
    for (const p of run) {
      if (!p.faces) {
        const g = p.glowFx && L.ctx('glow');
        if (g) { g.save(); p.glowFx(g, P, S, F); g.restore(); }
        const c = L.ctx(p.layer);
        if (c) { c.save(); p.draw(c, P, S, F); c.restore(); }
        continue;
      }
      // Inner edges stay at least 1.5px on the 128 card so they survive the downscale.
      const inner = Math.min(2, p.ow * 0.7);
      ctx.lineWidth = p.edge ? 2 : F.small ? Math.max(1.5, inner) : inner;
      ctx.strokeStyle = p.edge || ink;
      p.scr.forEach((f, k) => { path(ctx, f); ctx.fillStyle = p.faces[k].color; ctx.fill(); ctx.stroke(); });
    }
    i = j;
  }
}

// The alpha of `src` stamped at `offsets` (scaled by k) and filled with `color`. Eight stamps leave
// no gaps because every shape on the body layer already carries an ink outline at least 3.6px wide.
function grow(src, offsets, k, color, name) {
  const [c, ctx] = scratch(src.width, name);
  ctx.imageSmoothingEnabled = false;
  for (const [x, y] of offsets) ctx.drawImage(src, x * k, y * k);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// Canvas `filter` is missing on older Safari, where assigning it silently does nothing, so test it once.
let filterOK;
function canFilter() {
  if (filterOK === undefined) {
    try {
      const [, ctx] = canvas(12);
      ctx.filter = 'blur(2px)';
      ctx.fillRect(5, 5, 2, 2);
      filterOK = ctx.getImageData(1, 5, 1, 1).data[3] > 0;
    } catch {
      filterOK = false;
    }
  }
  return filterOK;
}

// Draws `src` blurred by `px`. Without canvas filters a downscale and smooth upscale stands in.
function blurInto(ctx, src, D, px) {
  if (canFilter()) {
    ctx.filter = `blur(${px}px)`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    return;
  }
  const d = Math.max(1, Math.round(D / 6));
  const [s, sctx] = scratch(d, 'blur');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, d, d);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s, 0, 0, D, D);
  ctx.drawImage(s, 0, 0, D, D);
}

// Fades whatever is near the canvas edge, so glows never end in a hard line; the outermost `solid`
// pixels are cleared completely.
function fadeEdges(ctx, D, w, solid) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  // [gradient from edge inwards, strip rectangle] for top, bottom, left and right.
  for (const [g0, g1, r] of [
    [[0, 0], [0, w], [0, 0, D, w]], [[0, D], [0, D - w], [0, D - w, D, w]],
    [[0, 0], [w, 0], [0, 0, w, D]], [[D, 0], [D - w, 0], [D - w, 0, w, D]],
  ]) {
    const g = ctx.createLinearGradient(...g0, ...g1);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(solid / w, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(...r);
  }
  ctx.restore();
}

// Draws the sprite into the pooled output canvas of its size and returns that canvas.
function render(key, hidden, F, k = 1) {
  const { hero, v } = parseKey(key);
  const model = hero.model;
  const huge = v === 'h' || v === 'hg';
  const golden = !hidden && (v === 'g' || v === 'hg');
  const { S, ox, feet } = layout(hero, huge, F);
  const D = F.size * k;
  const L = layers(D, k, hidden ? ['body', 'under'] : ['body', 'under', 'glow', 'over']);
  drawParts(L, buildHero(model, golden, hidden, F.small), S, ox, feet, F);

  const [out, ctx] = scratch(D, 'out');
  const put = (c) => c && ctx.drawImage(c, 0, 0);
  // Glows (one blur for all of them) and the ground ring, then a fade so nothing ends at the frame edge.
  if (!hidden) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (golden) glowDot(ctx, ox, feet - 1.25 * S, 1.7 * S, '#ffd84a', 0.35);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const glow = L.canvas('glow');
    if (glow) blurInto(ctx, glow, D, F.blur * k);
  }
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ring(ctx, ox, feet, S, F, { color: golden ? '#ffd84a' : model.aura || '#ffffff', huge, rarity: RARITIES[hero.rarity], hidden });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  fadeEdges(ctx, D, F.fade * k, 2 * k);
  // Uniform outer contour plus a faint light rim, so the figure reads on dark UI too.
  // Silhouettes get only the light rim, which keeps them visible on dark cards.
  const body = L.canvas('body');
  if (hidden) put(grow(body, F.rim, k, 'rgba(255,255,255,0.26)', 'grow1'));
  else {
    const inkC = grow(body, CONTOUR, k, INK, 'grow1');
    put(grow(inkC, F.rim, k, 'rgba(255,255,255,0.3)', 'grow2'));
    put(inkC);
  }
  put(L.canvas('under'));
  put(body);
  put(L.canvas('over'));
  return out;
}

// Data URLs are turned into blob URLs once, so reels and lists only pass short strings around.
function toBlobURL(data) {
  if (typeof URL === 'undefined' || !URL.createObjectURL) return data;
  const bin = atob(data.slice(data.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
}

// Sizes up to 128 use the 128 card layout; bigger sizes draw the 256 card at 1x, 2x or 3x.
function resolve(key, hidden, size) {
  const { id, v } = parseKey(key);
  const small = size <= SMALL.size;
  const F = small ? SMALL : FULL;
  const k = small ? 1 : Math.min(3, Math.max(1, Math.round(size / FULL.size)));
  const huge = v === 'h' || v === 'hg';
  const ck = (hidden ? id + (huge ? '|h' : '|n') + '#hidden' : key) + (small ? '@s' : k > 1 ? '@' + k : '');
  return { F, k, ck };
}

// A failed render returns the silhouette (or a blank image) without caching it, so the next call
// retries; after a second failure the fallback is kept.
const failures = new Map();
function fallback(key, hidden, size, ck, e) {
  const n = (failures.get(ck) || 0) + 1;
  failures.set(ck, n);
  pools.clear();
  if (n === 1) console.error('heroSprite failed for', key, e);
  const url = hidden ? BLANK : heroSprite(key, { hidden: true, size });
  if (n >= 2) cache.set(ck, url);
  return url;
}

// Image URL of a hero stack key ("reaper|hg"). `hidden` draws a dark silhouette for undiscovered
// heroes. `size` picks the layout: 128 for the reel and team slots (64-100 CSS px), 256 (default) for
// cards, 512 for the big reveal on 2x screens.
export function heroSprite(key, { hidden = false, size = FULL.size } = {}) {
  const { F, k, ck } = resolve(key, hidden, size);
  let url = cache.get(ck);
  if (url !== undefined) return url;
  try {
    url = toBlobURL(render(key, hidden, F, k).toDataURL('image/png'));
  } catch (e) {
    return fallback(key, hidden, size, ck, e);
  }
  cache.set(ck, url);
  return url;
}

const hasIdle = typeof requestIdleCallback === 'function';
// Without requestIdleCallback (Safari) wait a while, then run right after a frame so a render gets most
// of a frame's budget instead of landing in the middle of one.
const idle = (fn, timeout) => (hasIdle
  ? requestIdleCallback(fn, { timeout })
  : setTimeout(() => requestAnimationFrame(() => setTimeout(fn, 0)), Math.min(timeout, 180)));

// The game can pause warm-up (e.g. while the reel spins) where idle detection isn't available.
let paused = () => false;
export function setWarmPause(fn) { paused = fn; }

// Renders a sprite ahead of time in an idle slot (e.g. the 512 reveal sprite of the best key when the
// reel starts spinning) and resolves to its URL. Works without requestIdleCallback (Safari).
// Pre-rendering and warm-up encode synchronously on purpose: canvas.toBlob would skip the base64 round
// trip, but Chrome encodes in idle time, and with the 3D scene running it resolved up to 0.6s late in
// testing (toDataURL: ~2ms), which a fast roll cannot wait for.
export function preloadSprite(key, opts = {}) {
  return new Promise((done) => idle(() => done(heroSprite(key, opts)), 200));
}

// Renders sprites in the background, one per roomy idle slot, in the order the game needs them: normal
// heroes for the reel and team slots (128) and the index and lists (256), the index silhouettes, then the
// Golden and HUGE variants so a rare win doesn't stall the spin. Safe to call more than once.
let warming = false;
export function warmSprites() {
  if (warming || typeof document === 'undefined') return;
  warming = true;
  const jobs = [];
  const add = (v, opts) => { for (const h of HEROES) jobs.push([h.id + '|' + v, opts]); };
  add('n', { size: SMALL.size });
  add('n', {});
  add('n', { hidden: true });
  for (const v of ['g', 'h', 'hg']) add(v, { size: SMALL.size });
  for (const v of ['g', 'h', 'hg']) add(v, {});
  // A render takes ~10ms (more on slow devices), so wait for a roomy idle slot, but give up waiting
  // after a second in total (short slots must not keep restarting the wait).
  let waitStart = performance.now();
  const next = (deadline) => {
    const left = 1000 - (performance.now() - waitStart);
    const cramped = deadline && !deadline.didTimeout && deadline.timeRemaining() <= 8 && left > 0;
    if (cramped || (!hasIdle && paused())) return idle(next, Math.max(50, left));
    const job = jobs.shift();
    if (!job) return;
    heroSprite(...job);
    waitStart = performance.now();
    idle(next, 1000);
  };
  idle(next, 1000);
}
