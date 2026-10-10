// The hex upgrade tree. Nodes live on a pointy-top axial hex grid.
// Buying a node reveals its neighbours; nodes two steps away show as "?".
//
// The grid is split into six wedges (one per category) around the Town Hall.
// A node in wedge k at local (a, b) sits at a*DIR[k] + b*DIR[k+1].

export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const SECTOR = { roll: 0, town: 1, eco: 2, combat: 3, click: 4, luck: 5 };
const RING_COST = [0, 40, 250, 1500, 9000, 60000, 450000, 3500000, 25000000];

export const CATEGORY = {
  roll:   { name: 'Rolling', color: '#4fd2ff' },
  town:   { name: 'Town',    color: '#ffc94d' },
  eco:    { name: 'Gold',    color: '#ffe066' },
  combat: { name: 'Combat',  color: '#ff6a4d' },
  click:  { name: 'Clicking', color: '#d7e3ff' },
  luck:   { name: 'Luck',    color: '#6ee36f' },
};

const SPEED = (s) => { s.rollTime *= 0.82; };

// [id, name, icon, category, a, b, costMult, description, effect(stats, level), opts]
const RAW = [
  // ---------- Rolling ----------
  // Base rolls take 3s. The outer ring trims that down; the inner branches add ways to roll faster by playing actively.
  ['rollSpeed', 'Roll Speed', 'dice', 'roll', 1, 0, 1, 'Rolls take 18% less time.', SPEED],
  ['quickRolls', 'Quick Rolls', 'dice', 'roll', 2, 0, 1, 'Rolls take 18% less time.', SPEED],
  ['hurry1', 'Tap to Hurry', 'tap', 'roll', 1, 1, 0.5, 'While a roll is spinning, tap ROLL to speed it up. Each tap skips 7% of the roll.', (s) => { s.hurry = Math.max(s.hurry, 0.07); }],
  ['quickerRolls', 'Quicker Rolls', 'dice', 'roll', 3, 0, 1, 'Rolls take 18% less time.', SPEED],
  ['autoRoll', 'Auto Roll', 'autodice', 'roll', 2, 1, 0.4, 'Unlocks the Auto Roll button. Your town rolls for you.', (s) => { s.autoRoll = true; }],
  ['combo', 'Roll Combo', 'combo', 'roll', 1, 2, 0.6, 'Press ROLL again within 1.5s of a reveal to build a combo. Each combo stack makes rolls 4% faster (up to 10 stacks). Auto Roll does not build combos.', (s) => { s.comboMax = Math.max(s.comboMax, 10); }],
  ['fasterRolls', 'Faster Rolls', 'dice', 'roll', 4, 0, 1, 'Rolls take 18% less time.', SPEED],
  ['speedDice', 'Speed Dice', 'speeddie', 'roll', 3, 1, 0.4, 'A golden Speed Die sometimes bounces onto the screen. Tap it for 15s of Roll Rush: rolls go 2x faster.', (s) => { s.rush = true; }],
  ['autoEquip', 'Auto-Equip Best', 'equip', 'roll', 2, 2, 0.3, 'Your strongest heroes are equipped automatically after every roll.', (s) => { s.autoEquip = true; }],
  ['hurry2', 'Hurry II', 'tap', 'roll', 1, 3, 0.5, 'Each tap skips 10% of a spinning roll.', (s) => { s.hurry = Math.max(s.hurry, 0.1); }],
  ['superFastRolls', 'Super Fast Rolls', 'dice', 'roll', 5, 0, 1, 'Rolls take 18% less time.', SPEED],
  ['offline1', 'Offline Rolls I', 'moon', 'roll', 4, 1, 0.15, 'Keep rolling while you are away: 1 roll every 30s.', (s) => { s.offlineInterval = 30; }],
  ['doubleRoll', 'Double Roll', 'dice2', 'roll', 3, 2, 0.4, 'Every roll gives you 2 heroes.', (s) => { s.rollsPerRoll = Math.max(s.rollsPerRoll, 2); }],
  ['longerRush', 'Longer Rush', 'speeddie', 'roll', 2, 3, 0.4, 'Roll Rush lasts 25s.', (s) => { s.rushTime = Math.max(s.rushTime, 25); }],
  ['comboMaster', 'Combo Master', 'combo', 'roll', 1, 4, 0.5, 'Combos stack up to 25 times and each stack makes rolls 5% faster.', (s) => { s.comboMax = 25; s.comboStep = 0.05; }],
  ['hyperRolls', 'Hyper Rolls', 'dice', 'roll', 6, 0, 1, 'Rolls take 18% less time.', SPEED],
  ['offline2', 'Offline Rolls II', 'moon', 'roll', 5, 1, 0.1, 'Offline: 1 roll every 15s.', (s) => { s.offlineInterval = Math.min(s.offlineInterval || 99, 15); }],
  ['tripleRoll', 'Triple Roll', 'dice2', 'roll', 4, 2, 0.5, 'Every roll gives you 3 heroes.', (s) => { s.rollsPerRoll = Math.max(s.rollsPerRoll, 3); }],
  ['superRush', 'Super Rush', 'speeddie', 'roll', 3, 3, 0.4, 'Roll Rush makes rolls 3x faster.', (s) => { s.rushMult = 3; }],
  ['hurry3', 'Hurry III', 'tap', 'roll', 2, 4, 0.4, 'Each tap skips 14% of a roll, and taps can cut up to 75% of it.', (s) => { s.hurry = 0.14; s.hurryCap = 0.75; }],
  ['frequentDice', 'Frequent Dice', 'speeddie', 'roll', 1, 5, 0.4, 'Speed Dice show up about twice as often.', (s) => { s.diceEvery = [20, 38]; }],
  ['ludicrousRolls', 'Ludicrous Rolls', 'dice', 'roll', 7, 0, 0.5, 'Rolls take 18% less time.', SPEED],
  ['offline3', 'Offline Rolls III', 'moon', 'roll', 6, 1, 0.03, 'Offline: 1 roll every 8s.', (s) => { s.offlineInterval = Math.min(s.offlineInterval || 99, 8); }],
  ['offline4', 'Offline Rolls IV', 'moon', 'roll', 5, 2, 0.05, 'Offline: 1 roll every 4s.', (s) => { s.offlineInterval = Math.min(s.offlineInterval || 99, 4); }],

  // ---------- Town ----------
  ['house', 'Cozy Houses', 'house', 'town', 1, 0, 0.7, 'Build houses. +2 gold per second.', (s) => { s.income += 2; s.town.houses += 2; }],
  ['palisade', 'Palisade', 'fence', 'town', 1, 1, 1, 'Wooden walls around town. +40 Town HP.', (s) => { s.townHp += 40; s.town.walls = Math.max(s.town.walls, 1); }],
  ['farm', 'Wheat Farms', 'wheat', 'town', 2, 0, 1, 'Plant wheat fields. +5 gold per second.', (s) => { s.income += 5; s.town.farms += 2; }],
  ['cannon', 'Cannon', 'cannon', 'town', 1, 2, 1, 'Build a cannon that blasts groups of enemies.', (s) => { s.cannons += 1; }],
  ['stoneWalls', 'Stone Walls', 'wall', 'town', 2, 1, 1, 'Upgrade to stone walls. +80 Town HP.', (s) => { s.townHp += 80; s.town.walls = Math.max(s.town.walls, 2); }],
  ['market', 'Market Stalls', 'market', 'town', 3, 0, 1, 'Open the market. Town income +50%.', (s) => { s.incomeMult *= 1.5; s.town.market += 2; }],
  ['watchtower', 'Watchtower', 'tower', 'town', 2, 2, 1, 'A crossbow tower that snipes enemies.', (s) => { s.towers += 1; }],
  ['lumber', 'Lumber Mill', 'log', 'town', 1, 3, 0.6, 'Chop the forest. +12 gold per second.', (s) => { s.income += 12; s.town.lumber = true; }],
  ['stoneRoads', 'Stone Roads', 'road', 'town', 3, 1, 1, 'Pave the roads with stone. Town income +30%.', (s) => { s.incomeMult *= 1.3; s.town.roads = 1; }],
  ['village', 'Village Square', 'house', 'town', 4, 0, 1, 'More houses and a well. +30 gold per second.', (s) => { s.income += 30; s.town.houses += 3; s.town.well = true; }],
  ['heavyCannons', 'Heavy Cannons', 'cannon', 'town', 3, 2, 1, 'Cannons hit 3x harder. +1 cannon.', (s) => { s.cannons += 1; s.cannonDmg *= 3; }],
  ['stoneHall', 'Stone Hall', 'castle', 'town', 4, 1, 1, 'Rebuild the Town Hall in stone. +120 Town HP.', (s) => { s.townHp += 120; s.town.hall = Math.max(s.town.hall, 1); }],
  ['ballista', 'Ballista Towers', 'tower', 'town', 2, 3, 1, '+1 tower. Towers hit 2x harder.', (s) => { s.towers += 1; s.towerDmg *= 2; }],
  ['battery', 'Cannon Battery', 'cannon', 'town', 4, 2, 0.8, '+2 cannons.', (s) => { s.cannons += 2; }],
  ['guild', 'Merchant Guild', 'market', 'town', 5, 0, 1.2, 'Traders flock in. Town income x2.', (s) => { s.incomeMult *= 2; s.town.market += 2; }],
  ['castle', 'Castle Keep', 'castle', 'town', 5, 1, 1.2, 'Turn the hall into a castle. +300 Town HP.', (s) => { s.townHp += 300; s.town.hall = 2; }],
  ['treasury', 'Royal Treasury', 'chest', 'town', 6, 0, 1, '+150 gold per second.', (s) => { s.income += 150; s.town.houses += 3; }],
  ['goldenAge', 'Golden Age', 'crown', 'town', 7, 0, 1, 'Your kingdom prospers. Town income x3.', (s) => { s.incomeMult *= 3; }],

  // ---------- Gold ----------
  ['bounty1', 'Bounty I', 'coin', 'eco', 1, 0, 0.8, 'Enemies drop 25% more gold.', (s) => { s.killGold += 0.25; }],
  ['warChest1', 'War Chest I', 'chest', 'eco', 1, 1, 1, 'Wave rewards +30%.', (s) => { s.waveGold += 0.3; }],
  ['bounty2', 'Bounty II', 'coin', 'eco', 2, 0, 1, 'Enemies drop 50% more gold.', (s) => { s.killGold += 0.5; }],
  ['warChest2', 'War Chest II', 'chest', 'eco', 2, 1, 1, 'Wave rewards +60%.', (s) => { s.waveGold += 0.6; }],
  ['luckyCoins', 'Lucky Coins', 'coins', 'eco', 1, 2, 1, '8% of kills drop 5x gold.', (s) => { s.luckyCoins = Math.max(s.luckyCoins, 0.08); }],
  ['bounty3', 'Bounty III', 'coin', 'eco', 3, 0, 1, 'Enemies drop 75% more gold.', (s) => { s.killGold += 0.75; }],
  ['interest', 'Interest', 'bank', 'eco', 2, 2, 1, 'Earn 3% of your gold after every wave (up to 3x the wave reward).', (s) => { s.interest = Math.max(s.interest, 0.03); }],
  ['warChest3', 'War Chest III', 'chest', 'eco', 3, 1, 1, 'Wave rewards +100%.', (s) => { s.waveGold += 1; }],
  ['treasure', 'Treasure Goblins', 'goblin', 'eco', 4, 0, 1, '4% of enemies are golden and drop 15x gold.', (s) => { s.treasure = 0.04; }],
  ['jackpot', 'Jackpot Coins', 'coins', 'eco', 1, 3, 1, 'Lucky Coins happen 15% of the time and pay 10x.', (s) => { s.luckyCoins = 0.15; s.luckyMult = 10; }],
  ['bigInterest', 'Compound Interest', 'bank', 'eco', 3, 2, 1, 'Interest raised to 6%.', (s) => { s.interest = 0.06; }],
  ['bounty4', 'Bounty IV', 'coin', 'eco', 4, 1, 1, 'Enemies drop 100% more gold.', (s) => { s.killGold += 1; }],
  ['midas', 'Midas Touch', 'crown', 'eco', 5, 0, 2, 'All gold income x2.', (s) => { s.goldMult *= 2; }],
  ['bounty5', 'Bounty V', 'coin', 'eco', 6, 0, 1, 'Enemies drop 150% more gold.', (s) => { s.killGold += 1.5; }],

  // ---------- Combat ----------
  ['slots3', '3 Hero Slots', 'backpack', 'combat', 1, 0, 1.4, 'Equip a 3rd hero.', (s) => { s.slots = Math.max(s.slots, 3); }],
  ['heroDmg', 'Hero Damage', 'flame', 'combat', 1, 1, 1, '+20% hero damage per level.', (s, l) => { s.heroDmg *= 1 + 0.2 * l; }, { max: 5, growth: 2.1 }],
  ['slots4', '4 Hero Slots', 'backpack', 'combat', 2, 0, 1.8, 'Equip a 4th hero.', (s) => { s.slots = Math.max(s.slots, 4); }],
  ['stronger', 'Stronger Heroes', 'flame', 'combat', 2, 1, 1, 'Hero damage x1.5.', (s) => { s.heroDmg *= 1.5; }],
  ['drums', 'Battle Drums', 'drum', 'combat', 1, 2, 1, 'Heroes attack 20% faster.', (s) => { s.atkSpeed *= 1.2; }],
  ['slots5', '5 Hero Slots', 'backpack', 'combat', 3, 0, 1.8, 'Equip a 5th hero.', (s) => { s.slots = Math.max(s.slots, 5); }],
  ['crit', 'Critical Hits', 'crit', 'combat', 2, 2, 1, 'Hero attacks have a 10% chance to deal 3x damage.', (s) => { s.critChance += 0.1; }],
  ['eagleEye', 'Eagle Eye', 'eye', 'combat', 3, 1, 1, 'Heroes see 20% further.', (s) => { s.range *= 1.2; }],
  ['veteran', 'Veteran Training', 'star', 'combat', 1, 3, 1, 'Hero mastery bonuses are doubled.', (s) => { s.masteryMult *= 2; }],
  ['slots6', '6 Hero Slots', 'backpack', 'combat', 4, 0, 2, 'Equip a 6th hero.', (s) => { s.slots = Math.max(s.slots, 6); }],
  ['mighty', 'Mighty Heroes', 'flame', 'combat', 4, 1, 1.2, 'Hero damage x1.75.', (s) => { s.heroDmg *= 1.75; }],
  ['deadlyCrits', 'Deadly Crits', 'crit', 'combat', 3, 2, 1.2, 'Crits deal 6x damage and happen 5% more often.', (s) => { s.critMult = 6; s.critChance += 0.05; }],
  ['warHorns', 'War Horns', 'drum', 'combat', 2, 3, 1, 'Heroes attack 30% faster.', (s) => { s.atkSpeed *= 1.3; }],
  ['slots7', '7 Hero Slots', 'backpack', 'combat', 5, 0, 2, 'Equip a 7th hero.', (s) => { s.slots = Math.max(s.slots, 7); }],
  ['heroic', 'Heroic Might', 'flame', 'combat', 5, 1, 1.5, 'Hero damage x2.', (s) => { s.heroDmg *= 2; }],
  ['eliteTraining', 'Elite Training', 'sword', 'combat', 4, 2, 1, '+30% hero damage per level.', (s, l) => { s.heroDmg *= 1 + 0.3 * l; }, { max: 5, growth: 2 }],
  ['slots8', '8 Hero Slots', 'backpack', 'combat', 6, 0, 2.5, 'Equip an 8th hero.', (s) => { s.slots = Math.max(s.slots, 8); }],
  ['godly', 'Godly Heroes', 'flame', 'combat', 7, 0, 1, 'Hero damage x2.5.', (s) => { s.heroDmg *= 2.5; }],

  // ---------- Clicking ----------
  ['clickDmg', 'Click Damage', 'cursor', 'click', 1, 0, 0.7, '+100% click damage per level.', (s, l) => { s.clickMult *= 1 + l; }, { max: 5, growth: 1.9 }],
  ['clickAttack', 'Click Attack', 'hammer', 'click', 1, 1, 1, 'Clicks also deal 5% of your heroes\' total DPS.', (s) => { s.clickDpsPct += 0.05; }],
  ['clickSplash', 'Click Splash', 'splash', 'click', 2, 0, 1, 'Clicks hit nearby enemies for 50% damage.', (s) => { s.clickSplash = 0.5; }],
  ['clickCrit', 'Click Crits', 'crit', 'click', 2, 1, 1, 'Clicks have a 15% chance to deal 5x damage.', (s) => { s.clickCrit = 0.15; }],
  ['autoClick1', 'Auto Clicker', 'robot', 'click', 1, 2, 1, 'Automatically clicks the enemy closest to town 2 times a second.', (s) => { s.autoClick = Math.max(s.autoClick, 2); }],
  ['powerClick', 'Power Click', 'hammer', 'click', 3, 0, 1, 'Clicks deal an extra 15% of your heroes\' DPS.', (s) => { s.clickDpsPct += 0.15; }],
  ['autoClick2', 'Auto Clicker II', 'robot', 'click', 2, 2, 1, 'Auto clicks 5 times a second.', (s) => { s.autoClick = Math.max(s.autoClick, 5); }],
  ['thunder', 'Thunder Clicks', 'bolt', 'click', 3, 1, 1, 'Every 25th click strikes every enemy for 10x click damage.', (s) => { s.thunder = true; }],
  ['megaClicks', 'Mega Clicks', 'cursor', 'click', 4, 0, 1, 'Click damage x3.', (s) => { s.clickMult *= 3; }],
  ['autoClick3', 'Auto Clicker III', 'robot', 'click', 2, 3, 1, 'Auto clicks 10 times a second.', (s) => { s.autoClick = Math.max(s.autoClick, 10); }],
  ['gigaClicks', 'Giga Clicks', 'cursor', 'click', 5, 0, 1, 'Click damage x5.', (s) => { s.clickMult *= 5; }],

  // ---------- Luck ----------
  ['luck1', 'Luck I', 'clover', 'luck', 1, 0, 1, '+20% Luck.', (s) => { s.luck += 0.2; }],
  ['golden1', 'Golden Chance I', 'golden', 'luck', 1, 1, 1, 'Golden heroes (x2.5 damage) appear 2.5% of the time.', (s) => { s.goldenChance = Math.max(s.goldenChance, 0.025); }],
  ['luck2', 'Luck II', 'clover', 'luck', 2, 0, 1, '+30% Luck.', (s) => { s.luck += 0.3; }],
  ['streak', 'Lucky Streak', 'streak', 'luck', 1, 2, 1, 'Every 10th roll gets 2x Luck.', (s) => { s.streakMult = Math.max(s.streakMult, 2); }],
  ['golden2', 'Golden Chance II', 'golden', 'luck', 2, 1, 1, 'Golden heroes appear 5% of the time.', (s) => { s.goldenChance = Math.max(s.goldenChance, 0.05); }],
  ['luck3', 'Luck III', 'clover', 'luck', 3, 0, 1.2, '+50% Luck.', (s) => { s.luck += 0.5; }],
  ['huge', 'HUGE Heroes', 'huge', 'luck', 2, 2, 1.2, 'HUGE heroes (x4 damage, bigger) appear 0.5% of the time.', (s) => { s.hugeChance = Math.max(s.hugeChance, 0.005); }],
  ['streak2', 'Lucky Streak II', 'streak', 'luck', 1, 3, 1.3, 'Every 10th roll gets 3x Luck.', (s) => { s.streakMult = 3; }],
  ['huge2', 'HUGE Chance II', 'huge', 'luck', 3, 1, 1.5, 'HUGE heroes appear 1.5% of the time.', (s) => { s.hugeChance = 0.015; }],
  ['luck4', 'Luck IV', 'clover', 'luck', 4, 0, 1.2, '+100% Luck.', (s) => { s.luck += 1; }],
  ['golden3', 'Golden Chance III', 'golden', 'luck', 3, 2, 1, 'Golden heroes appear 10% of the time.', (s) => { s.goldenChance = 0.1; }],
  ['clover', 'Four-Leaf Clover', 'clover4', 'luck', 4, 1, 1.5, 'All Luck x1.5.', (s) => { s.luckMult *= 1.5; }],
  ['luck5', 'Luck V', 'clover', 'luck', 5, 0, 1.3, '+200% Luck.', (s) => { s.luck += 2; }],
  ['huge3', 'HUGE Chance III', 'huge', 'luck', 2, 3, 2, 'HUGE heroes appear 3% of the time.', (s) => { s.hugeChance = 0.03; }],
  ['fortune', "Fortune's Favor", 'clover4', 'luck', 6, 0, 1.5, '+300% Luck.', (s) => { s.luck += 3; }],
  ['luck6', 'Luck VI', 'clover', 'luck', 7, 0, 1, '+500% Luck.', (s) => { s.luck += 5; }],
];

