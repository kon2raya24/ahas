// The title-screen bot doubles as a playtest: it should survive a while and eat, poles and all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, turn } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';

test('the bot never steps into its own tail while growing', () => {
  const g = createGame({ seed: 1 });
  g.foods = []; g.nextPole = Infinity; g.spawnFood = false;
  // boxed into the corner: the only open-looking cell is the tail, which stays put while growing
  g.snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }];
  g.dir = { x: 0, y: -1 };
  g.grow = 2;
  const d = bot(g);
  assert.ok(!(d && d.x === 1 && d.y === 0), 'did not turn into the tail at (1,0)');
});

test('the bot eats and survives the tinikling on most seeds', () => {
  let eats = 0, poleDeaths = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = createGame({ seed });
    for (let i = 0; i < 60 * 90 && g.alive; i++) {
      if (!g.queue.length) { const d = bot(g); if (d) turn(g, d); }
      step(g, 1 / 60);
    }
    eats += g.eaten;
    if (g.deathBy === 'kawayan') poleDeaths++;
  }
  assert.ok(eats / 20 > 15, `ate ${eats / 20} per game`);
  assert.ok(poleDeaths <= 3, `${poleDeaths} of 20 games ended in the poles`);
});

test('the bot copes with pots, the tandang and wrapping in every mode', () => {
  for (const mode of ['klasiko', 'walangpader']) {
    let eats = 0;
    const deaths = {};
    for (let seed = 1; seed <= 15; seed++) {
      const g = createGame({ seed, mode });
      for (let i = 0; i < 60 * 120 && g.alive; i++) {
        if (!g.queue.length) { const d = bot(g); if (d) turn(g, d); }
        step(g, 1 / 60);
      }
      eats += g.eaten;
      if (g.deathBy) deaths[g.deathBy] = (deaths[g.deathBy] || 0) + 1;
    }
    assert.ok(eats / 15 > 16, `${mode}: ate ${eats / 15} per game`);
    assert.ok((deaths.banga || 0) + (deaths.manok || 0) <= 4, `${mode}: ${JSON.stringify(deaths)}`);
  }
});
