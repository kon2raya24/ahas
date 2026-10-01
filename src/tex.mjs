// Procedural textures for the 3D plaza, painted into canvases at load time: the banig and its weave,
// bamboo, the snake's scales, terracotta, the salakot's weave, kiping, masks, tribal cloth, soft
// particle sprites and the gold lettering that floats up in the world. Each surface that needs it
// gets a normal map made from its own heights. No image files. (The noise, normal-map and paint
// helpers come from Tumbang Preso's tex.mjs.)
import * as THREE from './vendor/three.module.min.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
export const hex = (c) => { if (c[0] !== '#') return c.match(/\d+/g).slice(0, 3).map(Number); const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => clamp(Math.round(v * k), 0, 255); return `rgb(${f(r)},${f(g)},${f(b)})`; };
export const mix = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, '0')).join(''); };

// Smooth value noise on a wrapping lattice, so every texture tiles.
export function noise(w, h, cell, r) {
  const gw = Math.max(1, Math.round(w / cell)), gh = Math.max(1, Math.round(h / cell)), grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const out = new Float32Array(w * h), s = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const gy = (y / h) * gh, y0 = Math.floor(gy) % gh, y1 = (y0 + 1) % gh, fy = s(gy - Math.floor(gy));
    for (let x = 0; x < w; x++) {
      const gx = (x / w) * gw, x0 = Math.floor(gx) % gw, x1 = (x0 + 1) % gw, fx = s(gx - Math.floor(gx));
      out[y * w + x] = lerp(lerp(grid[y0 * gw + x0], grid[y0 * gw + x1], fx), lerp(grid[y1 * gw + x0], grid[y1 * gw + x1], fx), fy);
    }
  }
  return out;
}
export function fbm(w, h, cell, octaves, r) {
  const out = new Float32Array(w * h);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) { const n = noise(w, h, Math.max(1, cell / 2 ** o), r); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function toTex(c, { repeat = null, color = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// A normal map from a height field: the slope in x and y, packed into RGB.
export function normalMap(hgt, w, h, strength = 2, opts = {}) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = hgt[j * w + ((i - 1 + w) % w)], rr = hgt[j * w + ((i + 1) % w)], u = hgt[((j - 1 + h) % h) * w + i], d = hgt[((j + 1) % h) * w + i];
    let nx = (l - rr) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const p = (j * w + i) * 4;
    img.data[p] = (nx * 0.5 + 0.5) * 255; img.data[p + 1] = (ny * 0.5 + 0.5) * 255; img.data[p + 2] = (nz * 0.5 + 0.5) * 255; img.data[p + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return toTex(c, { ...opts, color: false });
}
// Paint pixels from a function of (x, y) giving [r, g, b] (0-255) and optionally a height.
export function paint(w, h, fn, { repeat = null, strength = 0 } = {}) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), hgt = strength ? new Float32Array(w * h) : null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = fn(i, j), p = (j * w + i) * 4;
    img.data[p] = clamp(v[0], 0, 255); img.data[p + 1] = clamp(v[1], 0, 255); img.data[p + 2] = clamp(v[2], 0, 255); img.data[p + 3] = 255;
    if (hgt) hgt[j * w + i] = v[3] ?? 0;
  }
  x.putImageData(img, 0, 0);
  return { map: toTex(c, { repeat }), normalMap: hgt ? normalMap(hgt, w, h, strength, { repeat }) : null, canvas: c };
}

