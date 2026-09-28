// The title-screen bot doubles as a playtest: it should survive a while and eat, poles and all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, turn } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';

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
