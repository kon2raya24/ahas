// The page: screens, modes, input (keys, swipes, the d-pad, a gamepad), the loop, sound, scores,
// medals, settings and sharing. The rules live in game.mjs; the plaza is drawn in 3D by view3d.mjs, or
// by the 2D render.mjs if WebGL won't start.
import { createGame, step, turn, interval, FOODS, BASE_INTERVAL, MODES, dailySeed } from './game.mjs';
import { bot } from './bot.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';
import { MEDALS, earned } from './medals.mjs';
import { festival } from './festivals.mjs';
import { lookOf } from './look.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const touch = matchMedia('(pointer: coarse)').matches;
const DCAM = TEST && Q.get('dcam') ? Q.get('dcam').split(',').map(Number) : null; // a fixed camera for close-up checks
const KEY = 'ahas.v1';
const store = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: play on */ } },
};
// Saves from v1 only had { best, muted }; the old best becomes the first Klasiko score. The 3D version
// adds settings (graphics, volumes, calm, camera, grid) with defaults, so older saves carry over.
const saved = store.get() || {};
const data = {
  muted: !!saved.muted,
  mode: MODES[saved.mode] ? saved.mode : 'klasiko',
  scores: { klasiko: [], walangpader: [], ...(saved.scores || {}) },
  daily: saved.daily || { day: 0, best: 0 },
  medals: Array.isArray(saved.medals) ? saved.medals : [],
  music: saved.music !== false,
  hints: Array.isArray(saved.hints) ? saved.hints : [],
  how: !!saved.how,
  opt: { gfx: 'auto', vmusic: 1, vsfx: 1, calm: false, cam: 'tilt', grid: 'soft', ...(saved.opt || {}) },
};
if (!saved.scores && Number(saved.best) > 0) data.scores.klasiko.push({ score: Number(saved.best), len: 0, day: 0 });
const persist = () => store.set(data);
const today = () => dailySeed(new Date());
const bestFor = (m) => (m === 'daily' ? (data.daily.day === today() ? data.daily.best : 0) : data.scores[m][0]?.score || 0);
const reduced = () => data.opt.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const randomSeed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const buzz = (p) => { try { if (navigator.vibrate && touch) navigator.vibrate(p); } catch { /* no haptics */ } };
const $ = (id) => document.getElementById(id);

const A = createAudio();
A.setMuted(data.muted); A.setMusic(data.music); A.setMix({ music: data.opt.vmusic, sfx: data.opt.vsfx });

// ---------- the view: 3D, or the 2D board if WebGL won't start ----------
let V = null, R = null;
async function makeView() {
  if (Q.get('flat') !== '1') {
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
      const { createView } = await import('./view3d.mjs');
      const g = Q.get('gfx') ?? (data.opt.gfx === 'auto' ? null : String(data.opt.gfx));
      V = createView($('view'), { low: touch, gfx: g, onBite });
      return;
    } catch (err) { console.warn('3D view unavailable, using the 2D board', err); V = null; }
  }
  document.body.classList.add('flat');
  R = createRenderer($('board'));
  R.resize();
}

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
  'The snake glances where you steer: two quick turns are both kept.',
];
const CAUSE = {
  kawayan: 'Naipit ng kawayan. The tinikling got you.',
  pader: 'Bangga sa pader. You hit the frame.',
  banga: 'Basag ang banga. You crashed into a clay pot.',
  manok: 'Tinuka ng tandang. You ran into the rooster.',
  sarili: 'Nakagat mo ang sarili mo. You bit your own tail.',
};
const SCREENS = ['title', 'how', 'pause', 'over', 'medals', 'settings'];

let mode = 'title', game = null, demo = createGame({ seed: randomSeed() }), readyT = 0, holdT = 0, overAt = 0, think = true, lastBeat = -1, newMedals = [];

function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  document.body.classList.toggle('playing', name === null);
  document.body.classList.toggle('menu-open', name !== null && name !== 'title');
  $('hud').hidden = !(name === null || name === 'pause');
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
}

