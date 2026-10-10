import { icon } from './icons.js';

export const $ = (id) => document.getElementById(id);

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// Replace every <span data-icon="name"> placeholder with its SVG.
export function fillIcons(root = document) {
  for (const n of root.querySelectorAll('[data-icon]')) {
    if (n.dataset.filled === n.dataset.icon) continue;
    n.innerHTML = icon(n.dataset.icon);
    n.dataset.filled = n.dataset.icon;
  }
}

export const iconSpan = (name, cls = 'ico') => `<span class="${cls}">${icon(name)}</span>`;

// Only touch the DOM when the text actually changes.
export function setText(node, text) {
  if (node._t !== text) { node._t = text; node.textContent = text; }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Rarity colour helper used by every panel.
export function rarityStyle(r) {
  return r.rainbow ? { color: '#ffffff', cls: 'rainbow-text', border: '#ff7bff' } : { color: r.color, cls: '', border: r.color };
}
