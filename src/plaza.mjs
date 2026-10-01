// The town plaza in 3D, in cell units (one cell of the board = 1; a metre is M units). The banig and
// its bamboo frame sit on an entablado in the middle of the plaza, with food stalls either side, a
// coral-stone church at the far end, bahay na bato all round, trees and lamp posts. Strings of bunting
// run from tall bamboo posts. Each festival re-dresses it: the mat's dyed strips, the stage skirt, the
// awnings, what hangs on the strings, and its own set pieces (kiping, candles, flowers, masks, torches,
// fruit). Scanned surfaces and real props replace the painted ones once envpack.mjs loads them.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { bambooMat, bambooPole, sweep, banga } from './models.mjs';

export const M = 3.2; // units per metre
export const STAGE = 0.9, Y0 = 0.93, HALF = 10;
const TAU = Math.PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let rs = 20260928;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
// plain materials are shared by colour, so the merge can fold every copy into one draw
const STD = new Map();
const std = (color, o = {}) => {
  if (Object.values(o).some((v) => v && typeof v === 'object')) return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  const k = color + JSON.stringify(o);
  if (!STD.has(k)) STD.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o }));
  return STD.get(k);
};
const tag = (m, kind, w, h, extra = {}) => { m.userData.surface = { kind, w, h, ...extra }; return m; };
function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = null, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  if (s) (Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s));
  m.castShadow = cast; m.receiveShadow = receive; return m;
}
const box = (w, h, d, m, o) => mesh(new THREE.BoxGeometry(w, h, d), m, o);

// Merge every static mesh that shares a material into one, so the plaza costs a few dozen draws.
export function mergeStatic(root, { shallow = false } = {}) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), rel = new THREE.Matrix4();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep || (shallow && o.parent !== root)) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.standIn) return; // stand-ins hide as a whole: merged on their own
    const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const parts = list.map((m) => { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld)); return g; });
    const n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let at = 0;
    for (const g of parts) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, at * 3); nor.set(g.attributes.normal.array, at * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, at * 2);
      at += c; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const merged = new THREE.Mesh(geo, list[0].material);
    merged.castShadow = list[0].castShadow; merged.receiveShadow = list[0].receiveShadow;
    for (const m of list) m.parent.remove(m);
    root.add(merged);
  }
}

// Only things near the stage throw shadows (the sun's shadow covers the stage); far away it costs draws for nothing.
function nearShadows(root, R = 17) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  root.traverse((o) => { if (o.isMesh && o.castShadow) { o.getWorldPosition(v); if (Math.abs(v.x) > R || Math.abs(v.z) > R) o.castShadow = false; } });
}
// A string hanging between two points.
function catenary(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
  return pts;
}
// Points spaced evenly along a polyline.
function along(pts, step) {
  const out = [];
  let carry = step / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = a.distanceTo(b);
    let s = carry;
    while (s <= d) { out.push({ p: a.clone().lerp(b, s / d), dir: b.clone().sub(a).normalize() }); s += step; }
    carry = s - d;
  }
  return out;
}

// ---------- painted stand-ins for the scanned surfaces ----------
function groundTex() {
  // warm brick in herringbone, until the scan loads
  const S = 512, r = T.rng(8), n = T.noise(S, S, 3, r), cv = T.canvas(S, S), x = cv.getContext('2d');
  x.fillStyle = '#8a6a58'; x.fillRect(0, 0, S, S);
  const b = 32;
  for (let j = -2; j < S / b * 2 + 2; j++) for (let i = -2; i < S / b + 2; i++) {
    const X = i * b * 2 + (j % 2) * b, Y = j * b / 2;
    x.fillStyle = T.shade('#a8745a', 0.8 + r() * 0.35);
    x.save(); x.translate(X, Y); x.rotate(Math.PI / 4 * ((i + j) % 2 ? 1 : -1)); x.fillRect(-b + 2, -b / 4 + 2, b * 2 - 4, b / 2 - 4); x.restore();
  }
  const t = T.toTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40);
  return t;
}

