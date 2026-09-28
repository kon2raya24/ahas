// The rules: a pure step function that moves the snake, feeds it, runs the tinikling poles, the
// tandang and the barangay levels, and returns events (move, eat, expire, spawn, pole, clap, cut,
// level, peck, shield, die). Rendering and audio only read it.
import { rng } from './rng.mjs';

export const COLS = 20, ROWS = 20;
export const BASE_INTERVAL = 0.14; // seconds per cell at the start
export const MIN_INTERVAL = 0.07;
export const SPEEDUP = 0.0022; // seconds faster per extra segment
export const COMBO_WINDOW = 2.5; // eat again within this many seconds to keep the combo
export const POLE_AFTER = 6; // meals before the tinikling poles start
export const POLE_WARN = 2.4; // seconds of warning before a clap
export const POLE_CLAP = 0.35; // how long the closed poles stay on screen
export const CUT_COST = 5; // points lost per segment the poles cut off
export const SPECIAL_CHANCE = 0.28;
export const LEVEL_MEALS = 8; // meals per barangay
export const POTS_PER_LEVEL = 2, MAX_POTS = 14;
export const ROOSTER_STEP = 0.42; // seconds per cell for the tandang
export const PHASE = 1.5; // seconds of phasing after the anting-anting saves you
export const MODES = { klasiko: 'Klasiko', walangpader: 'Walang Pader', daily: 'Araw-araw' };

// The daily challenge: one seed per calendar day, the same for everyone.
export const dailySeed = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export const FOODS = {
  fishball: { name: 'Fishball', points: 10, grow: 1, weight: 5 },
  kwekkwek: { name: 'Kwek-kwek', points: 10, grow: 1, weight: 4 },
  turon: { name: 'Turon', points: 15, grow: 2, weight: 2 },
  bananacue: { name: 'Banana cue', points: 15, grow: 2, weight: 2 },
  balut: { name: 'Balut', points: 50, grow: 1, special: true, life: 7, effect: 'balut', dur: 8 },
  sili: { name: 'Sili', points: 20, grow: 1, special: true, life: 8, effect: 'sili', dur: 6 },
  halohalo: { name: 'Halo-halo', points: 20, grow: 1, special: true, life: 8, effect: 'halo', dur: 6 },
  anting: { name: 'Anting-anting', points: 10, grow: 0, special: true, life: 8 },
};
const REGULAR = Object.entries(FOODS).filter(([, f]) => !f.special).flatMap(([k, f]) => Array(f.weight).fill(k));
const SPECIAL = ['balut', 'balut', 'sili', 'sili', 'halohalo', 'halohalo', 'balut', 'anting', 'anting'];

// Combo multiplier: ×1 for the first two quick eats, then ×2, ×3, up to ×4.
export const comboMult = (combo) => Math.min(4, 1 + Math.floor((combo - 1) / 2));

export function createGame({ seed = Date.now(), cols = COLS, rows = ROWS, mode = 'klasiko' } = {}) {
  const y = Math.floor(rows / 2);
  const snake = [{ x: 6, y }, { x: 5, y }, { x: 4, y }];
  const g = {
    cols, rows, rand: rng(seed), t: 0, acc: 0,
    snake, prev: snake.map((p) => ({ ...p })), dir: { x: 1, y: 0 }, queue: [], grow: 0,
    foods: [], spawnFood: true, score: 0, eaten: 0, counts: {}, alive: true, deathBy: null,
    combo: 0, bestCombo: 0, lastEat: -99, effects: { balut: 0, sili: 0, halo: 0 },
    pole: null, nextPole: null, cuts: 0, claps: 0,
    mode, wrap: mode === 'walangpader', level: 1, pots: [], rooster: null, roosterAt: null, pecks: 0,
    shield: false, phase: 0, saves: 0,
  };
  spawn(g, 'regular');
  return g;
}

export function interval(g) {
  const base = Math.max(MIN_INTERVAL, BASE_INTERVAL - (g.snake.length - 3) * SPEEDUP);
  return base * (g.effects.sili > 0 ? 0.62 : 1) * (g.effects.halo > 0 ? 1.6 : 1);
}

