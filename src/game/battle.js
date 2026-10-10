// Waves, enemies, hero attacks, town defences and click damage.
import * as THREE from '../../vendor/three.module.min.js';
import { Rig } from '../world/models.js';
import { makeProjectile } from '../world/effects.js';
import { LANE_LENGTHS, SLOT_POS, lanePoint } from '../world/layout.js';
import { buildWave, enemyDef, hpScale, isBossWave } from '../data/enemies.js';
import { parseKey, RARITIES } from '../data/heroes.js';
import { heroStats, teamDps, killGold, waveClearGold, addGold } from './logic.js';
import { fmt } from '../util.js';

const BREAK_TIME = 4;
const tmp = new THREE.Vector3();
const BLOB_GEO = new THREE.CircleGeometry(0.75, 16).rotateX(-Math.PI / 2);
const BLOB_MAT = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false });

export class Battle {
  constructor({ scene, camera, effects, town, audio, hooks }) {
    Object.assign(this, { scene, camera, effects, town, audio, hooks });
    this.enemies = [];
    this.projectiles = [];
    this.heroes = [];
    this.phase = 'countdown';
    this.timer = 5;
    this.spawnQueue = [];
    this.waveTime = 0;
    this.townHp = 100;
    this.autoClickT = 0;
    this.hallShake = 0;
    this.lp = { x: 0, z: 0, dir: 0 };
  }

  init(state, stats) {
    this.state = state;
    this.stats = stats;
    this.townHp = stats.townHp;
    this.syncHeroes();
  }

  setStats(stats) {
    const gained = stats.townHp - this.stats.townHp;
    this.stats = stats;
    if (gained > 0) this.townHp += gained;
    this.syncHeroes();
  }

  // ---------------- Heroes ----------------
  syncHeroes() {
    const { state, stats } = this;
    const want = state.equipped.slice(0, stats.slots);
    for (let i = 0; i < Math.max(want.length, this.heroes.length); i++) {
      const cur = this.heroes[i];
      const key = want[i] || null;
      if (cur && cur.key === key) continue;
      if (cur) { this.scene.remove(cur.rig.root); this.heroes[i] = null; }
      if (key && i < SLOT_POS.length) {
        const { hero, v } = parseKey(key);
        const rig = new Rig(hero.model, { golden: v === 'g' || v === 'hg', scale: (v === 'h' || v === 'hg' ? 1.45 : 1) * 1.25 });
        const [x, z] = SLOT_POS[i];
        rig.root.position.set(x, 0.3, z);
        rig.root.rotation.y = Math.atan2(-x, -z) + Math.PI;
        this.scene.add(rig.root);
        this.heroes[i] = { key, rig, slot: i, cd: Math.random() * 0.5, pos: new THREE.Vector3(x, 0.3, z), target: null };
        this.effects.burst(new THREE.Vector3(x, 1, z), [RARITIES[hero.rarity].color, '#ffffff'], 14, { speed: 3, up: 5 });
      } else this.heroes[i] = null;
    }
    this.heroes.length = Math.max(want.length, 0);
    this.refreshPads();
  }

  refreshPads() {
    const colors = this.heroes.map((h) => {
      if (!h) return null;
      const r = RARITIES[parseKey(h.key).hero.rarity];
      return r.rainbow ? '#ff7bff' : r.color;
    });
    this.town.setPads(this.stats.slots, colors);
  }

  // ---------------- Waves ----------------
  startWave() {
    const w = this.state.wave;
    this.spawnQueue = buildWave(w);
    this.waveTime = 0;
    this.phase = 'fighting';
    this.townHp = this.stats.townHp;
    this.audio?.play('waveStart');
    this.hooks.onWaveStart?.(w, isBossWave(w));
  }

  skipCountdown() {
    if (this.phase === 'countdown') this.timer = 0;
  }

