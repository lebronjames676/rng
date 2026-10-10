// Pure game rules: rolling, hero power, equipping, saving. No DOM or three.js here.

import { HEROES, HERO_BY_ID, VARIANTS, stackKey, parseKey, masteryStars } from '../data/heroes.js';
import { computeStats, NODE_BY_ID, nodeCost, canBuy } from '../data/upgrades.js';
import { goldScale, waveReward } from '../data/enemies.js';

const SAVE_KEY = 'hero-rng-tycoon-save-v1';
const ROLL_ORDER = [...HEROES].sort((a, b) => b.odds - a.odds); // rarest first

export function newState() {
  return {
    v: 1,
    gold: 0,
    totalGold: 0,
    wave: 1,
    bestWave: 0,
    upgrades: {},
    inv: { [stackKey('villager')]: 1 },
    equipped: [stackKey('villager'), null],
    copies: { villager: 1 }, // total copies per hero id, for mastery
    discovered: { villager: true },
    rolls: 0,
    clicks: 0,
    kills: 0,
    bestRoll: 'villager',
    lastSeen: Date.now(),
    settings: { sound: true, autoRoll: false, shadows: true },
    tutorial: { rolled: false, upgraded: false },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    const base = newState();
    const st = { ...base, ...data, settings: { ...base.settings, ...data.settings }, tutorial: { ...base.tutorial, ...data.tutorial } };
    // Drop anything that refers to heroes or upgrades that no longer exist.
    for (const k of Object.keys(st.inv)) if (!HERO_BY_ID[k.split('|')[0]] || !VARIANTS[k.split('|')[1] || 'n']) delete st.inv[k];
    for (const k of Object.keys(st.upgrades)) if (!NODE_BY_ID[k]) delete st.upgrades[k];
    st.equipped = (st.equipped || []).map((k) => (k && st.inv[k] ? k : null));
    if (!HERO_BY_ID[st.bestRoll]) st.bestRoll = 'villager';
    return st;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    state.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ }
}

// ---------------- Rolling ----------------

// Sol's-RNG style roll: try the rarest hero first; each gets a luck/odds chance.
export function rollHeroId(luck, rng = Math.random) {
  for (let i = 0; i < ROLL_ORDER.length - 1; i++) {
    const h = ROLL_ORDER[i];
    if (rng() < luck / h.odds) return h.id;
  }
  return ROLL_ORDER[ROLL_ORDER.length - 1].id;
}

export function rollVariant(stats, rng = Math.random) {
  const huge = rng() < stats.hugeChance;
  const golden = rng() < stats.goldenChance;
  if (huge && golden) return 'hg';
  if (huge) return 'h';
  if (golden) return 'g';
  return 'n';
}

// Luck for the next roll, including the every-10th-roll streak bonus.
export function currentLuck(state, stats) {
  const streak = stats.streakMult > 1 && (state.rolls + 1) % 10 === 0;
  return { luck: stats.totalLuck * (streak ? stats.streakMult : 1), streak };
}

// Performs one roll press and returns the resulting stack keys.
export function doRoll(state, stats) {
  const { luck, streak } = currentLuck(state, stats);
  const results = [];
  for (let i = 0; i < stats.rollsPerRoll; i++) {
    const id = rollHeroId(luck);
    const v = rollVariant(stats);
    const key = stackKey(id, v);
    addHero(state, key, 1);
    results.push(key);
  }
  state.rolls++;
  state.tutorial.rolled = true;
  return { results, streak, luck };
}

export function addHero(state, key, n) {
  const { id } = parseKey(key);
  state.inv[key] = (state.inv[key] || 0) + n;
  state.copies[id] = (state.copies[id] || 0) + n;
  if (!state.discovered[id]) state.discovered[id] = true;
  if (HERO_BY_ID[id].odds > HERO_BY_ID[state.bestRoll].odds) state.bestRoll = id;
}

// Rarity score for sorting/highlighting a result.
export const heroOdds = (key) => parseKey(key).hero.odds;

// ---------------- Hero power ----------------

export function masteryMult(state, stats, heroId) {
  const stars = masteryStars(state.copies[heroId] || 0);
  return 1 + 0.15 * Math.max(0, stars - 1) * stats.masteryMult;
}

export function heroStats(state, stats, key) {
  const { hero, variant } = parseKey(key);
  const dmg = hero.dmg * variant.mult * masteryMult(state, stats, hero.id) * stats.heroDmg;
  const rate = hero.rate * stats.atkSpeed;
  const range = hero.range * stats.range;
  return { dmg, rate, range, dps: dmg * rate, hero, variant };
}

export function teamDps(state, stats) {
  let total = 0;
  for (const key of state.equipped.slice(0, stats.slots)) {
    if (key) total += heroStats(state, stats, key).dps;
  }
  return total;
}

// Keep the equipped list in sync with slot count and inventory.
export function normalizeEquipped(state, stats) {
  const eq = state.equipped.slice(0, stats.slots);
  while (eq.length < stats.slots) eq.push(null);
  const used = {};
  for (let i = 0; i < eq.length; i++) {
    const k = eq[i];
    if (!k) continue;
    used[k] = (used[k] || 0) + 1;
    if (!state.inv[k] || used[k] > state.inv[k]) { eq[i] = null; used[k]--; }
  }
  state.equipped = eq;
}

