// Procedural canvas textures: grass, dirt, planks, thatch, stone, and pixel-art faces.
import * as THREE from '../../vendor/three.module.min.js';
import { seeded } from './layout.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = true, pixel = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  else t.anisotropy = 4;
  return t;
}

const shade = (hex, amt) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
};

function speckle(ctx, w, h, colors, count, size, rnd) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = size[0] + rnd() * (size[1] - size[0]);
    ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), s, s);
  }
}

const cache = {};
const once = (key, fn) => cache[key] || (cache[key] = fn());

export const grassTex = () => once('grass', () => {
  const [c, ctx] = canvas(256);
  const rnd = seeded(7);
  ctx.fillStyle = '#5fbf2f';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, ['#55b229', '#69c935', '#4ea726', '#72d13c'], 2600, [2, 5], rnd);
  // little blades
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#7bd846' : '#4a9f24';
    ctx.fillRect(Math.floor(rnd() * 256), Math.floor(rnd() * 256), 1, 3 + rnd() * 3);
  }
  return toTexture(c);
});

export const dirtTex = () => once('dirt', () => {
  const [c, ctx] = canvas(128);
  const rnd = seeded(11);
  ctx.fillStyle = '#8a5a35';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, ['#7c4f2e', '#956540', '#6f4527', '#a06f47'], 900, [2, 6], rnd);
  return toTexture(c);
});

export const cobbleTex = () => once('cobble', () => {
  const [c, ctx] = canvas(128);
  const rnd = seeded(13);
  ctx.fillStyle = '#8f8a80';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    const off = (y / 16) % 2 ? 10 : 0;
    for (let x = -16; x < 128; x += 20) {
      const g = 200 + Math.floor(rnd() * 30);
      ctx.fillStyle = `rgb(${g},${g - 6},${g - 18})`;
      ctx.beginPath();
      ctx.roundRect(x + off + 1.5, y + 1.5, 17, 13, 4);
      ctx.fill();
    }
  }
  return toTexture(c);
});

export const plankTex = (color = '#a8743f') => once('plank' + color, () => {
  const [c, ctx] = canvas(128);
  const rnd = seeded(17);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = shade(color, -0.12);
    ctx.fillRect(x, 0, 2, 128);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = shade(color, (rnd() - 0.5) * 0.08);
      ctx.fillRect(x + 3 + rnd() * 10, rnd() * 128, 1, 10 + rnd() * 20);
    }
  }
  return toTexture(c);
});

export const thatchTex = () => once('thatch', () => {
  const [c, ctx] = canvas(128);
  const rnd = seeded(19);
  ctx.fillStyle = '#e8c33f';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = ['#f3d35a', '#d4ac2c', '#c99d22', '#fbe27a'][Math.floor(rnd() * 4)];
    ctx.fillRect(rnd() * 128, rnd() * 128, 1 + rnd(), 6 + rnd() * 10);
  }
  for (let y = 0; y < 128; y += 21) {
    ctx.fillStyle = 'rgba(140,100,20,0.35)';
    ctx.fillRect(0, y, 128, 2);
  }
  return toTexture(c);
});

export const stoneTex = () => once('stone', () => {
  const [c, ctx] = canvas(128);
  const rnd = seeded(23);
  ctx.fillStyle = '#6f747b';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    const off = (y / 16) % 2 ? 16 : 0;
    for (let x = -32; x < 128; x += 32) {
      const g = 140 + Math.floor(rnd() * 30);
      ctx.fillStyle = `rgb(${g},${g + 3},${g + 8})`;
      ctx.fillRect(x + off + 1, y + 1, 30, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + off + 1, y + 1, 30, 2);
    }
  }
  return toTexture(c);
});

export const soilTex = () => once('soil', () => {
  const [c, ctx] = canvas(64);
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    ctx.fillStyle = '#56341d';
    ctx.fillRect(0, y, 64, 3);
  }
  return toTexture(c);
});

export const stripeTex = (a = '#e23b3b', b = '#ffffff') => once('stripe' + a + b, () => {
  const [c, ctx] = canvas(64);
  for (let x = 0; x < 64; x += 16) {
    ctx.fillStyle = a; ctx.fillRect(x, 0, 8, 64);
    ctx.fillStyle = b; ctx.fillRect(x + 8, 0, 8, 64);
  }
  return toTexture(c);
});