  spawn(entry) {
    const w = this.state.wave;
    const def = enemyDef(entry.type);
    const golden = !entry.boss && Math.random() < this.stats.treasure;
    const rig = new Rig(def.model, { golden, scale: def.scale, shadows: false });
    const blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT);
    blob.position.y = 0.04;
    blob.scale.setScalar(def.scale);
    rig.root.add(blob);
    const hp = def.hp * hpScale(w) * (golden ? 2 : 1);
    const e = {
      def, rig, lane: entry.lane, dist: 0, hp, maxHp: hp, boss: !!entry.boss, golden,
      speed: def.speed * (1 + Math.min(0.35, w * 0.004)), slowT: 0, slowMult: 1, alive: true,
      pos: new THREE.Vector3(), height: 2.3 * def.scale,
    };
    this.placeEnemy(e);
    this.scene.add(rig.root);
    this.enemies.push(e);
    if (e.boss) {
      this.boss = e;
      this.audio?.play('boss');
      this.hooks.onBoss?.(def);
    }
  }

  placeEnemy(e) {
    const p = lanePoint(e.lane, e.dist, this.lp);
    e.pos.set(p.x, 0, p.z);
    e.rig.root.position.copy(e.pos);
    e.rig.root.rotation.y = p.dir;
  }

  removeEnemy(e) {
    e.alive = false;
    this.scene.remove(e.rig.root);
    if (this.boss === e) { this.boss = null; this.hooks.onBoss?.(null); }
  }

  enemyColors(e) {
    const m = e.def.model;
    return e.golden ? ['#ffd23f', '#ffe066', '#c9971c'] : [m.skin, m.shirt, m.pants];
  }

  damageEnemy(e, amount, { crit = false, silent = false } = {}) {
    if (!e.alive) return;
    e.hp -= amount;
    e.rig.hit();
    if (!silent) this.effects.damage(tmp.set(e.pos.x, e.height + 0.3, e.pos.z), amount, crit);
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    const { stats, state } = this;
    let gold = killGold(stats, e.def, state.wave);
    let lucky = false;
    if (e.golden) gold *= 15;
    if (stats.luckyCoins && Math.random() < stats.luckyCoins) { gold *= stats.luckyMult; lucky = true; }
    addGold(state, gold);
    state.kills++;
    const c = tmp.set(e.pos.x, 1 + e.height * 0.3, e.pos.z);
    this.effects.burst(c, this.enemyColors(e), e.boss ? 60 : 16, { speed: e.boss ? 7 : 4, size: e.boss ? 0.5 : 0.24 });
    this.effects.burst(c, ['#ffd23f', '#ffe98a'], lucky || e.golden ? 14 : 4, { speed: 2.5, size: 0.16, up: 6 });
    this.effects.text(tmp.set(e.pos.x, e.height + 0.9, e.pos.z), `+${fmt(gold)}`, { color: lucky || e.golden ? '#ffe14a' : '#ffd23f', size: lucky ? 26 : 20, rise: 2 });
    if (lucky) this.effects.text(tmp.set(e.pos.x, e.height + 1.6, e.pos.z), 'LUCKY!', { color: '#6ee36f', size: 24, rise: 2.2 });
    this.audio?.play(e.boss ? 'bossDie' : 'pop');
    this.removeEnemy(e);
  }

  // ---------------- Clicking ----------------
  clickDamage() {
    const s = this.stats;
    return s.clickBase * s.clickMult + teamDps(this.state, s) * s.clickDpsPct;
  }

  // Returns the enemy under a screen point (CSS pixels), if any.
  pickEnemy(sx, sy, w, h) {
    let best = null, bestD = 48;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      tmp.set(e.pos.x, e.height * 0.55, e.pos.z).project(this.camera);
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      const d = Math.hypot(x - sx, y - sy) - (e.boss ? 30 : 0);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  click(e, auto = false) {
    const s = this.stats;
    if (!auto) {
      this.state.clicks++;
      if (s.thunder && this.state.clicks % 25 === 0) this.thunder();
    }
    if (!e) return;
    let dmg = this.clickDamage();
    const crit = Math.random() < s.clickCrit;
    if (crit) dmg *= 5;
    const at = tmp.set(e.pos.x, e.height * 0.5, e.pos.z).clone();
    this.effects.flash(at, crit ? '#ffdf3b' : '#ffffff', auto ? 1.2 : 2.2);
    this.effects.burst(at, ['#ffffff', '#ffe98a'], auto ? 3 : 6, { speed: 3, size: 0.14 });
    this.audio?.play(auto ? 'tap' : 'hit');
    if (s.clickSplash) {
      for (const o of this.enemies) {
        if (o !== e && o.alive && o.pos.distanceTo(e.pos) < 2.6) this.damageEnemy(o, dmg * s.clickSplash, { silent: true });
      }
    }
    this.damageEnemy(e, dmg, { crit });
  }

  thunder() {
    const dmg = this.clickDamage() * 10;
    for (const e of [...this.enemies]) {
      if (!e.alive) continue;
      const top = new THREE.Vector3(e.pos.x + (Math.random() - 0.5) * 2, 14, e.pos.z);
      this.effects.lightning([top, new THREE.Vector3(e.pos.x, e.height * 0.5, e.pos.z)], '#fff36b');
      this.damageEnemy(e, dmg, { crit: true });
    }
    this.audio?.play('thunder');
  }

  // Enemy furthest along its road (closest to the hall).
  leadEnemy(from, range) {
    let best = null, bestP = -1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (from && (e.pos.x - from.x) ** 2 + (e.pos.z - from.z) ** 2 > range * range) continue;
      const p = e.dist / LANE_LENGTHS[e.lane];
      if (p > bestP) { bestP = p; best = e; }
    }
    return best;
  }

  // ---------------- Attacks ----------------
  heroAttack(h, target) {
    const { hero } = parseKey(h.key);
    const st = heroStats(this.state, this.stats, h.key);
    const atk = hero.attack;
    let dmg = st.dmg;
    const crit = Math.random() < this.stats.critChance;
    if (crit) dmg *= this.stats.critMult;
    const melee = atk.kind === 'slash' || atk.kind === 'scythe';
    h.rig.attack(melee ? 'melee' : 'cast', Math.min(0.5, 0.9 / st.rate));
    const size = h.rig.size;
    const from = new THREE.Vector3(h.pos.x, h.pos.y + 1.4 * size, h.pos.z);
    if (atk.kind === 'lightning') {
      const hitList = [target];
      for (const e of this.enemies) {
        if (hitList.length >= (atk.chain || 3)) break;
        if (e.alive && !hitList.includes(e) && e.pos.distanceTo(hitList[hitList.length - 1].pos) < 6) hitList.push(e);
      }
      const pts = [from, ...hitList.map((e) => new THREE.Vector3(e.pos.x, e.height * 0.55, e.pos.z))];
      this.effects.lightning(pts, atk.color);
      this.audio?.play('zap');
      for (const e of hitList) this.damageEnemy(e, dmg, { crit });
      return;
    }
    this.audio?.play(melee ? 'swing' : atk.kind === 'arrow' ? 'bow' : 'magic');
    this.fire({
      kind: atk.kind, color: atk.color, from, target, dmg, crit,
      speed: { arrow: 30, bolt: 20, fireball: 16, shuriken: 26, spear: 26, slash: 24, scythe: 20 }[atk.kind] || 20,
      aoe: atk.aoe || 0, slow: atk.slow || 0,
      delay: melee ? Math.min(0.2, 0.35 / st.rate) : 0.08,
    });
  }

  // Projectiles home in on `target` unless a fixed `aim` point is given.
  fire(p) {
    const mesh = makeProjectile(p.kind, p.color);
    mesh.visible = false;
    mesh.position.copy(p.from);
    this.scene.add(mesh);
    const homing = !p.aim;
    const aim = p.aim || new THREE.Vector3(p.target.pos.x, p.target.height * 0.5, p.target.pos.z);
    this.projectiles.push({ delay: 0, aoe: 0, slow: 0, crit: false, ...p, homing, mesh, pos: p.from.clone(), start: p.from.clone(), aim, t: 0 });
  }

  impact(p) {
    const at = p.aim;
    if (p.aoe > 0) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if ((e.pos.x - at.x) ** 2 + (e.pos.z - at.z) ** 2 < p.aoe * p.aoe || e === p.target) {
          if (p.slow) { e.slowT = 2.2; e.slowMult = 1 - p.slow; }
          this.damageEnemy(e, p.dmg, { crit: p.crit, silent: e !== p.target });
        }
      }
      this.effects.shockwave(at, p.aoe, p.color);
      this.effects.burst(at, [p.color, '#ffffff'], p.kind === 'cannonball' ? 14 : 8, { speed: 4, size: 0.18 });
      if (p.kind === 'cannonball' || p.kind === 'fireball') this.audio?.play('boom');
    } else if (p.target?.alive) {
      if (p.slow) { p.target.slowT = 2.2; p.target.slowMult = 1 - p.slow; }
      this.damageEnemy(p.target, p.dmg, { crit: p.crit });
    }
    if (p.kind === 'slash' || p.kind === 'scythe' || p.kind === 'bolt') this.effects.flash(at, p.color, 2);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.mesh.visible = true;
      if (p.homing && p.target.alive) p.aim.set(p.target.pos.x, p.target.height * 0.5, p.target.pos.z);
      let done = false;
      if (p.arc) {
        p.t += dt / p.flight;
        const k = Math.min(1, p.t);
        p.pos.lerpVectors(p.start, p.aim, k);
        p.pos.y += Math.sin(k * Math.PI) * p.arc;
        done = k >= 1;
      } else {
        tmp.subVectors(p.aim, p.pos);
        const d = tmp.length();
        const step = p.speed * dt;
        if (d <= step + 0.15) { p.pos.copy(p.aim); done = true; }
        else p.pos.addScaledVector(tmp, step / d);
      }
      p.mesh.position.copy(p.pos);
      if (!done) p.mesh.lookAt(p.aim);
      if (p.mesh.userData.spin) for (const s of p.mesh.userData.spin) s.rotation.y += dt * 25;
      if (p.kind === 'fireball' && Math.random() < 0.5) this.effects.burst(p.pos, ['#ff7a1a', '#ffd27a'], 1, { speed: 0.5, up: 1, size: 0.14, life: 0.4, gravity: 0 });
      if (done) {
        this.impact(p);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateDefences(dt) {
    const w = this.state.wave;
    for (const c of this.town.cannons) {
      c.cd = (c.cd ?? Math.random()) - dt;
      const target = this.leadEnemy(c.pos, 16);
      if (target) {
        const ang = Math.atan2(target.pos.x - c.pos.x, target.pos.z - c.pos.z);
        c.turret.rotation.y += angleDiff(c.turret.rotation.y, ang) * Math.min(1, dt * 6);
      }
      if (c.cd <= 0 && target) {
        c.cd = 2.2;
        c.recoil = 1;
        const from = c.pos.clone().add(new THREE.Vector3(Math.sin(c.turret.rotation.y) * 1.3, 0.2, Math.cos(c.turret.rotation.y) * 1.3));
        this.effects.flash(from, '#ffb347', 2.4);
        this.effects.burst(from, ['#d9d9d9', '#9a9a9a'], 5, { speed: 1.5, up: 2, size: 0.3, life: 0.6, gravity: -1 });
        const lead = target.speed * 1.0;
        const ahead = lanePoint(target.lane, Math.min(LANE_LENGTHS[target.lane], target.dist + lead), {});
        this.fire({
          kind: 'cannonball', color: '#ff8a3d', from, target: null, aim: new THREE.Vector3(ahead.x, 0.4, ahead.z),
          dmg: 0.35 * hpScale(w) * this.stats.cannonDmg, aoe: 2.4, arc: 4, flight: 1.0,
        });
        this.audio?.play('cannon');
      }
    }
    for (const t of this.town.towers) {
      t.cd = (t.cd ?? Math.random()) - dt;
      const target = this.leadEnemy(t.pos, 17);
      if (target) {
        const ang = Math.atan2(target.pos.x - t.pos.x, target.pos.z - t.pos.z);
        t.turret.rotation.y += angleDiff(t.turret.rotation.y, ang) * Math.min(1, dt * 8);
      }
      if (t.cd <= 0 && target) {
        t.cd = 1.1;
        this.fire({ kind: 'ballista', color: '#ffffff', from: t.pos.clone(), target, dmg: 0.22 * hpScale(w) * this.stats.towerDmg, speed: 34 });
        this.audio?.play('bow');
      }
    }
  }

  // ---------------- Main update ----------------
  update(dt) {
    const { state, stats } = this;
    this.updateProjectiles(dt);

    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
    } else if (this.phase === 'fighting') {
      this.waveTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].delay <= this.waveTime) this.spawn(this.spawnQueue.shift());

      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMult = 1; }
        const sp = e.speed * e.slowMult;
        e.dist += sp * dt;
        e.rig.walkSpeed = sp;
        if (e.dist >= LANE_LENGTHS[e.lane]) {
          this.townHp -= e.def.dmg;
          this.hallShake = 0.4;
          this.effects.burst(new THREE.Vector3(e.pos.x, 1, e.pos.z), this.enemyColors(e), 12);
          this.effects.text(new THREE.Vector3(e.pos.x, 3, e.pos.z), `-${e.def.dmg}`, { color: '#ff4a4a', size: 26 });
          this.audio?.play('townHit');
          this.removeEnemy(e);
          this.hooks.onTownHit?.();
          continue;
        }
        this.placeEnemy(e);
        e.rig.update(dt);
      }
      this.enemies = this.enemies.filter((e) => e.alive);

      if (this.townHp <= 0) this.failWave();
      else if (!this.spawnQueue.length && !this.enemies.length) this.clearWave();
    }

    // Heroes pick the leading enemy in range and attack on cooldown.
    for (const h of this.heroes) {
      if (!h) continue;
      const st = heroStats(state, stats, h.key);
      const target = this.phase === 'fighting' ? this.leadEnemy(h.pos, st.range) : null;
      if (target) {
        const ang = Math.atan2(target.pos.x - h.pos.x, target.pos.z - h.pos.z);
        h.rig.root.rotation.y += angleDiff(h.rig.root.rotation.y, ang) * Math.min(1, dt * 10);
      }
      h.cd -= dt;
      if (h.cd <= 0 && target) {
        h.cd = 1 / st.rate;
        this.heroAttack(h, target);
      }
      h.rig.update(dt);
    }

    this.updateDefences(dt);

    if (stats.autoClick > 0 && this.phase === 'fighting') {
      this.autoClickT -= dt;
      if (this.autoClickT <= 0) {
        this.autoClickT = 1 / stats.autoClick;
        const t = this.leadEnemy(null, 0);
        if (t) this.click(t, true);
      }
    }

    if (this.town.hall && this.hallShake > 0) {
      this.hallShake = Math.max(0, this.hallShake - dt);
      this.town.hall.position.x = Math.sin(this.hallShake * 60) * this.hallShake * 0.4;
    }
  }

  clearWave() {
    const { state, stats } = this;
    const w = state.wave;
    const reward = waveClearGold(state, stats, w);
    const interest = stats.interest ? Math.min(state.gold * stats.interest, reward * 3) : 0;
    addGold(state, reward + interest);
    state.bestWave = Math.max(state.bestWave, w);
    state.wave = w + 1;
    this.phase = 'countdown';
    this.timer = BREAK_TIME;
    this.audio?.play('waveClear');
    this.hooks.onWaveCleared?.(w, reward, interest);
  }

  failWave() {
    const w = this.state.wave;
    for (const e of this.enemies) {
      this.effects.burst(new THREE.Vector3(e.pos.x, 1, e.pos.z), this.enemyColors(e), 6);
      this.removeEnemy(e);
    }
    this.enemies = [];
    this.spawnQueue = [];
    this.phase = 'countdown';
    this.timer = BREAK_TIME + 2;
    // Falling back one wave lets the player farm gold and roll for better heroes.
    if (w > 1 && !isBossWave(w)) this.state.wave = w - 1;
    this.audio?.play('fail');
    this.hooks.onWaveFailed?.(w);
  }

  // Bars for the overlay.
  bars() {
    const out = [];
    for (const e of this.enemies) {
      if (!e.alive || (e.hp >= e.maxHp && !e.boss)) continue;
      out.push({ pos: { x: e.pos.x, y: e.height + 0.4 + (e.def.float ? 0.4 : 0), z: e.pos.z }, frac: Math.max(0, e.hp / e.maxHp), boss: e.boss, golden: e.golden });
    }
    return out;
  }
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

