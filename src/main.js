// Entry point: wires state, 3D world, battle and UI together and runs the game loop.
import { createScene } from './world/scene.js';
import { Town } from './world/town.js';
import { Effects } from './world/effects.js';
import { Battle } from './game/battle.js';
import {
  newState, loadState, saveState, computeStats, normalizeEquipped, offlineProgress,
  incomePerSec, addGold, equipBest, fillEmptySlots, heroOdds,
} from './game/logic.js';
import { Audio } from './audio.js';
import { TreeView } from './ui/tree.js';
import { HeroesPanel } from './ui/heroes.js';
import { Roller } from './ui/roll.js';
import { Hud } from './ui/hud.js';
import { $, fillIcons } from './ui/dom.js';
import { fmt } from './util.js';

const loaded = loadState();
const state = loaded || newState();
let stats = computeStats(state.upgrades);
normalizeEquipped(state, stats);

const view = createScene($('scene'));
const town = new Town(view.scene);
town.build(stats.town, stats);
const effects = new Effects(view.scene, view.camera, $('overlay'));
const audio = new Audio();
audio.enabled = state.settings.sound;
if (!state.settings.shadows) view.setShadows(false);

const game = {
  state, view, town, effects, audio,
  get stats() { return stats; },

  onUpgrade(node) {
    stats = computeStats(state.upgrades);
    normalizeEquipped(state, stats);
    if (stats.autoEquip) equipBest(state, stats);
    else fillEmptySlots(state, stats);
    battle.setStats(stats);
    town.build(stats.town, stats);
    battle.refreshPads();
    roller.refreshButtons();
    hud.refreshBadge();
    if (heroes.isOpen) heroes.render();
    hud.toast(`${node.name} unlocked!`);
    save();
  },

  onEquipChanged() {
    normalizeEquipped(state, stats);
    battle.syncHeroes();
    if (heroes.isOpen) heroes.render();
  },

  onRolled(keys) {
    if (heroes.isOpen) heroes.render();
    const best = keys.reduce((a, b) => (heroOdds(b) > heroOdds(a) ? b : a));
    if (heroOdds(best) >= 2000) save();
  },
};

const battle = new Battle({
  scene: view.scene, camera: view.camera, effects, town, audio,
  hooks: {
    onWaveStart(w, boss) {
      hud.banner(`Wave ${w}`, boss ? 'A boss is coming!' : '', boss ? 'boss' : '', 1.6);
    },
    onWaveCleared(w, reward, interest) {
      hud.banner(`Wave ${w} cleared!`, `+${fmt(reward + interest)} gold${interest > 0 ? ` (incl. ${fmt(interest)} interest)` : ''}`, '', 2.4);
      effects.burst({ x: 0, y: 6, z: 0 }, ['#ffd23f', '#ffe98a', '#ffffff'], 30, { speed: 6, up: 9, size: 0.3 });
      save();
    },
    onWaveFailed(w) {
      hud.banner('The town fell!', w > 1 && w % 10 !== 0 ? `Back to wave ${state.wave}. Roll for stronger heroes!` : 'Roll for stronger heroes and try again!', 'bad', 3.2);
    },
    onBoss(def) {
      if (def) hud.banner(def.name, 'Boss incoming!', 'boss', 2.2);
    },
  },
});
game.battle = battle;
battle.init(state, stats);

const hud = new Hud(game);
game.hud = hud;
const tree = new TreeView(game);
game.tree = tree;
const heroes = new HeroesPanel(game);
game.heroes = heroes;
const roller = new Roller(game);
game.roller = roller;
fillIcons();

// Welcome back: offline income and rolls.
function welcomeBack(seconds) {
  const res = offlineProgress(state, stats, seconds);
  if (stats.autoEquip) equipBest(state, stats);
  else fillEmptySlots(state, stats);
  game.onEquipChanged();
  hud.welcome(res);
}
if (loaded) {
  const away = (Date.now() - (state.lastSeen || Date.now())) / 1000;
  if (away > 60) welcomeBack(away);
}

// Clicking enemies on the 3D view.
const canvas = view.renderer.domElement;
canvas.addEventListener('pointerup', (e) => {
  audio.unlock();
  if (view.wasDrag()) return;
  const rect = canvas.getBoundingClientRect();
  const target = battle.pickEnemy(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
  battle.click(target);
});

// Keyboard shortcuts for desktop players.
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input')) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'r') { e.preventDefault(); audio.unlock(); roller.press(); }
  else if (k === 'a') roller.toggleAuto();
  else if (k === 'u') (tree.isOpen ? tree.close() : tree.open());
  else if (k === 'h') (heroes.isOpen ? heroes.close() : heroes.open('backpack'));
  else if (k === 'escape') {
    tree.close(); heroes.close();
    $('settingsModal').hidden = true;
    if (roller.revealOpen) roller.closeReveal();
  }
});

// ---------------- Saving ----------------
function save() { if (!game.resetting) saveState(state); }
setInterval(save, 10000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); return; }
  const away = (Date.now() - hiddenAt) / 1000;
  if (hiddenAt && away > 60) welcomeBack(away);
});
window.addEventListener('pagehide', save);

// ---------------- Loop ----------------
let last = performance.now();
let time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  addGold(state, incomePerSec(state, stats) * dt);
  roller.update(dt);
  battle.update(dt);
  town.update(dt, time);
  effects.update(dt);
  hud.update(dt);
  view.renderer.render(view.scene, view.camera);
  effects.drawOverlay(battle.bars());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setTimeout(() => $('loading').classList.add('done'), 150);
if (!loaded) hud.banner('Defend your town!', 'Roll heroes · Survive waves · Buy upgrades', '', 3.5);

// Handy for debugging from the console.
window.heroGame = game;
