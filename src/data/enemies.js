// Enemy types and wave composition.

export const ENEMIES = {
  skeleton: {
    name: 'Skeleton', hp: 1, speed: 2.2, gold: 1, dmg: 5, scale: 1, minWave: 1,
    model: { skin: '#eeeae0', face: 'skull', eye: '#1b1b1b', shirt: '#eeeae0', pants: '#d9d4c7', ribs: true,
      bony: true, weapon: { type: 'sword', color: '#8e8f91' } },
  },
  goblin: {
    name: 'Goblin', hp: 0.7, speed: 3.1, gold: 1, dmg: 4, scale: 0.8, minWave: 3,
    model: { skin: '#7cc242', face: 'goblin', shirt: '#7a5230', pants: '#4a3520', ears: true,
      weapon: { type: 'dagger', color: '#b0b8c0' } },
  },
  zombie: {
    name: 'Zombie', hp: 1.8, speed: 1.5, gold: 1.5, dmg: 8, scale: 1, minWave: 5, zombie: true,
    model: { skin: '#79a86a', face: 'zombie', shirt: '#3f6fa3', pants: '#3b3b5e' },
  },
  ghost: {
    name: 'Ghost', hp: 1.3, speed: 2.7, gold: 2, dmg: 8, scale: 1, minWave: 8, float: true,
    model: { skin: '#e9f3ff', face: 'ghost', shirt: '#e9f3ff', pants: '#e9f3ff', ghost: true },
  },
  orc: {
    name: 'Orc', hp: 3.5, speed: 1.8, gold: 3, dmg: 10, scale: 1.3, minWave: 12,
    model: { skin: '#4f8a3a', face: 'orc', shirt: '#6b4a2b', pants: '#3a2a1a', belt: '#2a1a0e',
      weapon: { type: 'axe', color: '#9aa3ad' } },
  },
  golem: {
    name: 'Stone Golem', hp: 9, speed: 1.1, gold: 7, dmg: 20, scale: 1.6, minWave: 18,
    model: { skin: '#8d939b', face: 'golem', eye: '#5ff2ff', glowEyes: true, shirt: '#7a8089', pants: '#6a7078', chunky: true },
  },
};

export const BOSSES = [
  {
    id: 'skeletonking', name: 'Skeleton King', hp: 28, speed: 0.85, gold: 40, dmg: 1000, scale: 2.1,
    model: { skin: '#eeeae0', face: 'skull', eye: '#ff3b3b', glowEyes: true, shirt: '#5b1f8a', pants: '#3a1459', ribs: false,
      bony: true, hat: { type: 'crown', color: '#f0c040' }, weapon: { type: 'sword', color: '#cfd6de' }, cape: '#7a1f1f' },
  },
  {
    id: 'orcwarlord', name: 'Orc Warlord', hp: 34, speed: 0.8, gold: 50, dmg: 1000, scale: 2.2,
    model: { skin: '#3f7a2e', face: 'orc', shirt: '#4a2a14', pants: '#2a1a0e', hat: { type: 'viking', color: '#6b6f75' },
      weapon: { type: 'hammer', color: '#6b6f75' }, belt: '#a01818' },
  },
  {
    id: 'lich', name: 'Lich Lord', hp: 40, speed: 0.9, gold: 60, dmg: 1000, scale: 2.1, float: true,
    model: { skin: '#cfe8ff', face: 'skull', eye: '#5ff2ff', glowEyes: true, shirt: '#1d2a5e', pants: '#1d2a5e',
      hat: { type: 'crown', color: '#5ff2ff' }, weapon: { type: 'staff', color: '#2a2a2e', gem: '#5ff2ff' }, cape: '#10183a', aura: '#5ff2ff' },
  },
];

// Enemy health and gold scale exponentially with the wave number.
export const hpScale = (w) => 10 * Math.pow(1.14, w - 1);
export const goldScale = (w) => Math.pow(1.115, w - 1);

export function waveReward(w) {
  return Math.round(30 * goldScale(w));
}

export function isBossWave(w) {
  return w % 10 === 0;
}

export function lanesForWave(w) {
  if (w >= 13) return 4;
  if (w >= 8) return 3;
  if (w >= 4) return 2;
  return 1;
}

// Builds the list of spawns for a wave: [{type, delay, lane}]
export function buildWave(w) {
  const count = Math.min(6 + Math.floor(w * 1.2), 40);
  const types = Object.entries(ENEMIES).filter(([, e]) => w >= e.minWave);
  const lanes = lanesForWave(w);
  const interval = Math.max(0.3, 0.9 - w * 0.012);
  const list = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    // Newer enemy types get more common as waves go on.
    const weights = types.map(([id, e]) => ({ id, w: 1 + Math.max(0, (w - e.minWave) * 0.15) }));
    let total = weights.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total, chosen = weights[0].id;
    for (const e of weights) { r -= e.w; if (r <= 0) { chosen = e.id; break; } }
    list.push({ type: chosen, delay: t, lane: i % lanes });
    t += interval * (0.7 + Math.random() * 0.6);
  }
  if (isBossWave(w)) {
    const boss = BOSSES[(w / 10 - 1) % BOSSES.length];
    list.push({ type: boss.id, boss: true, delay: t + 1.5, lane: 0 });
  }
  return list;
}

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
export const enemyDef = (id) => ENEMIES[id] || BOSS_BY_ID[id];
