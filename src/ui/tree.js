// The hex upgrade tree: pan/zoom map of nodes, buy on click (mouse) or second tap (touch).
import { NODES, NODE_BY_ID, nodeState, nodeCost, CATEGORY } from '../data/upgrades.js';
import { buyNode } from '../game/logic.js';
import { $, el, iconSpan, setText, escapeHtml } from './dom.js';
import { icon } from './icons.js';
import { fmt, clamp } from '../util.js';

const R = 61;
const toPx = (q, r) => [R * Math.sqrt(3) * (q + r / 2), R * 1.5 * r];

export class TreeView {
  constructor(game) {
    this.game = game;
    this.modal = $('treeModal');
    this.viewport = $('treeViewport');
    this.world = $('treeWorld');
    this.els = new Map();
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.centered = false;
    this.selected = null;
    this.hovered = null;
    this.bindPanZoom();
    this.modal.querySelector('[data-close]').addEventListener('click', () => this.close());
    $('zoomIn').addEventListener('click', () => this.zoomBy(1.2));
    $('zoomOut').addEventListener('click', () => this.zoomBy(1 / 1.2));
    $('niBuy').addEventListener('click', () => { if (this.selected) this.tryBuy(this.selected); });
  }

  get isOpen() { return !this.modal.hidden; }

  open() {
    this.modal.hidden = false;
    if (!this.centered) {
      const w = this.viewport.clientWidth, h = this.viewport.clientHeight;
      this.zoom = w < 640 ? 0.62 : 0.9;
      this.pan = { x: w / 2, y: h / 2 };
      this.centered = true;
    }
    this.render();
    this.applyTransform();
    this.showInfo(this.selected);
  }

  close() { this.modal.hidden = true; this.game.hud.refreshBadge(); }

  applyTransform() {
    this.world.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
  }

  zoomBy(f, cx, cy) {
    const vw = this.viewport.clientWidth, vh = this.viewport.clientHeight;
    cx ??= vw / 2; cy ??= vh / 2;
    const nz = clamp(this.zoom * f, 0.35, 1.8);
    const k = nz / this.zoom;
    this.pan.x = cx - (cx - this.pan.x) * k;
    this.pan.y = cy - (cy - this.pan.y) * k;
    this.zoom = nz;
    this.applyTransform();
  }