// ---------- the banig ----------
// A giant woven mat whose strips are one cell wide, so the weave itself is the grid: every cell is a
// crossing, with the row's strip on top in one cell and the column's in the next. Dyed strips make the
// festival's bands. `cols` strips each way; `px` pixels per cell.
export const BANIG_BASE = '#c8a468';
export function banigMap(fest, { n = 20, px = 64 } = {}) {
  const S = n * px, cv = canvas(S, S), x = cv.getContext('2d'), r = rng(fest.name.length * 97 + 5);
  // which strips are dyed: four bands each way, like the 2D mat
  const dye = new Map();
  fest.bands.forEach((c, i) => dye.set(2 + i * 5, c));
  const tone = Array.from({ length: n * 2 }, () => 0.93 + r() * 0.12);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const rowTop = (i + j) % 2 === 0, strip = rowTop ? j : i, c = dye.get(strip) ? mix(dye.get(strip), BANIG_BASE, 0.2) : BANIG_BASE;
    const k = tone[rowTop ? j : n + i], X = i * px, Y = j * px;
    x.fillStyle = shade(c, k); x.fillRect(X, Y, px, px);
    // the fibres run along the strip that's on top
    for (let f = 0; f < 18; f++) {
      const o = r() * px, w = 0.6 + r() * 1.6, v = 0.86 + r() * 0.22;
      x.fillStyle = shade(c, k * v);
      if (rowTop) x.fillRect(X, Y + o, px, w); else x.fillRect(X + o, Y, w, px);
    }
    // the strip curves down into the weave at both ends, and its edges sit in the other strip's shadow
    const g = rowTop ? x.createLinearGradient(X, 0, X + px, 0) : x.createLinearGradient(0, Y, 0, Y + px);
    g.addColorStop(0, 'rgba(60,36,12,0.34)'); g.addColorStop(0.12, 'rgba(60,36,12,0.06)'); g.addColorStop(0.88, 'rgba(60,36,12,0.06)'); g.addColorStop(1, 'rgba(60,36,12,0.34)');
    x.fillStyle = g; x.fillRect(X, Y, px, px);
    x.fillStyle = 'rgba(70,40,14,0.28)';
    if (rowTop) { x.fillRect(X, Y, px, 1.5); x.fillRect(X, Y + px - 1.5, px, 1.5); } else { x.fillRect(X, Y, 1.5, px); x.fillRect(X + px - 1.5, Y, 1.5, px); }
    // a glint along the top of the strip
    x.fillStyle = 'rgba(255,248,225,0.12)';
    if (rowTop) x.fillRect(X, Y + px * 0.3, px, px * 0.18); else x.fillRect(X + px * 0.3, Y, px * 0.18, px);
  }
  // diamonds woven into the middle of each block between the bands, soft so food and snake stay clear
  x.globalAlpha = 0.16;
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    const cx = (a * 5 + 4.5) * px, cy = (b * 5 + 4.5) * px, R = px * 1.05;
    x.fillStyle = (a + b) % 2 ? fest.bands[1] : fest.bands[0];
    x.beginPath(); x.moveTo(cx, cy - R); x.lineTo(cx + R, cy); x.lineTo(cx, cy + R); x.lineTo(cx - R, cy); x.closePath(); x.fill();
    x.fillStyle = '#fff8e1'; x.beginPath(); x.moveTo(cx, cy - R * 0.4); x.lineTo(cx + R * 0.4, cy); x.lineTo(cx, cy + R * 0.4); x.lineTo(cx - R * 0.4, cy); x.closePath(); x.fill();
  }
  x.globalAlpha = 1;
  // light wear and dust, so it's been sat on at many fiestas
  const dust = fbm(128, 128, 32, 3, r);
  x.globalCompositeOperation = 'multiply';
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const v = 1 - (dust[j * 2 * 128 + i * 2] - 0.4) * 0.16; x.fillStyle = `rgb(${255 * v | 0},${250 * v | 0},${238 * v | 0})`; x.fillRect((i * S) / 64, (j * S) / 64, S / 64 + 1, S / 64 + 1); }
  x.globalCompositeOperation = 'source-over';
  const t = toTex(cv, { aniso: 16 });
  return t;
}
// The weave's relief, one 2 × 2 block of cells tiled over the whole mat.
export function banigNormal({ px = 128 } = {}) {
  const S = px * 2, r = rng(77), fine = noise(S, S, 2, r), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = Math.floor(x / px), j = Math.floor(y / px), rowTop = (i + j) % 2 === 0;
    const u = (x % px) / px, v = (y % px) / px; // u along x, v along y inside the cell
    const along = rowTop ? u : v, across = rowTop ? v : u;
    // the strip is domed across its width and dives under its neighbours at the ends
    const dome = Math.sin(across * Math.PI) ** 0.6, dive = Math.sin(along * Math.PI) ** 0.35;
    const fibre = (fine[y * S + x] - 0.5) * 0.12 + Math.sin((rowTop ? y : x) * 1.7 + fine[y * S + x] * 3) * 0.03;
    hgt[y * S + x] = dome * 0.55 + dive * 0.45 + fibre;
  }
  return normalMap(hgt, S, S, 5, { repeat: [10, 10] });
}