export function buildPlaza({ low = false } = {}) {
  const root = new THREE.Group(); root.name = 'plaza';
  const statics = new THREE.Group(); root.add(statics);
  const live = new THREE.Group(); root.add(live); // things that move or change per festival
  const add = (...o) => statics.add(...o);
  const standIns = [];
  const standIn = (o) => { o.userData.standIn = true; standIns.push(o); return o; };

  // ---------- the ground ----------
  const groundM = tag(std('#ffffff', { map: groundTex(), roughness: 0.92 }), 'ground', 300, 300);
  const ground = mesh(new THREE.PlaneGeometry(300, 300), groundM, { rx: -Math.PI / 2, cast: false });
  add(ground);
  // a darker, older band of stone round the stage, where people stand
  const kerb = std('#9a8a78', { roughness: 0.9 });
  tag(kerb, 'stone', 4, 4);

  // ---------- the entablado ----------
  const S = 12.8;
  const wood = tag(std('#8a5a34', { roughness: 0.75, envMapIntensity: 0.35 }), 'wood', S * 2, S * 2);
  add(box(S * 2, STAGE, S * 2, wood, { y: STAGE / 2 }));
  // the skirt: pleated cloth in the festival's colours, on all four sides
  const skirtCanvas = T.canvas(512, 64), skirtTex = T.toTex(skirtCanvas); skirtTex.wrapS = THREE.RepeatWrapping;
  const skirtM = std('#ffffff', { map: skirtTex, roughness: 0.8, side: THREE.DoubleSide });
  const skirtGeo = (() => {
    const w = S * 2 + 0.2, n = 160, pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) { const t = i / n, x = -w / 2 + w * t, z = Math.sin(t * 80 * Math.PI) * 0.06; pos.push(x, 0, z, x, STAGE - 0.02, z); uv.push(t * 6, 0, t * 6, 1); }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; add(mesh(skirtGeo, skirtM, { x: Math.sin(a) * (S + 0.08), z: Math.cos(a) * (S + 0.08), ry: a, cast: false })); }
  // steps up on the near side
  for (let k = 0; k < 2; k++) add(box(7, STAGE * (1 - k * 0.5) * 0.5 + 0.05, 1.1, wood, { y: (STAGE * (1 - k * 0.5) * 0.5 + 0.05) / 2, z: S + 0.6 + k * 1.1 }));

  // ---------- the banig ----------
  const banigN = T.banigNormal({ px: low ? 64 : 128 });
  const matM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, normalMap: banigN, normalScale: new THREE.Vector2(0.9, 0.9) });
  const mat = mesh(new THREE.PlaneGeometry(20, 20), matM, { y: Y0, rx: -Math.PI / 2, cast: false });
  mat.userData.keep = true; root.add(mat);
  // the hem: a woven border in the festival's colour
  const hemCanvas = T.canvas(256, 32), hemTex = T.toTex(hemCanvas); hemTex.wrapS = THREE.RepeatWrapping; hemTex.repeat.set(12, 1);
  const hemM = std('#ffffff', { map: hemTex, roughness: 0.8 });
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; const h = mesh(new THREE.PlaneGeometry(21.2, 0.62), hemM, { x: Math.sin(a) * 10.31, y: Y0 - 0.004, z: Math.cos(a) * 10.31, rx: -Math.PI / 2, rz: a, cast: false }); root.add(h); }
  // a soft shadow where the mat meets the stage
  const shadowM = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false });
  root.add(mesh(new THREE.PlaneGeometry(21.8, 21.8), shadowM, { y: STAGE + 0.005, rx: -Math.PI / 2, cast: false }));

  // ---------- the bamboo frame ----------
  const bamb = bambooMat('dry'), dark = bambooMat('dark');
  const frame = new THREE.Group(); root.add(frame);
  for (let k = 0; k < 4; k++) {
    const along = k < 2, s = k % 2 ? 1 : -1;
    const p = bambooPole(22.8, 0.3, bamb);
    if (along) p.position.set(0, Y0 + 0.14, s * 10.62); else { p.rotation.set(0, Math.PI / 2, Math.PI / 2); p.position.set(s * 10.62, Y0 + 0.14, 0); }
    frame.add(p);
  }
  const rattan = std('#5a3a1c', { roughness: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      frame.add(mesh(new THREE.TorusGeometry(0.33, 0.045, 6, 18), rattan, { x: sx * (10.62 - 0.1 - k * 0.14), y: Y0 + 0.14, z: sz * 10.62, ry: Math.PI / 2 }));
      frame.add(mesh(new THREE.TorusGeometry(0.33, 0.045, 6, 18), rattan, { x: sx * 10.62, y: Y0 + 0.14, z: sz * (10.62 - 0.1 - k * 0.14) }));
    }
  }
  // walang pader: the frame's inner edge glows, with arrows marching out one side and in the other
  const glowCanvas = T.canvas(256, 32), gx = glowCanvas.getContext('2d');
  gx.fillStyle = '#000'; gx.fillRect(0, 0, 256, 32);
  for (let k = 0; k < 4; k++) { gx.fillStyle = '#fff'; gx.beginPath(); gx.moveTo(k * 64 + 8, 4); gx.lineTo(k * 64 + 36, 16); gx.lineTo(k * 64 + 8, 28); gx.lineTo(k * 64 + 20, 16); gx.fill(); }
  const glowTex = T.toTex(glowCanvas, { color: false }); glowTex.wrapS = THREE.RepeatWrapping; glowTex.repeat.set(8, 1);
  const wrapGlow = new THREE.Group(); wrapGlow.visible = false; root.add(wrapGlow);
  const wrapM = new THREE.MeshBasicMaterial({ color: '#2ec4b6', alphaMap: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const wrapEdge = new THREE.MeshBasicMaterial({ color: '#2ec4b6', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    wrapGlow.add(mesh(new THREE.PlaneGeometry(20, 0.34), wrapM, { x: Math.sin(a) * 10.17, y: Y0 + 0.012, z: Math.cos(a) * 10.17, rx: -Math.PI / 2, rz: a + Math.PI / 2 * 0, cast: false, receive: false }));
    wrapGlow.add(mesh(new THREE.PlaneGeometry(20.2, 0.06), wrapEdge, { x: Math.sin(a) * 10.02, y: Y0 + 0.014, z: Math.cos(a) * 10.02, rx: -Math.PI / 2, rz: a, cast: false, receive: false }));
  }

  // ---------- tall bamboo posts for the bunting (only behind and beside the mat, never in front of it) ----------
  const postTops = {};
  const post = (id, x, z, h) => {
    const p = bambooPole(h, 0.22, dark); p.rotation.set(0, 0, 0); p.position.set(x, h / 2, z); add(p);
    add(mesh(new THREE.ConeGeometry(0.3, 0.6, 10), dark, { x, y: h + 0.3, z }));
    postTops[id] = V3(x, h - 0.4, z);
  };
  post('fl', -13.4, -13.4, 11); post('fr', 13.4, -13.4, 11);
  post('ml', -15.2, 0, 9.5); post('mr', 15.2, 0, 9.5);
  post('nl', -15.2, 13.2, 8.5); post('nr', 15.2, 13.2, 8.5);

  // ---------- food stalls either side ----------
  const awnCanvas = T.canvas(256, 256), awnTex = T.toTex(awnCanvas);
  const awnM = std('#ffffff', { map: awnTex, roughness: 0.85, side: THREE.DoubleSide });
  const table = std('#7a4e2a', { roughness: 0.7 });
  const goods = ['#e07a2a', '#f2c230', '#c0392b', '#7cb342', '#8e5a2a', '#f4f1e8'].map((c) => std(c, { roughness: 0.6 }));
  const stalls = [];
  for (const side of [-1, 1]) for (const z of [-11, 0, 11]) {
    const x = side * 20.5, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; statics.add(g);
    // posts and a sloped awning
    for (const px of [-3.8, 3.8]) for (const pz of [-1.8, 2.4]) { const p = bambooPole(pz > 0 ? 7 : 7.8, 0.12, bamb); p.rotation.set(0, 0, 0); p.position.set(px, (pz > 0 ? 7 : 7.8) / 2, pz); g.add(p); }
    const aw = mesh(new THREE.PlaneGeometry(8.6, 5.2, 8, 1), awnM, { y: 7.4, z: 0.3, rx: -Math.PI / 2 + 0.16 }); g.add(aw);
    // a scalloped valance along the front
    for (let k = 0; k < 9; k++) g.add(mesh(new THREE.CircleGeometry(0.5, 12, 0, Math.PI), awnM, { x: -4 + k, y: 7.0, z: 2.95, rx: Math.PI, cast: false }));
    // the counter and what's on it
    const counter = standIn(new THREE.Group()); g.add(counter);
    counter.add(box(6.4, 0.2, 2.4, table, { y: 2.5 })); for (const px of [-2.9, 2.9]) for (const pz of [-1, 1]) counter.add(box(0.2, 2.5, 0.2, table, { x: px, y: 1.25, z: pz }));
    for (let k = 0; k < 7; k++) counter.add(mesh(new THREE.SphereGeometry(0.35 + rnd() * 0.2, 12, 8), pick(goods), { x: -2.6 + k * 0.85, y: 2.9, z: (rnd() - 0.5) * 1.2 }));
    stalls.push({ g, x, z, side });
  }

  // ---------- the church ----------
  const church = new THREE.Group(); church.position.set(0, 0, -64); statics.add(church);
  let stained = null;
  const archGeo = (() => { const s = new THREE.Shape(); s.moveTo(-1.4, 0); s.lineTo(1.4, 0); s.lineTo(1.4, 3.7); s.absarc(0, 3.7, 1.4, 0, Math.PI, false); s.lineTo(-1.4, 0); return new THREE.ShapeGeometry(s, 12); })();
  const coral = tag(std('#cdb896', { roughness: 0.95 }), 'stone', 30, 30, { tint: '#f0e2c8' });
  const coralDark = std('#1a120e', { roughness: 1 });
  const roofM = tag(std('#9a4a2a', { roughness: 0.8 }), 'roof', 30, 20);
  {
    const fw = 32, fh = 26;
    const sh = new THREE.Shape(); sh.moveTo(-fw / 2, 0); sh.lineTo(fw / 2, 0); sh.lineTo(fw / 2, fh); sh.lineTo(fw * 0.22, fh); sh.quadraticCurveTo(fw * 0.14, fh + 9, 0, fh + 10); sh.quadraticCurveTo(-fw * 0.14, fh + 9, -fw * 0.22, fh); sh.lineTo(-fw / 2, fh); sh.closePath();
    const arch = (cx, y0, w, h) => { const p = new THREE.Path(); p.moveTo(cx - w / 2, y0); p.lineTo(cx + w / 2, y0); p.lineTo(cx + w / 2, y0 + h - w / 2); p.absarc(cx, y0 + h - w / 2, w / 2, 0, Math.PI, false); p.lineTo(cx - w / 2, y0); return p; };
    sh.holes.push(arch(0, 0, 6.4, 11.5), arch(-9.5, 8, 2.6, 5.5), arch(9.5, 8, 2.6, 5.5), arch(-9.5, 17, 2.2, 4.2), arch(9.5, 17, 2.2, 4.2));
    const round = new THREE.Path(); round.absarc(0, 17.5, 2.4, 0, TAU, true); sh.holes.push(round);
    church.add(mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }), coral, { z: 0 }));
    church.add(box(fw - 1, fh + 6, 1, coralDark, { y: (fh + 6) / 2, z: 0.3, cast: false }));
    // cornices and pilasters
    for (const y of [7, 15.5, 25.6]) church.add(box(fw + 1.2, 0.7, 3.2, coral, { y, z: 1.2 }));
    for (const x of [-15.2, -5, 5, 15.2]) church.add(box(1.6, 25, 3.4, coral, { x, y: 12.5, z: 1.2 }));
    // the nave behind, with a tiled roof
    church.add(box(28, 20, 34, coral, { y: 10, z: -17 }));
    const gable = new THREE.Shape(); gable.moveTo(-15.5, 0); gable.lineTo(15.5, 0); gable.lineTo(0, 9); gable.closePath();
    church.add(mesh(new THREE.ExtrudeGeometry(gable, { depth: 35, bevelEnabled: false }), roofM, { y: 19.8, z: -34.5 }));
    // twin bell towers
    for (const s of [-1, 1]) {
      const t = new THREE.Group(); t.position.set(s * 21, 0, -1); church.add(t);
      t.add(box(9, 22, 9, coral, { y: 11 })); t.add(box(10, 0.8, 10, coral, { y: 22.4 }));
      t.add(box(7.4, 9, 7.4, coral, { y: 27.2 })); t.add(box(8.2, 0.7, 8.2, coral, { y: 32 }));
      // arched bell openings on every face
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; t.add(mesh(archGeo, coralDark, { x: Math.sin(a) * 3.72, y: 24.6, z: Math.cos(a) * 3.72, ry: a, cast: false })); t.add(mesh(new THREE.TorusGeometry(1.55, 0.25, 6, 16, Math.PI), coral, { x: Math.sin(a) * 3.75, y: 28.3, z: Math.cos(a) * 3.75, ry: a })); }
      for (const [x, z] of [[-3.7, -3.7], [3.7, -3.7], [-3.7, 3.7], [3.7, 3.7]]) t.add(box(0.9, 9, 0.9, coral, { x, y: 27.2, z }));
      t.add(mesh(new THREE.CylinderGeometry(1.2, 1.4, 1.6, 16), std('#b8862a', { roughness: 0.35, metalness: 0.9 }), { y: 26.8 })); // the bell
      t.add(mesh(new THREE.SphereGeometry(3.6, 20, 12, 0, TAU, 0, Math.PI / 2), roofM, { y: 32.3 }));
      t.add(box(0.3, 2.8, 0.3, std('#e8e0d0'), { y: 37 })); t.add(box(1.4, 0.3, 0.3, std('#e8e0d0'), { y: 37.6 }));
    }
    // the door: carved double leaves under the arch
    const doorM = std('#4a2a16', { roughness: 0.7 }), stud = std('#c8a050', { roughness: 0.35, metalness: 0.9 });
    church.add(box(6.2, 8.4, 0.4, doorM, { y: 4.2, z: 0.9 }));
    church.add(mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.4, 24, 1, false, 0, Math.PI), doorM, { y: 8.4, z: 0.9, rx: Math.PI / 2, rz: Math.PI / 2 }));
    for (const x of [-1.5, 1.5]) for (const y of [2, 4.5, 7]) church.add(box(2.2, 1.8, 0.2, std('#3a1e0e', { roughness: 0.75 }), { x, y, z: 1.15 }));
    church.add(box(0.12, 8.4, 0.5, std('#1a0e06'), { y: 4.2, z: 1.0 }));
    for (const x of [-0.5, 0.5]) church.add(mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 14), stud, { x, y: 4.4, z: 1.2 }));
    // stained glass: the rose window and the arched windows glow at night
    const roseC = T.canvas(256, 256), rx2 = roseC.getContext('2d');
    for (let k = 0; k < 16; k++) { rx2.fillStyle = ['#c0392b', '#2a5ab8', '#f2c230', '#2e8b57'][k % 4]; rx2.beginPath(); rx2.moveTo(128, 128); rx2.arc(128, 128, 128, (k / 16) * TAU, ((k + 1) / 16) * TAU); rx2.fill(); }
    rx2.fillStyle = '#f2c230'; rx2.beginPath(); rx2.arc(128, 128, 34, 0, TAU); rx2.fill();
    rx2.strokeStyle = '#1a120e'; rx2.lineWidth = 6; for (let k = 0; k < 16; k++) { rx2.beginPath(); rx2.moveTo(128, 128); rx2.lineTo(128 + Math.cos((k / 16) * TAU) * 128, 128 + Math.sin((k / 16) * TAU) * 128); rx2.stroke(); } for (const r of [34, 80]) { rx2.beginPath(); rx2.arc(128, 128, r, 0, TAU); rx2.stroke(); }
    const roseT = T.toTex(roseC);
    stained = std('#ffffff', { map: roseT, emissive: '#ffffff', emissiveMap: roseT, emissiveIntensity: 0.15, roughness: 0.2 });
    church.add(mesh(new THREE.CircleGeometry(2.4, 32), stained, { y: 17.5, z: 0.6, cast: false }));
    church.add(mesh(new THREE.TorusGeometry(2.45, 0.22, 8, 36), coral, { y: 17.5, z: 2.3 }));
    for (const [x, y, w, h] of [[-9.5, 8, 2.6, 5.5], [9.5, 8, 2.6, 5.5], [-9.5, 17, 2.2, 4.2], [9.5, 17, 2.2, 4.2]]) church.add(mesh(new THREE.PlaneGeometry(w, h), stained, { x, y: y + h / 2, z: 0.6, cast: false }));
    // a niche with a saint over the door, and finials on the gable
    church.add(box(2.4, 3.8, 0.6, coralDark, { y: 29.5, z: 1.9 }));
    church.add(mesh(new THREE.CapsuleGeometry(0.55, 1.6, 4, 10), std('#f0ece4', { roughness: 0.6 }), { y: 29.4, z: 2.1 }));
    for (const x of [-15.2, -7, 7, 15.2]) church.add(mesh(new THREE.ConeGeometry(0.6, 2.2, 8), coral, { x, y: 27.1, z: 1.2 }));
    church.add(box(0.35, 3, 0.35, std('#e8e0d0'), { y: 37.4, z: 0.6 })); church.add(box(1.6, 0.35, 0.35, std('#e8e0d0'), { y: 38.2, z: 0.6 }));
    // steps up to the door
    for (let k = 0; k < 4; k++) church.add(box(18 - k * 1.5, 0.35, 2, coral, { y: 0.17 + k * 0.35, z: 5.5 - k * 1.1 }));
  }

  // ---------- bahay na bato round the plaza ----------
  const plaster = ['#f0e4cc', '#e2ccaa'].map((c) => tag(std(c, { roughness: 0.92 }), 'plaster', 10, 6, { detail: true }));
  const woodUp = ['#7a4a26', '#5e3a1e'].map((c) => tag(std(c, { roughness: 0.8 }), 'wood', 10, 4));
  const capizCanvas = T.canvas(512, 128), cx2 = capizCanvas.getContext('2d');
  cx2.fillStyle = '#4a2c16'; cx2.fillRect(0, 0, 512, 128);
  for (let w = 0; w < 4; w++) for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) { cx2.fillStyle = T.shade('#f4ecd8', 0.9 + ((i + j) % 2) * 0.08); cx2.fillRect(w * 128 + 10 + i * 18, 14 + j * 20, 15, 17); }
  const capizTex = T.toTex(capizCanvas); capizTex.wrapS = THREE.RepeatWrapping;
  const capizM = std('#ffffff', { map: capizTex, roughness: 0.5, emissive: '#ffb050', emissiveMap: capizTex, emissiveIntensity: 0 });
  const tiles = roofM;
  const house = (x, z, ry, w, d) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; statics.add(g);
    g.add(box(w, 11, d, pick(plaster), { y: 5.5 }));
    for (let k = 0; k < Math.floor(w / 5); k++) g.add(box(2.2, 3.6, 0.3, coralDark, { x: -w / 2 + 2.5 + k * 5, y: 4.2, z: d / 2 + 0.05, cast: false })); // doors and arches below
    const up = pick(woodUp);
    g.add(box(w + 1.6, 9, d + 1.6, up, { y: 15.5 }));
    const win = mesh(new THREE.PlaneGeometry(w + 1.2, 4.5), capizM, { y: 16, z: d / 2 + 0.82, cast: false }); win.material.map.repeat.set(Math.max(1, Math.round(w / 6)), 1); g.add(win);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.001, Math.hypot(w + 3, d + 3) / 2, 7, 4, 1, false, Math.PI / 4), tiles); r.scale.set((w + 3) / Math.hypot(w + 3, d + 3) * 1.414, 1, (d + 3) / Math.hypot(w + 3, d + 3) * 1.414); r.position.y = 23.5; r.castShadow = true; g.add(r);
    return g;
  };
  for (let k = 0; k < 5; k++) { house(-50, -36 + k * 18, Math.PI / 2, 15, 12); house(50, -36 + k * 18, -Math.PI / 2, 15, 12); }
  for (let k = 0; k < 5; k++) house(-36 + k * 18, 52, Math.PI, 15, 12);
  for (const x of [-38, 38]) house(x, -52, 0, 16, 12);

  // ---------- trees and lamps (painted stand-ins; real ones from the scans) ----------
  // dense mango and acacia trees: a forked trunk under a crown of lumpy leaf clusters
  const foliageTex = T.foliage(31);
  const bark = std('#5a4030', { roughness: 0.95 }), leaf = std('#ffffff', { map: foliageTex.map, normalMap: foliageTex.normalMap, color: '#5f8a3a', roughness: 0.85 }), leaf2 = std('#ffffff', { map: foliageTex.map, normalMap: foliageTex.normalMap, color: '#48742c', roughness: 0.85 });
  const blob = (r) => { const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 2.1 + p.getZ(i) * 1.7) * Math.cos(p.getY(i) * 2.3)) * 0.12 + (rnd() - 0.5) * 0.08; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.78, p.getZ(i) * k); } g.computeVertexNormals(); return g; };
  const trees = [[-33, -30, 1], [33, -30, 0], [-35, 22, 0], [35, 22, 1], [-28, 40, 1], [28, 40, 0], [-14, -36, 0], [14, -36, 1], [-44, -48, 1], [44, -46, 0]];
  for (const [x, z, acacia] of trees) {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = rnd() * TAU; statics.add(t);
    const h = acacia ? 8 : 6.5;
    t.add(mesh(new THREE.CylinderGeometry(0.55, 1.0, h, 9), bark, { y: h / 2 }));
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; t.add(mesh(new THREE.CylinderGeometry(0.25, 0.45, 5, 7), bark, { x: Math.cos(a) * 1.4, y: h + 1.4, z: Math.sin(a) * 1.4, rz: Math.cos(a) * 0.6, rx: -Math.sin(a) * 0.6 })); }
    const n = acacia ? 14 : 12, R = acacia ? 7 : 5;
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * R;
      t.add(mesh(blob(acacia ? 2.6 + rnd() * 1.2 : 2.8 + rnd() * 1.4), k % 2 ? leaf : leaf2, { x: Math.cos(a) * d, y: h + (acacia ? 3 + rnd() * 1.4 : 3.4 + rnd() * 3.2) - d * 0.2, z: Math.sin(a) * d }));
    }
  }
  const lampM = std('#1c1c20', { roughness: 0.5, metalness: 0.7 });
  const lampGlass = std('#fff2c8', { emissive: '#ffd08a', emissiveIntensity: 0, roughness: 0.2 });
  const lamps = [];
  for (const [x, z] of [[-17, -17], [17, -17], [-17, 17], [17, 17], [-28, -8], [28, -8], [-28, 10], [28, 10]]) {
    const l = new THREE.Group(); l.position.set(x, 0, z); statics.add(l);
    l.add(mesh(new THREE.CylinderGeometry(0.16, 0.26, 11, 10), lampM, { y: 5.5 }));
    l.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), lampM, { y: 11 }));
    l.add(mesh(new THREE.CylinderGeometry(0.42, 0.3, 1.1, 10), lampGlass, { y: 11.7, cast: false }));
    l.add(mesh(new THREE.ConeGeometry(0.6, 0.6, 10), lampM, { y: 12.5 }));
    lamps.push(V3(x, 11.7, z));
  }

  // ---------- the strings of bunting ----------
  const P = postTops;
  const strings = [
    catenary(P.fl, P.fr, 1.6), catenary(P.fl, P.ml, 1.0), catenary(P.fr, P.mr, 1.0), catenary(P.ml, P.nl, 0.8), catenary(P.mr, P.nr, 0.8),
    catenary(P.fl, V3(-30, 14, -46), 3), catenary(P.fr, V3(30, 14, -46), 3), catenary(P.fl, V3(-8, 18, -62), 3.5), catenary(P.fr, V3(8, 18, -62), 3.5),
    catenary(P.ml, V3(-44, 14, -4), 2.4), catenary(P.mr, V3(44, 14, -4), 2.4), catenary(P.nl, V3(-44, 13, 24), 2.4), catenary(P.nr, V3(44, 13, 24), 2.4),
    catenary(P.nl, V3(-24, 12, 44), 2.2), catenary(P.nr, V3(24, 12, 44), 2.2),
  ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(strings.flatMap((s) => s.slice(1).flatMap((p, i) => [s[i], p])));
  statics.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#2a1a14' })));
  const slots = strings.flatMap((s) => along(s, 1.05));

  // hanging things, instanced: one set per shape; each festival picks shapes and colours
  const hang = {};
  const flagGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.42, 0, 0, 0.42, 0, 0, 0, -1.0, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2)); g.computeVertexNormals(); return g; })();
  const squareGeo = new THREE.PlaneGeometry(0.8, 1.1).translate(0, -0.55, 0);
  const leafTex = T.kiping('#ffffff');
  const shapes = {
    flag: [flagGeo, std('#ffffff', { roughness: 0.7, side: THREE.DoubleSide })],
    square: [squareGeo, std('#ffffff', { roughness: 0.75, side: THREE.DoubleSide })],
    kiping: [new THREE.PlaneGeometry(0.62, 0.94).translate(0, -0.47, 0), std('#ffffff', { map: leafTex, alphaTest: 0.4, roughness: 0.55, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: leafTex, emissiveIntensity: 0.08 })],
    bulb: [new THREE.SphereGeometry(0.16, 10, 8).translate(0, -0.2, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.3 })],
    flower: [new THREE.IcosahedronGeometry(0.28, 0).translate(0, -0.25, 0), std('#ffffff', { roughness: 0.6, flatShading: true })],
  };
  for (const [k, [geo, m]] of Object.entries(shapes)) {
    const im = new THREE.InstancedMesh(geo, m, slots.length); im.count = 0; im.castShadow = k !== 'bulb'; im.visible = false; im.frustumCulled = false;
    im.setColorAt(0, new THREE.Color('#fff'));
    live.add(im); hang[k] = im;
  }
  const dummy = new THREE.Object3D(), C = new THREE.Color();
  let hangKind = 'flag', hangColors = ['#fff'], hangGrow = 1;
  function setHang(kind, colors) {
    hangKind = kind; hangColors = colors;
    for (const k in hang) hang[k].visible = k === kind;
    const im = hang[kind]; im.count = slots.length;
    slots.forEach((s, i) => { im.setColorAt(i, C.set(colors[i % colors.length])); });
    im.instanceColor.needsUpdate = true;
  }

  // ---------- festival set pieces, built the first time each festival comes up ----------
  const sets = new Map();
  const anchors = { corners: [[-12, -12], [12, -12], [-12, 12], [12, 12]].map(([x, z]) => V3(x, STAGE, z)), sides: [[-12, 0], [12, 0], [0, -12]].map(([x, z]) => V3(x, STAGE, z)) };
  const flames = []; // torch and candle flames for the view's particles
  const glows = []; // point-light spots for night festivals
  const spin = []; // things that turn or sway
  const parolMats = new Map();
  const parolMat = (c) => { if (!parolMats.has(c)) parolMats.set(c, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.4, side: THREE.DoubleSide })); return parolMats.get(c); };
  function buildSet(name, fest) {
    const g = new THREE.Group(); g.name = 'set ' + name;
    const F = fest.flags;
    // parols on every post, in all festivals but lit brightest at night
    const parolM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.4, side: THREE.DoubleSide });
    const starShape = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.45 : 1.1, a = -Math.PI / 2 + (k * Math.PI) / 5; (k ? starShape.lineTo : starShape.moveTo).call(starShape, Math.cos(a) * r, Math.sin(a) * r); } starShape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 }).translate(0, 0, -0.15);
    const parol = (p, color, s = 1) => {
      const m = parolMat(color);
      const o = new THREE.Group(); o.position.copy(p); g.add(o);
      o.add(mesh(starGeo, m, { s, cast: false }));
      for (const sx of [-0.3, 0.3]) o.add(mesh(new THREE.BoxGeometry(0.06, 1.6 * s, 0.02), m, { x: sx * s, y: -1.6 * s, cast: false })); // tails
      glows.push({ p: p.clone(), color, power: 0.6 });
      return o;
    };
    const posts = Object.values(postTops);
    const add = (o) => { g.add(o); return o; };
    switch (name) {
      case 'Pahiyas': {
        // kiping chandeliers (arangya) hanging from the posts, and harvest heaps at the stage corners
        const leafM = std('#ffffff', { map: leafTex, alphaTest: 0.4, roughness: 0.55, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: leafTex, emissiveIntensity: 0.1 });
        const leafGeo = new THREE.PlaneGeometry(0.7, 1.05).translate(0, -0.52, 0);
        const n = posts.length * 34;
        const im = new THREE.InstancedMesh(leafGeo, leafM, n); let i = 0;
        for (const p of posts) for (let ring = 0; ring < 4; ring++) for (let k = 0; k < [6, 8, 10, 10][ring]; k++) {
          if (i >= n) break;
          const a = (k / [6, 8, 10, 10][ring]) * TAU + ring, r = 0.35 + ring * 0.32;
          dummy.position.set(p.x + Math.cos(a) * r, p.y - 0.6 - ring * 0.7, p.z + Math.sin(a) * r); dummy.rotation.set(0.25, -a + Math.PI / 2, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, C.set(F[(k + ring) % F.length])); i++;
        }
        im.count = i; im.castShadow = true; add(im);
        const straw = std('#d9b24a', { roughness: 0.9 }), veg = ['#6a2a7a', '#e07a2a', '#3a7a2a', '#c0392b', '#f2c230'].map((c) => std(c, { roughness: 0.5 }));
        for (const c of anchors.corners) {
          const heap = new THREE.Group(); heap.position.set(c.x * 1.02, STAGE, c.z * 1.02); add(heap);
          for (let k = 0; k < 5; k++) heap.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, 2.4, 8), straw, { x: (k - 2) * 0.35, y: 1.2, rz: (k - 2) * 0.15 })); // rice stalks
          for (let k = 0; k < 9; k++) heap.add(mesh(new THREE.SphereGeometry(0.28 + rnd() * 0.2, 12, 8), pick(veg), { x: (rnd() - 0.5) * 1.6, y: 0.3, z: (rnd() - 0.5) * 1.6, s: [1, 0.8 + rnd() * 0.8, 1] }));
        }
        break;
      }
      case 'Sinulog': {
        // tall red and yellow banners on bamboo, and candles by the hundred at the stage corners
        const banner = std('#ffffff', { roughness: 0.7, side: THREE.DoubleSide });
        for (const [x, z] of [[-18, -18], [18, -18], [-24, -4], [24, -4], [-24, 6], [24, 6], [-9, -20], [9, -20]]) {
          const b = new THREE.Group(); b.position.set(x, 0, z); add(b);
          b.add(bambooPole(14, 0.14, bamb)); b.children[0].rotation.set(0, 0, 0); b.children[0].position.y = 7;
          const cloth = mesh(new THREE.PlaneGeometry(1.8, 7, 1, 8), banner.clone(), { x: 0.95, y: 9.6 }); cloth.material.color.set(rnd() < 0.5 ? '#d32f2f' : '#fbc02d'); b.add(cloth);
          spin.push({ o: cloth, kind: 'flutter', p: rnd() * 6 });
          b.rotation.y = Math.atan2(-x, -z) + Math.PI / 2;
        }
        const wax = std('#f6ecd8', { roughness: 0.5 }), wax2 = std('#d32f2f', { roughness: 0.5 });
        for (const c of anchors.corners) for (let k = 0; k < 14; k++) {
          const a = rnd() * TAU, r = 0.3 + rnd() * 1.1, h = 0.4 + rnd() * 0.7, x = c.x * 1.02 + Math.cos(a) * r, z = c.z * 1.02 + Math.sin(a) * r;
          add(mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 8), k % 3 ? wax : wax2, { x, y: STAGE + h / 2, z }));
          flames.push({ x, y: STAGE + h + 0.08, z, s: 0.5, color: '#ffb040' });
        }
        for (const c of anchors.corners) glows.push({ p: V3(c.x, STAGE + 1.5, c.z), color: '#ffb040', power: 0.7 });
        break;
      }
      case 'Panagbenga': {
        // flower garlands piled round the stage, flower arches either side, pines in the mist
        const petal = F.map((c) => std(c, { roughness: 0.55 }));
        const flower = new THREE.IcosahedronGeometry(0.34, 0);
        const count = 420, im = new THREE.InstancedMesh(flower, std('#ffffff', { roughness: 0.55, flatShading: true }), count); let i = 0;
        const put = (x, y, z, s = 1) => { if (i >= count) return; dummy.position.set(x, y, z); dummy.rotation.set(rnd() * 3, rnd() * 3, 0); dummy.scale.setScalar(s * (0.7 + rnd() * 0.6)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, C.set(F[i % F.length])); i++; };
        for (const s of [-1, 1]) for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI, x = s * 13.8, z = Math.cos(a) * 9, y = STAGE + Math.sin(a) * 9; put(x + (rnd() - 0.5) * 0.4, y, z, 1.2); put(x + (rnd() - 0.5) * 0.6, y + (rnd() - 0.5) * 0.5, z + (rnd() - 0.5) * 0.5, 1); put(x, y - 0.3, z + 0.3, 0.9); }
        for (let k = 0; k < 120; k++) { const a = rnd() * TAU, side = k % 4, t = rnd() * 2 - 1, x = [t * 12, t * 12, 12.2, -12.2][side], z = [12.2, -12.2, t * 12, t * 12][side]; put(x, STAGE + 0.25, z, 0.9); }
        im.count = i; im.instanceColor.needsUpdate = true; im.castShadow = true; add(im);
        for (const s of [-1, 1]) add(mesh(new THREE.TorusGeometry(9, 0.25, 8, 40, Math.PI), std('#3a6a2a'), { x: s * 13.8, y: STAGE, ry: Math.PI / 2 }));
        const pine = std('#2a4a30', { roughness: 0.9 }), trunk = std('#4a3020', { roughness: 0.95 });
        for (const [x, z, h] of [[-26, -26, 22], [26, -28, 26], [-38, 4, 24], [38, -6, 22], [-22, 34, 20], [24, 36, 24], [-8, -44, 28], [10, -46, 24], [-44, -20, 26], [44, 24, 24]]) {
          const t = new THREE.Group(); t.position.set(x, 0, z); add(t);
          t.add(mesh(new THREE.CylinderGeometry(0.4, 0.7, h * 0.4, 8), trunk, { y: h * 0.2 }));
          for (let k = 0; k < 5; k++) t.add(mesh(new THREE.ConeGeometry(h * (0.3 - k * 0.045), h * 0.34, 10), pine, { y: h * (0.3 + k * 0.14) }));
        }
        break;
      }
      case 'MassKara': {
        // giant smiling masks on poles, and neon arches
        const tex = [T.mask(1, F), T.mask(2, [F[2], F[0], F[3], F[1]]), T.mask(3, [F[0], F[3], F[1], F[2]])];
        const masks = [[-18, -17], [18, -17], [-25, -2], [25, -2], [-25, 10], [25, 10], [0, -21], [-10, -20], [10, -20]];
        masks.forEach(([x, z], k) => {
          const m = new THREE.Group(); m.position.set(x, 0, z); add(m);
          const p = bambooPole(9, 0.12, dark); p.rotation.set(0, 0, 0); p.position.y = 4.5; m.add(p);
          const face = mesh(new THREE.PlaneGeometry(6, 6), std('#ffffff', { map: tex[k % 3], alphaTest: 0.3, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tex[k % 3], emissiveIntensity: 0.35 }), { y: 11 });
          m.add(face); m.rotation.y = Math.atan2(-x, -z) + Math.PI;
          spin.push({ o: face, kind: 'bob', p: k });
        });
        const neon = F.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.3 }));
        for (let k = 0; k < 3; k++) for (const s of [-1, 1]) add(mesh(new THREE.TorusGeometry(10 - k * 1.4, 0.09, 6, 48, Math.PI), neon[k % neon.length], { x: s * (14 + k * 0.5), y: STAGE, ry: Math.PI / 2, cast: false }));
        for (const [x, z] of masks) glows.push({ p: V3(x, 9, z), color: pick(F), power: 1 });
        break;
      }
      case 'Ati-Atihan': {
        // torches round the stage, drums, tribal banners and a bonfire
        const cloth = T.tribal(4, F.length >= 4 ? [F[0], F[1], F[2], '#fff8e1'] : F);
        const bannerM = std('#ffffff', { map: cloth, roughness: 0.85, side: THREE.DoubleSide });
        for (const [x, z] of [[-14.5, -14.5], [14.5, -14.5], [-14.5, 14.5], [14.5, 14.5], [-15.5, -6], [15.5, -6], [-15.5, 6], [15.5, 6]]) {
          const t = new THREE.Group(); t.position.set(x, 0, z); add(t);
          const p = bambooPole(5.5, 0.12, dark); p.rotation.set(0, 0, 0); p.position.y = 2.75; t.add(p);
          t.add(mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.7, 10), std('#3a2414', { roughness: 0.9 }), { y: 5.6 }));
          flames.push({ x, y: 6.1, z, s: 1.6, color: '#ff8a2a', torch: true });
          glows.push({ p: V3(x, 6.4, z), color: '#ff8a3a', power: 1.2 });
        }
        for (const [x, z] of [[-20, -18], [20, -18], [-26, 2], [26, 2]]) {
          const b = mesh(new THREE.PlaneGeometry(3, 10), bannerM, { x, y: 7, z }); b.rotation.y = Math.atan2(-x, -z) + Math.PI; add(b);
          add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 13, 6), std('#2a1a10'), { x, y: 6.5, z }));
          spin.push({ o: b, kind: 'flutter', p: x });
        }
        const drumM = std('#ffffff', { map: cloth, roughness: 0.7 }), hide = std('#d9c4a0', { roughness: 0.8 });
        for (const [x, z, r] of [[-17, -13, 1.1], [-17.5, -10.5, 0.8], [17, -13, 1.1], [17.6, -10.4, 0.8]]) { add(mesh(new THREE.CylinderGeometry(r, r * 0.85, r * 2.2, 18), drumM, { x, y: r * 1.1, z })); add(mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.06, 18), hide, { x, y: r * 2.2, z })); }
        flames.push({ x: 0, y: 1.2, z: -19, s: 3.2, color: '#ff7a1a', torch: true, fire: true });
        glows.push({ p: V3(0, 2.5, -19), color: '#ff7a2a', power: 2 });
        const logs = std('#3a2414', { roughness: 0.95 });
        for (let k = 0; k < 6; k++) add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.2, 8), logs, { x: Math.cos(k) * 0.4, y: 0.8, z: -19 + Math.sin(k) * 0.4, rx: 0.9 * Math.cos(k * 1.7), rz: 0.9 * Math.sin(k * 1.7) }));
        break;
      }
      case 'Kadayawan': {
        // fruit piled high at the stage corners, orchids, and woven t'nalak banners
        const fruit = [['#7a8a2a', 0.55, 'durian'], ['#b8d05a', 0.6], ['#e0b03a', 0.3], ['#6a1a3a', 0.25], ['#e8d24a', 0.28], ['#c04a2a', 0.3]];
        const spike = new THREE.IcosahedronGeometry(1, 1);
        for (const c of anchors.corners) {
          const heap = new THREE.Group(); heap.position.set(c.x * 1.02, STAGE, c.z * 1.02); add(heap);
          heap.add(mesh(new THREE.CylinderGeometry(1.3, 1, 0.6, 16, 1, true), std('#a07a3e', { roughness: 0.9, side: THREE.DoubleSide }), { y: 0.3 }));
          for (let k = 0; k < 16; k++) { const [col, r, kind] = fruit[k % fruit.length]; heap.add(mesh(kind ? spike : new THREE.SphereGeometry(1, 14, 10), std(col, { roughness: kind ? 0.9 : 0.5, flatShading: !!kind }), { x: (rnd() - 0.5) * 1.6, y: 0.5 + rnd() * 0.9, z: (rnd() - 0.5) * 1.6, s: r })); }
        }
        const cloth = T.tribal(9, ['#3a1a10', '#c0392b', '#f4e8d0', '#2a2a2a']);
        const bannerM = std('#ffffff', { map: cloth, roughness: 0.85, side: THREE.DoubleSide });
        for (const [x, z] of [[-20, -18], [20, -18], [-26, 2], [26, 2], [-26, 12], [26, 12]]) {
          const b = mesh(new THREE.PlaneGeometry(2.6, 9), bannerM, { x, y: 7.5, z }); b.rotation.y = Math.atan2(-x, -z) + Math.PI; add(b);
          add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 13, 6), std('#2a1a10'), { x, y: 6.5, z }));
          spin.push({ o: b, kind: 'flutter', p: z });
        }
        break;
      }
      default: {
        // the plain barangay fiesta: balloons at the stage corners
        const bal = F.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1 }));
        for (const c of anchors.corners) for (let k = 0; k < 5; k++) {
          const b = new THREE.Group(); b.position.set(c.x * 1.06 + (rnd() - 0.5) * 1.2, STAGE, c.z * 1.06 + (rnd() - 0.5) * 1.2); add(b);
          const h = 5 + rnd() * 2;
          b.add(mesh(new THREE.SphereGeometry(0.7, 16, 12), bal[k % bal.length], { y: h, s: [1, 1.2, 1] }));
          b.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, h, 4), std('#eeeeee'), { y: h / 2, cast: false }));
        }
      }
    }
    // everyone gets parols on the tall posts (bigger at MassKara)
    posts.forEach((p, i) => parol(p.clone().add(V3(0, -1.6, 0)), F[i % 2], name === 'MassKara' ? 1.2 : 0.8)); // two colours, alternating
    // everything that doesn't move becomes a few merged meshes: one per material
    for (const s of spin) s.o.traverse((m) => { m.userData.keep = true; });
    nearShadows(g); mergeStatic(g);
    return g;
  }

  // ---------- switching festivals ----------
  const matMaps = new Map();
  let current = null, entering = null, leaving = null, grow = 1;
  function paintFestival(fest, paint) {
    // the stage skirt: wide stripes; the awnings: stripes; the hem: a braid
    const sx = skirtCanvas.getContext('2d');
    paint.forEach((c, i) => { sx.fillStyle = c; sx.fillRect((i * 512) / paint.length, 0, 512 / paint.length + 1, 64); });
    sx.fillStyle = 'rgba(0,0,0,0.18)'; sx.fillRect(0, 52, 512, 12); sx.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 32; k++) { sx.beginPath(); sx.arc(k * 16 + 8, 58, 4, 0, TAU); sx.fill(); }
    skirtTex.needsUpdate = true;
    const ax = awnCanvas.getContext('2d');
    for (let k = 0; k < 8; k++) { ax.fillStyle = k % 2 ? '#d8d0c0' : T.shade(paint[(k / 2) % paint.length | 0], 0.85); ax.fillRect(k * 32, 0, 32, 256); }
    awnTex.needsUpdate = true;
    const hx = hemCanvas.getContext('2d');
    hx.fillStyle = T.shade(fest.bands[0], 0.8); hx.fillRect(0, 0, 256, 32);
    for (let k = 0; k < 16; k++) { hx.fillStyle = k % 2 ? fest.bands[2] : '#f2e2b8'; hx.beginPath(); hx.moveTo(k * 16, 4); hx.lineTo(k * 16 + 16, 16); hx.lineTo(k * 16, 28); hx.fill(); }
    hemTex.needsUpdate = true;
  }
  function setFestival(fest, look, { instant = false } = {}) {
    if (current && current.name === fest.name) return;
    if (!matMaps.has(fest.name)) matMaps.set(fest.name, T.banigMap(fest, { px: low ? 48 : 72 }));
    matM.map = matMaps.get(fest.name); matM.needsUpdate = true;
    paintFestival(fest, look.paint);
    const kinds = { Fiesta: 'flag', Pahiyas: 'kiping', Sinulog: 'square', Panagbenga: 'flower', MassKara: 'bulb', 'Ati-Atihan': 'square', Kadayawan: 'flower' };
    setHang(kinds[fest.name] || 'flag', fest.flags);
    if (!sets.has(fest.name)) { flames.length = 0; glows.length = 0; const g = buildSet(fest.name, fest); g.userData.flames = flames.slice(); g.userData.glows = glows.slice(); sets.set(fest.name, g); live.add(g); }
    if (leaving) leaving.visible = false;
    leaving = current ? sets.get(current.name) : null;
    entering = sets.get(fest.name);
    for (const g of sets.values()) g.visible = g === entering || g === leaving;
    current = fest;
    grow = instant ? 1 : 0;
    if (instant && leaving) { leaving.visible = false; leaving = null; }
    applyGrow();
    capizM.emissiveIntensity = look.night * 1.4; if (stained) stained.emissiveIntensity = 0.15 + look.night * 1.6; lampGlass.emissiveIntensity = look.night * 3 + 0.2;
    hang.bulb.material.emissiveIntensity = 2.5;
  }
  function applyGrow() {
    const k = grow, e = k < 1 ? 1 - Math.pow(1 - k, 3) : 1;
    if (entering) { entering.scale.set(1, Math.max(0.001, e), 1); entering.position.y = (1 - e) * 6; }
    if (leaving) { const l = 1 - Math.min(1, k * 2); leaving.scale.set(1, Math.max(0.001, l), 1); if (l <= 0) { leaving.visible = false; leaving = null; } }
    hangGrow = e;
  }
  // ---------- each frame ----------
  function update(t, dt, { reduced = false, wrap = false } = {}) {
    if (grow < 1) { grow = Math.min(1, grow + dt / 1.3); applyGrow(); }
    // bunting in the breeze
    const im = hang[hangKind];
    slots.forEach((s, i) => {
      const sway = reduced ? 0 : Math.sin(t * 2.2 + i * 0.7) * 0.28;
      dummy.position.copy(s.p); dummy.rotation.set(sway, Math.atan2(-s.dir.z, s.dir.x), 0); dummy.scale.set(1, hangGrow, 1);
      if (hangKind === 'kiping') dummy.rotation.z = Math.sin(t * 1.3 + i) * 0.2;
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    for (const s of spin) {
      if (!s.o.parent || !s.o.parent.visible && s.o.parent.parent && !s.o.parent.parent.visible) continue;
      if (reduced) continue;
      if (s.kind === 'sway') s.o.rotation.z = Math.sin(t * 1.4 + s.p) * 0.08;
      else if (s.kind === 'flutter') s.o.rotation.x = Math.sin(t * 2.4 + s.p) * 0.08;
      else if (s.kind === 'bob') s.o.position.y = 11 + Math.sin(t * 1.3 + s.p) * 0.25;
      else if (s.kind === 'balloon') { s.o.rotation.z = Math.sin(t * 0.9 + s.p) * 0.06; s.o.rotation.x = Math.cos(t * 0.7 + s.p) * 0.05; }
    }
    wrapGlow.visible = wrap;
    if (wrap) glowTex.offset.x = reduced ? 0 : (t * 0.35) % 1;
  }
  const active = () => (current ? sets.get(current.name) : null);
  nearShadows(statics); mergeStatic(statics);
  for (const o of standIns) mergeStatic(o);
  mergeStatic(frame);
  return {
    root, mat, matM, frame, setFestival, update, stalls, lamps, standIns, anchors, postTops, setOf: (n) => sets.get(n),
    get flames() { const g = active(); return g ? g.userData.flames : []; },
    get glows() { const g = active(); return g ? g.userData.glows : []; },
    capizM, lampGlass,
  };
}
export { banga };
