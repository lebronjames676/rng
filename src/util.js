// Small shared helpers: math, randomness and number formatting.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

// Game-style money format with three significant digits: 950, 1.25K, 20.0K, 1.00M
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 > 0.05 ? n.toFixed(1) : Math.floor(n).toString();
  let i = 0;
  while (n >= 1000 && i < SUFFIXES.length - 1) { n /= 1000; i++; }
  let s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  if (parseFloat(s) >= 1000 && i < SUFFIXES.length - 1) { n /= 1000; i++; s = n.toFixed(2); }
  return s + SUFFIXES[i];
}

// Compact format without trailing zeros, used for odds: 1500 -> 1.5K, 1000000 -> 1M
export function fmtShort(n) {
  if (n < 1000) return (Math.round(n * 10) / 10).toString();
  let i = 0;
  while (n >= 1000 && i < SUFFIXES.length - 1) { n /= 1000; i++; }
  const s = n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
  return s + SUFFIXES[i];
}

export const fmtOdds = (n) => '1 in ' + fmtShort(Math.max(1, n));

export function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Weighted pick from [{w, ...}] entries.
export function weighted(list, key = 'w') {
  let total = 0;
  for (const e of list) total += e[key];
  let r = Math.random() * total;
  for (const e of list) { r -= e[key]; if (r <= 0) return e; }
  return list[list.length - 1];
}