function start() {
  A.start();
  if (!data.how && !TEST) { mode = 'how'; show('how'); return; }
  const m = data.mode;
  const again = !!game || mode === 'over';
  game = createGame({ seed: m === 'daily' && !(TEST && Q.get('seed')) ? today() : randomSeed(), mode: m });
  if (V) V.reset(game); else R.reset();
  holdT = V ? V.intro(again ? 'replay' : 'start') : 0;
  if (reduced() && V) { V.skip(); holdT = 0.2; }
  readyT = 1.0; think = true; lastBeat = -1; newMedals = [];
  setFestival(1);
  mode = 'play';
  show(null);
  hud(true);
  hint('turn', touch ? 'Swipe anywhere, or use the d-pad, to turn.' : 'Turn with the arrow keys or WASD. A gamepad works too.');
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

function medalsHTML(fresh = []) {
  return MEDALS.map((m, i) => `<div class="medal${data.medals.includes(m.id) ? ' got' : ''}${fresh.includes(m.id) ? ' fresh' : ''}"><i>${i + 1}</i><b>${m.name}</b><small>${m.desc}</small></div>`).join('');
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
  $('over-best').classList.toggle('best', isBest);
  const eaten = Object.entries(g.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${FOODS[k].name} ×${n}`).join(' · ');
  const stats = [[MODES[g.mode], ''], ['Barangay', g.level], [festival(g.level).name, ''], ['Haba', g.snake.length], ['Combo', g.bestCombo], g.cuts ? ['Naipit', `${g.cuts}×`] : null, g.pecks ? ['Naunahan', `${g.pecks}×`] : null].filter(Boolean);
  $('over-stats').innerHTML = stats.map(([k, v]) => `<li>${k}${v !== '' ? ` <b>${v}</b>` : ''}</li>`).join('');
  $('over-food').textContent = eaten || 'Walang nakain. Nothing eaten, gutom pa!';
  $('over-medal-count').textContent = `Medalya ${data.medals.length}/${MEDALS.length}${newMedals.length ? ` · ${newMedals.length} bago!` : ''}`;
  $('over-medals').innerHTML = medalsHTML(newMedals);
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

// Medals can unlock mid-game; each shows a card once.
function checkMedals(g) {
  for (const id of earned(g)) {
    if (data.medals.includes(id)) continue;
    data.medals.push(id); newMedals.push(id);
    const i = MEDALS.findIndex((x) => x.id === id), m = MEDALS[i];
    toast({ medal: i + 1, title: m.name, text: m.desc });
    A.medal();
    persist();
  }
}
// Toasts queue up, so a medal and a hint never overwrite each other.
const toasts = [];
let toastBusy = false;
function toast(item, ms = 2800) { toasts.push([item, ms]); if (!toastBusy) nextToast(); }
function nextToast() {
  const el = $('toast');
  const next = toasts.shift();
  toastBusy = !!next;
  if (!next) { el.hidden = true; return; }
  const [it] = next;
  el.className = it.medal ? '' : 'hint';
  el.innerHTML = it.medal ? `<i>${it.medal}</i><div><small>BAGONG MEDALYA</small><b></b><span></span></div>` : '<div><span></span></div>';
  if (it.medal) { el.querySelector('b').textContent = it.title; el.querySelector('span').textContent = it.text; } else el.querySelector('span').textContent = it.text;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  setTimeout(nextToast, next[1]);
}
// First-game hints, each shown once ever.
function hint(id, text) {
  if (data.hints.includes(id) || AUTOPLAY) return;
  data.hints.push(id); persist();
  toast({ text }, 3600);
}
// The big lettering over the play: "Handa…", "Barangay 2 · Pahiyas".
let bannerT = 0;
function banner(html, secs = 1.4) { const b = $('banner'); b.innerHTML = html; b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); bannerT = secs; }

function renderMedals() {
  $('medal-list').innerHTML = medalsHTML();
  $('medal-count').textContent = `${data.medals.length} of ${MEDALS.length}`;
}

async function share() {
  const g = game;
  if (!g) return;
  const day = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const text = `🐍 Ahas sa Fiesta · ${MODES[g.mode]}${g.mode === 'daily' ? ` ${day}` : ''}\nPuntos ${g.score} · Barangay ${g.level} (${festival(g.level).name}) · Haba ${g.snake.length}\n${location.origin}${location.pathname}`;
  try {
    if (navigator.share && touch) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); $('share').textContent = 'Nakopya! Copied'; }
  } catch { $('share').textContent = 'Hindi ma-share'; }
}

// the bite: in 3D it lands when the head reaches the food, so the sound waits for it
function onBite(e) { A.eat(e.combo, !!FOODS[e.food].special); buzz(12); }
function onEvent(e) {
  if (V) V.event(e, game); else R.event(e, game);
  switch (e.type) {
    case 'eat': if (!V) onBite(e); checkMedals(game); hint('eat', 'Sarap! Every meal makes you longer. Eat fast for a combo.'); bumpScore(); break;
    case 'spawn': A.spawn(!!e.special); if (e.special) hint('special', 'Special food! Grab it before its ring of light runs out.'); break;
    case 'pole': hint('pole', 'Red line! Get your head out before the tinikling poles clap.'); break;
    case 'expire': A.expire(); break;
    case 'clap': A.clap(); buzz(30); checkMedals(game); break;
    case 'cut': A.cut(); buzz(60); bumpScore(); break;
    case 'level': levelUp(e); break;
    case 'rooster': A.crow(); hint('rooster', 'The tandang steals your food. Beat him to it, and never bump him.'); break;
    case 'peck': A.peck(); break;
    case 'shield': A.shield(); buzz(50); checkMedals(game); break;
    case 'die': A.die(); buzz([80, 40, 140]); overAt = performance.now() + 1500; break;
    case 'move': think = true; break;
    default: break;
  }
}
function levelUp(e) {
  const f = festival(e.level), L = lookOf(f.name);
  A.level(); buzz([20, 40, 20]); checkMedals(game);
  if (V) { holdT = V.levelShot(e.level, reduced()); readyT = 0.55; setTimeout(() => A.pot(), (reduced() ? 0.3 : 1.1) * 1000 + 450); } else setFestival(e.level);
  banner(`<small>Barangay ${e.level}</small><b class="gold">${f.name}</b><span>${f.place} · ${L.time}</span>`, reduced() ? 1.4 : 2.3);
  hint('level', 'New barangay, new festival, and more banga pots in the way.');
  setFestival(e.level);
}

// The page behind the 2D board takes on the festival's colour; the HUD names it.
function setFestival(level) {
  const f = festival(level);
  document.body.style.setProperty('--accent', f.accent);
  $('fest').textContent = f.name; $('fest-place').textContent = `Barangay ${level}`;
}
let shownScore = 0;
function bumpScore() { const s = $('score'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
function hud(resetScore = false) {
  const g = game;
  if (!g) return;
  if (resetScore) shownScore = 0;
  shownScore = g.score < shownScore ? g.score : Math.min(g.score, shownScore + Math.max(1, (g.score - shownScore) * 0.2));
  $('score').textContent = Math.round(shownScore);
  $('best').textContent = Math.max(bestFor(g.mode), g.score);
  $('mode-label').textContent = `${MODES[g.mode]} · best`;
  const chips = [];
  if (g.alive) {
    if (g.effects.balut > 0) chips.push(['Balut ×2', '#fcd116', g.effects.balut / FOODS.balut.dur]);
    if (g.effects.sili > 0) chips.push(['Sili ×2 bilis', '#ff4d4d', g.effects.sili / FOODS.sili.dur]);
    if (g.effects.halo > 0) chips.push(['Halo-halo bagal', '#8fd3ff', g.effects.halo / FOODS.halohalo.dur]);
    if (g.shield) chips.push(['Anting-anting', '#ffe070', 1]);
    if (g.combo >= 2) { const m = Math.min(4, 1 + Math.floor((g.combo - 1) / 2)); chips.push([`Sunod-sunod ${g.combo}${m > 1 ? ` ×${m}` : ''}`, '#ff8ae2', Math.max(0, 1 - (g.t - g.lastEat) / 2.5)]); }
  }
  const box = $('fx-chips'), key = chips.map((c) => c[0]).join('|');
  if (box.dataset.key !== key) { box.dataset.key = key; box.innerHTML = chips.map(([l, c]) => `<div class="eff" style="--c:${c}"><i></i><span>${l}</span></div>`).join(''); }
  [...box.children].forEach((el, i) => { el.firstChild.style.width = `${Math.round(chips[i][2] * 100)}%`; });
}

function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; show(null); } }
function toMenu() { mode = 'title'; game = null; setFestival(1); if (V) V.reset(null); show('title'); updateTitle(); }

// ---------- settings ----------
let settingsFrom = 'title';
function openSettings(from = settingsFrom, again = null) {
  settingsFrom = from; mode = 'settings';
  const o = data.opt;
  const seg = (key, list) => `<div class="modes">${list.map(([v, label]) => `<button type="button" data-k="${key}" data-v="${v}" aria-pressed="${String(o[key]) === String(v)}">${label}</button>`).join('')}</div>`;
  $('settings-body').innerHTML = `
    <div class="grp"><h3>Itsura · Look</h3>
    <p class="muted">Graphics</p>${seg('gfx', [['auto', 'Auto'], [2, 'Mataas · High'], [1, 'Katamtaman · Med'], [0, 'Mababa · Low']])}
    <p class="muted">Kamera · Camera</p>${seg('cam', [['tilt', 'Tagilid · 3D'], ['top', 'Itaas · Top-down']])}
    <p class="muted">Guhit ng grid · Grid lines</p>${seg('grid', [['soft', 'Banig lang · Weave'], ['strong', 'Malinaw · Strong']])}</div>
    <div class="grp"><h3>Tunog · Sound</h3>
    <label class="slide">Musika · Music <input type="range" min="0" max="1" step="0.05" data-k="vmusic" value="${o.vmusic}"></label>
    <label class="slide">Tunog · Effects <input type="range" min="0" max="1" step="0.05" data-k="vsfx" value="${o.vsfx}"></label>
    <p class="muted">Lahat ng tunog · All sound</p><div class="modes"><button type="button" data-k="mute" data-v="0" aria-pressed="${!data.muted}">Bukas · On</button><button type="button" data-k="mute" data-v="1" aria-pressed="${data.muted}">Patay · Off</button></div></div>
    <div class="grp"><h3>Galaw · Motion</h3>
    <p class="muted">Yanig ng kamera · Camera shake and flashes</p>${seg('calm', [[false, 'Buo · Full'], [true, 'Kalmado · Calm']])}
    <p class="muted">Calm also skips the camera swings between festivals.${matchMedia('(prefers-reduced-motion: reduce)').matches ? ' Your device asks for reduced motion, so it is on.' : ''}</p></div>`;
  for (const b of $('settings-body').querySelectorAll('button')) b.onclick = () => {
    const k = b.dataset.k, v = b.dataset.v;
    if (k === 'gfx') { o.gfx = v === 'auto' ? 'auto' : +v; if (V) { V.post.setAuto(o.gfx === 'auto'); V.post.setLevel(o.gfx === 'auto' ? (touch ? 1 : 2) : o.gfx); } }
    else if (k === 'calm') { o.calm = v === 'true'; document.body.classList.toggle('calm', o.calm); }
    else if (k === 'mute') { if ((v === '1') !== data.muted) toggleSound(); }
    else o[k] = v;
    persist(); openSettings(settingsFrom, `[data-k="${k}"][data-v="${v}"]`);
  };
  for (const r of $('settings-body').querySelectorAll('input[type=range]')) r.oninput = () => { o[r.dataset.k] = +r.value; A.start(); A.setMix({ music: o.vmusic, sfx: o.vsfx }); persist(); };
  show('settings');
  if (again && $('settings-body').querySelector(again)) $('settings-body').querySelector(again).focus({ preventScroll: true });
}
$('settings-ok').onclick = () => { if (settingsFrom === 'pause') { mode = 'pause'; show('pause'); } else { mode = 'title'; show('title'); } };
for (const b of document.querySelectorAll('.settings-btn')) b.onclick = () => openSettings(mode === 'pause' ? 'pause' : 'title');
document.body.classList.toggle('calm', !!data.opt.calm);

// ---------- input ----------
function steer(d) {
  if (mode !== 'play' || !game || !game.alive) return;
  if (V && V.holding()) V.skip();
  if (turn(game, d)) A.turn();
}
const KEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (KEYS[k] && mode === 'play') { e.preventDefault(); steer(DIR[KEYS[k]]); return; }
  if ((k === ' ' || k === 'Enter') && mode === 'play' && V && V.holding()) { e.preventDefault(); V.skip(); return; }
  if ((k === ' ' || k === 'Enter') && (mode === 'title' || mode === 'over') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); start(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); else if (mode === 'medals' || mode === 'how') toMenu(); else if (mode === 'settings') $('settings-ok').click(); }
  if (k === 'm' || k === 'M') toggleSound();
});
// swipes anywhere on the stage
let swipe = null;
const stage = $('stage');
stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY }; });
stage.addEventListener('pointermove', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) < 22) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR.right : DIR.left) : (dy > 0 ? DIR.down : DIR.up));
  swipe = { x: e.clientX, y: e.clientY };
});
for (const ev of ['pointerup', 'pointercancel']) stage.addEventListener(ev, () => { swipe = null; });
for (const b of document.querySelectorAll('[data-dir]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); steer(DIR[b.dataset.dir]); });
// a controller: the d-pad or left stick steers; ✕ / A starts and confirms; Options / Start pauses
const padState = { dir: null, a: false, start: false, b: false };
function readPad() {
  const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null;
  if (!p) return;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes || [];
  const x = (b(15) ? 1 : 0) - (b(14) ? 1 : 0) + (Math.abs(ax[0] || 0) > 0.5 ? Math.sign(ax[0]) : 0), y = (b(13) ? 1 : 0) - (b(12) ? 1 : 0) + (Math.abs(ax[1] || 0) > 0.5 ? Math.sign(ax[1]) : 0);
  const dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y ? (y > 0 ? 'down' : 'up') : null;
  if (dir && dir !== padState.dir) {
    if (mode === 'play') steer(DIR[dir]);
    else { // move between buttons on the menus
      const screen = SCREENS.find((id) => !$(id).hidden), list = screen ? [...$(screen).querySelectorAll('button, input')].filter((el) => el.offsetParent) : [];
      const i = list.indexOf(document.activeElement), n = list.length;
      if (n) { const d = dir === 'down' || dir === 'right' ? 1 : -1; if (document.activeElement?.type === 'range' && (dir === 'left' || dir === 'right')) { const r = document.activeElement; r.value = +r.value + d * 0.1; r.oninput(); } else list[(i + d + n) % n].focus(); }
    }
  }
  padState.dir = dir;
  const a = b(0), st = b(9), back = b(1);
  if (a && !padState.a) { if (mode === 'play' && V && V.holding()) V.skip(); else if (document.activeElement?.tagName === 'BUTTON') document.activeElement.click(); else if (mode === 'title' || mode === 'over') start(); }
  if (st && !padState.start) { if (mode === 'play') pause(); else if (mode === 'pause') resume(); else if (mode === 'title' || mode === 'over') start(); }
  if (back && !padState.b) { if (mode === 'pause') resume(); else if (mode === 'settings') $('settings-ok').click(); else if (mode === 'medals' || mode === 'how') toMenu(); }
  padState.a = a; padState.start = st; padState.b = back;
}

function toggleSound() { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); soundLabel(); }
const soundLabel = () => {
  for (const b of document.querySelectorAll('.sound')) { b.textContent = data.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', data.muted ? 'Tunog: off, turn sound on' : 'Tunog: on, turn sound off'); b.title = 'Tunog · Sound (M)'; }
};
soundLabel();
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('.play')) b.onclick = start;
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { data.mode = b.dataset.mode; persist(); updateTitle(); };
$('resume').onclick = resume;
$('pause-btn').onclick = pause;
$('menu').onclick = toMenu;
$('quit').onclick = toMenu;
$('share').onclick = share;
$('how-btn').onclick = () => { mode = 'how'; show('how'); };
$('how-ok').onclick = () => { const first = !data.how; data.how = true; persist(); if (first) start(); else toMenu(); };
$('open-medals').onclick = () => { renderMedals(); mode = 'medals'; show('medals'); };
$('close-medals').onclick = toMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function updateTitle() {
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === data.mode));
  const d = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  $('daily-label').textContent = `Araw-araw · ${d}`;
  const b = bestFor(data.mode);
  $('title-best').textContent = { klasiko: 'The bamboo frame is a wall.', walangpader: 'No walls: slip out one side, in the other.', daily: 'Everyone gets the same board today.' }[data.mode] + (b ? ` Best${data.mode === 'daily' ? ' today' : ''}: ${b}` : '');
  $('open-medals').textContent = `Medalya ${data.medals.length}/${MEDALS.length}`;
}
updateTitle();

// Where the board may sit: below the HUD, above the d-pad.
function safeArea() {
  const w = innerWidth, h = innerHeight, portrait = h > w;
  const playing = mode === 'play' || mode === 'pause';
  let top = playing || mode === 'over' ? (w < 560 ? 58 : 66) : 20, bottom = 14, left = 8, right = 8;
  if (touch && playing) { if (portrait) bottom = 150; else right = 220; }
  if (w < 560 && playing) bottom = Math.max(bottom, touch ? 186 : 44); // the effect chips sit under the board on phones
  return { top, bottom, left, right };
}

// ---------- loop ----------
let last = performance.now(), t = 0, demoWait = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  readPad();
  if (game && mode === 'play') {
    if (holdT > 0) { holdT -= dt; if (V && !V.holding() && holdT > 0.05) holdT = 0.05; }
    else if (readyT > 0) readyT -= dt;
    else {
      if (AUTOPLAY && think && !game.queue.length) { const d = bot(game); if (d) turn(game, d); think = false; }
      for (const e of step(game, dt)) onEvent(e);
      // tinikling taps on the beat while the poles warn
      if (game.pole && game.pole.warn > 0) { const b = Math.floor(game.pole.warn / 0.4); if (b !== lastBeat) { lastBeat = b; A.tap(); } } else lastBeat = -1;
    }
    if (holdT <= 0 && readyT > 0 && game.alive && bannerT <= 0.2) { if (!$('banner').dataset.ready) { $('banner').dataset.ready = '1'; banner(`<b class="gold">${readyT > 0.5 ? 'Handa…' : 'Laro na!'}</b>`, readyT + 0.35); } }
    if (readyT <= 0) delete $('banner').dataset.ready;
    if (!game.alive && now > overAt && overAt) { overAt = 0; gameOver(); }
    hud();
  } else if (!game) {
    if (demo.alive) {
      if (!demo.queue.length) { const d = bot(demo); if (d) turn(demo, d); }
      for (const e of step(demo, dt)) { if (V) V.event(e, demo); else R.event(e, demo); }
    } else if ((demoWait += dt) > 1.5) { demoWait = 0; demo = createGame({ seed: randomSeed() }); if (V) V.reset(null); }
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').hidden = true; }
  const view = game || demo;
  if (V) V.frame(view, dt, { mode: game ? mode : mode === 'title' ? 'title' : mode, reduced: reduced(), camStyle: data.opt.cam, grid: data.opt.grid, safe: safeArea(), ready: readyT, debugCam: DCAM });
  else R.draw(view, t, { reduced: reduced(), best: bestFor(view.mode), hudOn: !!game });
  A.set(mode === 'play' && !!game?.alive, game ? Math.min(1.8, BASE_INTERVAL / interval(game)) : 1);
  requestAnimationFrame(frame);
}

async function boot() {
  try { await Promise.race([document.fonts.load('italic 900 34px "Barlow Condensed"'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* system fonts, then */ }
  await makeView();
  window.addEventListener('resize', () => (V ? V.resize() : R.resize()));
  if (V) new ResizeObserver(() => V.resize()).observe($('view'));
  // the photographed skies, scanned surfaces and real props load in the background; a bar shows it
  if (V && Q.get('env') !== '0') {
    const bar = $('loading'), pct = $('load-pct');
    bar.hidden = false; bar.style.setProperty('--p', '10%'); pct.textContent = '10%';
    import('./envpack.mjs').then(({ loadEnv }) => loadEnv(Q.get('envbase') || 'assets/env/')).then((env) => {
      V.setEnv(env, (f) => { pct.textContent = `${Math.round(f * 100)}%`; bar.style.setProperty('--p', `${Math.round(f * 100)}%`); });
      let k = 10; const tick = setInterval(() => { k = Math.min(100, k + 15); pct.textContent = `${k}%`; bar.style.setProperty('--p', `${k}%`); if (k >= 100) { clearInterval(tick); bar.classList.add('done'); setTimeout(() => { bar.hidden = true; }, 700); } }, 250);
    }).catch(() => { bar.hidden = true; });
  }
  show('title');
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
  setTimeout(() => $('fade').classList.add('gone'), 60);
  if (TEST) {
    window.__ahas = { get game() { return game; }, get mode() { return mode; }, start, setMode(m) { data.mode = m; updateTitle(); }, get view() { return V; }, get flat() { return !V; }, data, pause, resume, openSettings, toMenu,
      // fast-forward the game with the bot (for headless checks): events still reach the view
      ff(sec, quiet = true) { const g = game; holdT = 0; readyT = 0; if (V) V.skip(); for (let i = 0; i < sec * 60 && g.alive; i++) { if (!g.queue.length) { const d = bot(g); if (d) turn(g, d); } for (const e of step(g, 1 / 60)) { if (quiet && (e.type === 'level' || e.type === 'die')) { if (e.type === 'level') setFestival(e.level); if (V) V.setFestival(e.level); continue; } onEvent(e); } } return { t: g.t, score: g.score, len: g.snake.length, level: g.level, alive: g.alive }; } };
    if (Q.get('mode')) data.mode = Q.get('mode');
    if (Q.get('go') === '1') { data.how = true; start(); }
  }
}
// installable and playable offline; skipped in tests so headless runs always load fresh files
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });
boot();
