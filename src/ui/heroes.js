// Heroes panel: equipped slots, backpack cards and the hero index.
import { HEROES, RARITIES, parseKey, displayName, stackKey, masteryStars, MASTERY_STEPS } from '../data/heroes.js';
import { heroStats, equipHero, equipBest, equippedCount, normalizeEquipped } from '../game/logic.js';
import { portrait } from './portraits.js';
import { $, el, iconSpan, escapeHtml, rarityStyle } from './dom.js';
import { icon } from './icons.js';
import { fmt, fmtOdds } from '../util.js';

export class HeroesPanel {
  constructor(game) {
    this.game = game;
    this.modal = $('heroesModal');
    this.tab = 'backpack';
    this.modal.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
    for (const t of this.modal.querySelectorAll('.tab')) t.addEventListener('click', () => this.show(t.dataset.tab));
    $('equipBest').addEventListener('click', () => {
      const { state, stats } = this.game;
      if (equipBest(state, stats)) this.game.onEquipChanged();
      this.render();
    });
  }

  get isOpen() { return !this.modal.hidden; }

  open(tab = 'backpack') {
    this.modal.hidden = false;
    this.show(tab);
  }

  close() { this.modal.hidden = true; }

  show(tab) {
    this.tab = tab;
    for (const t of this.modal.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === tab);
    $('backpackTab').hidden = tab !== 'backpack';
    $('indexTab').hidden = tab !== 'index';
    this.render();
  }

  render() {
    if (!this.isOpen) return;
    if (this.tab === 'backpack') this.renderBackpack();
    else this.renderIndex();
  }

  renderBackpack() {
    const { state, stats } = this.game;
    normalizeEquipped(state, stats);
    $('slotCount').innerHTML = `<span class="muted">${state.equipped.filter(Boolean).length}/${stats.slots}</span>`;
    const row = $('slotsRow');
    row.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const key = i < stats.slots ? state.equipped[i] : null;
      let s;
      if (i >= stats.slots) {
        s = el('div', 'slot locked', iconSpan('lock'));
        s.title = `Unlock "${i + 1} Hero Slots" in the upgrade tree`;
      } else if (!key) {
        s = el('div', 'slot empty', '+');
        s.title = 'Empty slot. Tap a hero below to equip it.';
      } else {
        const { hero } = parseKey(key);
        const rs = rarityStyle(RARITIES[hero.rarity]);
        s = el('button', 'slot', `<img src="${portrait(key)}" alt="${escapeHtml(displayName(key))}"><span class="slot-x">${icon('close')}</span>`);
        s.style.borderColor = rs.border;
        s.title = `${displayName(key)}: tap to unequip`;
        s.addEventListener('click', () => {
          state.equipped[i] = null;
          this.game.onEquipChanged();
          this.render();
        });
      }
      row.appendChild(s);
    }

    const keys = Object.keys(state.inv).filter((k) => state.inv[k] > 0);
    keys.sort((a, b) => heroStats(state, stats, b).dps - heroStats(state, stats, a).dps);
    let total = 0;
    for (const k of keys) total += state.inv[k];
    $('ownedCount').textContent = `${keys.length} kinds · ${fmt(total)} heroes`;
    const wrap = $('cards');
    wrap.innerHTML = '';
    for (const key of keys) {
      const { hero, v } = parseKey(key);
      const r = RARITIES[hero.rarity];
      const rs = rarityStyle(r);
      const st = heroStats(state, stats, key);
      const eq = equippedCount(state, key);
      const stars = masteryStars(state.copies[hero.id] || 0);
      const card = el('button', 'card');
      card.style.setProperty('--rc', rs.border);
      const varTag = (v.includes('h') ? '<span class="c-var huge">HUGE</span>' : '') + (v.includes('g') ? '<span class="c-var">GOLDEN</span>' : '');
      const eqTag = eq ? `<span class="c-eq">EQUIPPED${eq > 1 ? ' x' + eq : ''}</span>` : '';
      card.innerHTML = `
        <span class="c-tags">${varTag}${eqTag}</span><span class="c-count">x${fmt(state.inv[key])}</span>
        <img src="${portrait(key)}" alt="" loading="lazy">
        <div class="c-name outline">${escapeHtml(hero.name)}</div>
        <div class="c-rarity ${rs.cls}">${r.name}</div>
        <div class="c-stat">${fmt(st.dps)} DPS</div>
        <div class="stars" title="Mastery: more copies make this hero stronger">${'★'.repeat(stars)}${'☆'.repeat(6 - stars)}</div>`;
      card.title = eq < state.inv[key] ? 'Tap to equip' : 'All copies equipped. Tap to unequip one.';
      card.addEventListener('click', () => {
        if (equippedCount(state, key) < state.inv[key]) {
          if (equipHero(state, stats, key)) this.game.onEquipChanged();
        } else {
          const idx = state.equipped.lastIndexOf(key);
          if (idx >= 0) { state.equipped[idx] = null; this.game.onEquipChanged(); }
        }
        this.render();
      });
      wrap.appendChild(card);
    }
  }

  renderIndex() {
    const { state, stats } = this.game;
    const found = HEROES.filter((h) => state.discovered[h.id]).length;
    $('indexCount').textContent = `${found}/${HEROES.length} found`;
    $('indexLuck').textContent = `Your Luck is x${stats.totalLuck.toFixed(2)}, so rare heroes are ${stats.totalLuck.toFixed(2)}x more likely. Collect copies to earn mastery stars (${MASTERY_STEPS.join(', ')} copies).`;
    const wrap = $('indexCards');
    wrap.innerHTML = '';
    for (const hero of HEROES) {
      const known = !!state.discovered[hero.id];
      const r = RARITIES[hero.rarity];
      const rs = rarityStyle(r);
      const key = stackKey(hero.id);
      const copies = state.copies[hero.id] || 0;
      const stars = masteryStars(copies);
      const card = el('div', `card${known ? '' : ' unknown'}`);
      card.style.setProperty('--rc', known ? rs.border : '#5d6588');
      const eff = Math.max(1, hero.odds / stats.totalLuck);
      card.innerHTML = `
        ${known ? `<span class="c-count">x${fmt(copies)}</span>` : ''}
        <img src="${portrait(key, !known)}" alt="" loading="lazy">
        <div class="c-name outline">${known ? escapeHtml(hero.name) : '???'}</div>
        <div class="c-rarity ${rs.cls}">${r.name}</div>
        <div class="c-stat">${fmtOdds(hero.odds)}</div>
        ${stats.totalLuck > 1 ? `<div class="c-stat">with Luck: ${fmtOdds(eff)}</div>` : ''}
        ${known ? `<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(6 - stars)}</div>` : ''}`;
      wrap.appendChild(card);
    }
  }
}