function toAxial(sector, a, b) {
  const d1 = DIRS[sector], d2 = DIRS[(sector + 1) % 6];
  return [a * d1[0] + b * d2[0], a * d1[1] + b * d2[1]];
}

export const NODES = [
  { id: 'root', name: 'Town Hall', icon: 'castle', cat: 'town', q: 0, r: 0, cost: 0, max: 1, root: true,
    desc: 'The heart of your town. Defend it from every wave!', fx: () => {} },
];
for (const [id, name, icon, cat, a, b, cm, desc, fx, opts = {}] of RAW) {
  const [q, r] = toAxial(SECTOR[cat], a, b);
  NODES.push({
    id, name, icon, cat, q, r, ring: a + b, desc, fx,
    cost: Math.round(RING_COST[a + b] * cm),
    max: opts.max || 1, growth: opts.growth || 2,
  });
}

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
const POS = new Map(NODES.map((n) => [`${n.q},${n.r}`, n]));
export const nodeAt = (q, r) => POS.get(`${q},${r}`);

export function neighbors(node) {
  const out = [];
  for (const [dq, dr] of DIRS) {
    const n = nodeAt(node.q + dq, node.r + dr);
    if (n) out.push(n);
  }
  return out;
}

export function nodeCost(node, level) {
  return Math.round(node.cost * Math.pow(node.growth, level));
}

