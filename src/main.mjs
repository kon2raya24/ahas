// The page: screens, input (keys, swipes, d-pad), the loop, sound and the best score. Rules live in
// game.mjs.
import { createGame, step, turn, interval, FOODS, BASE_INTERVAL } from './game.mjs';
import { bot } from './bot.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const KEY = 'ahas.v1';
const store = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: play on */ } },
};
const saved = store.get() || {};
let best = Number(saved.best) || 0;
let muted = !!saved.muted;
const persist = () => store.set({ best, muted });
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const R = createRenderer(canvas);
const A = createAudio();
A.setMuted(muted);

const DIR = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const TIPS = [
  'Halo-halo slows you down: perfect for squeezing through tight spots.',
  'Sili doubles your points, and your speed. Kapit!',
  'Eat again within 2.5 seconds to keep the sunod-sunod combo going.',
  'Balut is worth 50, and doubles everything for 8 seconds.',
  'When a line turns red, the tinikling poles are coming. Get your head out!',
  'The poles only cut your tail if your head is safe.',
];

let mode = 'title', game = null, demo = createGame({ seed: seed() }), readyT = 0, overAt = 0, think = true, lastBeat = -1;

function show(name) {
  for (const id of ['title', 'pause', 'over']) $(id).hidden = id !== name;
  $('pause-btn').hidden = name !== null;
  const first = name && $(name).querySelector('button');
  if (first) first.focus({ preventScroll: true });
}

function start() {
  A.start();
  game = createGame({ seed: seed() });
  R.reset();
  readyT = 1.1; think = true; lastBeat = -1;
  mode = 'play';
  show(null);
}

function gameOver() {
  mode = 'over';
  const g = game;
  const isBest = g.score > best;
  if (isBest) { best = g.score; persist(); }
  $('over-cause').textContent = g.deathBy === 'kawayan' ? 'Naipit ng kawayan. The tinikling got you.' : g.deathBy === 'pader' ? 'Bangga sa pader. You hit the frame.' : 'Nakagat mo ang sarili mo. You bit your own tail.';
  $('over-score').textContent = g.score;
  $('over-best').textContent = isBest ? 'Bagong best! New best!' : `Best: ${best}`;
  $('over-best').classList.toggle('new', isBest);
  const eaten = Object.entries(g.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${FOODS[k].name} ×${n}`).join(' · ');
  $('over-stats').textContent = [`Haba ${g.snake.length}`, `best combo ${g.bestCombo}`, g.cuts ? `naipit ${g.cuts}×` : null].filter(Boolean).join(' · ');
  $('over-food').textContent = eaten || 'Walang nakain. Nothing eaten, gutom pa!';
  $('over-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  show('over');
}

function onEvent(e) {
  R.event(e, game);
  switch (e.type) {
    case 'eat': A.eat(e.combo, !!FOODS[e.food].special); break;
    case 'spawn': A.spawn(!!e.special); break;
    case 'expire': A.expire(); break;
    case 'clap': A.clap(); break;
    case 'cut': A.cut(); break;
    case 'die': A.die(); overAt = performance.now() + 1100; break;
    case 'move': think = true; break;
    default: break;
  }
}

function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; show(null); } }

// ---------- input ----------
function steer(d) {
  if (mode !== 'play' || !game || !game.alive) return;
  if (turn(game, d)) A.turn();
}
const KEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (KEYS[k]) { e.preventDefault(); steer(DIR[KEYS[k]]); return; }
  if ((k === ' ' || k === 'Enter') && (mode === 'title' || mode === 'over') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); start(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); }
  if (k === 'm' || k === 'M') toggleSound();
});
// swipes anywhere on the stage
let touch = null;
const stage = $('stage');
stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') touch = { x: e.clientX, y: e.clientY }; });
stage.addEventListener('pointermove', (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  if (Math.hypot(dx, dy) < 22) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR.right : DIR.left) : (dy > 0 ? DIR.down : DIR.up));
  touch = { x: e.clientX, y: e.clientY };
});
for (const ev of ['pointerup', 'pointercancel']) stage.addEventListener(ev, () => { touch = null; });
for (const b of document.querySelectorAll('[data-dir]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); steer(DIR[b.dataset.dir]); });

function toggleSound() { A.start(); muted = !muted; A.setMuted(muted); persist(); soundLabel(); }
const soundLabel = () => { for (const b of document.querySelectorAll('.sound')) b.textContent = muted ? 'Tunog: off' : 'Tunog: on'; };
soundLabel();
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('.play')) b.onclick = start;
$('resume').onclick = resume;
$('pause-btn').onclick = pause;
$('menu').onclick = () => { mode = 'title'; game = null; show('title'); updateBest(); };
$('quit').onclick = () => { mode = 'title'; game = null; show('title'); updateBest(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
const updateBest = () => { $('title-best').textContent = best ? `Best: ${best}` : ''; };
updateBest();

// ---------- loop ----------
let last = performance.now(), t = 0, demoWait = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  if (game && mode === 'play') {
    if (readyT > 0) readyT -= dt;
    else {
      if (AUTOPLAY && think && !game.queue.length) { const d = bot(game); if (d) turn(game, d); think = false; }
      for (const e of step(game, dt)) onEvent(e);
      // tinikling taps on the beat while the poles warn
      if (game.pole && game.pole.warn > 0) { const b = Math.floor(game.pole.warn / 0.4); if (b !== lastBeat) { lastBeat = b; A.tap(); } } else lastBeat = -1;
    }
    if (!game.alive && now > overAt && overAt) { overAt = 0; gameOver(); }
  } else if (!game) {
    if (demo.alive) {
      if (!demo.queue.length) { const d = bot(demo); if (d) turn(demo, d); }
      for (const e of step(demo, dt)) R.event(e, demo);
    } else if ((demoWait += dt) > 1.5) { demoWait = 0; demo = createGame({ seed: seed() }); }
  }
  const view = game || demo;
  R.draw(view, t, { reduced: reduced(), best, hudOn: !!game });
  const ready = !!game && mode === 'play' && readyT > 0;
  $('ready').hidden = !ready;
  if (ready) $('ready').textContent = readyT > 0.45 ? 'Handa…' : 'Laro na!';
  A.set(mode === 'play' && !!game?.alive, game ? Math.min(1.8, BASE_INTERVAL / interval(game)) : 1);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', R.resize);
R.resize();
show('title');
requestAnimationFrame(frame);

if (TEST) {
  window.__ahas = { get game() { return game; }, get mode() { return mode; }, start };
  if (Q.get('go') === '1') start();
}