// ---------- bamboo ----------
// Along v: the culm's nodes every `seg` of the texture, with a lip; along u: fine fibre streaks.
export function bamboo(seed = 3, { color = '#c9a860', nodes = 4, green = 0 } = {}) {
  const W = 64, H = 512, r = rng(seed), f = noise(W, H, 3, r), big = fbm(W, H, 64, 3, r), [cr, cg, cb] = hex(color);
  return paint(W, H, (x, y) => {
    const p = (y / H) * nodes, d = Math.abs(p - Math.round(p)) * (H / nodes), node = d < 5, lip = d < 12 ? (12 - d) / 12 : 0;
    const k = (0.82 + big[y * W + x] * 0.3 + (f[y * W + x] - 0.5) * 0.12) * (node ? 0.62 : 1 - lip * 0.08);
    const gr = green * (1 - big[y * W + x]);
    return [cr * k * (1 - gr * 0.35), cg * k * (1 + gr * 0.1), cb * k * (1 - gr * 0.2), (node ? 1.4 : lip * 0.7) + f[y * W + x] * 0.25];
  }, { strength: 3 });
}

// ---------- the snake ----------
// Along u: four bands, one per segment (red, yellow, blue, white with a little sun on the back), each
// with overlapping scales; around v: belly at 0 and 1, back at 0.5.
export const FLAG = ['#d0142c', '#fcd116', '#1447b8', '#f6f1e3'];
export function scales(kind = 'flag') {
  const W = 512, H = 128, cv = canvas(W, H), x = cv.getContext('2d'), hgt = new Float32Array(W * H), r = rng(kind.length * 31);
  const pal = kind === 'gold' ? ['#e8a51c', '#ffd84a', '#c9861a', '#fff0a8'] : kind === 'ice' ? ['#5fa0dc', '#bfe2ff', '#3f80c4', '#dff0ff'] : FLAG;
  const bw = W / 4;
  for (let b = 0; b < 4; b++) {
    const g = x.createLinearGradient(0, 0, 0, H), c = pal[b];
    // the belly is paler, the back a touch deeper
    g.addColorStop(0, mix(c, '#fff4dc', 0.55)); g.addColorStop(0.3, c); g.addColorStop(0.5, shade(c, 0.9)); g.addColorStop(0.7, c); g.addColorStop(1, mix(c, '#fff4dc', 0.55));
    x.fillStyle = g; x.fillRect(b * bw, 0, bw, H);
  }
  // scales: rows of rounded plates, offset every other row, darker at the rim
  const sw = 16, sh = 11;
  for (let row = 0; row * sh < H + sh; row++) for (let col = -1; col * sw < W + sw; col++) {
    const cx = col * sw + (row % 2) * sw / 2, cy = row * sh;
    for (let yy = -sh; yy <= sh; yy++) for (let xx = -sw / 2; xx <= sw / 2; xx++) {
      const X = ((Math.round(cx + xx) % W) + W) % W, Y = Math.round(cy + yy);
      if (Y < 0 || Y >= H) continue;
      const d = Math.hypot(xx / (sw * 0.55), (yy + sh * 0.3) / (sh * 0.95));
      if (d > 1) continue;
      const hv = Math.cos(d * Math.PI / 2) * 0.9 + 0.1;
      if (hv > hgt[Y * W + X]) hgt[Y * W + X] = hv;
    }
  }
  const img = x.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) { const k = 0.84 + hgt[i] * 0.2 + (r() - 0.5) * 0.03; img.data[i * 4] *= k; img.data[i * 4 + 1] *= k; img.data[i * 4 + 2] *= k; }
  x.putImageData(img, 0, 0);
  // thin dark seams between the bands, and the sun on the white band's back
  for (let b = 0; b < 4; b++) { x.fillStyle = 'rgba(20,10,30,0.5)'; x.fillRect(b * bw - 2, 0, 4, H); }
  if (kind === 'flag') {
    const cx = 3.5 * bw, cy = H / 2;
    x.save(); x.translate(cx, cy);
    x.fillStyle = '#f2b90c';
    for (let k = 0; k < 8; k++) { x.save(); x.rotate((k * Math.PI) / 4); x.beginPath(); x.moveTo(-4, 9); x.lineTo(0, 30); x.lineTo(4, 9); x.fill(); x.restore(); }
    x.beginPath(); x.arc(0, 0, 11, 0, Math.PI * 2); x.fill();
    x.restore();
    for (const [dx, dy] of [[-0.3, -0.28], [0.3, -0.28], [0, 0.34]]) star(x, 1.5 * bw + dx * bw, H / 2 + dy * H, 6, 2.6, '#fff3b0');
  }
  const map = toTex(cv); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const nor = normalMap(hgt, W, H, 3.2); nor.wrapS = nor.wrapT = THREE.RepeatWrapping;
  return { map, normalMap: nor };
}
function star(x, cx, cy, R, r, color) {
  x.fillStyle = color; x.beginPath();
  for (let k = 0; k < 10; k++) { const rr = k % 2 ? r : R, a = -Math.PI / 2 + (k * Math.PI) / 5; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath(); x.fill();
}
// The head: red scales, a little finer.
export function headSkin(color = '#d0142c') {
  const r = rng(9), f = noise(256, 128, 4, r), [cr, cg, cb] = hex(color);
  return paint(256, 128, (x, y) => {
    const sx = x % 12, sy = (y + (Math.floor(x / 12) % 2) * 5) % 10, d = Math.hypot((sx - 6) / 6, (sy - 5) / 5), hv = d < 1 ? Math.cos(d * Math.PI / 2) : 0;
    const k = 0.9 + hv * 0.12 + (f[y * 256 + x] - 0.5) * 0.06;
    return [cr * k, cg * k, cb * k, hv];
  }, { strength: 2.4 });
}

// ---------- clay and weave ----------
// A banga's terracotta: warm clay, a painted band of zigzags on the shoulder (v: 0 base, 1 rim).
export function terracotta(seed = 4) {
  const W = 256, H = 256, r = rng(seed), big = fbm(W, H, 48, 4, r), fine = noise(W, H, 2, r);
  const t = paint(W, H, (x, y) => {
    const i = y * W + x, k = 0.84 + big[i] * 0.26 + (fine[i] - 0.5) * 0.08, soot = y > H * 0.86 ? 0.8 : 1;
    return [178 * k * soot, 92 * k * soot, 52 * k * soot, big[i] * 0.4 + fine[i] * 0.4];
  }, { strength: 2.2 });
  const x = t.canvas.getContext('2d');
  x.strokeStyle = 'rgba(252,240,214,0.82)'; x.lineWidth = 4;
  x.beginPath(); for (let k = 0; k <= 16; k++) x.lineTo((k / 16) * W, H * (0.36 + (k % 2) * 0.07)); x.stroke();
  x.fillStyle = 'rgba(40,20,14,0.7)'; x.fillRect(0, H * 0.3, W, 3); x.fillRect(0, H * 0.46, W, 3);
  x.fillStyle = 'rgba(252,240,214,0.6)'; for (let k = 0; k < 16; k++) { x.beginPath(); x.arc((k + 0.5) * W / 16, H * 0.55, 3, 0, Math.PI * 2); x.fill(); }
  t.map.needsUpdate = true;
  return t;
}
// Woven bamboo strips, over-under on the diagonal: the salakot, baskets, the stage's sawali.
export function sawali(seed = 12, { color = '#caa56a', n = 12, repeat = null } = {}) {
  const S = 256, r = rng(seed), f = noise(S, S, 3, r), [cr, cg, cb] = hex(color), q = S / n;
  return paint(S, S, (x, y) => {
    const a = x + y, b = x - y + S * 4, ia = Math.floor(a / q), ib = Math.floor(b / q), over = (ia + ib) % 2 === 0;
    const band = over ? Math.sin(((a % q) / q) * Math.PI) : Math.sin(((b % q) / q) * Math.PI);
    const k = 0.62 + band * 0.42 + (f[y * S + x] - 0.5) * 0.12;
    return [cr * k, cg * k, cb * k, band];
  }, { repeat, strength: 4 });
}

// ---------- festival pieces ----------
// Kiping: a leaf-shaped rice wafer, translucent colour with veins. The alpha is the leaf's outline.
export function kiping(color = '#e53935') {
  const W = 128, H = 192, cv = canvas(W, H), x = cv.getContext('2d');
  x.translate(W / 2, H); // the stem at the bottom
  x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-W * 0.62, -H * 0.3, -W * 0.3, -H * 0.8, 0, -H * 0.98); x.bezierCurveTo(W * 0.3, -H * 0.8, W * 0.62, -H * 0.3, 0, 0); x.closePath();
  const g = x.createLinearGradient(0, 0, 0, -H); g.addColorStop(0, shade(color, 0.8)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, 1.2));
  x.fillStyle = g; x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -4); x.lineTo(0, -H * 0.92); x.stroke();
  x.lineWidth = 2;
  for (let k = 1; k < 7; k++) { const y = -H * k * 0.13; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, y); x.quadraticCurveTo(s * W * 0.18, y - H * 0.03, s * W * 0.3 * Math.sin((k / 7) * Math.PI), y - H * 0.09); x.stroke(); } }
  const t = toTex(cv); return t;
}
// A MassKara mask: a gold face with a huge smile, painted patterns, and feathers fanning out.
export function mask(seed = 1, colors = ['#ffd54f', '#7e57c2', '#26c6da', '#ef5350']) {
  const S = 512, cv = canvas(S, S), x = cv.getContext('2d'), r = rng(seed);
  x.translate(S / 2, S / 2 + 30);
  // feathers
  for (let k = 0; k < 15; k++) {
    const a = -Math.PI * 0.92 + (k / 14) * Math.PI * 0.84, c = colors[k % colors.length];
    x.save(); x.rotate(a + Math.PI / 2);
    const g = x.createLinearGradient(0, 0, 0, -220); g.addColorStop(0, shade(c, 0.7)); g.addColorStop(1, shade(c, 1.25));
    x.fillStyle = g; x.beginPath(); x.moveTo(0, -80); x.quadraticCurveTo(-38, -170, 0, -236); x.quadraticCurveTo(38, -170, 0, -80); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -84); x.lineTo(0, -230); x.stroke();
    x.restore();
  }
  // the face
  const face = x.createRadialGradient(-30, -40, 20, 0, 0, 170); face.addColorStop(0, '#fff3b0'); face.addColorStop(0.5, colors[0]); face.addColorStop(1, shade(colors[0], 0.6));
  x.fillStyle = face; x.beginPath(); x.ellipse(0, 0, 150, 165, 0, 0, Math.PI * 2); x.fill();
  x.lineWidth = 8; x.strokeStyle = shade(colors[1], 0.8); x.stroke();
  // painted swirls
  for (let k = 0; k < 10; k++) { x.fillStyle = colors[1 + (k % 3)]; x.beginPath(); x.arc((r() - 0.5) * 210, (r() - 0.6) * 150, 8 + r() * 12, 0, Math.PI * 2); x.fill(); }
  // eyes
  for (const s of [-1, 1]) {
    x.fillStyle = colors[2]; x.beginPath(); x.ellipse(s * 58, -34, 44, 30, s * -0.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1b0f24'; x.beginPath(); x.ellipse(s * 58, -30, 26, 15, s * -0.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { const a = Math.PI + (k / 5) * Math.PI; x.beginPath(); x.arc(s * 58 + Math.cos(a) * 52, -34 + Math.sin(a) * 38, 4, 0, Math.PI * 2); x.fill(); }
  }
  // the smile: wide open, teeth showing
  x.fillStyle = '#7a0f24'; x.beginPath(); x.moveTo(-100, 40); x.quadraticCurveTo(0, 175, 100, 40); x.quadraticCurveTo(0, 88, -100, 40); x.fill();
  x.fillStyle = '#fffaf0'; x.beginPath(); x.moveTo(-88, 48); x.quadraticCurveTo(0, 96, 88, 48); x.quadraticCurveTo(0, 120, -88, 48); x.fill();
  x.strokeStyle = 'rgba(120,80,60,0.5)'; x.lineWidth = 2; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(k * 24, 60 + Math.abs(k) * -2); x.lineTo(k * 22, 92 - Math.abs(k) * 6); x.stroke(); }
  x.fillStyle = colors[3]; x.beginPath(); x.arc(-96, 40, 12, 0, Math.PI * 2); x.arc(96, 40, 12, 0, Math.PI * 2); x.fill();
  // sequins round the rim
  for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; x.fillStyle = k % 2 ? '#fff8e1' : colors[3]; x.beginPath(); x.arc(Math.cos(a) * 146, Math.sin(a) * 160, 5, 0, Math.PI * 2); x.fill(); }
  return toTex(cv);
}
// Tribal cloth for Ati-Atihan and Kadayawan: bands of zigzags, diamonds and crosses.
export function tribal(seed = 2, colors = ['#212121', '#e64a19', '#ffb300', '#fff8e1']) {
  const W = 256, H = 512, cv = canvas(W, H), x = cv.getContext('2d'), r = rng(seed);
  x.fillStyle = colors[0]; x.fillRect(0, 0, W, H);
  let y = 0;
  while (y < H) {
    const h = 24 + Math.floor(r() * 3) * 16, kind = Math.floor(r() * 4), c = colors[1 + Math.floor(r() * (colors.length - 1))];
    x.fillStyle = c; x.strokeStyle = c; x.lineWidth = 5;
    if (kind === 0) { x.beginPath(); for (let k = 0; k <= 16; k++) x.lineTo((k / 16) * W, y + (k % 2 ? h * 0.8 : h * 0.2)); x.stroke(); }
    else if (kind === 1) for (let k = 0; k < 8; k++) { const cx = (k + 0.5) * W / 8, cy = y + h / 2; x.beginPath(); x.moveTo(cx, cy - h * 0.4); x.lineTo(cx + h * 0.4, cy); x.lineTo(cx, cy + h * 0.4); x.lineTo(cx - h * 0.4, cy); x.fill(); }
    else if (kind === 2) { x.fillRect(0, y + h * 0.35, W, h * 0.3); }
    else for (let k = 0; k < 8; k++) { const cx = (k + 0.5) * W / 8, cy = y + h / 2; x.fillRect(cx - 2, cy - h * 0.35, 4, h * 0.7); x.fillRect(cx - h * 0.35, cy - 2, h * 0.7, 4); }
    y += h + 6;
  }
  const t = toTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// A parol's capiz panel: a star with ribs, bright in the middle.
export function parolTex(color = '#fcd116') {
  const S = 256, cv = canvas(S, S), x = cv.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, mix(color, '#ffffff', 0.4)); g.addColorStop(1, color);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(80,40,20,0.35)'; x.lineWidth = 3;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; x.beginPath(); x.moveTo(S / 2, S / 2); x.lineTo(S / 2 + Math.cos(a) * S, S / 2 + Math.sin(a) * S); x.stroke(); }
  for (let k = 1; k < 4; k++) { x.beginPath(); x.arc(S / 2, S / 2, (k * S) / 8, 0, Math.PI * 2); x.stroke(); }
  return toTex(cv);
}