export const portalTex = () => once('portal', () => {
  const [c, ctx] = canvas(128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, '#e19bff');
  g.addColorStop(0.6, '#7b2cd6');
  g.addColorStop(1, '#2a0a4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(64, 64, 14 + i * 13, i, i + 3.6);
    ctx.stroke();
  }
  return toTexture(c, { repeat: false });
});

export const glowTex = () => once('glow', () => {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c, { repeat: false });
});

export const ringTex = () => once('ring', () => {
  const [c, ctx] = canvas(128);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(64, 64, 40, 0, Math.PI * 2); ctx.stroke();
  return toTexture(c, { repeat: false });
});

// ---------------- Faces (16x16 pixel art) ----------------

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * 4, y * 4, w * 4, h * 4);
}

// Returns { map, emissive } canvases for a head's front face.
export function faceTextures(m) {
  const key = 'face:' + JSON.stringify([m.face, m.skin, m.eye, m.hood, m.beard, m.glowEyes, m.hair]);
  return once(key, () => {
    const [c, ctx] = canvas(64);
    const [ec, ectx] = canvas(64);
    ectx.fillStyle = '#000';
    ectx.fillRect(0, 0, 64, 64);
    const skin = m.skin;
    const eye = m.eye || '#1d1d1d';
    const glow = (x, y, w, h, color) => { px(ctx, x, y, w, h, color); if (m.glowEyes) px(ectx, x, y, w, h, color); };
    px(ctx, 0, 0, 16, 16, skin);
    const face = m.face || 'normal';

    const eyes = (y = 6, h = 3, color = eye) => {
      glow(3, y, 3, h, color); glow(10, y, 3, h, color);
      if (!m.glowEyes) { px(ctx, 3, y, 1, 1, '#ffffff'); px(ctx, 10, y, 1, 1, '#ffffff'); }
    };
    const smile = () => { px(ctx, 6, 11, 4, 1, '#7a2b2b'); px(ctx, 5, 10, 1, 1, '#7a2b2b'); px(ctx, 10, 10, 1, 1, '#7a2b2b'); };
    const blush = () => { px(ctx, 2, 9, 2, 1, shade(skin, -0.06)); px(ctx, 12, 9, 2, 1, shade(skin, -0.06)); };
    const skull = (bone) => {
      px(ctx, 2, 2, 12, 9, bone); px(ctx, 3, 11, 10, 3, bone);
      glow(3, 5, 4, 4, m.glowEyes ? eye : '#121212'); glow(9, 5, 4, 4, m.glowEyes ? eye : '#121212');
      px(ctx, 7, 9, 2, 2, '#121212');
      for (let x = 4; x < 12; x += 2) px(ctx, x, 12, 1, 2, '#121212');
    };

    switch (face) {
      case 'normal':
        if (m.hair) { px(ctx, 0, 0, 16, 3, m.hair); px(ctx, 0, 0, 2, 9, m.hair); px(ctx, 14, 0, 2, 9, m.hair); }
        eyes(); smile(); blush();
        break;
      case 'angry':
        eyes(7, 2); px(ctx, 2, 5, 4, 1, '#3a1d0e'); px(ctx, 10, 5, 4, 1, '#3a1d0e');
        px(ctx, 5, 4, 1, 1, '#3a1d0e'); px(ctx, 10, 4, 1, 1, '#3a1d0e');
        if (m.beard) { px(ctx, 1, 10, 14, 6, m.beard); px(ctx, 6, 11, 4, 1, '#5a1b1b'); }
        else px(ctx, 5, 11, 6, 1, '#5a1b1b');
        break;
      case 'beard':
        eyes(5); px(ctx, 2, 4, 4, 1, shade(m.beard, -0.1)); px(ctx, 10, 4, 4, 1, shade(m.beard, -0.1));
        px(ctx, 1, 9, 14, 7, m.beard); px(ctx, 4, 9, 8, 1, shade(m.beard, 0.08));
        px(ctx, 6, 11, 4, 1, '#6b3a2a');
        break;
      case 'visor':
        px(ctx, 0, 0, 16, 16, skin);
        px(ctx, 1, 5, 14, 3, '#15171b');
        if (m.glowEyes) { glow(3, 6, 3, 1, eye); glow(10, 6, 3, 1, eye); }
        for (let y = 10; y < 15; y += 2) px(ctx, 5, y, 6, 1, shade(skin, -0.25));
        px(ctx, 7, 0, 2, 16, shade(skin, 0.1));
        break;
      case 'hood': {
        const hood = m.hood || '#333';
        px(ctx, 0, 0, 16, 16, hood);
        px(ctx, 2, 3, 12, 13, m.glowEyes ? '#0d0a0a' : shade('#f3c48f', -0.18));
        if (m.glowEyes) { glow(4, 7, 3, 2, eye); glow(9, 7, 3, 2, eye); }
        else { eyes(7, 2); px(ctx, 6, 12, 4, 1, '#6b2b2b'); }
        break;
      }
      case 'skull':
        if (m.skin === '#eeeae0') {
          glow(3, 5, 4, 4, m.glowEyes ? eye : '#121212'); glow(9, 5, 4, 4, m.glowEyes ? eye : '#121212');
          px(ctx, 7, 9, 2, 2, '#3a3a3a');
          px(ctx, 3, 12, 10, 1, '#3a3a3a');
          for (let x = 4; x < 12; x += 2) px(ctx, x, 12, 1, 3, '#3a3a3a');
        } else skull('#f2efe6');
        break;
      case 'ninja':
        px(ctx, 0, 0, 16, 16, '#1f1f24');
        px(ctx, 1, 5, 14, 4, '#f3c48f');
        eyes(6, 2);
        px(ctx, 2, 5, 4, 1, '#1f1f24');
        break;
      case 'glow':
        glow(3, 6, 3, 3, eye); glow(10, 6, 3, 3, eye);
        px(ctx, 6, 11, 4, 1, shade(skin, -0.2));
        break;
      case 'void':
        px(ctx, 0, 0, 16, 16, skin);
        glow(2, 6, 4, 2, eye); glow(10, 6, 4, 2, eye);
        glow(3, 5, 2, 1, '#c084ff'); glow(11, 5, 2, 1, '#c084ff');
        break;
      case 'goblin':
        px(ctx, 2, 5, 4, 4, '#fff36b'); px(ctx, 10, 5, 4, 4, '#fff36b');
        px(ctx, 4, 6, 2, 2, '#1d1d1d'); px(ctx, 10, 6, 2, 2, '#1d1d1d');
        px(ctx, 3, 11, 10, 2, '#3a1010');
        for (let x = 4; x < 12; x += 2) px(ctx, x, 11, 1, 1, '#ffffff');
        break;
      case 'zombie':
        px(ctx, 3, 6, 3, 3, '#1d1d1d'); px(ctx, 10, 6, 3, 2, '#c42020');
        px(ctx, 4, 11, 8, 1, '#2b3a22'); px(ctx, 5, 10, 1, 3, '#2b3a22'); px(ctx, 8, 10, 1, 3, '#2b3a22');
        px(ctx, 12, 2, 2, 3, shade(skin, -0.12));
        break;
      case 'orc':
        px(ctx, 3, 6, 3, 2, '#ffde3b'); px(ctx, 10, 6, 3, 2, '#ffde3b');
        px(ctx, 2, 5, 5, 1, '#1f3317'); px(ctx, 9, 5, 5, 1, '#1f3317');
        px(ctx, 4, 11, 8, 2, '#2a1a0e');
        px(ctx, 4, 9, 1, 3, '#f5f0e0'); px(ctx, 11, 9, 1, 3, '#f5f0e0');
        break;
      case 'ghost':
        px(ctx, 3, 5, 3, 4, '#1d2533'); px(ctx, 10, 5, 3, 4, '#1d2533');
        px(ctx, 7, 10, 2, 3, '#1d2533');
        break;
      case 'golem':
        glow(3, 6, 3, 2, eye); glow(10, 6, 3, 2, eye);
        px(ctx, 1, 2, 1, 4, shade(skin, -0.15)); px(ctx, 12, 10, 3, 1, shade(skin, -0.15));
        px(ctx, 5, 11, 6, 1, shade(skin, -0.25));
        break;
      case 'blank':
        break;
      default:
        eyes(); smile();
    }
    return { map: toTexture(c, { repeat: false, pixel: true }), emissive: m.glowEyes ? toTexture(ec, { repeat: false, pixel: true }) : null };
  });
}

// Torso front with a printed ribcage (skeletons, reapers).
export function ribsTexture(base, bone = '#f2efe6') {
  return once('ribs' + base + bone, () => {
    const [c, ctx] = canvas(64);
    px(ctx, 0, 0, 16, 16, base);
    px(ctx, 7, 1, 2, 14, bone);
    for (let y = 3; y < 12; y += 3) { px(ctx, 3, y, 10, 1, bone); px(ctx, 2, y + 1, 1, 1, bone); px(ctx, 13, y + 1, 1, 1, bone); }
    return toTexture(c, { repeat: false, pixel: true });
  });
}