// owned: 'owned' | 'available' | 'hidden' (shown as ?) | 'invisible'
export function nodeState(node, upgrades) {
  const lvl = upgrades[node.id] || 0;
  if (node.root || lvl > 0) return 'owned';
  const ns = neighbors(node);
  if (ns.some((n) => n.root || (upgrades[n.id] || 0) > 0)) return 'available';
  if (ns.some((n) => nodeState1(n, upgrades))) return 'hidden';
  return 'invisible';
}
// "available" check without recursion, used for the hidden ring.
function nodeState1(node, upgrades) {
  if (node.root || (upgrades[node.id] || 0) > 0) return false;
  return neighbors(node).some((n) => n.root || (upgrades[n.id] || 0) > 0);
}

export function canBuy(node, upgrades) {
  const lvl = upgrades[node.id] || 0;
  if (node.root || lvl >= node.max) return false;
  const st = nodeState(node, upgrades);
  return st === 'owned' || st === 'available';
}

export function baseStats() {
  return {
    rollTime: 3.0, autoRoll: false, rollsPerRoll: 1, autoEquip: false, offlineInterval: 0,
    hurry: 0, hurryCap: 0.6, comboMax: 0, comboStep: 0.04, rush: false, rushTime: 15, rushMult: 2, diceEvery: [45, 75],
    luck: 1, luckMult: 1, streakMult: 1, goldenChance: 0.01, hugeChance: 0,
    slots: 2, heroDmg: 1, atkSpeed: 1, range: 1, critChance: 0, critMult: 3, masteryMult: 1,
    clickBase: 5, clickMult: 1, clickDpsPct: 0, clickSplash: 0, clickCrit: 0, autoClick: 0, thunder: false,
    killGold: 1, waveGold: 1, luckyCoins: 0, luckyMult: 5, interest: 0, treasure: 0, goldMult: 1,
    townHp: 100, income: 0, incomeMult: 1,
    cannons: 0, cannonDmg: 1, towers: 0, towerDmg: 1,
    town: { houses: 0, farms: 0, market: 0, walls: 0, roads: 0, hall: 0, lumber: false, well: false },
  };
}

export function computeStats(upgrades) {
  const s = baseStats();
  for (const node of NODES) {
    const lvl = upgrades[node.id] || 0;
    if (lvl > 0) node.fx(s, lvl);
  }
  s.totalLuck = s.luck * s.luckMult;
  s.townLevel = 1 + NODES.reduce((a, n) => a + (n.cat === 'town' && !n.root ? (upgrades[n.id] || 0) : 0), 0);
  return s;
}