// ---------- particles and lettering ----------
export function dot() {
  const S = 64, cv = canvas(S, S), x = cv.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return toTex(cv, { color: false });
}
export function puff() {
  const S = 128, r = rng(5), n = fbm(S, S, 32, 3, r), cv = canvas(S, S), x = cv.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const d = Math.hypot(i - S / 2, j - S / 2) / (S / 2), a = clamp((1 - d) * 1.6, 0, 1) * (0.55 + n[j * S + i] * 0.7), p = (j * S + i) * 4;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = 255; img.data[p + 3] = clamp(a * 255, 0, 255);
  }
  x.putImageData(img, 0, 0);
  return toTex(cv, { color: false });
}
// Floating lettering: italic condensed caps, a gold gradient (or a flat colour), a dark outline.
export function textTex(text, { color = null, size = 96, sub = null } = {}) {
  const font = `italic 900 ${size}px "Barlow Condensed", "Baloo 2", system-ui, sans-serif`;
  const m = canvas(8, 8).getContext('2d'); m.font = font;
  const W = Math.ceil(m.measureText(text).width + size * 0.6), H = Math.ceil(size * (sub ? 1.75 : 1.3));
  const cv = canvas(W, H), x = cv.getContext('2d');
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  const y = size * 0.62;
  x.lineJoin = 'round'; x.lineWidth = size * 0.16; x.strokeStyle = '#140a18'; x.strokeText(text, W / 2, y + size * 0.05);
  if (color) x.fillStyle = color;
  else { const g = x.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.42, '#ffd23f'); g.addColorStop(0.6, '#e8741c'); g.addColorStop(1, '#fff0b0'); x.fillStyle = g; }
  x.fillText(text, W / 2, y);
  if (sub) { x.font = `italic 800 ${size * 0.42}px "Barlow Condensed", system-ui, sans-serif`; x.lineWidth = size * 0.1; x.strokeText(sub, W / 2, size * 1.38); x.fillStyle = '#fff'; x.fillText(sub, W / 2, size * 1.38); }
  const t = toTex(cv, { aniso: 4 });
  return { tex: t, aspect: W / H };
}
