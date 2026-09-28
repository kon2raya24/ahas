// The page: screens, modes, input (keys, swipes, d-pad), the loop, sound, scores, medals and sharing.
// Rules live in game.mjs.
import { createGame, step, turn, interval, FOODS, BASE_INTERVAL, MODES, dailySeed } from './game.mjs';
import { bot } from './bot.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';
import { MEDALS, earned } from './medals.mjs';
import { festival } from './festivals.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const KEY = 'ahas.v1';
const store = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: play on */ } },
};
// Saves from v1 only had { best, muted }; the old best becomes the first Klasiko score.
const saved = store.get() || {};
const data = {
  muted: !!saved.muted,
  mode: MODES[saved.mode] ? saved.mode : 'klasiko',
  scores: { klasiko: [], walangpader: [], ...(saved.scores || {}) },
  daily: saved.daily || { day: 0, best: 0 },
  medals: Array.isArray(saved.medals) ? saved.medals : [],
  music: saved.music !== false,
  hints: Array.isArray(saved.hints) ? saved.hints : [],
};
if (!saved.scores && Number(saved.best) > 0) data.scores.klasiko.push({ score: Number(saved.best), len: 0, day: 0 });
const persist = () => store.set(data);
const today = () => dailySeed(new Date());
const bestFor = (m) => (m === 'daily' ? (data.daily.day === today() ? data.daily.best : 0) : data.scores[m][0]?.score || 0);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const randomSeed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const buzz = (p) => { try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(p); } catch { /* no haptics */ } };

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const R = createRenderer(canvas);
const A = createAudio();
A.setMuted(data.muted);
A.setMusic(data.music);

const DIR = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const TIPS = [
  'Halo-halo slows you down: perfect for squeezing through tight spots.',
  'Sili doubles your points, and your speed. Kapit!',
  'Eat again within 2.5 seconds to keep the sunod-sunod combo going.',
  'Balut is worth 50, and doubles everything for 8 seconds.',
  'When a line turns red, the tinikling poles are coming. Get your head out!',
  'The anting-anting saves you from one crash. Grab it before a tricky stretch.',
  'The tandang goes for your fishball. Beat him to it!',
  'Every 8 meals is a new barangay, with more banga in the way.',
  'In Walang Pader you can slip out one side and in the other.',
];
const CAUSE = {
  kawayan: 'Naipit ng kawayan. The tinikling got you.',
  pader: 'Bangga sa pader. You hit the frame.',
  banga: 'Basag ang banga. You crashed into a clay pot.',
  manok: 'Tinuka ng tandang. You ran into the rooster.',
  sarili: 'Nakagat mo ang sarili mo. You bit your own tail.',
};

let mode = 'title', game = null, demo = createGame({ seed: randomSeed() }), readyT = 0, overAt = 0, think = true, lastBeat = -1, newMedals = [];

function show(name) {
  for (const id of ['title', 'pause', 'over', 'medals']) $(id).hidden = id !== name;
  $('pause-btn').hidden = name !== null;
  document.body.classList.toggle('playing', name === null);
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
}

function start() {
  A.start();
  const m = data.mode;
  game = createGame({ seed: m === 'daily' && !(TEST && Q.get('seed')) ? today() : randomSeed(), mode: m });
  R.reset();
  readyT = 1.1; think = true; lastBeat = -1; newMedals = [];
  setFestival(1);
  mode = 'play';
  show(null);
  hint('turn', matchMedia('(pointer: coarse)').matches ? 'Swipe anywhere, or use the d-pad, to turn.' : 'Turn with the arrow keys or WASD.');
}

function record(g) {
  if (g.mode === 'daily') {
    if (data.daily.day !== today()) data.daily = { day: today(), best: 0 };
    const isBest = g.score > data.daily.best;
    if (isBest) data.daily.best = g.score;
    return isBest && g.score > 0;
  }
  const list = data.scores[g.mode];
  const isBest = g.score > (list[0]?.score || 0);
  list.push({ score: g.score, len: g.snake.length, day: today() });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 5);
  return isBest && g.score > 0;
}

