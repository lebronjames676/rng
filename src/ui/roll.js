// The roll button, the spinning name display and the big reveal for rare heroes.
import { HEROES, RARITIES, parseKey, displayName } from '../data/heroes.js';
import { doRoll, rollHeroId, autoFill, currentLuck } from '../game/logic.js';
import { portrait } from './portraits.js';
import { $, setText, escapeHtml, rarityStyle } from './dom.js';
import { fmtOdds, clamp } from '../util.js';
import { icon } from './icons.js';

const BIG_REVEAL_TIER = 4; // legendary and up get the full-screen reveal

export class Roller {
  constructor(game) {
    this.game = game;
    this.busy = false;
    this.t = 0;
    this.wait = 0;
    this.revealOpen = false;
    this.fadeTimer = 0;
    this.btn = $('rollBtn');
    this.auto = $('autoBtn');
    this.display = $('rollDisplay');
    this.btn.addEventListener('click', () => { game.audio.unlock(); this.press(); });
    this.auto.addEventListener('click', () => { game.audio.unlock(); this.toggleAuto(); });
    $('reveal').addEventListener('click', () => this.closeReveal());
    this.refreshButtons();
  }

  get autoOn() { return this.game.stats.autoRoll && this.game.state.settings.autoRoll; }

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
    this.btn.classList.toggle('lucky', streak && !this.busy);
    this.btn.classList.toggle('busy', this.busy);
    setText($('rollLabel'), this.busy ? 'ROLLING' : streak ? 'LUCKY!' : 'ROLL');
  }

  press() {
    if (this.busy || this.revealOpen) return;
    this.start();
  }

  start() {
    const { state, stats } = this.game;
    this.result = doRoll(state, stats);
    this.busy = true;
    this.t = 0;
    this.nextTick = 0;
    this.ticks = 0;
    this.dur = clamp(stats.rollTime * 0.88, 0.22, 1.9);
    this.display.classList.remove('fade', 'pop');
    setText($('rdExtra'), '');
    this.refreshButtons();
  }

  // Show a random name while rolling, mostly common ones so rare flashes feel exciting.
  showSpin() {
    const id = rollHeroId(Math.max(1, this.game.stats.totalLuck * 0.6));
    const hero = HEROES.find((h) => h.id === id);
    this.setName(hero.name, RARITIES[hero.rarity], fmtOdds(hero.odds), false);
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
    let best = keys[0];
    for (const k of keys) if (parseKey(k).hero.odds > parseKey(best).hero.odds) best = k;
    const { hero, v } = parseKey(best);
    const r = RARITIES[hero.rarity];
    this.setName(displayName(best), r, fmtOdds(hero.odds) + (this.result.streak ? ' · LUCKY ROLL' : ''), true);
    this.display.classList.add('pop');
    if (keys.length > 1) {
      const others = [...keys];
      others.splice(keys.indexOf(best), 1);
      $('rdExtra').innerHTML = others
        .map((k) => { const p = parseKey(k); const rr = RARITIES[p.hero.rarity]; return `<span class="chip" style="color:${rr.rainbow ? '#ff9bff' : rr.color}">${escapeHtml(displayName(k))}</span>`; })
        .join('');
    }
    game.audio.play('reveal', r.tier);
    game.effects.burst({ x: 0, y: 4, z: 0 }, [r.rainbow ? '#ff7bff' : r.color, '#ffffff'], 6 + r.tier * 6, { speed: 4 + r.tier, up: 8 });

    if (autoFill(state, stats, keys)) game.onEquipChanged();
    game.onRolled(keys);

    if (r.tier >= BIG_REVEAL_TIER || (v !== 'n' && r.tier >= 2)) this.openReveal(best);
    this.busy = false;
    this.wait = 0.3;
    this.fadeTimer = 2.2;
    this.refreshButtons();
  }

  openReveal(key) {
    const { hero } = parseKey(key);
    const r = RARITIES[hero.rarity];
    const rs = rarityStyle(r);
    const box = $('reveal');
    box.style.setProperty('--ray', r.rainbow ? '#ff7bff' : r.color);
    const rar = $('revealRarity');
    rar.textContent = `${r.name.toUpperCase()}!`;
    rar.className = `reveal-rarity outline ${rs.cls}`;
    rar.style.color = r.rainbow ? '' : r.color;
    $('revealImg').src = portrait(key);
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

  update(dt) {
    if (this.busy) {
      this.t += dt;
      const k = this.t / this.dur;
      $('rollFill').style.width = `${Math.min(100, k * 100)}%`;
      if (this.t >= this.nextTick && k < 0.92) {
        this.showSpin();
        this.ticks++;
        this.game.audio.play('tick', this.ticks % 8);
        this.nextTick = this.t + 0.04 + k * k * 0.16;
      }
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
    if (this.fadeTimer > 0) {
      this.fadeTimer -= dt;
      if (this.fadeTimer <= 0 && !this.autoOn) this.display.classList.add('fade');
    }
    if (this.autoOn) {
      this.wait -= dt;
      if (this.wait <= 0) this.start();
    }
  }
}
