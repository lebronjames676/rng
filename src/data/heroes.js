// Hero roster. `odds` is the "1 in N" chance shown to the player.
// `model` drives the blocky character builder in world/models.js.
// `attack` describes how the hero fights (see game/battle.js).

export const RARITIES = {
  common:    { name: 'Common',    color: '#d6dde6', dark: '#5d6875', tier: 0 },
  uncommon:  { name: 'Uncommon',  color: '#6ee36f', dark: '#1f7a2c', tier: 1 },
  rare:      { name: 'Rare',      color: '#43b0ff', dark: '#11549c', tier: 2 },
  epic:      { name: 'Epic',      color: '#bd6bff', dark: '#5b1fa0', tier: 3 },
  legendary: { name: 'Legendary', color: '#ffb52e', dark: '#9c5a00', tier: 4 },
  mythic:    { name: 'Mythic',    color: '#ff4778', dark: '#9c0f37', tier: 5 },
  secret:    { name: 'Secret',    color: '#ffffff', dark: '#222222', tier: 6, rainbow: true },
};

const SKIN = '#f3c48f';

export const HEROES = [
  {
    id: 'villager', name: 'Villager', rarity: 'common', odds: 2,
    dmg: 4, rate: 1.0, range: 7.5,
    attack: { kind: 'slash', color: '#ffffff' },
    model: { skin: SKIN, face: 'normal', shirt: '#a0703f', pants: '#3d5a80',
      hat: { type: 'straw', color: '#e9c44c' }, weapon: { type: 'pitchfork', color: '#8b5a2b' } },
  },
  {
    id: 'archer', name: 'Archer', rarity: 'common', odds: 4,
    dmg: 5, rate: 1.2, range: 11,
    attack: { kind: 'arrow', color: '#d9b77a' },
    model: { skin: SKIN, face: 'normal', shirt: '#4f9d3a', pants: '#6b4a2b',
      hat: { type: 'cap', color: '#3f7f2e', accent: '#d63a3a' }, weapon: { type: 'bow', color: '#8b5a2b' } },
  },
  {
    id: 'guard', name: 'Town Guard', rarity: 'common', odds: 6,
    dmg: 9, rate: 0.9, range: 7.5,
    attack: { kind: 'slash', color: '#e8eef5' },
    model: { skin: SKIN, face: 'normal', shirt: '#b33a3a', pants: '#555c66',
      hat: { type: 'helmet', color: '#aab4be' }, weapon: { type: 'sword', color: '#cfd6de' },
      offhand: { type: 'shield', color: '#7a4a24', accent: '#e9c44c' } },
  },
  {
    id: 'knight', name: 'Knight', rarity: 'uncommon', odds: 12,
    dmg: 16, rate: 1.0, range: 8,
    attack: { kind: 'slash', color: '#dff3ff' },
    model: { skin: '#c3ccd5', face: 'visor', shirt: '#c3ccd5', pants: '#7d8791',
      hat: { type: 'plume', color: '#d63a3a' }, weapon: { type: 'sword', color: '#e6edf3' },
      offhand: { type: 'shield', color: '#2f5fb3', accent: '#ffffff' }, cape: '#2f5fb3' },
  },
  {
    id: 'hunter', name: 'Hunter', rarity: 'uncommon', odds: 20,
    dmg: 18, rate: 1.1, range: 12,
    attack: { kind: 'arrow', color: '#bfa274' },
    model: { skin: SKIN, face: 'hood', hood: '#6b5233', shirt: '#7a5230', pants: '#4a3520',
      hat: { type: 'hood', color: '#6b5233' }, weapon: { type: 'crossbow', color: '#6d4523' } },
  },
  {
    id: 'apprentice', name: 'Apprentice', rarity: 'uncommon', odds: 32,
    dmg: 22, rate: 1.0, range: 11,
    attack: { kind: 'bolt', color: '#7fd0ff', aoe: 1.2 },
    model: { skin: SKIN, face: 'normal', shirt: '#3b6fd4', pants: '#2c55a8',
      hat: { type: 'wizard', color: '#3b6fd4', accent: '#ffd23f' }, weapon: { type: 'staff', color: '#7a4a24', gem: '#7fd0ff' } },
  },
  {
    id: 'paladin', name: 'Paladin', rarity: 'rare', odds: 60,
    dmg: 45, rate: 0.9, range: 8,
    attack: { kind: 'slash', color: '#ffe680', aoe: 1.8 },
    model: { skin: SKIN, face: 'beard', beard: '#c98b3a', shirt: '#f1f1f1', pants: '#d8b545',
      hat: { type: 'helmet', color: '#e3b341' }, weapon: { type: 'hammer', color: '#d9dee6' },
      cape: '#e8d48a', belt: '#e3b341' },
  },
  {
    id: 'ranger', name: 'Ranger', rarity: 'rare', odds: 100,
    dmg: 30, rate: 2.0, range: 14,
    attack: { kind: 'arrow', color: '#9cff8a' },
    model: { skin: SKIN, face: 'hood', hood: '#2f6b3a', shirt: '#2f6b3a', pants: '#3e3a2a',
      hat: { type: 'hood', color: '#2f6b3a' }, weapon: { type: 'bow', color: '#5b3a1e' }, cape: '#244f2c' },
  },
  {
    id: 'frostmage', name: 'Frost Mage', rarity: 'rare', odds: 150,
    dmg: 50, rate: 1.1, range: 12,
    attack: { kind: 'bolt', color: '#aef0ff', aoe: 1.5, slow: 0.45 },
    model: { skin: '#e6eef5', face: 'normal', eye: '#2b8bd6', shirt: '#5aa9e6', pants: '#3a86c8',
      hat: { type: 'wizard', color: '#bfe8ff', accent: '#5aa9e6' }, weapon: { type: 'staff', color: '#d8f4ff', gem: '#aef0ff' },
      aura: '#9be7ff' },
  },
  {
    id: 'berserker', name: 'Berserker', rarity: 'epic', odds: 300,
    dmg: 70, rate: 2.2, range: 8,
    attack: { kind: 'slash', color: '#ff9b6a' },
    model: { skin: '#e0a878', face: 'angry', beard: '#d9682a', shirt: '#e0a878', pants: '#6b3a1f',
      hat: { type: 'viking', color: '#9aa3ad' }, weapon: { type: 'axe', color: '#c9d1d9' },
      offhand: { type: 'axe', color: '#c9d1d9' }, belt: '#4a2a14' },
  },
  {
    id: 'pyromancer', name: 'Pyromancer', rarity: 'epic', odds: 500,
    dmg: 160, rate: 0.9, range: 12,
    attack: { kind: 'fireball', color: '#ff7a1a', aoe: 2.2 },
    model: { skin: SKIN, face: 'hood', hood: '#7a1410', eye: '#ffb02e', glowEyes: true, shirt: '#b3261e', pants: '#7a1410',
      hat: { type: 'hood', color: '#7a1410' }, weapon: { type: 'staff', color: '#3a1d0e', gem: '#ff6a00' },
      offhand: { type: 'flame', color: '#ff7a1a' }, aura: '#ff7a1a' },
  },
  {
    id: 'ninja', name: 'Ninja', rarity: 'epic', odds: 800,
    dmg: 55, rate: 3.5, range: 13,
    attack: { kind: 'shuriken', color: '#cfd6de' },
    model: { skin: '#1f1f24', face: 'ninja', shirt: '#1f1f24', pants: '#2a2a31',
      hat: { type: 'bandana', color: '#d62828' }, weapon: { type: 'katana', color: '#e6edf3' }, belt: '#d62828' },
  },
  {
    id: 'dragonknight', name: 'Dragon Knight', rarity: 'legendary', odds: 2000,
    dmg: 520, rate: 0.9, range: 9,
    attack: { kind: 'slash', color: '#ff6a1f', aoe: 2.0 },
    model: { skin: '#8e1616', face: 'visor', eye: '#ffb02e', glowEyes: true, shirt: '#9e1b1b', pants: '#5e0f0f',
      hat: { type: 'horns', color: '#f0c040' }, weapon: { type: 'lance', color: '#f0c040' },
      wings: '#b71c1c', aura: '#ff5a1f', belt: '#f0c040' },
  },
  {
    id: 'stormwizard', name: 'Storm Wizard', rarity: 'legendary', odds: 4000,
    dmg: 330, rate: 1.4, range: 13,
    attack: { kind: 'lightning', color: '#fff36b', chain: 4 },
    model: { skin: SKIN, face: 'beard', beard: '#f2f2f2', shirt: '#2b3a8f', pants: '#1f2a6b',
      hat: { type: 'wizard', color: '#2b3a8f', accent: '#ffd23f' }, weapon: { type: 'staff', color: '#5b3a1e', gem: '#fff36b' },
      aura: '#7df9ff' },
  },
  {
    id: 'valkyrie', name: 'Valkyrie', rarity: 'legendary', odds: 7000,
    dmg: 400, rate: 1.8, range: 12,
    attack: { kind: 'spear', color: '#ffe680' },
    model: { skin: SKIN, face: 'normal', hair: '#f5d76e', shirt: '#d9dee6', pants: '#3a66c4',
      hat: { type: 'winged', color: '#d9dee6' }, weapon: { type: 'spear', color: '#f0c040' },
      offhand: { type: 'shield', color: '#3a66c4', accent: '#f0c040' }, wings: '#ffffff' },
  },
  {
    id: 'reaper', name: 'Grim Reaper', rarity: 'mythic', odds: 15000,
    dmg: 1250, rate: 1.2, range: 9,
    attack: { kind: 'scythe', color: '#ff2a2a', aoe: 2.5 },
    model: { skin: '#151518', face: 'skull', eye: '#ff2a2a', glowEyes: true, shirt: '#151518', pants: '#151518',
      ribs: true, trim: '#c0141c', hat: { type: 'hoodpeak', color: '#151518' },
      weapon: { type: 'scythe', color: '#2a2a2e', blade: '#3d3d44' }, offhand: { type: 'flame', color: '#ff3030' }, aura: '#ff2a2a' },
  },
  {
    id: 'necromancer', name: 'Necromancer', rarity: 'mythic', odds: 40000,
    dmg: 2200, rate: 1.0, range: 13,
    attack: { kind: 'bolt', color: '#7dff7a', aoe: 2.0 },
    model: { skin: '#2a1a3d', face: 'hood', hood: '#2a1a3d', eye: '#7dff7a', glowEyes: true, shirt: '#3a2456', pants: '#2a1a3d',
      hat: { type: 'hoodpeak', color: '#2a1a3d' }, weapon: { type: 'skullstaff', color: '#3a2a1e', gem: '#7dff7a' },
      offhand: { type: 'orb', color: '#7dff7a' }, aura: '#7dff7a', cape: '#1c1029' },
  },
  {
    id: 'celestial', name: 'Celestial', rarity: 'mythic', odds: 90000,
    dmg: 3600, rate: 1.3, range: 14,
    attack: { kind: 'bolt', color: '#ffe680', aoe: 2.0 },
    model: { skin: '#fff7e0', face: 'glow', eye: '#ffcf3f', glowEyes: true, shirt: '#fff7e0', pants: '#f2deb0',
      hat: { type: 'halo', color: '#ffe066' }, weapon: { type: 'staff', color: '#f0c040', gem: '#fffbe0' },
      offhand: { type: 'orb', color: '#ffe680' }, wings: '#fff4c2', aura: '#fff2a8', belt: '#f0c040' },
  },
  {
    id: 'voidking', name: 'Void King', rarity: 'secret', odds: 250000,
    dmg: 9000, rate: 1.5, range: 11,
    attack: { kind: 'slash', color: '#b46bff', aoe: 2.5 },
    model: { skin: '#120a20', face: 'void', eye: '#ffffff', glowEyes: true, shirt: '#1b0f2e', pants: '#120a20',
      hat: { type: 'crown', color: '#c9a2ff' }, weapon: { type: 'sword', color: '#b46bff', glow: true },
      cape: '#3d1a6e', aura: '#a855ff', trim: '#c9a2ff' },
  },
  {
    id: 'deathincarnate', name: 'Death Incarnate', rarity: 'secret', odds: 1000000,
    dmg: 22000, rate: 1.6, range: 11,
    attack: { kind: 'scythe', color: '#ff1a3c', aoe: 3.0 },
    model: { skin: '#0b0b0d', face: 'skull', eye: '#ffffff', glowEyes: true, shirt: '#0b0b0d', pants: '#0b0b0d',
      ribs: true, trim: '#ff1a3c', hat: { type: 'demonhorns', color: '#1a1a1f' },
      weapon: { type: 'scythe', color: '#1a1a1f', blade: '#ff1a3c', glow: true }, offhand: { type: 'flame', color: '#ff1a3c' },
      cape: '#5a0010', aura: '#ff1a3c', scale: 1.12 },
  },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

// Variants roll on top of the hero itself.
export const VARIANTS = {
  n:  { name: '',             mult: 1,  scale: 1 },
  g:  { name: 'Golden',       mult: 2.5, scale: 1 },
  h:  { name: 'HUGE',         mult: 4,  scale: 1.45 },
  hg: { name: 'HUGE Golden',  mult: 10, scale: 1.45 },
};

export const stackKey = (id, v = 'n') => `${id}|${v}`;
export function parseKey(key) {
  const [id, v] = key.split('|');
  return { id, v: v || 'n', hero: HERO_BY_ID[id], variant: VARIANTS[v || 'n'] };
}

export function displayName(key) {
  const { hero, variant } = parseKey(key);
  return variant.name ? `${variant.name} ${hero.name}` : hero.name;
}

// Mastery: owning many copies of a hero type makes every copy stronger.
export const MASTERY_STEPS = [1, 10, 50, 250, 1000, 5000];
export function masteryStars(copies) {
  let s = 0;
  for (const t of MASTERY_STEPS) if (copies >= t) s++;
  return s;
}
