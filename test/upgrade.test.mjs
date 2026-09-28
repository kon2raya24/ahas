// v1.1: modes, barangay levels with banga pots, the tandang, the anting-anting shield, daily seeds and medals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, turn, interval, LEVEL_MEALS, dailySeed, festival, FESTIVALS } from '../src/game.mjs';
import { MEDALS, earned } from '../src/medals.mjs';

const bare = (over = {}, opts = {}) => {
  const g = createGame({ seed: 1, ...opts });
  g.foods = []; g.nextPole = Infinity; g.spawnFood = false; g.roosterAt = Infinity;
  return Object.assign(g, over);
};
const tick = (g, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...step(g, interval(g) + 1e-9)); return ev; };
const feed = (g) => { const h = g.snake[0]; g.foods = [{ type: 'fishball', x: h.x + g.dir.x, y: h.y + g.dir.y }]; return tick(g); };

test('walang pader: the snake wraps around the edges instead of crashing', () => {
  const g = bare({}, { mode: 'walangpader' });
  g.snake = [{ x: g.cols - 1, y: 5 }, { x: g.cols - 2, y: 5 }, { x: g.cols - 3, y: 5 }];
  tick(g);
  assert.ok(g.alive);
  assert.deepEqual(g.snake[0], { x: 0, y: 5 });
});

test('every few meals is a new barangay that adds banga pots away from the snake', () => {
  const g = bare();
  let ev = [];
  g.snake = [{ x: 2, y: 10 }, { x: 1, y: 10 }, { x: 0, y: 10 }];
  for (let i = 0; i < LEVEL_MEALS; i++) ev.push(...feed(g));
  const lv = ev.find((e) => e.type === 'level');
  assert.ok(lv && lv.level === 2);
  assert.ok(g.pots.length >= 2);
  const h = g.snake[0];
  for (const p of g.pots) {
    assert.ok(Math.abs(p.x - h.x) + Math.abs(p.y - h.y) >= 4, 'not right in front of you');
    assert.ok(!g.snake.some((s) => s.x === p.x && s.y === p.y));
    assert.ok(p.x > 0 && p.y > 0 && p.x < g.cols - 1 && p.y < g.rows - 1, 'never against the frame');
    for (const q of g.pots) if (q !== p) assert.ok(Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) > 1, 'pots never touch, so no dead-end pockets');
  }
});

test('running into a banga ends the game', () => {
  const g = bare();
  const h = g.snake[0];
  g.pots = [{ x: h.x + 1, y: h.y }];
  const ev = tick(g);
  assert.equal(g.alive, false);
  assert.ok(ev.some((e) => e.type === 'die' && e.by === 'banga'));
});

test('the anting-anting absorbs one crash, then you phase for a moment', () => {
  const g = bare();
  const h = g.snake[0];
  g.foods = [{ type: 'anting', x: h.x + 1, y: h.y, life: 5 }];
  tick(g);
  assert.ok(g.shield);
  g.pots = [{ x: g.snake[0].x + 1, y: g.snake[0].y }];
  const ev = tick(g);
  assert.ok(g.alive, 'saved');
  assert.ok(ev.some((e) => e.type === 'shield'));
  assert.equal(g.shield, false);
  assert.ok(g.phase > 0);
  // a second crash after the phase is fatal again
  g.phase = 0;
  g.pots = [{ x: g.snake[0].x + 1, y: g.snake[0].y }];
  tick(g);
  assert.equal(g.alive, false);
});

test('the tandang pecks food it reaches, never walks onto the snake, and is fatal to run into', () => {
  const g = bare({ spawnFood: true });
  g.rooster = { x: 12, y: 3, dir: { x: 0, y: 1 }, t: 0 };
  g.foods = [{ type: 'fishball', x: 12, y: 5 }];
  const ev = [];
  for (let i = 0; i < 600 && !ev.some((e) => e.type === 'peck'); i++) {
    ev.push(...step(g, 1 / 60));
    const r = g.rooster;
    assert.ok(!g.snake.some((s) => s.x === r.x && s.y === r.y), 'never on the snake');
    if (g.snake[0].x > 16) { g.snake = [{ x: 3, y: 15 }, { x: 2, y: 15 }, { x: 1, y: 15 }]; g.prev = g.snake.map((p) => ({ ...p })); }
  }
  assert.ok(ev.some((e) => e.type === 'peck'), 'it went for the food');
  assert.equal(g.foods.length, 1, 'stolen food comes back somewhere else');

  const hit = bare();
  const h = hit.snake[0];
  hit.rooster = { x: h.x + 1, y: h.y, dir: { x: 0, y: 1 }, t: -100 };
  const ev2 = tick(hit);
  assert.equal(hit.alive, false);
  assert.ok(ev2.some((e) => e.type === 'die' && e.by === 'manok'));
});

test('the tandang shows up in barangay 2', () => {
  const g = createGame({ seed: 5 });
  g.nextPole = Infinity;
  assert.equal(g.rooster, null);
  g.eaten = LEVEL_MEALS; g.level = 2; g.roosterAt = g.t;
  step(g, 0.01);
  assert.ok(g.rooster);
});

test('daily seeds are the same all day and change the next day', () => {
  assert.equal(dailySeed(new Date(2026, 8, 28, 1)), dailySeed(new Date(2026, 8, 28, 23)));
  assert.notEqual(dailySeed(new Date(2026, 8, 28)), dailySeed(new Date(2026, 8, 29)));
  const a = createGame({ seed: dailySeed(new Date(2026, 8, 28)), mode: 'daily' });
  const b = createGame({ seed: dailySeed(new Date(2026, 8, 28)), mode: 'daily' });
  assert.deepEqual(a.foods, b.foods);
});

test('medals are earned from what happened in a game', () => {
  assert.ok(MEDALS.length >= 8);
  const g = bare();
  assert.deepEqual(earned(g), []);
  feed(g);
  assert.ok(earned(g).includes('unang-kagat'));
  g.counts.balut = 1; g.bestCombo = 5; g.level = 5; g.claps = 5;
  const e = earned(g);
  for (const id of ['suwerte', 'sunod-sunod', 'barangay-5', 'tinikling']) assert.ok(e.includes(id), id);
});

test('each barangay is a festival, cycling after the last one', () => {
  assert.equal(festival(1).name, 'Fiesta');
  const names = new Set();
  for (let l = 1; l <= FESTIVALS.length; l++) names.add(festival(l).name);
  assert.equal(names.size, FESTIVALS.length, 'every level up to the cycle is a different festival');
  assert.equal(festival(FESTIVALS.length + 1).name, festival(1).name, 'then it cycles');
  for (const f of FESTIVALS) {
    assert.ok(f.place && f.bands.length === 4 && f.flags.length >= 5, f.name);
  }
});

test('level events carry the festival', () => {
  const g = bare();
  g.snake = [{ x: 2, y: 10 }, { x: 1, y: 10 }, { x: 0, y: 10 }];
  const ev = [];
  for (let i = 0; i < LEVEL_MEALS; i++) ev.push(...feed(g));
  assert.equal(ev.find((e) => e.type === 'level').festival, festival(2).name);
});
