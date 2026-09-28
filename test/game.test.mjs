import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, turn, interval, FOODS, comboMult, POLE_WARN } from '../src/game.mjs';

const RIGHT = { x: 1, y: 0 }, LEFT = { x: -1, y: 0 }, UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 };
// A game with no food and no poles, so each test places exactly what it needs.
const bare = (over = {}) => {
  const g = createGame({ seed: 1 });
  g.foods = []; g.nextPole = Infinity; g.spawnFood = false;
  return Object.assign(g, over);
};
const tick = (g, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...step(g, interval(g) + 1e-9)); return ev; };

test('the snake starts with three segments and moves one cell per tick', () => {
  const g = bare();
  assert.equal(g.snake.length, 3);
  const { x, y } = g.snake[0];
  tick(g);
  assert.deepEqual(g.snake[0], { x: x + 1, y });
  assert.equal(g.snake.length, 3);
});

test('it cannot reverse into itself, and two quick turns both happen', () => {
  const g = bare();
  turn(g, LEFT);
  tick(g);
  assert.deepEqual(g.dir, RIGHT, 'reverse ignored');
  const { x, y } = g.snake[0];
  turn(g, UP); turn(g, LEFT);
  tick(g, 2);
  assert.deepEqual(g.snake[0], { x: x - 1, y: y - 1 });
});

test('eating food grows the snake, scores, and spawns more food off the snake', () => {
  const g = bare({ spawnFood: true });
  const h = g.snake[0];
  g.foods = [{ type: 'fishball', x: h.x + 1, y: h.y }];
  const ev = tick(g);
  assert.ok(ev.some((e) => e.type === 'eat' && e.food === 'fishball'));
  assert.equal(g.score, FOODS.fishball.points);
  tick(g);
  assert.equal(g.snake.length, 4);
  assert.ok(g.foods.length >= 1);
  for (const f of g.foods) assert.ok(!g.snake.some((p) => p.x === f.x && p.y === f.y));
});

test('hitting the wall or yourself ends the game; the vacating tail cell is safe', () => {
  const wall = bare();
  wall.snake = [{ x: wall.cols - 1, y: 5 }, { x: wall.cols - 2, y: 5 }, { x: wall.cols - 3, y: 5 }];
  const ev = tick(wall);
  assert.equal(wall.alive, false);
  assert.ok(ev.some((e) => e.type === 'die' && e.by === 'pader'));

  const self = bare();
  self.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  self.dir = LEFT; self.queue = [DOWN];
  tick(self);
  assert.equal(self.alive, false, 'ran into its own body');

  const chase = bare();
  chase.snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
  chase.dir = DOWN;
  tick(chase);
  assert.equal(chase.alive, true, 'the tail moves out of the way in the same tick');
});

test('sili speeds you up and doubles points; halo-halo slows you down', () => {
  const g = bare();
  const base = interval(g);
  const h = g.snake[0];
  g.foods = [{ type: 'sili', x: h.x + 1, y: h.y, life: 5 }];
  tick(g);
  assert.ok(interval(g) < base * 0.7);
  g.foods = [{ type: 'fishball', x: g.snake[0].x + 1, y: g.snake[0].y }];
  const before = g.score;
  tick(g);
  assert.ok(g.score - before >= FOODS.fishball.points * 2);

  const c = bare();
  c.foods = [{ type: 'halohalo', x: c.snake[0].x + 1, y: c.snake[0].y, life: 5 }];
  tick(c);
  assert.ok(interval(c) > base * 1.4);
});

test('special food disappears if you are too slow', () => {
  const g = bare();
  g.foods = [{ type: 'balut', x: 1, y: 1, life: 0.5 }];
  const ev = step(g, 0.6);
  assert.ok(ev.some((e) => e.type === 'expire' && e.food === 'balut'));
  assert.equal(g.foods.length, 0);
});

test('quick eats build a combo multiplier', () => {
  assert.equal(comboMult(1), 1);
  assert.equal(comboMult(3), 2);
  assert.equal(comboMult(20), 4);
  const g = bare();
  for (let i = 0; i < 3; i++) { g.foods = [{ type: 'fishball', x: g.snake[0].x + 1, y: g.snake[0].y }]; tick(g); }
  assert.equal(g.combo, 3);
  assert.equal(g.score, 10 + 10 + 20);
});

test('tinikling poles warn first; a clap on your body cuts the tail and costs points', () => {
  const g = bare({ score: 100 });
  g.snake = [{ x: 8, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 6, y: 7 }, { x: 6, y: 8 }];
  g.dir = RIGHT;
  g.pole = { axis: 'row', index: 7, warn: 0.2, clap: 0 };
  const ev = step(g, 0.25);
  const cut = ev.find((e) => e.type === 'cut');
  assert.ok(cut, 'clapped on the body');
  assert.equal(g.snake.length, 4);
  assert.equal(cut.lost, 2);
  assert.equal(g.score, 90);
  assert.ok(g.alive);
});

test('a clap on your head ends the game', () => {
  const g = bare();
  const h = g.snake[0];
  g.pole = { axis: 'col', index: h.x, warn: 0.01, clap: 0 };
  g.acc = -10; // hold the snake still for this test
  const ev = step(g, 0.05);
  assert.equal(g.alive, false);
  assert.ok(ev.some((e) => e.type === 'die' && e.by === 'kawayan'));
});

test('poles start after a few meals and always give the full warning', () => {
  const g = createGame({ seed: 7 });
  assert.equal(g.pole, null);
  g.eaten = 6; g.nextPole = g.t + 0.1;
  let ev = [];
  g.acc = -100;
  for (let i = 0; i < 10 && !g.pole; i++) ev.push(...step(g, 0.05));
  assert.ok(g.pole, 'a pole appeared');
  assert.ok(Math.abs(g.pole.warn - POLE_WARN) < 0.06);
  assert.ok(ev.some((e) => e.type === 'pole'));
});

test('games are deterministic per seed', () => {
  const a = createGame({ seed: 3 }), b = createGame({ seed: 3 });
  assert.deepEqual(a.foods, b.foods);
});
