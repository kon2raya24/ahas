// The rules: a pure step function that moves the snake, feeds it, runs the tinikling poles and
// returns events (move, eat, expire, spawn, pole, clap, cut, die). Rendering and audio only read it.
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

export const FOODS = {
  fishball: { name: 'Fishball', points: 10, grow: 1, weight: 5 },
  kwekkwek: { name: 'Kwek-kwek', points: 10, grow: 1, weight: 4 },
  turon: { name: 'Turon', points: 15, grow: 2, weight: 2 },
  bananacue: { name: 'Banana cue', points: 15, grow: 2, weight: 2 },
  balut: { name: 'Balut', points: 50, grow: 1, special: true, life: 7, effect: 'balut', dur: 8 },
  sili: { name: 'Sili', points: 20, grow: 1, special: true, life: 8, effect: 'sili', dur: 6 },
  halohalo: { name: 'Halo-halo', points: 20, grow: 1, special: true, life: 8, effect: 'halo', dur: 6 },
};
const REGULAR = Object.entries(FOODS).filter(([, f]) => !f.special).flatMap(([k, f]) => Array(f.weight).fill(k));
const SPECIAL = ['balut', 'balut', 'sili', 'sili', 'halohalo', 'halohalo', 'balut'];

// Combo multiplier: ×1 for the first two quick eats, then ×2, ×3, up to ×4.
export const comboMult = (combo) => Math.min(4, 1 + Math.floor((combo - 1) / 2));

export function createGame({ seed = Date.now(), cols = COLS, rows = ROWS } = {}) {
  const y = Math.floor(rows / 2);
  const snake = [{ x: 6, y }, { x: 5, y }, { x: 4, y }];
  const g = {
    cols, rows, rand: rng(seed), t: 0, acc: 0,
    snake, prev: snake.map((p) => ({ ...p })), dir: { x: 1, y: 0 }, queue: [], grow: 0,
    foods: [], spawnFood: true, score: 0, eaten: 0, counts: {}, alive: true, deathBy: null,
    combo: 0, bestCombo: 0, lastEat: -99, effects: { balut: 0, sili: 0, halo: 0 },
    pole: null, nextPole: null, cuts: 0,
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

const occupied = (g, x, y) => g.snake.some((p) => p.x === x && p.y === y) || g.foods.some((f) => f.x === x && f.y === y);
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

function die(g, by, ev) {
  g.alive = false;
  g.deathBy = by;
  ev.push({ type: 'die', by, score: g.score });
}

function move(g, ev) {
  if (g.queue.length) g.dir = g.queue.shift();
  const h = g.snake[0];
  const head = { x: h.x + g.dir.x, y: h.y + g.dir.y };
  if (head.x < 0 || head.y < 0 || head.x >= g.cols || head.y >= g.rows) return die(g, 'pader', ev);
  const body = g.grow > 0 ? g.snake : g.snake.slice(0, -1);
  if (body.some((p) => p.x === head.x && p.y === head.y)) return die(g, 'sarili', ev);
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
  if (g.eaten >= POLE_AFTER && g.nextPole === null) g.nextPole = g.t + 3;
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
        if (inLine(p, g.snake[0])) return die(g, 'kawayan', ev);
        const i = g.snake.findIndex((q) => inLine(p, q));
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
  poles(g, dt, ev);
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
