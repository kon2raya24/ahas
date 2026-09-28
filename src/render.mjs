// Draws the fiesta: a banig mat in a bamboo frame, the snake in flag colors with a salakot, street
// food, the tinikling poles, and the juice (confetti, popups, shake). Reads the game state only.
import { FOODS, progress, COMBO_WINDOW, comboMult } from './game.mjs';
import { festival } from './festivals.mjs';

export const W = 600, H = 708;
const CELL = 27, N = 20, BX = 30, BY = 114, BOARD = CELL * N;
const cx = (x) => BX + x * CELL + CELL / 2, cy = (y) => BY + y * CELL + CELL / 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const FLAG = ['#ce1126', '#fcd116', '#0038a8', '#f4f1e8'];
const FIESTA = ['#ce1126', '#fcd116', '#0038a8', '#ff6fb5', '#2ec4b6', '#ff9f1c', '#f4f1e8'];
const YUM = ['SARAP!', 'Ang sarap!', 'Busog!', 'Yum!', 'Solb!', 'Lodi!'];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const mats = new Map(); // one painted banig per festival
  const matFor = (f) => { if (!mats.has(f.name)) mats.set(f.name, paintMat(f)); return mats.get(f.name); };
  const bulges = []; // a lump that travels down the body after each meal
  const parts = [], popups = [];
  let shake = 0, flash = 0, flashColor = '235,111,146', lastT = null, shownScore = 0, deathT = -1, reducedNow = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }

  // ---------- the banig, painted once ----------
  function paintMat(fest) {
    const c = document.createElement('canvas');
    c.width = BOARD; c.height = BOARD;
    const m = c.getContext('2d');
    m.fillStyle = '#e8d2a6'; m.fillRect(0, 0, BOARD, BOARD);
    // over-under weave: 9 px strips, shaded by which strand is on top
    const s = 9;
    for (let y = 0; y < BOARD; y += s) for (let x = 0; x < BOARD; x += s) {
      const over = ((x / s) + (y / s)) % 2 === 0;
      m.fillStyle = over ? 'rgba(255,245,220,0.35)' : 'rgba(120,80,40,0.12)';
      m.fillRect(x, y, s, s);
      m.fillStyle = 'rgba(90,60,30,0.12)';
      if (over) m.fillRect(x, y + s - 1, s, 1); else m.fillRect(x + s - 1, y, 1, s);
    }
    // woven colored bands and diamonds, soft so the snake stays readable
    const bands = fest.bands.map((c, i) => [c, 2 + i * 5]);
    for (const [col, k] of bands) {
      m.fillStyle = col; m.globalAlpha = 0.24;
      m.fillRect(0, k * CELL + 9, BOARD, 9); m.fillRect(k * CELL + 9, 0, 9, BOARD);
    }
    m.globalAlpha = 0.14;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = (i * 5 + 2.5) * CELL, y = (j * 5 + 2.5) * CELL;
      m.fillStyle = (i + j) % 2 ? '#6a1b9a' : '#d84315';
      m.beginPath(); m.moveTo(x, y - 30); m.lineTo(x + 30, y); m.lineTo(x, y + 30); m.lineTo(x - 30, y); m.closePath(); m.fill();
      m.fillStyle = '#fff8e1'; m.beginPath(); m.moveTo(x, y - 12); m.lineTo(x + 12, y); m.lineTo(x, y + 12); m.lineTo(x - 12, y); m.closePath(); m.fill();
    }
    m.globalAlpha = 1;
    // faint cell checker so the grid can be read at speed
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) { m.fillStyle = 'rgba(60,30,10,0.06)'; m.fillRect(x * CELL, y * CELL, CELL, CELL); }
    if (fest.tint) { m.fillStyle = fest.tint; m.fillRect(0, 0, BOARD, BOARD); }
    return c;
  }

  // ---------- juice ----------
  const emit = (p) => { if (parts.length < 600) parts.push({ g: 0, rot: 0, vr: 0, ...p, max: p.life }); };
  const popup = (text, x, y, color, size = 20) => popups.push({ text, x, y, color, size, life: 1, max: 1 });
  function confetti(x, y, n, colors = FIESTA, power = 180) {
    for (let i = 0; i < n * (reducedNow ? 0.3 : 1); i++) {
      const a = Math.random() * Math.PI * 2, v = power * (0.4 + Math.random());
      emit({ kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 380, life: 0.8 + Math.random() * 0.6, color: pick(colors), size: 3 + Math.random() * 3, vr: (Math.random() - 0.5) * 20 });
    }
  }

  function event(e, g) {
    switch (e.type) {
      case 'eat': {
        bulges.push({ pos: 0 });
        const x = cx(e.x), y = cy(e.y);
        const special = FOODS[e.food].special;
        confetti(x, y, special ? 40 : 16, special ? FIESTA : ['#fcd116', '#ff9f1c', '#f4f1e8', '#ce1126']);
        popup(`+${e.points}`, x, y - 16, e.mult > 1 ? '#fcd116' : '#fff8e1', 18 + Math.min(12, e.mult * 3));
        if (e.food === 'balut') popup('SUWERTE! ×2', x, y - 44, '#fcd116', 22);
        else if (e.food === 'sili') { popup('ANGHANG! ×2', x, y - 44, '#ff4d4d', 22); flashColor = '255,80,40'; flash = 0.5; }
        else if (e.food === 'halohalo') { popup('BRAIN FREEZE!', x, y - 44, '#9ad7ff', 22); flashColor = '150,210,255'; flash = 0.5; }
        else if (e.combo >= 3) popup(pick(YUM), x, y - 44, '#ff6fb5', 18);
        shake = Math.max(shake, special ? 5 : 2);
        break;
      }
      case 'spawn':
        for (let i = 0; i < (e.special ? 14 : 6); i++) { const a = (i / (e.special ? 14 : 6)) * Math.PI * 2; emit({ kind: 'spark', x: cx(e.x), y: cy(e.y), vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.4, color: e.special ? '#fcd116' : '#fff8e1', size: 2 }); }
        break;
      case 'expire':
        for (let i = 0; i < 8; i++) emit({ kind: 'smoke', x: cx(e.x), y: cy(e.y), vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 0.7, color: '120,100,90', size: 5 });
        popup('Sayang!', cx(e.x), cy(e.y) - 14, '#d7c4a3', 16);
        break;
      case 'clap': {
        const along = e.axis === 'row';
        for (let k = 0; k < 16; k++) emit({ kind: 'chip', x: along ? BX + Math.random() * BOARD : cx(e.index), y: along ? cy(e.index) : BY + Math.random() * BOARD, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 180, g: 500, life: 0.6, color: '#c8a15a', size: 3 });
        popup('KLAK!', along ? W / 2 : cx(e.index), along ? cy(e.index) - 18 : BY + BOARD / 2, '#fff8e1', 26);
        shake = Math.max(shake, 6);
        break;
      }
      case 'cut':
        popup(`NAIPIT! −${e.lost * 5}`, W / 2, BY + 40, '#ff6b6b', 24);
        flashColor = '235,111,146'; flash = 0.6;
        break;
      case 'level': {
        const f = festival(e.level);
        popup(`BARANGAY ${e.level}!`, W / 2, BY + BOARD / 2 - 52, '#fcd116', 38);
        popup(`${f.name.toUpperCase()}!`, W / 2, BY + BOARD / 2 - 12, f.flags[0] === '#212121' ? '#ffb300' : f.flags[0], 32);
        popup(f.place, W / 2, BY + BOARD / 2 + 16, '#fff8e1', 18);
        for (let k = 0; k < 5; k++) confetti(BX + (k + 0.5) * BOARD / 5, BY + 10, 18, f.flags, 220);
        for (const p of e.pots) for (let i = 0; i < 10; i++) emit({ kind: 'smoke', x: cx(p.x), y: cy(p.y), vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 40, life: 0.6, color: '170,120,80', size: 5 });
        shake = Math.max(shake, 5);
        break;
      }
      case 'rooster':
        popup('Tiktilaok!', cx(e.x), cy(e.y) - 18, '#ffb36b', 20);
        break;
      case 'peck':
        for (let i = 0; i < 10; i++) emit({ kind: 'feather', x: cx(e.x), y: cy(e.y), vx: (Math.random() - 0.5) * 80, vy: -30 - Math.random() * 60, g: 60, life: 1, color: pick(['#c0392b', '#e67e22', '#1e8449', '#f4f1e8']), size: 3, vr: (Math.random() - 0.5) * 8 });
        popup('Naunahan ka!', cx(e.x), cy(e.y) - 16, '#ffb36b', 18);
        break;
      case 'shield': {
        const h = g.snake[0];
        for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; emit({ kind: 'spark', x: cx(h.x), y: cy(h.y), vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.6, color: '#fcd116', size: 2.5 }); }
        popup('ANTING-ANTING!', cx(h.x), cy(h.y) - 30, '#fcd116', 24);
        flashColor = '252,209,22'; flash = 0.7; shake = Math.max(shake, 6);
        break;
      }
      case 'die': {
        deathT = 0;
        shake = reducedNow ? 0 : 14; flashColor = '235,60,60'; flash = 1;
        g.snake.forEach((p, i) => setTimeout(() => confetti(cx(p.x), cy(p.y), 6, FLAG, 140), i * 18));
        popup({ kawayan: 'Naipit ng kawayan!', pader: 'Bangga!', banga: 'Basag ang banga!', manok: 'Tinuka ng tandang!' }[e.by] || 'Nakagat ang sarili!', W / 2, BY + BOARD / 2 - 20, '#fff8e1', 26);
        break;
      }
      default: break;
    }
  }

  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.rot += p.vr * dt;
      if (p.kind === 'confetti') p.vx *= 0.985;
    }
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.life -= dt; p.y -= 30 * dt; if (p.life <= 0) popups.splice(i, 1); }
    shake = Math.max(0, shake - dt * 30);
    flash = Math.max(0, flash - dt * 1.8);
    if (deathT >= 0) deathT += dt;
  }

  function drawParts() {
    for (const p of parts) {
      const a = clamp(p.life / p.max * 1.5, 0, 1);
      if (p.kind === 'feather') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 2, p.size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'confetti' || p.kind === 'chip') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a;
        ctx.fillStyle = p.color; ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = hexA(p.color, a); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'smoke' || p.kind === 'steam') {
        ctx.fillStyle = `rgba(${p.color},${0.35 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - a), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'flame') {
        ctx.fillStyle = hexA(p.color, a); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    for (const p of popups) {
      const a = clamp(p.life / p.max * 2, 0, 1);
      const pop = 1 + Math.max(0, (p.life - p.max + 0.12) / 0.12) * 0.45;
      ctx.font = `900 ${Math.round(p.size * pop)}px "Baloo 2", system-ui, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = `rgba(40,16,40,${0.9 * a})`; ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = hexA(p.color, a); ctx.fillText(p.text, p.x, p.y);
    }
    ctx.textAlign = 'left';
  }

  // ---------- frame, bunting, parols ----------
  function frame(t, reduced, fest) {
    // bamboo frame with nodes
    const f = 18;
    const bamboo = (x, y, w, h, vertical) => {
      const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#9c7a3c'); g.addColorStop(0.35, '#e2c27a'); g.addColorStop(0.7, '#c9a256'); g.addColorStop(1, '#7c5c28');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(80,55,20,0.55)';
      if (vertical) for (let k = y + 40; k < y + h - 10; k += 90) ctx.fillRect(x, k, w, 3);
      else for (let k = x + 40; k < x + w - 10; k += 90) ctx.fillRect(k, y, 3, h);
    };
    bamboo(BX - f, BY - f, BOARD + f * 2, f, false);
    bamboo(BX - f, BY + BOARD, BOARD + f * 2, f, false);
    bamboo(BX - f, BY, f, BOARD, true);
    bamboo(BX + BOARD, BY, f, BOARD, true);
    // lashings at the corners
    ctx.strokeStyle = '#5b3a1a'; ctx.lineWidth = 2;
    for (const [x, y] of [[BX - f, BY - f], [BX + BOARD, BY - f], [BX - f, BY + BOARD], [BX + BOARD, BY + BOARD]]) {
      for (let k = 3; k < f; k += 5) { ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + k - 4, y + f); ctx.stroke(); }
    }
    // bunting across the top
    ctx.strokeStyle = 'rgba(40,20,40,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(W / 2, 34, W, 6); ctx.stroke();
    for (let k = 0; k < 24; k++) {
      const u = (k + 0.5) / 24, x = u * W, y = 6 + 28 * 2 * u * (1 - u); // on the string's curve
      const flap = reduced ? 0 : Math.sin(t * 4 + k) * 2;
      ctx.fillStyle = fest.flags[k % fest.flags.length];
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + flap, y + 16); ctx.fill();
    }
    parol(22, 58, t, '#fcd116', reduced); parol(W - 22, 58, t, '#ff6fb5', reduced);
  }

  function parol(x, y, t, color, reduced) {
    const sw = reduced ? 0 : Math.sin(t * 1.5 + x) * 0.1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, hexA(color, 0.6)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(-30, -30, 60, 60);
    ctx.fillStyle = color; star(0, 0, 13, 5.5, 5);
    ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hexA(color, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, 11); ctx.lineTo(-6, 26); ctx.moveTo(3, 11); ctx.lineTo(6, 26); ctx.stroke();
    ctx.restore();
  }

  // ---------- HUD ----------
  function hud(g, best, dt) {
    shownScore = g.score < shownScore ? g.score : Math.min(g.score, shownScore + Math.max(1, (g.score - shownScore) * dt * 10));
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8e1'; ctx.font = '800 13px "Baloo 2", system-ui, sans-serif';
    ctx.fillText('PUNTOS', W / 2, 52);
    ctx.font = '800 34px "Baloo 2", system-ui, sans-serif';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,16,40,0.8)';
    ctx.strokeText(String(Math.round(shownScore)), W / 2, 84); ctx.fillStyle = '#fcd116'; ctx.fillText(String(Math.round(shownScore)), W / 2, 84);
    ctx.textAlign = 'left';
    ctx.font = '700 13px "Baloo 2", system-ui, sans-serif'; ctx.fillStyle = '#f4d9ff';
    ctx.fillText(`Haba ${g.snake.length}`, 50, 70);
    ctx.fillStyle = '#fcd116'; ctx.fillText(`Barangay ${g.level} · ${festival(g.level).name}`, 50, 87);
    ctx.textAlign = 'right'; ctx.fillStyle = '#f4d9ff';
    ctx.fillText(`Best ${Math.max(best, g.score)}`, W - 50, 70);
    ctx.fillStyle = g.wrap ? '#2ec4b6' : g.mode === 'daily' ? '#ff9f1c' : '#d9bfe6';
    ctx.fillText({ klasiko: 'Klasiko', walangpader: 'Walang Pader', daily: 'Araw-araw' }[g.mode] || '', W - 50, 87);
    ctx.textAlign = 'left';
    // active effects as chips under the score
    const chips = [];
    if (!g.alive) return;
    if (g.effects.balut > 0) chips.push(['Balut ×2', '#fcd116', g.effects.balut / FOODS.balut.dur]);
    if (g.effects.sili > 0) chips.push(['Sili ×2 bilis', '#ff4d4d', g.effects.sili / FOODS.sili.dur]);
    if (g.effects.halo > 0) chips.push(['Halo-halo bagal', '#9ad7ff', g.effects.halo / FOODS.halohalo.dur]);
    if (g.shield) chips.push(['Anting-anting', '#fcd116', 1]);
    if (g.combo >= 2) chips.push([`Sunod-sunod ${g.combo}${comboMult(g.combo) > 1 ? ` ×${comboMult(g.combo)}` : ''}`, '#ff6fb5', clamp(1 - (g.t - g.lastEat) / COMBO_WINDOW, 0, 1)]);
    // below the board, left of the pause button, so they never cover play
    const cw = Math.min(122, (W - 150) / Math.max(1, chips.length) - 6);
    let x = (W - 110) / 2 - (chips.length * (cw + 6) - 6) / 2;
    const y = BY + BOARD + 26;
    for (const [label, color, frac] of chips) {
      ctx.fillStyle = 'rgba(30,12,40,0.8)'; roundRect(x, y, cw, 22, 11); ctx.fill();
      ctx.fillStyle = hexA(color, 0.4); roundRect(x, y, cw * frac, 22, 11); ctx.fill();
      ctx.fillStyle = color; ctx.font = `800 ${cw < 115 ? 11 : 12}px "Baloo 2", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(label, x + cw / 2, y + 15); ctx.textAlign = 'left';
      x += cw + 6;
    }
  }

  // ---------- food ----------
  function food(f, t, reduced) {
    const x = cx(f.x), y = cy(f.y);
    const bob = reduced ? 0 : Math.sin(t * 4 + f.x * 1.3 + f.y) * 1.5;
    const def = FOODS[f.type];
    ctx.fillStyle = 'rgba(60,30,10,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (def.special) {
      const warn = f.life < 2.2 && !reduced && Math.sin(t * 20) > 0;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 22);
      g.addColorStop(0, f.type === 'anting' ? 'rgba(255,240,150,0.6)' : f.type === 'halohalo' ? 'rgba(150,210,255,0.55)' : f.type === 'sili' ? 'rgba(255,80,40,0.5)' : 'rgba(252,209,22,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44);
      ctx.strokeStyle = warn ? '#ffffff' : '#fff8e1'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (f.life / def.life)); ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(1.25, 1.25);
    switch (f.type) {
      case 'fishball': skewer(['#b5793a', '#c98945', '#b5793a'], 4.2); break;
      case 'kwekkwek': skewer(['#ff8a1f', '#ff9f3a'], 5.2); break;
      case 'bananacue': {
        stick();
        for (const [dx, dy] of [[-3, 3], [3, -3]]) { ctx.fillStyle = '#8a4b12'; ctx.beginPath(); ctx.ellipse(dx, dy, 7, 4.5, -0.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,220,120,0.6)'; ctx.beginPath(); ctx.ellipse(dx - 1, dy - 1.5, 4, 1.4, -0.8, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'turon': {
        ctx.rotate(-0.5);
        ctx.fillStyle = '#c47a1d'; roundRect(-10, -5, 20, 10, 5); ctx.fill();
        ctx.fillStyle = '#e8a33d'; roundRect(-10, -5, 20, 5, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(120,60,10,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-6, 5); ctx.moveTo(3, -5); ctx.lineTo(1, 5); ctx.stroke();
        ctx.fillStyle = 'rgba(255,240,200,0.7)'; ctx.fillRect(-7, -4, 12, 1.5);
        break;
      }
      case 'balut': {
        ctx.fillStyle = '#f6ecd6'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fcd116'; star(0, -1, 4, 1.8, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(-2.5, -4, 1.5, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'sili': {
        ctx.rotate(0.6);
        ctx.fillStyle = '#e0231d'; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.quadraticCurveTo(7, -4, 2, 10); ctx.quadraticCurveTo(-5, 0, -3, -8); ctx.fill();
        ctx.fillStyle = '#2e7d32'; ctx.fillRect(-4, -11, 4, 4); ctx.fillRect(-2, -13, 2, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-1, -5, 1.5, 6);
        break;
      }
      case 'anting': {
        ctx.strokeStyle = '#8a6a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(0, -5); ctx.lineTo(6, -10); ctx.stroke();
        ctx.fillStyle = '#e0a526'; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-8, -5); ctx.lineTo(8, -5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fcd116'; ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(-5.5, -3.5); ctx.lineTo(5.5, -3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.ellipse(0, -0.5, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill(); // the all-seeing eye
        ctx.fillStyle = '#2a1030'; ctx.beginPath(); ctx.arc(0, -0.5, 1, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'halohalo': {
        ctx.fillStyle = 'rgba(220,240,255,0.55)'; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7b3fa0'; ctx.beginPath(); ctx.arc(0, -5, 7, Math.PI, 0); ctx.fill(); // ube
        ctx.fillStyle = '#ff6fb5'; ctx.fillRect(-5, 0, 10, 3);
        ctx.fillStyle = '#fcd116'; ctx.fillRect(-4, 4, 8, 3);
        ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.arc(2, -9, 2.5, 0, Math.PI * 2); ctx.fill(); // leche flan
        ctx.strokeStyle = '#c0c8d8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4, -14); ctx.lineTo(7, 2); ctx.stroke();
        break;
      }
      default: break;
    }
    ctx.restore();
  }
  function stick() { ctx.strokeStyle = '#d8b27a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, -10); ctx.stroke(); }
  function skewer(colors, r) {
    stick();
    colors.forEach((c, i) => {
      const k = (i - (colors.length - 1) / 2) * r * 1.6;
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(k, -k, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(k - r * 0.35, -k - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ---------- the snake ----------
  function snake(g, t, reduced, dead) {
    const a = dead ? 1 : progress(g);
    const pts = g.snake.map((p, i) => {
      const q = g.prev[i] || p;
      // a wrap jumps across the board, so snap instead of sliding
      if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > 1) return { x: cx(p.x), y: cy(p.y) };
      return { x: cx(lerp(q.x, p.x, a)), y: cy(lerp(q.y, p.y, a)) };
    });
    if (!pts.length) return;
    const golden = g.effects.balut > 0, hot = g.effects.sili > 0, cold = g.effects.halo > 0;
    const hide = dead && deathT > 0.05;
    if (hide) return;
    const path = () => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const far = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y) > CELL * 1.6;
        if (far) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y);
      }
    };
    if (g.phase > 0) ctx.globalAlpha = reduced ? 0.55 : 0.35 + 0.25 * Math.abs(Math.sin(t * 14));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // shadow, outline, body
    ctx.save(); ctx.translate(2, 4); path(); ctx.strokeStyle = 'rgba(60,30,10,0.25)'; ctx.lineWidth = CELL * 0.82; ctx.stroke(); ctx.restore();
    path(); ctx.strokeStyle = '#2a1030'; ctx.lineWidth = CELL * 0.86; ctx.stroke();
    path(); ctx.strokeStyle = golden ? '#e0a526' : cold ? '#7fb8e8' : '#0038a8'; ctx.lineWidth = CELL * 0.7; ctx.stroke();
    // flag bands: red, yellow, white, blue, repeating down the body
    for (let i = pts.length - 1; i >= 1; i--) {
      const c = golden ? (i % 2 ? '#fcd116' : '#ffe98a') : cold ? (i % 2 ? '#bfe6ff' : '#e6f6ff') : FLAG[i % 4];
      const lump = bulges.reduce((m, b) => Math.max(m, Math.exp(-((i - b.pos) ** 2) / 1.2)), 0);
      if (lump > 0.05) { ctx.fillStyle = '#2a1030'; ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, CELL * (0.43 + lump * 0.14), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, CELL * (0.33 + lump * 0.12), 0, Math.PI * 2); ctx.fill();
      if (!golden && !cold && i % 4 === 3) { ctx.fillStyle = '#fcd116'; star(pts[i].x, pts[i].y, 4, 1.8, 5); } // little stars on the white bands
    }
    path(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = CELL * 0.18; ctx.save(); ctx.translate(-2, -3); ctx.stroke(); ctx.restore();
    if (hot && !reduced && Math.random() < 0.7) emit({ kind: 'flame', x: pts[0].x + (Math.random() - 0.5) * 8, y: pts[0].y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 0.35, color: pick(['#ff4d1a', '#ff9f1c', '#fcd116']), size: 4 });
    if (cold && !reduced && Math.random() < 0.3) emit({ kind: 'spark', x: pts[0].x + (Math.random() - 0.5) * 20, y: pts[0].y + (Math.random() - 0.5) * 20, vx: 0, vy: 10, life: 0.6, color: '#e6f6ff', size: 1.6 });
    head(pts[0], g, t, reduced, hot, golden);
    ctx.globalAlpha = 1;
    if (g.shield) {
      const r = CELL * (0.8 + (reduced ? 0 : 0.08 * Math.sin(t * 6)));
      ctx.strokeStyle = 'rgba(252,209,22,0.8)'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ---------- banga and the tandang ----------
  function pot(p) {
    const x = cx(p.x), y = cy(p.y);
    ctx.fillStyle = 'rgba(60,30,10,0.3)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 11, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - 4, y - 2, 1, x, y + 2, 14);
    g.addColorStop(0, '#d98a52'); g.addColorStop(1, '#8a4a22');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 2, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a3e1a'; ctx.fillRect(x - 6, y - 10, 12, 5); // neck
    ctx.fillStyle = '#a85a2c'; ctx.fillRect(x - 8, y - 12, 16, 3); // rim
    ctx.strokeStyle = 'rgba(255,230,190,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 9, y + 2); ctx.quadraticCurveTo(x, y + 6, x + 9, y + 2); ctx.stroke(); // painted band
  }

  function tandang(r, t, reduced) {
    const x = cx(r.x), y = cy(r.y);
    const bob = reduced ? 0 : Math.abs(Math.sin(t * 9)) * 2;
    ctx.save(); ctx.translate(x, y - bob); if (r.dir.x < 0) ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(60,30,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 12 + bob, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0a526'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(-3, 12 + bob); ctx.moveTo(2, 6); ctx.lineTo(3, 12 + bob); ctx.stroke(); // legs
    for (const [c, a] of [['#1e8449', -2.3], ['#1a5276', -2.0], ['#111', -1.7]]) { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-5, 0, 8, a, a + 0.9); ctx.stroke(); } // tail
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(0, 1, 8, 6.5, 0, 0, Math.PI * 2); ctx.fill(); // body
    ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.ellipse(1, 2, 5, 3.5, -0.2, 0, Math.PI * 2); ctx.fill(); // wing
    ctx.fillStyle = '#d35400'; ctx.beginPath(); ctx.arc(6, -5, 4, 0, Math.PI * 2); ctx.fill(); // head
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(5, -9.5, 1.8, 0, Math.PI * 2); ctx.arc(7.5, -9.8, 1.8, 0, Math.PI * 2); ctx.fill(); // comb
    ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(9.5, -5.5); ctx.lineTo(13, -4.5); ctx.lineTo(9.5, -3.5); ctx.fill(); // beak
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(7, -6, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function head(p, g, t, reduced, hot, golden) {
    const ang = Math.atan2(g.dir.y, g.dir.x);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    ctx.fillStyle = '#2a1030'; ctx.beginPath(); ctx.ellipse(1, 0, CELL * 0.56, CELL * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hot ? '#ff3b1f' : golden ? '#fcd116' : '#ce1126'; ctx.beginPath(); ctx.ellipse(1, 0, CELL * 0.48, CELL * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-1, -4, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    // tongue
    if (!reduced && Math.sin(t * 3) > 0.75) {
      ctx.strokeStyle = '#ff3b6b'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(19, 0); ctx.lineTo(22, -3); ctx.moveTo(19, 0); ctx.lineTo(22, 3); ctx.stroke();
    }
    // eyes, blinking now and then
    const blink = !reduced && (t % 3.2) < 0.12;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(5, s * 5.5, 4, blink ? 0.8 : 4, 0, 0, Math.PI * 2); ctx.fill();
      if (!blink) { ctx.fillStyle = '#1b1024'; ctx.beginPath(); ctx.arc(6.5, s * 5.5, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    // a salakot, always sitting upright
    ctx.save(); ctx.translate(p.x - 2, p.y - 9);
    ctx.fillStyle = '#2a1030'; ctx.beginPath(); ctx.moveTo(-13, 3); ctx.lineTo(0, -9); ctx.lineTo(13, 3); ctx.closePath(); ctx.fill();
    const hat = ctx.createLinearGradient(-12, 0, 12, 0); hat.addColorStop(0, '#b8893a'); hat.addColorStop(0.5, '#e9c57a'); hat.addColorStop(1, '#a37626');
    ctx.fillStyle = hat; ctx.beginPath(); ctx.moveTo(-11.5, 2); ctx.lineTo(0, -7.5); ctx.lineTo(11.5, 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,20,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.moveTo(-9, 0.5); ctx.lineTo(9, 0.5); ctx.stroke();
    ctx.fillStyle = '#ce1126'; ctx.beginPath(); ctx.arc(0, -7.5, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---------- tinikling poles ----------
  function poles(g, t, reduced) {
    const p = g.pole;
    if (!p) return;
    const row = p.axis === 'row';
    const center = row ? cy(p.index) : cx(p.index);
    if (p.warn > 0) {
      // the line glows and flashes faster as the clap gets close
      const urgency = 1 - p.warn / 2.4;
      const on = reduced || Math.sin(t * (8 + urgency * 22)) > 0;
      ctx.fillStyle = `rgba(206,17,38,${on ? 0.22 + urgency * 0.25 : 0.1})`;
      if (row) ctx.fillRect(BX, center - CELL / 2, BOARD, CELL); else ctx.fillRect(center - CELL / 2, BY, CELL, BOARD);
      ctx.strokeStyle = 'rgba(255,248,225,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
      if (row) ctx.strokeRect(BX, center - CELL / 2, BOARD, CELL); else ctx.strokeRect(center - CELL / 2, BY, CELL, BOARD);
      ctx.setLineDash([]);
    }
    // poles tap twice apart, then clap together (the tinikling rhythm)
    let gap;
    if (p.warn > 0) {
      const beat = (p.warn * 2.5) % 1;
      gap = CELL * 0.62 + (reduced ? 0 : Math.abs(Math.sin(beat * Math.PI)) * 5);
    } else gap = 3;
    for (const s of [-1, 1]) pole(row, center + s * gap);
    if (p.warn > 0 && p.warn < 1.2) {
      ctx.fillStyle = '#fff8e1'; ctx.font = '900 16px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center';
      const lx = row ? W / 2 : center, ly = row ? center - CELL : BY + 16;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,16,40,0.9)'; ctx.strokeText('TINIKLING!', lx, ly + 5); ctx.fillText('TINIKLING!', lx, ly + 5); ctx.textAlign = 'left';
    }
  }
  function pole(row, at) {
    const len = BOARD + 60, w = 8;
    const g = row ? ctx.createLinearGradient(0, at - w / 2, 0, at + w / 2) : ctx.createLinearGradient(at - w / 2, 0, at + w / 2, 0);
    g.addColorStop(0, '#8a6a2c'); g.addColorStop(0.4, '#ecd08a'); g.addColorStop(1, '#7c5c28');
    ctx.fillStyle = g;
    if (row) ctx.fillRect(BX - 30, at - w / 2, len, w); else ctx.fillRect(at - w / 2, BY - 30, w, len);
    ctx.fillStyle = 'rgba(80,55,20,0.6)';
    for (let k = 20; k < len; k += 70) { if (row) ctx.fillRect(BX - 30 + k, at - w / 2, 2, w); else ctx.fillRect(at - w / 2, BY - 30 + k, w, 2); }
  }

  // ---------- helpers ----------
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(x, y, r, ri, n) { ctx.beginPath(); for (let k = 0; k < n * 2; k++) { const rr = k % 2 ? ri : r, a = -Math.PI / 2 + (k * Math.PI) / n; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  function draw(g, t, { reduced = false, best = 0, hudOn = true } = {}) {
    reducedNow = reduced;
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1);
    lastT = t;
    updateFx(dt);
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (shake > 0 && !reduced) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const fest = festival(g.level);
    frame(t, reduced, fest);
    ctx.drawImage(matFor(fest), BX, BY);
    for (let i = bulges.length - 1; i >= 0; i--) { bulges[i].pos += dt * 22; if (bulges[i].pos > g.snake.length + 2) bulges.splice(i, 1); }
    if (g.effects.halo > 0) { ctx.fillStyle = 'rgba(160,210,255,0.14)'; ctx.fillRect(BX, BY, BOARD, BOARD); }
    if (g.effects.sili > 0) { ctx.fillStyle = 'rgba(255,90,40,0.08)'; ctx.fillRect(BX, BY, BOARD, BOARD); }
    if (g.wrap) {
      // walang pader: the frame is open, so its inner edge glows
      const glow = reduced ? 0.85 : 0.6 + 0.3 * Math.sin(t * 3);
      ctx.shadowColor = '#2ec4b6'; ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(46,196,182,${glow})`; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.lineDashOffset = reduced ? 0 : -t * 14;
      ctx.strokeRect(BX + 2, BY + 2, BOARD - 4, BOARD - 4); ctx.setLineDash([]); ctx.shadowBlur = 0;
      // arrows on the frame: out one side, in the other
      ctx.fillStyle = `rgba(160,255,240,${glow})`; ctx.font = '900 14px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const [x, y] of [[BX + BOARD / 2, BY - 5], [BX + BOARD / 2, BY + BOARD + 14], [BX - 9, BY + BOARD / 2 + 5], [BX + BOARD + 9, BY + BOARD / 2 + 5]]) ctx.fillText(x === BX + BOARD / 2 ? '⇅' : '⇆', x, y);
      ctx.textAlign = 'left';
    }
    for (const p of g.pots) pot(p);
    for (const f of g.foods) food(f, t, reduced);
    if (g.rooster) tandang(g.rooster, t, reduced);
    snake(g, t, reduced, !g.alive);
    poles(g, t, reduced);
    drawParts();
    if (flash > 0) { ctx.fillStyle = `rgba(${flashColor},${flash * 0.3})`; ctx.fillRect(BX, BY, BOARD, BOARD); }
    ctx.setTransform(k, 0, 0, canvas.height / H, 0, 0);
    if (hudOn) hud(g, best, dt);
    drawPopups();
  }

  function reset() { parts.length = 0; popups.length = 0; bulges.length = 0; shownScore = 0; deathT = -1; shake = 0; flash = 0; }

  return { draw, resize, event, reset };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
