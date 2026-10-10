// The roll button, the spinning hero reel and the big reveal for rare heroes.
// Also the active-play speed boosts: Tap to Hurry, Roll Combo and Speed Dice (Roll Rush).
import { HEROES, RARITIES, parseKey, displayName, stackKey } from '../data/heroes.js';
import { doRoll, rollHeroId, autoFill, currentLuck } from '../game/logic.js';
import { heroSprite } from './portraits.js';
import { $, el, setText, escapeHtml, rarityStyle } from './dom.js';
import { fmtOdds, rand } from '../util.js';
import { icon } from './icons.js';

const BIG_REVEAL_TIER = 4; // legendary and up get the full-screen reveal
const REEL_CARDS = 44;
const WIN_INDEX = 38;
const COMBO_WINDOW = 1.5;
const easeOutQuart = (k) => 1 - Math.pow(1 - k, 4);
const rarityColor = (r) => (r.rainbow ? '#ff7bff' : r.color);
// Rare heroes that can show up right next to the winning card as a near miss.
const TEASERS = HEROES.filter((h) => h.odds >= 300);

export class Roller {
  constructor(game) {
    this.game = game;
    this.busy = false;
    this.t = 0;
    this.wait = 0;
    this.revealOpen = false;
    this.fadeTimer = 0;
    this.combo = 0;
    this.comboT = 0;
    this.hurried = 0;
    this.rushT = 0;
    this.diceT = rand(...game.stats.diceEvery);
    this.die = null;
    this.btn = $('rollBtn');
    this.auto = $('autoBtn');
    this.display = $('rollDisplay');
    this.reel = $('reel');
    this.strip = $('reelStrip');
    this.btn.addEventListener('click', () => { game.audio.unlock(); this.press(); });
    this.auto.addEventListener('click', () => { game.audio.unlock(); this.toggleAuto(); });
    $('reveal').addEventListener('click', () => this.closeReveal());
    this.refreshButtons();
  }

  get autoOn() { return this.game.stats.autoRoll && this.game.state.settings.autoRoll; }

  // Combo stacks and Roll Rush both shorten the next roll.
  speedMult() {
    const s = this.game.stats;
    return (1 + this.combo * s.comboStep) * (this.rushT > 0 ? s.rushMult : 1);
  }

  toggleAuto() {
    const { state, stats } = this.game;
    if (!stats.autoRoll) {
      this.game.hud.toast('Unlock Auto Roll in the Upgrades tree!');
      this.game.audio.play('deny');
      return;
    }
    state.settings.autoRoll = !state.settings.autoRoll;
    this.game.audio.play('click');
    this.refreshButtons();
  }

  refreshButtons() {
    const { state, stats } = this.game;
    this.auto.classList.toggle('unlocked', stats.autoRoll);
    this.auto.classList.toggle('on', this.autoOn);
    const ico = $('autoIco');
    const want = stats.autoRoll ? 'autodice' : 'lock';
    if (ico.dataset.filled !== want) { ico.innerHTML = icon(want); ico.dataset.filled = want; }
    this.auto.title = stats.autoRoll ? 'Toggle Auto Roll' : 'Unlock Auto Roll in the upgrade tree';
    const streak = currentLuck(state, stats).streak;
    const canHurry = this.busy && stats.hurry > 0 && this.hurried < stats.hurryCap;
    this.btn.classList.toggle('lucky', streak && !this.busy);
    this.btn.classList.toggle('busy', this.busy && !canHurry);
    this.btn.classList.toggle('hurry', canHurry);
    setText($('rollLabel'), canHurry ? 'TAP!' : this.busy ? 'ROLLING' : streak ? 'LUCKY!' : 'ROLL');
  }

  // Roll button / Space: start a roll, or hurry the one that is spinning.
  press() {
    if (this.revealOpen) { this.closeReveal(); return; }
    if (this.busy) { this.hurry(); return; }
    this.start(true);
  }

  start(manual) {
    const { state, stats } = this.game;
    if (stats.comboMax > 0) {
      const before = this.combo;
      this.combo = manual && this.comboT > 0 ? Math.min(stats.comboMax, this.combo + 1) : 0;
      if (this.combo > before) {
        this.game.audio.play('combo', this.combo);
        state.tutorial.comboed = true;
      }
    }
    this.comboT = 0;
    this.result = doRoll(state, stats);
    this.busy = true;
    this.t = 0;
    this.hurried = 0;
    this.dur = Math.max(0.25, stats.rollTime / this.speedMult());
    this.display.classList.remove('fade', 'pop');
    this.reel.hidden = false;
    setText($('rdExtra'), '');
    this.buildReel(this.bestKey(this.result.results));
    this.refreshButtons();
  }