function gameOver() {
  mode = 'over';
  const g = game;
  const isBest = record(g);
  checkMedals(g);
  persist();
  $('over-cause').textContent = CAUSE[g.deathBy] || CAUSE.sarili;
  $('over-score').textContent = g.score;
  $('over-best').textContent = isBest ? 'Bagong best! New best!' : `Best${g.mode === 'daily' ? ' today' : ''}: ${bestFor(g.mode)}`;
  $('over-best').classList.toggle('new', isBest);
  const eaten = Object.entries(g.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${FOODS[k].name} ×${n}`).join(' · ');
  $('over-stats').textContent = [MODES[g.mode], `Barangay ${g.level}`, `Haba ${g.snake.length}`, `best combo ${g.bestCombo}`, g.cuts ? `naipit ${g.cuts}×` : null, g.pecks ? `naunahan ${g.pecks}×` : null].filter(Boolean).join(' · ');
  $('over-food').textContent = eaten || 'Walang nakain. Nothing eaten, gutom pa!';
  $('over-medals').textContent = newMedals.length ? `Bagong medalya: ${newMedals.map((id) => MEDALS.find((m) => m.id === id).name).join(', ')}` : '';
  $('over-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  renderBoard($('over-top'), g.mode, g.score);
  $('share').textContent = 'I-share · Share';
  show('over');
}

function renderBoard(el, m, highlight) {
  el.innerHTML = '';
  if (m === 'daily') { el.hidden = true; return; }
  el.hidden = !data.scores[m].length;
  data.scores[m].forEach((r, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${r.score}${r.len ? ` · haba ${r.len}` : ''}`;
    if (r.score === highlight && r.day === today()) li.className = 'me';
    el.appendChild(li);
  });
}

// Medals can unlock mid-game; each shows a toast once.
function checkMedals(g) {
  for (const id of earned(g)) {
    if (data.medals.includes(id)) continue;
    data.medals.push(id); newMedals.push(id);
    const m = MEDALS.find((x) => x.id === id);
    toast(`🏅 ${m.name}: ${m.desc}`);
    A.medal();
    persist();
  }
}
// Toasts queue up, so a medal and a hint never overwrite each other.
const toasts = [];
let toastBusy = false;
function toast(text, ms = 2600) {
  toasts.push([text, ms]);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const el = $('toast');
  const item = toasts.shift();
  toastBusy = !!item;
  if (!item) { el.hidden = true; return; }
  el.textContent = item[0]; el.hidden = false;
  setTimeout(nextToast, item[1]);
}
// First-game hints, each shown once ever.
function hint(id, text) {
  if (data.hints.includes(id) || AUTOPLAY) return;
  data.hints.push(id); persist();
  toast(text, 3400);
}

function renderMedals() {
  const box = $('medal-list');
  box.innerHTML = '';
  for (const m of MEDALS) {
    const got = data.medals.includes(m.id);
    const li = document.createElement('li');
    li.className = got ? 'got' : '';
    li.innerHTML = '<b></b><span></span>';
    li.querySelector('b').textContent = `${got ? '🏅' : '🔒'} ${m.name}`;
    li.querySelector('span').textContent = m.desc;
    box.appendChild(li);
  }
  $('medal-count').textContent = `${data.medals.length} of ${MEDALS.length}`;
}

async function share() {
  const g = game;
  if (!g) return;
  const day = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const text = `🐍 Ahas sa Fiesta · ${MODES[g.mode]}${g.mode === 'daily' ? ` ${day}` : ''}\nPuntos ${g.score} · Barangay ${g.level} · Haba ${g.snake.length}\n${location.origin}${location.pathname}`;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); $('share').textContent = 'Nakopya! Copied'; }
  } catch { $('share').textContent = 'Hindi ma-share'; }
}

