// Chunky cartoon SVG icons (64x64 viewBox, thick dark outlines).

const S = 'stroke="#1b1530" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';
const svg = (body) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

const die = (x, y, s, fill = '#eaf7ff') => {
  const k = s / 40;
  const p = (a, b) => `<circle cx="${x + a * k}" cy="${y + b * k}" r="${4 * k}" fill="#2a4f9e"/>`;
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${9 * k}" fill="${fill}" ${S}/>
    <path d="M${x + 6 * k} ${y + 9 * k} h${s - 12 * k}" stroke="#fff" stroke-width="${3 * k}" stroke-linecap="round" opacity=".8"/>
    ${p(10, 12)}${p(30, 12)}${p(20, 21)}${p(10, 30)}${p(30, 30)}`;
};

const leaf = (cx, cy, rot, fill) => `<ellipse cx="0" cy="-9" rx="8.5" ry="10" fill="${fill}" ${S} transform="translate(${cx} ${cy}) rotate(${rot})"/>`;

export const ICONS = {
  dice: svg(die(12, 12, 40)),
  dice2: svg(die(6, 6, 30, '#d7efff') + die(26, 26, 32)),
  autodice: svg(die(8, 8, 38) + `<circle cx="46" cy="46" r="13" fill="#5ee25b" ${S}/><path d="M40 46a6 6 0 1 0 6-6" fill="none" stroke="#1b1530" stroke-width="3"/><path d="M45 36l3 4-4 2" fill="none" stroke="#1b1530" stroke-width="3"/>`),
  moon: svg(`<path d="M40 8a24 24 0 1 0 16 38A20 20 0 0 1 40 8z" fill="#ffe066" ${S}/><path d="M34 18h10l-10 10h10" fill="none" stroke="#2a4f9e" stroke-width="3.5" stroke-linejoin="round"/>`),
  equip: svg(`<rect x="12" y="10" width="40" height="44" rx="8" fill="#a45bff" ${S}/><rect x="17" y="15" width="30" height="22" rx="5" fill="#d3a8ff"/><path d="M32 46V24m-9 9l9-9 9 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  house: svg(`<rect x="15" y="30" width="34" height="24" fill="#c98a4b" ${S}/><path d="M8 32L32 12l24 20z" fill="#ffd34d" ${S}/><rect x="27" y="40" width="10" height="14" fill="#5b3418" ${S}/>`),
  fence: svg([12, 26, 40].map((x) => `<path d="M${x} 56V20l6-8 6 8v36z" fill="#d79a5e" ${S}/>`).join('') + `<rect x="8" y="34" width="48" height="7" fill="#a86b35" ${S}/>`),
  wheat: svg(`<path d="M32 58V14" stroke="#1b1530" stroke-width="6" stroke-linecap="round"/><path d="M32 58V14" stroke="#e9c44c" stroke-width="2.5" stroke-linecap="round"/>${[16, 26, 36].map((y) => leaf(26, y + 8, -40, '#ffd34d') + leaf(38, y + 8, 40, '#ffd34d')).join('')}`),
  cannon: svg(`<rect x="10" y="20" width="40" height="18" rx="9" fill="#4a5a73" ${S} transform="rotate(-20 30 29)"/><circle cx="24" cy="44" r="12" fill="#a86b35" ${S}/><circle cx="24" cy="44" r="4" fill="#1b1530"/>`),
  wall: svg(`<path d="M8 56V22h9v8h8v-8h14v8h8v-8h9v34z" fill="#a9b0b9" ${S}/><path d="M8 40h48M22 40v16M42 40v16M32 30v10" stroke="#1b1530" stroke-width="3"/>`),
  market: svg(`<rect x="14" y="30" width="36" height="24" fill="#c98a4b" ${S}/><path d="M8 30l6-16h36l6 16z" fill="#fff" ${S}/><path d="M17 14l-3 16M28 14l-2 16M38 14l2 16M48 14l3 16" stroke="#e23b3b" stroke-width="5"/><path d="M8 30l6-16h36l6 16z" fill="none" ${S}/>`),
  tower: svg(`<path d="M18 56l4-30h20l4 30" fill="#a86b35" ${S}/><path d="M22 34l20 14M42 34L22 48" stroke="#1b1530" stroke-width="3"/><rect x="14" y="20" width="36" height="8" fill="#c98a4b" ${S}/><path d="M12 20l20-12 20 12z" fill="#ffd34d" ${S}/>`),
  log: svg(`<rect x="8" y="22" width="40" height="22" rx="4" fill="#c58a54" ${S}/><ellipse cx="48" cy="33" rx="8" ry="11" fill="#f0c48f" ${S}/><ellipse cx="48" cy="33" rx="3" ry="5" fill="none" stroke="#a86b35" stroke-width="2.5"/>`),
  road: svg(`<path d="M22 58l6-52h8l6 52z" fill="#d8d0c0" ${S}/><path d="M26 40h12M27 26h10M25 50h14" stroke="#1b1530" stroke-width="3"/>`),
  castle: svg(`<path d="M8 56V20h8v6h6v-6h8v6h4v-6h8v6h6v-6h8v36z" fill="#a9b0b9" ${S}/><path d="M26 56V42a6 6 0 0 1 12 0v14" fill="#5b3418" ${S}/><path d="M32 4v12" stroke="#1b1530" stroke-width="3"/><path d="M32 5h10l-3 3 3 3H32" fill="#e23b3b" ${S}/>`),
  chest: svg(`<rect x="8" y="28" width="48" height="26" rx="3" fill="#a86b35" ${S}/><path d="M8 30c0-14 48-14 48 0z" fill="#c98a4b" ${S}/><rect x="27" y="28" width="10" height="12" rx="2" fill="#ffd34d" ${S}/><path d="M8 34h48" stroke="#1b1530" stroke-width="3"/>`),
  coin: svg(`<circle cx="32" cy="32" r="22" fill="#ffd34d" ${S}/><circle cx="32" cy="32" r="14" fill="none" stroke="#d99a1e" stroke-width="3"/><path d="M32 22l3 7h7l-6 4 2 8-6-5-6 5 2-8-6-4h7z" fill="#fff3b0"/>`),
  coins: svg(`<ellipse cx="26" cy="46" rx="16" ry="7" fill="#e9b42a" ${S}/><ellipse cx="26" cy="38" rx="16" ry="7" fill="#ffd34d" ${S}/><circle cx="42" cy="24" r="14" fill="#ffd34d" ${S}/><path d="M42 16v16" stroke="#d99a1e" stroke-width="4" stroke-linecap="round"/>`),
  bank: svg(`<path d="M18 22c-8 6-10 32 14 32s22-26 14-32z" fill="#c98a4b" ${S}/><path d="M22 14h20l-4 8H26z" fill="#a86b35" ${S}/><text x="32" y="47" font-family="system-ui" font-weight="900" font-size="20" text-anchor="middle" fill="#ffe066" stroke="#1b1530" stroke-width="1.5">%</text>`),
  goblin: svg(`<path d="M6 26l12 2M58 26l-12 2" stroke="#1b1530" stroke-width="9" stroke-linecap="round"/><path d="M6 26l12 2M58 26l-12 2" stroke="#7cc242" stroke-width="4" stroke-linecap="round"/><rect x="16" y="14" width="32" height="34" rx="8" fill="#7cc242" ${S}/><rect x="21" y="24" width="8" height="8" fill="#fff36b"/><rect x="35" y="24" width="8" height="8" fill="#fff36b"/><circle cx="46" cy="48" r="10" fill="#ffd34d" ${S}/>`),
  crown: svg(`<path d="M8 48l4-30 12 12 8-18 8 18 12-12 4 30z" fill="#ffd34d" ${S}/><rect x="8" y="46" width="48" height="8" rx="2" fill="#e9b42a" ${S}/><circle cx="32" cy="36" r="4" fill="#ff4778"/>`),
  backpack: svg(`<rect x="14" y="16" width="36" height="40" rx="9" fill="#8a5a2e" ${S}/><path d="M24 16v-4a8 8 0 0 1 16 0v4" fill="none" ${S}/><rect x="20" y="32" width="24" height="16" rx="4" fill="#6b4423" ${S}/><rect x="28" y="30" width="8" height="6" rx="2" fill="#ffd34d" ${S}/>`),
  flame: svg(`<path d="M32 6c4 12 18 16 18 32a18 18 0 0 1-36 0c0-8 4-12 8-16 0 6 4 8 6 8-2-10 2-18 4-24z" fill="#ff5a3d" ${S}/><path d="M32 30c2 6 9 8 9 15a9 9 0 0 1-18 0c0-5 4-8 9-15z" fill="#ffd34d"/>`),
  drum: svg(`<ellipse cx="32" cy="24" rx="20" ry="8" fill="#f2e6d0" ${S}/><path d="M12 24v20c0 5 9 9 20 9s20-4 20-9V24" fill="#e23b3b" ${S}/><path d="M16 30l8 20M48 30l-8 20M32 32v20" stroke="#ffd34d" stroke-width="3"/><path d="M40 6L28 20M24 6l12 14" stroke="#1b1530" stroke-width="4" stroke-linecap="round"/>`),
  crit: svg(`<path d="M32 4l6 16 16-6-8 14 14 8-16 2 4 16-14-10-10 14-2-16-16 2 12-12L6 20l16 2z" fill="#ff4a4a" ${S}/><path d="M32 20v14M32 40v2" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`),
  eye: svg(`<path d="M4 32s10-18 28-18 28 18 28 18-10 18-28 18S4 32 4 32z" fill="#fff" ${S}/><circle cx="32" cy="32" r="10" fill="#43b0ff" ${S}/><circle cx="32" cy="32" r="4" fill="#1b1530"/>`),
  star: svg(`<path d="M32 6l8 16 18 3-13 12 3 18-16-9-16 9 3-18L6 25l18-3z" fill="#ffd34d" ${S}/>`),
  sword: svg(`<path d="M46 8l10 0 0 10-26 26-10-10z" fill="#dfe6ee" ${S}/><path d="M14 36l14 14" stroke="#1b1530" stroke-width="9" stroke-linecap="round"/><path d="M14 36l14 14" stroke="#ffd34d" stroke-width="4" stroke-linecap="round"/><path d="M18 46l-8 8" stroke="#1b1530" stroke-width="8" stroke-linecap="round"/><path d="M18 46l-8 8" stroke="#8a5a2e" stroke-width="3.5" stroke-linecap="round"/>`),
  cursor: svg(`<path d="M16 6l34 26-15 3 9 18-8 4-9-18-11 10z" fill="#fff" ${S}/>`),
  hammer: svg(`<rect x="10" y="10" width="30" height="18" rx="4" fill="#b8c2cc" ${S} transform="rotate(-35 25 19)"/><path d="M30 26l22 26" stroke="#1b1530" stroke-width="10" stroke-linecap="round"/><path d="M30 26l22 26" stroke="#c98a4b" stroke-width="5" stroke-linecap="round"/>`),
  splash: svg(`<circle cx="32" cy="32" r="10" fill="#fff" ${S}/>${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${32 + Math.cos(a * Math.PI / 180) * 21}" cy="${32 + Math.sin(a * Math.PI / 180) * 21}" r="5" fill="#bfe8ff" ${S}/>`).join('')}`),
  robot: svg(`<rect x="12" y="18" width="40" height="32" rx="8" fill="#b8c2cc" ${S}/><rect x="19" y="27" width="10" height="8" rx="2" fill="#43b0ff"/><rect x="35" y="27" width="10" height="8" rx="2" fill="#43b0ff"/><path d="M24 42h16M32 18V8" stroke="#1b1530" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="8" r="4" fill="#ff4a4a" ${S}/>`),
  bolt: svg(`<path d="M36 4L12 36h16l-6 24 28-36H34z" fill="#ffe14a" ${S}/>`),
  clover: svg(`<path d="M32 36q6 14 0 24" stroke="#1b1530" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M32 36q6 14 0 24" stroke="#3fae2c" stroke-width="3" stroke-linecap="round" fill="none"/>${leaf(32, 34, 0, '#5ed63f')}${leaf(32, 34, 120, '#5ed63f')}${leaf(32, 34, 240, '#5ed63f')}`),
  clover4: svg(`<path d="M32 36q6 14 0 24" stroke="#1b1530" stroke-width="7" stroke-linecap="round" fill="none"/>${leaf(32, 32, 45, '#2fc05a')}${leaf(32, 32, 135, '#2fc05a')}${leaf(32, 32, 225, '#2fc05a')}${leaf(32, 32, 315, '#2fc05a')}<path d="M52 6v10M47 11h10" stroke="#ffe14a" stroke-width="3.5" stroke-linecap="round"/>`),
  golden: svg(`<rect x="12" y="14" width="40" height="38" rx="6" fill="#ffd34d" ${S}/><path d="M12 24h40" stroke="#e9b42a" stroke-width="4"/><rect x="20" y="30" width="8" height="10" fill="#7a4b00"/><rect x="36" y="30" width="8" height="10" fill="#7a4b00"/><path d="M50 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff" ${S}/>`),
  huge: svg(`<rect x="8" y="18" width="34" height="34" rx="6" fill="#f3c48f" ${S}/><rect x="15" y="28" width="6" height="8" fill="#1b1530"/><rect x="29" y="28" width="6" height="8" fill="#1b1530"/><path d="M48 40V8m-8 8l8-8 8 8" fill="none" stroke="#1b1530" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 40V8m-8 8l8-8 8 8" fill="none" stroke="#5ee25b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  streak: svg(die(6, 14, 34) + `<path d="M48 8c2 6 10 9 10 18a10 10 0 0 1-20 0c0-4 2-6 4-9 0 3 2 4 3 4-1-5 1-9 3-13z" fill="#ff8a3d" ${S}/><text x="47" y="58" font-family="system-ui" font-weight="900" font-size="18" text-anchor="middle" fill="#fff" stroke="#1b1530" stroke-width="1.5">x2</text>`),
  tap: svg(`<path d="M24 34V12a5 5 0 0 1 10 0v16l12 3c4 1 6 4 5 8l-3 13c-1 4-4 6-8 6H30c-3 0-5-1-7-4l-9-12c-2-3 2-7 5-5z" fill="#fff" ${S}/><path d="M14 10l-5-4M12 20H5M42 8l4-5" stroke="#ffd34d" stroke-width="4" stroke-linecap="round"/>`),
  combo: svg(die(4, 16, 30, '#ffe2c9') + `<path d="M44 6c3 8 14 11 14 23a12 12 0 0 1-24 0c0-6 3-9 6-12 0 4 2 6 4 6-1-7 0-12 0-17z" fill="#ff6a3d" ${S}/><text x="44" y="60" font-family="system-ui" font-weight="900" font-size="17" text-anchor="middle" fill="#fff" stroke="#1b1530" stroke-width="1.5">x10</text>`),
  speeddie: svg(`<path d="M2 26h12M4 36h10M6 46h8" stroke="#1b1530" stroke-width="6" stroke-linecap="round"/><path d="M2 26h12M4 36h10M6 46h8" stroke="#fff36b" stroke-width="2.5" stroke-linecap="round"/><rect x="18" y="12" width="40" height="40" rx="9" fill="#ffd34d" ${S}/><path d="M24 20h28" stroke="#fff3b0" stroke-width="3" stroke-linecap="round"/><path d="M42 18L28 36h9l-4 12 14-18h-9z" fill="#fff" stroke="#1b1530" stroke-width="2.5" stroke-linejoin="round"/>`),
  goldbar: svg(`<path d="M6 44l10-18h32l10 18z" fill="#ffc93b" ${S}/><path d="M16 26l6-10h20l6 10z" fill="#ffe27a" ${S}/><path d="M12 42h40" stroke="#fff3b0" stroke-width="3" stroke-linecap="round"/>`),
  heart: svg(`<path d="M32 56S6 40 6 22a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 18-26 34-26 34z" fill="#ff4a5c" ${S}/><path d="M16 20a6 6 0 0 1 6-5" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/>`),
  skull: svg(`<path d="M12 30a20 20 0 0 1 40 0v8l-6 4v10H18V42l-6-4z" fill="#f2efe6" ${S}/><rect x="19" y="28" width="9" height="9" rx="2" fill="#1b1530"/><rect x="36" y="28" width="9" height="9" rx="2" fill="#1b1530"/><path d="M27 52v-6M32 52v-6M37 52v-6" stroke="#1b1530" stroke-width="3"/>`),
  gear: svg(`<path d="M28 6h8l2 7 6 3 7-3 5 6-4 6 2 6 7 2v8l-7 2-2 6 4 6-5 6-7-3-6 3-2 7h-8l-2-7-6-3-7 3-5-6 4-6-2-6-7-2v-8l7-2 2-6-4-6 5-6 7 3 6-3z" fill="#c4ccd6" ${S}/><circle cx="32" cy="32" r="8" fill="#6b7685" ${S}/>`),
  book: svg(`<path d="M8 12h20a6 6 0 0 1 6 6v36a5 5 0 0 0-5-5H8z" fill="#43b0ff" ${S}/><path d="M56 12H38a6 6 0 0 0-6 6v36a5 5 0 0 1 5-5h19z" fill="#79c8ff" ${S}/><path d="M14 22h12M14 30h12M40 22h10M40 30h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  hex: svg(`<path d="M32 4l24 14v28L32 60 8 46V18z" fill="#2ec5ff" ${S}/><path d="M32 14l15 9v18l-15 9-15-9V23z" fill="#bff0ff" ${S}/>`),
  lock: svg(`<rect x="12" y="28" width="40" height="28" rx="6" fill="#ffc93b" ${S}/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" ${S}/><circle cx="32" cy="41" r="4" fill="#1b1530"/>`),
  swords: svg(`<path d="M10 10l30 30M54 10L24 40" stroke="#1b1530" stroke-width="10" stroke-linecap="round"/><path d="M10 10l30 30M54 10L24 40" stroke="#dfe6ee" stroke-width="5" stroke-linecap="round"/><path d="M36 50l10-10M28 50L18 40" stroke="#1b1530" stroke-width="9" stroke-linecap="round"/><path d="M36 50l10-10M28 50L18 40" stroke="#ffd34d" stroke-width="4" stroke-linecap="round"/>`),
  close: svg(`<path d="M16 16l32 32M48 16L16 48" stroke="#1b1530" stroke-width="12" stroke-linecap="round"/><path d="M16 16l32 32M48 16L16 48" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`),
  plus: svg(`<path d="M32 12v40M12 32h40" stroke="#1b1530" stroke-width="12" stroke-linecap="round"/><path d="M32 12v40M12 32h40" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`),
  minus: svg(`<path d="M12 32h40" stroke="#1b1530" stroke-width="12" stroke-linecap="round"/><path d="M12 32h40" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`),
  sound: svg(`<path d="M8 24h10l14-12v40L18 40H8z" fill="#fff" ${S}/><path d="M40 22a14 14 0 0 1 0 20M46 16a22 22 0 0 1 0 32" fill="none" stroke="#1b1530" stroke-width="4" stroke-linecap="round"/>`),
};

export const icon = (name) => ICONS[name] || ICONS.star;