export function equippedCount(state, key) {
  return state.equipped.filter((k) => k === key).length;
}

// Fill every slot with the strongest heroes owned. Returns true if anything changed.
export function equipBest(state, stats) {
  const keys = Object.keys(state.inv).filter((k) => state.inv[k] > 0);
  keys.sort((a, b) => heroStats(state, stats, b).dps - heroStats(state, stats, a).dps);
  const next = [];
  for (const k of keys) {
    for (let i = 0; i < state.inv[k] && next.length < stats.slots; i++) next.push(k);
    if (next.length >= stats.slots) break;
  }
  while (next.length < stats.slots) next.push(null);
  // Keep heroes that stay equipped in their current slot so they don't jump around.
  const before = state.equipped.slice(0, stats.slots);
  const result = new Array(stats.slots).fill(null);
  const pool = [...next];
  before.forEach((k, i) => {
    const j = pool.indexOf(k);
    if (k && j >= 0) { result[i] = k; pool.splice(j, 1); }
  });
  for (let i = 0; i < result.length; i++) if (!result[i] && pool.length) result[i] = pool.shift();
  const changed = result.some((k, i) => k !== before[i]);
  state.equipped = result;
  return changed;
}

// True when Equip Best would put a stronger team on the field.
export function canImproveTeam(state, stats) {
  const copy = { ...state, equipped: state.equipped.slice(0, stats.slots) };
  const before = teamDps(copy, stats);
  equipBest(copy, stats);
  return teamDps(copy, stats) > before * 1.0001;
}

// Put a hero into the first empty slot, or replace the weakest equipped hero.
export function equipHero(state, stats, key) {
  normalizeEquipped(state, stats);
  if (equippedCount(state, key) >= (state.inv[key] || 0)) return false;
  let idx = state.equipped.indexOf(null);
  if (idx < 0) {
    let worst = Infinity;
    state.equipped.forEach((k, i) => {
      const d = heroStats(state, stats, k).dps;
      if (d < worst) { worst = d; idx = i; }
    });
  }
  if (idx < 0) return false;
  state.equipped[idx] = key;
  return true;
}

export function unequipSlot(state, i) {
  if (state.equipped[i]) { state.equipped[i] = null; return true; }
  return false;
}

// Put the strongest unequipped heroes into empty slots without replacing anyone.
export function fillEmptySlots(state, stats) {
  normalizeEquipped(state, stats);
  if (!state.equipped.includes(null)) return false;
  const keys = Object.keys(state.inv).filter((k) => state.inv[k] > equippedCount(state, k));
  keys.sort((a, b) => heroStats(state, stats, b).dps - heroStats(state, stats, a).dps);
  let changed = false;
  for (const k of keys) {
    while (state.equipped.includes(null) && equippedCount(state, k) < state.inv[k]) {
      state.equipped[state.equipped.indexOf(null)] = k;
      changed = true;
    }
  }
  return changed;
}

// Fill empty slots right after a roll so new players see heroes appear immediately.
export function autoFill(state, stats, newKeys) {
  normalizeEquipped(state, stats);
  if (stats.autoEquip) return equipBest(state, stats);
  let changed = false;
  for (const k of newKeys) {
    const idx = state.equipped.indexOf(null);
    if (idx < 0) break;
    if (equippedCount(state, k) < state.inv[k]) { state.equipped[idx] = k; changed = true; }
  }
  return changed;
}

// ---------------- Upgrades ----------------

export function buyNode(state, id) {
  const node = NODE_BY_ID[id];
  if (!node || !canBuy(node, state.upgrades)) return { ok: false, reason: 'locked' };
  const lvl = state.upgrades[id] || 0;
  const cost = nodeCost(node, lvl);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  state.upgrades[id] = lvl + 1;
  state.tutorial.upgraded = true;
  return { ok: true, cost };
}

export function affordableCount(state, nodes) {
  let n = 0;
  for (const node of nodes) {
    if (!canBuy(node, state.upgrades)) continue;
    if (state.gold >= nodeCost(node, state.upgrades[node.id] || 0)) n++;
  }
  return n;
}

// ---------------- Economy ----------------

export function incomePerSec(state, stats) {
  return stats.income * stats.incomeMult * stats.goldMult * (1 + 0.03 * state.bestWave);
}

export function addGold(state, amount) {
  state.gold += amount;
  state.totalGold += amount;
}

export function killGold(stats, def, wave) {
  return def.gold * 0.3 * goldScale(wave) * stats.killGold * stats.goldMult;
}

export function waveClearGold(state, stats, wave) {
  return Math.round(waveReward(wave) * stats.waveGold * stats.goldMult);
}

// Offline progress: town income keeps flowing at half rate, rolls continue if unlocked.
export function offlineProgress(state, stats, seconds) {
  const capped = Math.min(seconds, 8 * 3600);
  const gold = Math.floor(incomePerSec(state, stats) * capped * 0.5);
  let rolls = 0;
  const found = {};
  if (stats.offlineInterval > 0) {
    rolls = Math.min(Math.floor(capped / stats.offlineInterval), 20000);
    for (let i = 0; i < rolls; i++) {
      const r = doRoll(state, stats);
      for (const k of r.results) found[k] = (found[k] || 0) + 1;
    }
  }
  if (gold > 0) addGold(state, gold);
  return { seconds: capped, gold, rolls, found };
}

export { computeStats, VARIANTS };