  hurry() {
    const { stats, state } = this.game;
    if (stats.hurry <= 0) {
      this.btn.classList.remove('nudge'); void this.btn.offsetWidth; this.btn.classList.add('nudge');
      return;
    }
    const step = Math.min(stats.hurry, stats.hurryCap - this.hurried);
    if (step <= 0) return;
    this.hurried += step;
    this.t += step * this.dur;
    state.tutorial.hurried = true;
    this.game.audio.play('hurry', Math.round(this.hurried / stats.hurry));
    this.btn.classList.remove('zap'); void this.btn.offsetWidth; this.btn.classList.add('zap');
    this.refreshButtons();
  }

  bestKey(keys) {
    let best = keys[0];
    for (const k of keys) if (parseKey(k).hero.odds > parseKey(best).hero.odds) best = k;
    return best;
  }

  // Fill the reel with random heroes and put the result where the reel will stop.
  buildReel(winKey) {
    const luck = Math.max(1, this.game.stats.totalLuck * 0.6);
    this.cards = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < REEL_CARDS; i++) {
      let key;
      if (i === WIN_INDEX) key = winKey;
      else if (Math.abs(i - WIN_INDEX) === 1 && Math.random() < 0.3) key = stackKey(TEASERS[Math.floor(Math.random() * TEASERS.length)].id);
      else key = stackKey(rollHeroId(luck));
      const r = RARITIES[parseKey(key).hero.rarity];
      const card = el('div', 'reel-card', `<img src="${heroSprite(key)}" alt="">`);
      card.style.setProperty('--rc', rarityColor(r));
      frag.appendChild(card);
      this.cards.push(key);
    }
    this.strip.replaceChildren(frag);
    const first = this.strip.firstElementChild;
    this.step = first.offsetWidth + parseFloat(getComputedStyle(this.strip).columnGap || 0);
    this.startPos = 2;
    this.endPos = WIN_INDEX + rand(-0.3, 0.3);
    this.lastIdx = -1;
    this.placeReel(0);
  }

  placeReel(k) {
    const pos = this.startPos + (this.endPos - this.startPos) * easeOutQuart(Math.min(1, k));
    const x = this.reel.clientWidth / 2 - (pos + 0.5) * this.step;
    this.strip.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    const idx = Math.round(pos);
    if (idx !== this.lastIdx && k < 1) {
      this.lastIdx = idx;
      const { hero } = parseKey(this.cards[idx]);
      this.setName(hero.name, RARITIES[hero.rarity], fmtOdds(hero.odds), false);
      this.game.audio.play('tick', idx % 8);
    }
  }

  setName(name, rarity, odds, final) {
    const rs = rarityStyle(rarity);
    const nameEl = $('rdName'), rarEl = $('rdRarity');
    setText(nameEl, name);
    setText(rarEl, rarity.name);
    nameEl.className = `rd-name outline ${final ? rs.cls : ''}`;
    nameEl.style.color = rs.cls && final ? '' : rarity.rainbow ? '#ffffff' : rarity.color;
    rarEl.className = `rd-rarity ${rs.cls}`;
    rarEl.style.color = rarity.rainbow ? '' : rarity.color;
    setText($('rdOdds'), odds);
  }

  reveal() {
    const { game } = this;
    const { state, stats } = game;
    const keys = this.result.results;
    const best = this.bestKey(keys);
    const { hero, v } = parseKey(best);
    const r = RARITIES[hero.rarity];
    this.placeReel(1);
    this.strip.children[WIN_INDEX]?.classList.add('win');
    this.setName(displayName(best), r, fmtOdds(hero.odds) + (this.result.streak ? ' · LUCKY ROLL' : ''), true);
    this.display.classList.add('pop');
    if (keys.length > 1) {
      const others = [...keys];
      others.splice(keys.indexOf(best), 1);
      $('rdExtra').innerHTML = others
        .map((k) => `<span class="chip" style="color:${rarityColor(RARITIES[parseKey(k).hero.rarity])}">${escapeHtml(displayName(k))}</span>`)
        .join('');
    }
    game.audio.play('reveal', r.tier);
    game.effects.burst({ x: 0, y: 4, z: 0 }, [rarityColor(r), '#ffffff'], 6 + r.tier * 6, { speed: 4 + r.tier, up: 8 });

    if (autoFill(state, stats, keys)) game.onEquipChanged();
    game.onRolled(keys);

    if (r.tier >= BIG_REVEAL_TIER || (v !== 'n' && r.tier >= 2)) this.openReveal(best);
    this.busy = false;
    this.wait = 0.3;
    this.fadeTimer = 2.6;
    if (stats.comboMax > 0) this.comboT = COMBO_WINDOW;
    this.refreshButtons();
  }

  openReveal(key) {
    const { hero } = parseKey(key);
    const r = RARITIES[hero.rarity];
    const rs = rarityStyle(r);
    const box = $('reveal');
    box.style.setProperty('--ray', rarityColor(r));
    const rar = $('revealRarity');
    rar.textContent = `${r.name.toUpperCase()}!`;
    rar.className = `reveal-rarity outline ${rs.cls}`;
    rar.style.color = r.rainbow ? '' : r.color;
    $('revealImg').src = heroSprite(key);
    $('revealName').textContent = displayName(key);
    $('revealOdds').textContent = fmtOdds(hero.odds);
    box.hidden = false;
    $('banner').hidden = true;
    this.revealOpen = true;
    this.revealTimer = this.autoOn ? 2.6 : 6;
  }

  closeReveal() {
    $('reveal').hidden = true;
    this.revealOpen = false;
  }

  // ---------------- Speed Dice / Roll Rush ----------------
  updateDice(dt) {
    const { stats, audio } = this.game;
    if (this.rushT > 0) {
      this.rushT -= dt;
      if (this.rushT <= 0) { this.rushT = 0; audio.play('rushEnd'); }
    }
    if (this.die) {
      const d = this.die;
      d.life -= dt;
      const w = window.innerWidth, h = window.innerHeight;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.x < w * 0.12 || d.x > w * 0.88) d.vx *= -1;
      if (d.y < h * 0.22 || d.y > h * 0.58) d.vy *= -1;
      d.el.style.left = `${d.x}px`;
      d.el.style.top = `${d.y}px`;
      d.el.classList.toggle('leaving', d.life < 2);
      if (d.life <= 0) this.removeDie();
      return;
    }
    if (!stats.rush || this.rushT > 0) return;
    this.diceT -= dt;
    const blocked = this.revealOpen || this.game.tree.isOpen || this.game.heroes.isOpen;
    if (this.diceT <= 0 && !blocked) this.spawnDie();
  }

  spawnDie() {
    const w = window.innerWidth, h = window.innerHeight;
    const btn = el('button', 'speed-die', `<span class="ico">${icon('speeddie')}</span><span class="die-tap outline">TAP!</span>`);
    btn.setAttribute('aria-label', 'Speed Die: tap for Roll Rush');
    btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.collectDie(); });
    $('game').appendChild(btn);
    const a = Math.random() * Math.PI * 2;
    this.die = { el: btn, x: rand(w * 0.2, w * 0.8), y: rand(h * 0.26, h * 0.52), vx: Math.cos(a) * 70, vy: Math.sin(a) * 50, life: 9 };
    this.game.audio.play('dieSpawn');
  }

  removeDie() {
    this.die?.el.remove();
    this.die = null;
    this.diceT = rand(...this.game.stats.diceEvery);
  }

  collectDie() {
    const { stats, hud, audio, effects } = this.game;
    this.game.audio.unlock();
    this.rushT = stats.rushTime;
    this.removeDie();
    audio.play('rush');
    effects.burst({ x: 0, y: 5, z: 0 }, ['#ffd23f', '#fff36b', '#ffffff'], 30, { speed: 7, up: 9, size: 0.3 });
    hud.banner('ROLL RUSH!', `Rolls ${stats.rushMult}x faster for ${stats.rushTime}s`, 'rush', 2);
  }

  // ---------------- Frame update ----------------
  update(dt) {
    this.updateDice(dt);
    if (this.busy) {
      this.t += dt;
      const k = this.t / this.dur;
      $('rollFill').style.width = `${Math.min(100, k * 100)}%`;
      this.placeReel(k);
      if (this.t >= this.dur) {
        $('rollFill').style.width = '0%';
        this.reveal();
      }
      return;
    }
    if (this.revealOpen) {
      this.revealTimer -= dt;
      if (this.revealTimer <= 0) this.closeReveal();
      return;
    }
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0 && this.combo > 0) { this.combo = 0; this.game.audio.play('comboLost'); }
    }
    if (this.fadeTimer > 0) {
      this.fadeTimer -= dt;
      if (this.fadeTimer <= 0 && !this.autoOn) this.display.classList.add('fade');
    }
    if (this.autoOn) {
      this.wait -= dt;
      if (this.wait <= 0) this.start(false);
    }
  }
}