  bindPanZoom() {
    const vp = this.viewport;
    const pts = new Map();
    let moved = 0, pinch = 0;
    vp.addEventListener('pointerdown', (e) => {
      vp.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    vp.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') this.hover(e.target.closest('.hexw'));
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = vp.getBoundingClientRect();
        if (pinch) this.zoomBy(d / pinch, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        pinch = d;
        moved += 20;
        return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) {
        vp.classList.add('dragging');
        this.pan.x += dx / pts.size; this.pan.y += dy / pts.size;
        this.applyTransform();
      }
    });
    const end = (e) => {
      const had = pts.delete(e.pointerId);
      vp.classList.remove('dragging');
      if (pts.size < 2) pinch = 0;
      if (had && moved <= 6 && e.type === 'pointerup') {
        const hex = document.elementFromPoint(e.clientX, e.clientY)?.closest('.hexw');
        if (hex) this.tap(hex, e.pointerType);
      }
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover(null); });
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
  }

  hover(hex) {
    const node = hex ? NODE_BY_ID[hex.dataset.id] : null;
    if (node === this.hovered) return;
    this.hovered = node;
    this.showInfo(node || this.selected);
  }

  tap(hex, pointerType) {
    const node = NODE_BY_ID[hex.dataset.id];
    const st = nodeState(node, this.game.state.upgrades);
    if (st === 'hidden') {
      hex.classList.remove('shake'); void hex.offsetWidth; hex.classList.add('shake');
      this.selected = null;
      this.showInfo(null, 'Buy a neighbouring upgrade to reveal this one.');
      return;
    }
    // Mouse buys on click; touch selects first, then buys on a second tap.
    const again = this.selected === node;
    this.selected = node;
    this.render();
    this.showInfo(node);
    if (pointerType === 'mouse' || again) this.tryBuy(node);
  }

  tryBuy(node) {
    const { game } = this;
    const res = buyNode(game.state, node.id);
    const hex = this.els.get(node.id);
    if (!res.ok) {
      if (res.reason === 'gold') {
        game.audio.play('deny');
        hex?.classList.remove('shake'); void hex?.offsetWidth; hex?.classList.add('shake');
      }
      return;
    }
    game.audio.play('buy');
    game.onUpgrade(node);
    this.render();
    const h2 = this.els.get(node.id);
    h2?.classList.remove('bought'); void h2?.offsetWidth; h2?.classList.add('bought');
    this.showInfo(node);
  }

  hexHtml(node, st, lvl) {
    if (st === 'hidden') return `<div class="hex"></div><div class="hex-in"><span class="hex-q outline">?</span></div>`;
    const maxed = lvl >= node.max;
    const cost = nodeCost(node, lvl);
    const badge = node.max > 1 ? `<span class="hex-lvl">${maxed ? 'MAX' : `${lvl}/${node.max}`}</span>` : '';
    const price = !node.root && !maxed ? `<span class="hex-price outline">${iconSpan('goldbar')}${fmt(cost)}</span>` : '';
    return `<div class="hex"></div><div class="hex-in">${badge}${iconSpan(node.icon)}<span class="hex-name outline">${escapeHtml(node.name)}</span>${price}</div>`;
  }

  render() {
    const { state } = this.game;
    const seen = new Set();
    for (const node of NODES) {
      const st = nodeState(node, state.upgrades);
      if (st === 'invisible') continue;
      seen.add(node.id);
      const lvl = state.upgrades[node.id] || 0;
      const sig = `${st}|${lvl}`;
      let hex = this.els.get(node.id);
      if (!hex) {
        hex = el('div', 'hexw');
        hex.dataset.id = node.id;
        const [x, y] = toPx(node.q, node.r);
        hex.style.left = `${x}px`;
        hex.style.top = `${y}px`;
        this.world.appendChild(hex);
        this.els.set(node.id, hex);
      }
      if (hex._sig !== sig) {
        hex._sig = sig;
        hex.innerHTML = this.hexHtml(node, st, lvl);
      }
      hex.className = `hexw ${st}${node.root ? ' root' : ''}${this.selected === node ? ' selected' : ''}`;
    }
    for (const [id, hex] of this.els) if (!seen.has(id)) { hex.remove(); this.els.delete(id); }
    this.updateAfford();
  }

  // Cheap per-tick refresh of affordability glow and the gold counter.
  updateAfford() {
    const { state } = this.game;
    setText($('treeGold'), fmt(state.gold));
    for (const [id, hex] of this.els) {
      const node = NODE_BY_ID[id];
      const lvl = state.upgrades[id] || 0;
      const buyable = !node.root && lvl < node.max && !hex.classList.contains('hidden');
      const afford = buyable && state.gold >= nodeCost(node, lvl);
      hex.classList.toggle('afford', afford);
      hex.classList.toggle('poor', buyable && !afford);
    }
    if (this.isOpen) this.showInfo(this.hovered || this.selected);
  }

  showInfo(node, msg) {
    const { state } = this.game;
    const buy = $('niBuy');
    if (!node) {
      $('niIcon').innerHTML = icon('hex');
      setText($('niName'), 'Upgrade Tree');
      setText($('niDesc'), msg || 'Spend gold on glowing hexes. Each upgrade reveals new ones next to it. Drag to explore.');
      buy.hidden = true;
      return;
    }
    const lvl = state.upgrades[node.id] || 0;
    const cat = CATEGORY[node.cat];
    $('niIcon').innerHTML = icon(node.icon);
    setText($('niName'), node.max > 1 ? `${node.name} (Lv ${lvl}/${node.max})` : node.name);
    setText($('niDesc'), `${cat ? cat.name + ' · ' : ''}${node.desc}`);
    buy.hidden = false;
    const st = nodeState(node, state.upgrades);
    if (node.root) { buy.disabled = true; buy.innerHTML = 'Home'; return; }
    if (lvl >= node.max) { buy.disabled = true; buy.innerHTML = 'Owned'; return; }
    if (st === 'hidden') { buy.disabled = true; buy.innerHTML = 'Locked'; return; }
    const cost = nodeCost(node, lvl);
    buy.disabled = state.gold < cost;
    const html = `${iconSpan('goldbar')}<span>${fmt(cost)}</span>`;
    if (buy._h !== html) { buy._h = html; buy.innerHTML = html; }
  }
}
