// Heads-up display: gold, wave status, luck, team, banners, hints, settings and welcome-back.
import { RARITIES, parseKey, displayName, HERO_BY_ID } from '../data/heroes.js';
import { NODES } from '../data/upgrades.js';
import { incomePerSec, teamDps, affordableCount, currentLuck, clearSave, canImproveTeam } from '../game/logic.js';
import { heroSprite } from './portraits.js';
import { $, el, setText, escapeHtml, rarityStyle } from './dom.js';
import { fmt, fmtTime, fmtOdds } from '../util.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.badgeT = 0;
    this.bannerT = 0;
    this.teamSig = '';
    this.resetArmed = 0;
    $('upgradesBtn').addEventListener('click', () => { game.audio.unlock(); game.tree.open(); });
    $('heroesBtn').addEventListener('click', () => { game.audio.unlock(); game.heroes.open('backpack'); });
    $('indexBtn').addEventListener('click', () => { game.audio.unlock(); game.heroes.open('index'); });
    $('teamPanel').addEventListener('click', () => game.heroes.open('backpack'));
    $('startNow').addEventListener('click', () => game.battle.skipCountdown());
    $('settingsBtn').addEventListener('click', () => this.openSettings());

    const sm = $('settingsModal');
    sm.querySelector('[data-close]').addEventListener('click', () => { sm.hidden = true; });
    sm.addEventListener('click', (e) => { if (e.target === sm) sm.hidden = true; });
    $('optSound').addEventListener('change', (e) => { game.state.settings.sound = e.target.checked; game.audio.enabled = e.target.checked; });
    $('optShadows').addEventListener('change', (e) => { game.state.settings.shadows = e.target.checked; game.view.setShadows(e.target.checked); });
    $('resetView').addEventListener('click', () => game.view.resetView());
    $('resetSave').addEventListener('click', () => this.resetProgress());

    const wm = $('welcomeModal');
    wm.querySelector('[data-close]').addEventListener('click', () => { wm.hidden = true; game.audio.unlock(); });
  }

  update(dt) {
    const { state, stats, battle, roller } = this.game;
    setText($('gold'), fmt(state.gold));
    setText($('income'), `+${fmt(incomePerSec(state, stats))}/s`);
    setText($('townLevel'), String(stats.townLevel));
    setText($('waveNum'), String(state.wave));
    $('waveCard').classList.toggle('boss', state.wave % 10 === 0);

    const hp = Math.max(0, battle.townHp), max = stats.townHp;
    const frac = hp / max;
    const fill = $('hpFill');
    fill.style.width = `${frac * 100}%`;
    fill.className = `fill${frac < 0.3 ? ' low' : frac < 0.6 ? ' mid' : ''}`;
    setText($('hpText'), `${Math.ceil(hp)} / ${max}`);

    let sub;
    if (battle.phase === 'countdown') sub = `Next wave in ${Math.ceil(battle.timer)}${state.wave % 10 === 0 ? ' · BOSS' : ''}`;
    else sub = `Enemies left: ${battle.enemies.length + battle.spawnQueue.length}`;
    setText($('waveSub'), sub);
    $('startNow').hidden = !(battle.phase === 'countdown' && battle.timer > 1);

    const { luck, streak } = currentLuck(state, stats);
    setText($('luck'), `x${luck.toFixed(2)}`);
    const sp = $('streakPill');
    sp.hidden = stats.streakMult <= 1;
    if (!sp.hidden) {
      setText($('streakText'), streak ? `x${stats.streakMult} LUCKY ROLL!` : `${(state.rolls % 10)}/10 → x${stats.streakMult}`);
      sp.classList.toggle('hot', streak);
    }

    const boss = battle.boss;
    $('bossBar').hidden = !boss;
    if (boss) {
      setText($('bossName'), boss.def.name);
      $('bossFill').style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
    }

    this.updateRollStatus();
    setText($('teamDps'), fmt(teamDps(state, stats)));
    this.renderTeam();
    setText($('rollMeta'), `Rolls: ${fmt(state.rolls)} · Best: ${HERO_BY_ID[state.bestRoll].name} (${fmtOdds(HERO_BY_ID[state.bestRoll].odds)})`);

    this.badgeT -= dt;
    if (this.badgeT <= 0) {
      this.badgeT = 0.3;
      this.refreshBadge();
      roller.refreshButtons();
      if (this.game.tree.isOpen) this.game.tree.updateAfford();
      this.updateHint();
    }

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0.4) $('banner').classList.add('out');
      if (this.bannerT <= 0) $('banner').hidden = true;
    }
  }

  // Combo and Roll Rush pills above the roll button, each with a draining timer bar.
  updateRollStatus() {
    const { stats, roller } = this.game;
    const cp = $('comboPill');
    cp.hidden = !(stats.comboMax > 0 && roller.combo > 0);
    if (!cp.hidden) {
      const pct = Math.round(roller.combo * stats.comboStep * 100);
      setText($('comboText'), `Combo x${roller.combo} · +${pct}% speed`);
      $('comboBar').style.width = roller.busy || roller.revealOpen ? '100%' : `${Math.max(0, roller.comboT / 1.5) * 100}%`;
    }
    const rp = $('rushPill');
    rp.hidden = roller.rushT <= 0;
    if (!rp.hidden) {
      setText($('rushText'), `ROLL RUSH x${stats.rushMult} · ${Math.ceil(roller.rushT)}s`);
      $('rushBar').style.width = `${(roller.rushT / stats.rushTime) * 100}%`;
    }
  }

  refreshBadge() {
    const { state, stats } = this.game;
    const n = affordableCount(state, NODES);
    const b = $('upBadge');
    b.hidden = n === 0;
    setText(b, String(n));
    $('heroBadge').hidden = stats.autoEquip || !canImproveTeam(state, stats);
  }

  renderTeam() {
    const { state, stats } = this.game;
    const keys = state.equipped.slice(0, stats.slots);
    const sig = keys.join(',') + stats.slots;
    if (sig === this.teamSig) return;
    this.teamSig = sig;
    const wrap = $('teamSlots');
    wrap.innerHTML = '';
    for (let i = 0; i < stats.slots; i++) {
      const k = keys[i];
      const s = el('div', `mini-slot${k ? '' : ' empty'}`);
      if (k) {
        const r = RARITIES[parseKey(k).hero.rarity];
        s.style.borderColor = rarityStyle(r).border;
        s.innerHTML = `<img src="${heroSprite(k)}" alt="${escapeHtml(displayName(k))}">`;
        s.title = displayName(k);
      }
      wrap.appendChild(s);
    }
  }

  banner(title, sub = '', cls = '', dur = 2.4) {
    const b = $('banner');
    b.hidden = false;
    b.className = `banner ${cls}`;
    void b.offsetWidth;
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    this.bannerT = dur;
  }

  toast(msg) { this.banner(msg, '', 'small', 2); }

  updateHint() {
    const { state, battle } = this.game;
    const h = $('hint');
    let target = null, text = '', side = 'down';
    const { roller, stats } = this.game;
    if (!state.tutorial.rolled) { target = $('rollBtn'); text = 'Roll for heroes!'; }
    else if (stats.hurry > 0 && !state.tutorial.hurried && roller.busy) { target = $('rollBtn'); text = 'Tap ROLL fast to hurry the spin!'; }
    else if (stats.comboMax > 0 && !state.tutorial.comboed && !roller.busy && roller.comboT > 0 && !roller.autoOn) { target = $('rollBtn'); text = 'Roll again now to start a combo!'; }
    else if (roller.die) { text = 'Tap the Speed Die for a Roll Rush!'; }
    else if (!state.tutorial.upgraded && affordableCount(state, NODES) > 0) { target = $('upgradesBtn'); text = 'You can afford an upgrade!'; side = 'left'; }
    else if (state.clicks < 3 && battle.phase === 'fighting' && battle.enemies.length && state.wave <= 3) { text = 'Tap enemies to hit them!'; }
    else if (!$('heroBadge').hidden && state.rolls < 60) { target = $('heroesBtn'); text = 'Equip your stronger heroes!'; side = 'left'; }
    if (!text) { h.hidden = true; return; }
    h.hidden = false;
    setText(h, text);
    h.className = `hint ${target ? side : ''}`;
    if (!target) { h.style.left = '50%'; h.style.top = '38%'; h.style.transform = 'translateX(-50%)'; return; }
    const r = target.getBoundingClientRect();
    if (side === 'down') {
      h.style.left = `${r.left + r.width / 2}px`; h.style.top = `${r.top - 58}px`; h.style.transform = 'translateX(-50%)';
    } else {
      h.style.left = `${r.right + 18}px`; h.style.top = `${r.top + r.height / 2}px`; h.style.transform = 'translateY(-50%)';
    }
  }

  openSettings() {
    const { state, stats } = this.game;
    $('optSound').checked = state.settings.sound;
    $('optShadows').checked = state.settings.shadows;
    const rows = [
      ['Best wave', state.bestWave],
      ['Total rolls', fmt(state.rolls)],
      ['Enemies defeated', fmt(state.kills)],
      ['Gold earned', fmt(state.totalGold)],
      ['Roll time', `${stats.rollTime.toFixed(2)}s`],
      ['Heroes per roll', stats.rollsPerRoll],
      ['Golden chance', `${(stats.goldenChance * 100).toFixed(1)}%`],
      ['HUGE chance', `${(stats.hugeChance * 100).toFixed(1)}%`],
      ['Click damage', fmt(this.game.battle.clickDamage())],
    ];
    $('statsList').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
    $('resetSave').textContent = 'Reset progress';
    this.resetArmed = 0;
    $('settingsModal').hidden = false;
  }

  resetProgress() {
    const btn = $('resetSave');
    if (Date.now() - this.resetArmed > 4000) {
      this.resetArmed = Date.now();
      btn.textContent = 'Tap again to erase everything';
      return;
    }
    this.game.resetting = true;
    clearSave();
    location.reload();
  }

  welcome(res) {
    if (!res || (res.gold <= 0 && res.rolls <= 0)) return;
    const found = Object.entries(res.found).sort((a, b) => parseKey(b[0]).hero.odds - parseKey(a[0]).hero.odds).slice(0, 6);
    let html = `<p>You were away for <b>${fmtTime(res.seconds)}</b>.</p>`;
    if (res.gold > 0) html += `<p>Your town earned <b>${fmt(res.gold)} gold</b>.</p>`;
    if (res.rolls > 0) {
      html += `<p>Offline rolls: <b>${fmt(res.rolls)}</b></p><div class="found">`;
      html += found.map(([k, n]) => {
        const r = RARITIES[parseKey(k).hero.rarity];
        return `<span class="chip" style="color:${r.rainbow ? '#ff9bff' : r.color}">${escapeHtml(displayName(k))} x${fmt(n)}</span>`;
      }).join('');
      html += '</div>';
    }
    $('welcomeBody').innerHTML = html;
    $('welcomeModal').hidden = false;
  }
}