// Queue a turn (up to two ahead, so quick corner inputs are never lost); reversing is ignored.
export function turn(g, d) {
  const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
  if (g.queue.length >= 2 || (d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return false;
  g.queue.push(d);
  return true;
}

const at = (list, x, y) => list.some((p) => p.x === x && p.y === y);
const occupied = (g, x, y) => at(g.snake, x, y) || at(g.foods, x, y) || at(g.pots, x, y) || (g.rooster && g.rooster.x === x && g.rooster.y === y);
const inLine = (pole, p) => (pole.axis === 'row' ? p.y === pole.index : p.x === pole.index);

function spawn(g, kind) {
  const free = [];
  const h = g.snake[0];
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    if (occupied(g, x, y) || Math.abs(x - h.x) + Math.abs(y - h.y) < 3) continue;
    if (g.pole && inLine(g.pole, { x, y })) continue;
    free.push({ x, y });
  }
  if (!free.length) return null;
  const at = free[Math.floor(g.rand() * free.length)];
  const type = kind === 'regular' ? REGULAR[Math.floor(g.rand() * REGULAR.length)] : SPECIAL[Math.floor(g.rand() * SPECIAL.length)];
  const food = { type, ...at, ...(FOODS[type].special ? { life: FOODS[type].life } : {}) };
  g.foods.push(food);
  return food;
}

// A fatal bump: phasing ignores it, the anting-anting absorbs it once, otherwise it's game over.
function survive(g, by, ev) {
  if (g.phase > 0) return true;
  if (g.shield) {
    g.shield = false; g.phase = PHASE; g.saves++;
    ev.push({ type: 'shield', by });
    return true;
  }
  die(g, by, ev);
  return false;
}

function levelUp(g, ev) {
  g.level++;
  const h = g.snake[0];
  const added = [];
  for (let n = 0; n < POTS_PER_LEVEL && g.pots.length < MAX_POTS; n++) {
    const free = [];
    for (let y = 1; y < g.rows - 1; y++) for (let x = 1; x < g.cols - 1; x++) {
      if (occupied(g, x, y) || Math.abs(x - h.x) + Math.abs(y - h.y) < 4) continue;
      // pots never touch each other, so they can't wall off a pocket
      if (g.pots.some((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 1)) continue;
      if (g.pole && inLine(g.pole, { x, y })) continue;
      free.push({ x, y });
    }
    if (!free.length) break;
    const pot = free[Math.floor(g.rand() * free.length)];
    g.pots.push(pot); added.push(pot);
  }
  if (g.level >= 2 && g.roosterAt === null) g.roosterAt = g.t + 2;
  ev.push({ type: 'level', level: g.level, pots: added });
}

// The tandang struts around, mostly towards food, and never onto you or the cell ahead of your head.
function rooster(g, dt, ev) {
  if (!g.rooster) {
    if (g.roosterAt === null || g.t < g.roosterAt) return;
    const h = g.snake[0];
    const spots = [];
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (!occupied(g, x, y) && Math.abs(x - h.x) + Math.abs(y - h.y) >= 6) spots.push({ x, y });
    if (!spots.length) return;
    const s = spots[Math.floor(g.rand() * spots.length)];
    g.rooster = { ...s, dir: { x: 1, y: 0 }, t: 0 };
    ev.push({ type: 'rooster', x: s.x, y: s.y });
    return;
  }
  const r = g.rooster;
  r.t += dt;
  if (r.t < ROOSTER_STEP) return;
  r.t -= ROOSTER_STEP;
  const h = g.snake[0], ahead = { x: h.x + g.dir.x, y: h.y + g.dir.y };
  const ok = (x, y) => x >= 0 && y >= 0 && x < g.cols && y < g.rows && !at(g.snake, x, y) && !at(g.pots, x, y) && !(x === ahead.x && y === ahead.y);
  const opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].filter((d) => ok(r.x + d.x, r.y + d.y));
  if (!opts.length) return;
  const food = g.foods.filter((f) => !FOODS[f.type].special).sort((a, b) => Math.abs(a.x - r.x) + Math.abs(a.y - r.y) - (Math.abs(b.x - r.x) + Math.abs(b.y - r.y)))[0];
  const dist = (d) => (food ? Math.abs(r.x + d.x - food.x) + Math.abs(r.y + d.y - food.y) : 0);
  let d;
  const roll = g.rand();
  if (food && roll < 0.55) d = opts.sort((a, b) => dist(a) - dist(b))[0];
  else if (roll < 0.8 && opts.some((o) => o.x === r.dir.x && o.y === r.dir.y)) d = r.dir;
  else d = opts[Math.floor(g.rand() * opts.length)];
  r.x += d.x; r.y += d.y; r.dir = d;
  const fi = g.foods.findIndex((f) => f.x === r.x && f.y === r.y && !FOODS[f.type].special);
  if (fi >= 0) {
    const f = g.foods.splice(fi, 1)[0];
    g.pecks++;
    ev.push({ type: 'peck', food: f.type, x: f.x, y: f.y });
    if (g.spawnFood) { const n = spawn(g, 'regular'); if (n) ev.push({ type: 'spawn', food: n.type, x: n.x, y: n.y }); }
  }
}

function die(g, by, ev) {
  g.alive = false;
  g.deathBy = by;
  ev.push({ type: 'die', by, score: g.score });
}

function move(g, ev) {
  if (g.queue.length) g.dir = g.queue.shift();
  const h = g.snake[0];
  let head = { x: h.x + g.dir.x, y: h.y + g.dir.y };
  const out = head.x < 0 || head.y < 0 || head.x >= g.cols || head.y >= g.rows;
  const body = g.grow > 0 ? g.snake : g.snake.slice(0, -1);
  const by = out && !g.wrap ? 'pader'
    : at(body, head.x, head.y) ? 'sarili'
    : at(g.pots, head.x, head.y) ? 'banga'
    : g.rooster && g.rooster.x === head.x && g.rooster.y === head.y ? 'manok' : null;
  if (by && !survive(g, by, ev)) return;
  if (out) head = { x: (head.x + g.cols) % g.cols, y: (head.y + g.rows) % g.rows };
  const old = g.snake;
  g.snake = [head, ...old];
  if (g.grow > 0) g.grow--; else g.snake.pop();
  // where each segment was a tick ago, for smooth drawing between ticks
  g.prev = g.snake.map((_, i) => ({ ...old[Math.min(i, old.length - 1)] }));
  ev.push({ type: 'move' });

  const fi = g.foods.findIndex((f) => f.x === head.x && f.y === head.y);
  if (fi < 0) return;
  const food = g.foods.splice(fi, 1)[0];
  const def = FOODS[food.type];
  g.combo = g.t - g.lastEat <= COMBO_WINDOW ? g.combo + 1 : 1;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  g.lastEat = g.t;
  const mult = comboMult(g.combo) * (g.effects.balut > 0 ? 2 : 1) * (g.effects.sili > 0 ? 2 : 1);
  const points = def.points * mult;
  g.score += points;
  g.grow += def.grow;
  g.eaten++;
  g.counts[food.type] = (g.counts[food.type] || 0) + 1;
  if (def.effect) g.effects[def.effect] = def.dur;
  ev.push({ type: 'eat', food: food.type, x: head.x, y: head.y, points, mult, combo: g.combo });
  if (food.type === 'anting') { g.shield = true; }
  if (g.eaten >= POLE_AFTER && g.nextPole === null) g.nextPole = g.t + 3;
  if (g.eaten % LEVEL_MEALS === 0) levelUp(g, ev);
  if (!g.spawnFood) return;
  if (!def.special) {
    const f = spawn(g, 'regular');
    if (f) ev.push({ type: 'spawn', food: f.type, x: f.x, y: f.y });
    if (!g.foods.some((q) => FOODS[q.type].special) && g.rand() < SPECIAL_CHANCE) {
      const sp = spawn(g, 'special');
      if (sp) ev.push({ type: 'spawn', food: sp.type, x: sp.x, y: sp.y, special: true });
    }
  }
}

function poles(g, dt, ev) {
  if (g.pole) {
    const p = g.pole;
    if (p.warn > 0) {
      p.warn -= dt;
      if (p.warn <= 0) {
        p.clap = POLE_CLAP;
        ev.push({ type: 'clap', axis: p.axis, index: p.index });
        if (inLine(p, g.snake[0]) && !survive(g, 'kawayan', ev)) return;
        if (g.alive) g.claps++;
        const i = g.snake.findIndex((q, k) => k > 0 && inLine(p, q));
        if (i > 0) {
          const lost = g.snake.length - i;
          g.snake = g.snake.slice(0, i);
          g.prev = g.prev.slice(0, i);
          g.grow = 0;
          g.score = Math.max(0, g.score - lost * CUT_COST);
          g.combo = 0;
          g.cuts++;
          ev.push({ type: 'cut', lost, axis: p.axis, index: p.index });
        }
      }
    } else {
      p.clap -= dt;
      if (p.clap <= 0) {
        g.pole = null;
        g.nextPole = g.t + Math.max(4, 10 - g.eaten * 0.12) + g.rand() * 3;
      }
    }
    return;
  }
  if (g.nextPole === null || g.t < g.nextPole) return;
  // aim at a line the snake is on most of the time, so the poles matter
  const axis = g.rand() < 0.5 ? 'row' : 'col';
  const size = axis === 'row' ? g.rows : g.cols;
  let index = Math.floor(g.rand() * size);
  if (g.rand() < 0.65) {
    const seg = g.snake[Math.floor(g.rand() * g.snake.length)];
    index = axis === 'row' ? seg.y : seg.x;
  }
  g.pole = { axis, index, warn: POLE_WARN, clap: 0 };
  ev.push({ type: 'pole', axis, index });
}

export function step(g, dt) {
  const ev = [];
  if (!g.alive) return ev;
  g.t += dt;
  for (const k of Object.keys(g.effects)) g.effects[k] = Math.max(0, g.effects[k] - dt);
  for (const f of [...g.foods]) {
    if (f.life === undefined) continue;
    f.life -= dt;
    if (f.life <= 0) { g.foods.splice(g.foods.indexOf(f), 1); ev.push({ type: 'expire', food: f.type, x: f.x, y: f.y }); }
  }
  if (g.t - g.lastEat > COMBO_WINDOW) g.combo = 0;
  g.phase = Math.max(0, g.phase - dt);
  poles(g, dt, ev);
  if (!g.alive) return ev;
  rooster(g, dt, ev);
  if (!g.alive) return ev;
  g.acc += dt;
  while (g.alive && g.acc >= interval(g)) {
    g.acc -= interval(g);
    move(g, ev);
  }
  return ev;
}

// How far through the current tick we are, for drawing between cells.
export const progress = (g) => Math.max(0, Math.min(1, g.acc / interval(g)));