function onEvent(e) {
  R.event(e, game);
  switch (e.type) {
    case 'eat': A.eat(e.combo, !!FOODS[e.food].special); buzz(12); checkMedals(game); hint('eat', 'Sarap! Every meal makes you longer. Eat fast for a combo.'); break;
    case 'spawn': A.spawn(!!e.special); if (e.special) hint('special', 'Special food! Grab it before its timer ring runs out.'); break;
    case 'pole': hint('pole', 'Red line! Get your head out before the tinikling poles clap.'); break;
    case 'expire': A.expire(); break;
    case 'clap': A.clap(); buzz(30); checkMedals(game); break;
    case 'cut': A.cut(); buzz(60); break;
    case 'level': setFestival(e.level); A.level(); buzz([20, 40, 20]); checkMedals(game); hint('level', 'New barangay, new festival, and more banga pots in the way.'); break;
    case 'rooster': A.crow(); hint('rooster', 'The tandang steals your food. Beat him to it, and never bump him.'); break;
    case 'peck': A.peck(); break;
    case 'shield': A.shield(); buzz(50); checkMedals(game); break;
    case 'die': A.die(); buzz([80, 40, 140]); overAt = performance.now() + 1100; break;
    case 'move': think = true; break;
    default: break;
  }
}

// The page behind the board takes on the festival's color.
const setFestival = (level) => document.body.style.setProperty('--accent', festival(level).accent);

function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; show(null); } }
function toMenu() { mode = 'title'; game = null; setFestival(1); show('title'); updateTitle(); }

// ---------- input ----------
function steer(d) {
  if (mode !== 'play' || !game || !game.alive) return;
  if (turn(game, d)) A.turn();
}
const KEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (KEYS[k] && mode === 'play') { e.preventDefault(); steer(DIR[KEYS[k]]); return; }
  if ((k === ' ' || k === 'Enter') && (mode === 'title' || mode === 'over') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); start(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); else if (mode === 'medals') toMenu(); }
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

function toggleSound() { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); soundLabel(); }
function toggleMusic() { A.start(); data.music = !data.music; A.setMusic(data.music); persist(); soundLabel(); }
const soundLabel = () => {
  for (const b of document.querySelectorAll('.sound')) { b.textContent = data.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', data.muted ? 'Tunog: off, turn sound on' : 'Tunog: on, turn sound off'); b.title = 'Tunog · Sound (M)'; }
  for (const b of document.querySelectorAll('.music')) { b.textContent = '🎵'; b.classList.toggle('off', !data.music); b.setAttribute('aria-label', data.music ? 'Musika: on, turn music off' : 'Musika: off, turn music on'); b.title = 'Musika · Music'; }
};
soundLabel();
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('.music')) b.onclick = toggleMusic;
for (const b of document.querySelectorAll('.play')) b.onclick = start;
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { data.mode = b.dataset.mode; persist(); updateTitle(); };
$('resume').onclick = resume;
$('pause-btn').onclick = pause;
$('menu').onclick = toMenu;
$('quit').onclick = toMenu;
$('share').onclick = share;
$('open-medals').onclick = () => { renderMedals(); mode = 'medals'; show('medals'); };
$('close-medals').onclick = toMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function updateTitle() {
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === data.mode));
  const d = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  $('daily-label').textContent = `Araw-araw · ${d}`;
  const b = bestFor(data.mode);
  $('title-best').textContent = { klasiko: 'The frame is a wall.', walangpader: 'No walls: slip out one side, in the other.', daily: 'Everyone gets the same board today.' }[data.mode] + (b ? ` Best${data.mode === 'daily' ? ' today' : ''}: ${b}` : '');
  $('open-medals').textContent = `Medalya ${data.medals.length}/${MEDALS.length}`;
}
updateTitle();

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
    } else if ((demoWait += dt) > 1.5) { demoWait = 0; demo = createGame({ seed: randomSeed() }); }
  }
  const view = game || demo;
  R.draw(view, t, { reduced: reduced(), best: bestFor(view.mode), hudOn: !!game });
  const ready = !!game && mode === 'play' && readyT > 0;
  $('ready').hidden = !ready;
  if (ready) $('ready').textContent = readyT > 0.45 ? 'Handa…' : 'Laro na!';
  A.set(mode === 'play' && !!game?.alive, game ? Math.min(1.8, BASE_INTERVAL / interval(game)) : 1);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', R.resize);
// installable and playable offline; skipped in tests so headless runs always load fresh files
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });
R.resize();
show('title');
requestAnimationFrame(frame);

if (TEST) {
  window.__ahas = { get game() { return game; }, get mode() { return mode; }, start, setMode(m) { data.mode = m; updateTitle(); } };
  if (Q.get('mode')) data.mode = Q.get('mode');
  if (Q.get('go') === '1') start();
}
