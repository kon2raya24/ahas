// The crafted 3D pieces, in cell units (one cell = 1): the street food, the banga, the tandang, the
// snake's head with its salakot, the tinikling poles and the bamboo. Built from smooth primitives,
// lathes and sweeps with PBR materials; every piece is a Group with its base at y = 0.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { mergeStatic } from './plaza.mjs';

const TAU = Math.PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0, ...o });
function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = null, cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  if (s) (Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s));
  m.castShadow = cast; m.receiveShadow = true; return m;
}
const sphere = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);

// A tube along a curve whose radius changes along it (chili, bananas, feathers).
export function sweep(curve, radius, { tubular = 32, radial = 12, cap = true } = {}) {
  const frames = curve.computeFrenetFrames(tubular, false), pos = [], nor = [], uv = [], idx = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular; curve.getPointAt(t, p);
    const r = radius(t), N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU; n.set(0, 0, 0).addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r); nor.push(n.x, n.y, n.z); uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// Bumps for fried food: a normal map from noise, shared.
let BUMPY = null;
function bumpy() {
  if (BUMPY) return BUMPY;
  const r = T.rng(21), n = T.noise(128, 128, 4, r), f = T.noise(128, 128, 2, r), h = new Float32Array(128 * 128);
  for (let i = 0; i < h.length; i++) h[i] = n[i] * 0.7 + f[i] * 0.3;
  BUMPY = T.normalMap(h, 128, 128, 4); BUMPY.wrapS = BUMPY.wrapT = THREE.RepeatWrapping;
  return BUMPY;
}

// ---------- shared materials ----------
let MAT = null;
function mats() {
  if (MAT) return MAT;
  const bamb = T.bamboo(3, { color: '#d4b26a', nodes: 3 });
  const stick = std('#d9bb85', { roughness: 0.7 });
  MAT = {
    stick,
    fishball: phys('#b5732f', { roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.35, normalMap: bumpy(), normalScale: new THREE.Vector2(0.9, 0.9) }),
    sauce: phys('#5a2410', { roughness: 0.2, clearcoat: 1 }),
    kwek: phys('#ff7414', { roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.4, normalMap: bumpy(), normalScale: new THREE.Vector2(1.4, 1.4), sheen: 0.3, sheenColor: new THREE.Color('#ffb070') }),
    caramel: phys('#b8661a', { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, normalMap: bumpy(), normalScale: new THREE.Vector2(0.4, 0.4) }),
    wrapper: phys('#d68a2c', { roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2, normalMap: bumpy(), normalScale: new THREE.Vector2(0.7, 0.7) }),
    banana: phys('#7c3e0e', { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, normalMap: bumpy(), normalScale: new THREE.Vector2(0.35, 0.35) }),
    shell: phys('#f2e6cc', { roughness: 0.55, clearcoat: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#fff8e8') }),
    chili: phys('#d9150f', { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
    green: phys('#2e7d32', { roughness: 0.45, clearcoat: 0.4 }),
    glass: phys('#e8f6ff', { roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, ior: 1.5, specularIntensity: 1, depthWrite: false }),
    ube: phys('#6b2d91', { roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color('#c79ae8') }),
    ice: phys('#f4fbff', { roughness: 0.35, transmission: 0, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), normalMap: bumpy(), normalScale: new THREE.Vector2(1.2, 1.2) }),
    flan: phys('#f2b632', { roughness: 0.2, clearcoat: 1 }),
    beans: phys('#8a2a1a', { roughness: 0.4, clearcoat: 0.6 }),
    nata: phys('#ffffff', { roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }),
    pinipig: phys('#ff6fb5', { roughness: 0.5 }),
    spoon: phys('#d8dde6', { roughness: 0.2, metalness: 1 }),
    gold: phys('#ffcc4d', { roughness: 0.22, metalness: 1, clearcoat: 0.5 }),
    goldDark: phys('#b07a12', { roughness: 0.35, metalness: 1 }),
    enamel: phys('#fffaf0', { roughness: 0.15, clearcoat: 1 }),
    pupil: phys('#140c1c', { roughness: 0.1, clearcoat: 1 }),
    cord: std('#3a1f14', { roughness: 0.9 }),
    bamboo: std('#ffffff', { map: bamb.map, normalMap: bamb.normalMap, roughness: 0.55 }),
    block: std('#7a5230', { roughness: 0.8 }),
  };
  return MAT;
}

// Street food on a bamboo skewer: balls along a stick lying at a jaunty angle.
function skewer(g, balls, mat, { r = 0.13, scale = [1, 1, 1], gap = 1.62 } = {}) {
  const M = mats(), len = 0.86;
  const s = mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 8), M.stick, { rz: Math.PI / 2 }); g.add(s);
  const tip = mesh(new THREE.ConeGeometry(0.014, 0.05, 8), M.stick, { x: len / 2 + 0.02, rz: -Math.PI / 2 }); g.add(tip);
  for (let i = 0; i < balls; i++) {
    const x = (i - (balls - 1) / 2) * r * gap + 0.08;
    const b = mesh(sphere(r, 22, 16), mat, { x, s: scale, ry: i * 1.3 }); g.add(b);
  }
  return g;
}

// ---------- the food ----------
export function food(type) {
  const M = mats(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  switch (type) {
    case 'fishball': {
      skewer(body, 3, M.fishball, { r: 0.135 });
      // a lick of sweet sauce over the top
      for (let i = 0; i < 3; i++) body.add(mesh(sphere(0.07, 12, 8), M.sauce, { x: (i - 1) * 0.22 + 0.08, y: 0.1, s: [1.3, 0.35, 1] }));
      body.rotation.set(0, 0.7, 0.28);
      break;
    }
    case 'kwekkwek': {
      skewer(body, 3, M.kwek, { r: 0.12, scale: [1.18, 0.95, 0.95], gap: 1.9 });
      body.rotation.set(0, -0.6, 0.3);
      break;
    }
    case 'turon': {
      const roll = mesh(new THREE.CapsuleGeometry(0.12, 0.44, 8, 18), M.wrapper, { rz: Math.PI / 2 }); body.add(roll);
      // the wrapper's folds and the caramel that ran down
      for (let i = 0; i < 4; i++) body.add(mesh(new THREE.TorusGeometry(0.122, 0.012, 6, 24), M.caramel, { x: -0.18 + i * 0.12, ry: Math.PI / 2, rx: 0.4 }));
      body.add(mesh(sphere(0.1, 14, 10), M.caramel, { x: 0.05, y: 0.07, s: [2.2, 0.5, 1.1] }));
      body.add(mesh(sphere(0.035, 8, 6), M.caramel, { x: 0.12, y: -0.1, z: 0.07, s: [1, 1.6, 1] }));
      body.rotation.set(0, 0.5, 0);
      body.position.y = 0.02;
      break;
    }
    case 'bananacue': {
      const s = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 8), M.stick, { rz: Math.PI / 2 }); body.add(s);
      for (const [x, k] of [[-0.17, 1], [0.2, -1]]) {
        const c = new THREE.QuadraticBezierCurve3(V3(x - 0.02, 0.12 * k, -0.2), V3(x + 0.07, 0, 0), V3(x - 0.02, -0.02 * k, 0.2));
        const b = mesh(sweep(c, (t) => 0.035 + Math.sin(t * Math.PI) ** 0.6 * 0.085, { tubular: 20, radial: 12 }), M.banana, { ry: Math.PI / 2 * 0 });
        b.rotation.y = Math.PI / 2; b.position.set(x, 0, 0); body.add(b);
      }
      body.rotation.set(0, -0.8, 0.22);
      break;
    }
    case 'balut': {
      const egg = mesh(sphere(0.17, 26, 18), M.shell, { y: 0.02, s: [1, 1.28, 1] }); body.add(egg);
      // the little woven dish it sits in
      const dish = mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.08, 20, 1, true), std('#b98a4a', { roughness: 0.85, side: THREE.DoubleSide }), { y: -0.17 }); body.add(dish);
      body.add(mesh(sphere(0.02, 8, 6), M.shell, { x: 0.12, y: 0.14, z: 0.05 }));
      break;
    }
    case 'sili': {
      const c = new THREE.CubicBezierCurve3(V3(-0.28, 0.06, 0), V3(-0.08, 0.1, 0.05), V3(0.14, 0.02, -0.02), V3(0.3, -0.12, 0.06));
      body.add(mesh(sweep(c, (t) => (0.03 + 0.1 * Math.sin(Math.min(1, (1 - t) * 1.3) * Math.PI / 2)) * (t > 0.96 ? 0.6 : 1), { tubular: 28, radial: 14 }), M.chili));
      body.add(mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.05, 10), M.green, { x: -0.3, y: 0.06, rz: Math.PI / 2 - 0.2 }));
      body.add(mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.18, 8), M.green, { x: -0.38, y: 0.12, rz: 0.9 }));
      body.rotation.set(0, 0.8, 0.12);
      break;
    }
    case 'halohalo': {
      const prof = [[0.001, 0], [0.12, 0], [0.13, 0.02], [0.06, 0.06], [0.05, 0.12], [0.11, 0.16], [0.2, 0.3], [0.23, 0.56], [0.235, 0.58]].map(([r, y]) => new THREE.Vector2(r, y));
      const cup = mesh(new THREE.LatheGeometry(prof, 28), M.glass, { y: -0.3 }); cup.renderOrder = 2; body.add(cup);
      const layer = (r0, r1, y0, h, m) => body.add(mesh(new THREE.CylinderGeometry(r1, r0, h, 22), m, { y: -0.3 + y0 + h / 2, cast: false }));
      layer(0.105, 0.155, 0.16, 0.09, M.beans); layer(0.155, 0.19, 0.25, 0.1, M.nata); layer(0.19, 0.215, 0.35, 0.18, M.ice);
      body.add(mesh(sphere(0.16, 20, 14), M.ice, { y: 0.24, s: [1.3, 0.62, 1.3] }));
      body.add(mesh(sphere(0.11, 20, 14), M.ube, { x: -0.05, y: 0.34, s: [1, 0.85, 1] }));
      body.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 16), M.flan, { x: 0.09, y: 0.33, z: 0.05, rz: -0.3 }));
      for (let i = 0; i < 7; i++) body.add(mesh(sphere(0.018, 6, 4), M.pinipig, { x: Math.cos(i * 2.1) * 0.14, y: 0.3 + (i % 3) * 0.015, z: Math.sin(i * 2.1) * 0.14, cast: false }));
      const spoon = new THREE.Group(); spoon.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 6), M.spoon, { y: 0.3 })); spoon.add(mesh(sphere(0.04, 10, 8), M.spoon, { s: [1, 0.35, 1.5] }));
      spoon.position.set(0.08, 0.15, -0.06); spoon.rotation.set(0.3, 0, -0.35); body.add(spoon);
      body.position.y = 0.14;
      break;
    }
    case 'anting': {
      const sh = new THREE.Shape(); const R = 0.26;
      for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k * TAU) / 3; (k ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * R, -Math.sin(a) * R); }
      sh.closePath();
      const tri = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 3 }), M.gold, { z: -0.025 }); body.add(tri);
      const inner = new THREE.Shape(); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k * TAU) / 3; (k ? inner.lineTo : inner.moveTo).call(inner, Math.cos(a) * R * 0.6, -Math.sin(a) * R * 0.6); } inner.closePath();
      body.add(mesh(new THREE.ExtrudeGeometry(inner, { depth: 0.02, bevelEnabled: false }), M.goldDark, { z: 0.05 }));
      body.add(mesh(sphere(0.07, 18, 10), M.enamel, { z: 0.07, s: [1.2, 0.72, 0.35] }));
      body.add(mesh(sphere(0.035, 14, 10), M.pupil, { z: 0.09, s: [1, 1, 0.4] }));
      body.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 18), M.goldDark, { y: 0.28 }));
      body.add(mesh(new THREE.TorusGeometry(0.28, 0.008, 6, 40, Math.PI * 1.2), M.cord, { y: 0.34, rz: Math.PI * -0.1 + Math.PI * 0 }));
      body.position.y = 0.18;
      break;
    }
    default: break;
  }
  mergeStatic(body);
  return g;
}
// Glow colours for the specials (the ring on the mat and the light above).
export const SPECIAL_GLOW = { balut: '#ffd23f', sili: '#ff4a1f', halohalo: '#8fd3ff', anting: '#fff0a0' };

// ---------- banga ----------
let POT = null;
export function banga(rand = Math.random) {
  if (!POT) {
    const t = T.terracotta(4);
    const prof = [[0.001, 0], [0.2, 0], [0.26, 0.04], [0.38, 0.18], [0.42, 0.32], [0.39, 0.46], [0.3, 0.58], [0.2, 0.68], [0.18, 0.74], [0.24, 0.8], [0.25, 0.84], [0.215, 0.85], [0.17, 0.78], [0.16, 0.7]].map(([r, y]) => new THREE.Vector2(r, y));
    POT = { geo: new THREE.LatheGeometry(prof, 36), mat: std('#ffffff', { map: t.map, normalMap: t.normalMap, roughness: 0.82 }), inside: std('#2a1208', { roughness: 1 }) };
  }
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(mesh(POT.geo, POT.mat, { s: [1.02, 1.05, 1.02] }));
  body.add(mesh(new THREE.CircleGeometry(0.16, 20), POT.inside, { y: 0.74, rx: -Math.PI / 2, cast: false }));
  body.rotation.y = rand() * TAU;
  return g;
}

// ---------- the tandang ----------
export function rooster() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const red = phys('#9a2a10', { roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#ff7a3a') });
  const hackle = phys('#e2801f', { roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color('#ffd070') });
  const tailM = phys('#0c2a22', { roughness: 0.3, sheen: 1, sheenColor: new THREE.Color('#2ad08a'), clearcoat: 0.6 });
  const tail2 = phys('#12204a', { roughness: 0.3, sheen: 1, sheenColor: new THREE.Color('#4a7aff'), clearcoat: 0.6 });
  const comb = phys('#e3122e', { roughness: 0.35, clearcoat: 0.5 });
  const beakM = phys('#f2c230', { roughness: 0.35 });
  const legM = phys('#e8b83a', { roughness: 0.5 });
  body.add(mesh(sphere(0.25, 24, 16), red, { y: 0.46, s: [1.25, 0.95, 0.88] }));
  body.add(mesh(sphere(0.2, 18, 12), hackle, { x: -0.02, y: 0.44, z: 0.13, s: [1.2, 0.7, 0.45], rz: -0.2 }));
  body.add(mesh(sphere(0.2, 18, 12), hackle, { x: -0.02, y: 0.44, z: -0.13, s: [1.2, 0.7, 0.45], rz: -0.2 }));
  const neck = new THREE.Group(); neck.position.set(0.2, 0.58, 0); body.add(neck);
  neck.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.24, 14), hackle, { y: 0.08, rz: -0.35 }));
  const head = new THREE.Group(); head.position.set(0.08, 0.24, 0); neck.add(head);
  head.add(mesh(sphere(0.095, 18, 12), red, { s: [1.1, 1, 0.9] }));
  for (let k = 0; k < 4; k++) head.add(mesh(sphere(0.045, 10, 8), comb, { x: 0.07 - k * 0.045, y: 0.09 + Math.sin((k / 3) * Math.PI) * 0.03, s: [0.8, 1.2, 0.55] }));
  head.add(mesh(sphere(0.035, 10, 8), comb, { x: 0.09, y: -0.08, s: [0.7, 1.4, 0.6] }));
  head.add(mesh(new THREE.ConeGeometry(0.03, 0.09, 10), beakM, { x: 0.13, y: -0.01, rz: -Math.PI / 2 - 0.2 }));
  for (const s of [-1, 1]) {
    head.add(mesh(sphere(0.022, 10, 8), mats().enamel, { x: 0.05, y: 0.025, z: s * 0.07 }));
    head.add(mesh(sphere(0.013, 8, 6), mats().pupil, { x: 0.062, y: 0.025, z: s * 0.082 }));
  }
  // sickle feathers arching up and back
  const tail = new THREE.Group(); tail.position.set(-0.24, 0.52, 0); body.add(tail);
  for (let k = 0; k < 7; k++) {
    const z = (k - 3) * 0.035, h = 0.3 + (k % 3) * 0.08, back = 0.28 + (k % 2) * 0.08;
    const c = new THREE.QuadraticBezierCurve3(V3(0, 0, z), V3(-back * 0.3, h * 1.2, z * 1.4), V3(-back, h * 0.2, z * 2));
    tail.add(mesh(sweep(c, (t) => 0.035 * (1 - t * 0.7), { tubular: 14, radial: 6 }), k % 2 ? tail2 : tailM));
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0, 0.3, s * 0.08); body.add(leg);
    leg.add(mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.3, 8), legM, { y: -0.15 }));
    for (const a of [-0.5, 0, 0.5]) leg.add(mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.1, 6), legM, { x: Math.cos(a) * 0.04, y: -0.3, z: Math.sin(a) * 0.04, rz: -Math.PI / 2, ry: -a }));
    legs.push(leg);
  }
  body.scale.setScalar(0.92);
  return { group: g, body, neck, head, tail, legs };
}

// ---------- the snake's head ----------
// Local +x is forward. The skull is a sphere pulled into a blunt, friendly wedge.
export function snakeHead() {
  const skin = T.headSkin('#d0142c');
  for (const x of [skin.map, skin.normalMap]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(3, 3); }
  const skinM = phys('#ffffff', { map: skin.map, normalMap: skin.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.18 });
  const g = new THREE.Group();
  const geo = sphere(1, 36, 24), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = Math.max(0, x); // the snout narrows and flattens
    z *= 1 - f * 0.28; y *= 1 - f * 0.18; if (y < 0) y *= 0.62;
    y += x * 0.06 - (x > 0.4 ? (x - 0.4) * 0.1 : 0);
    p.setXYZ(i, x * 0.5, y * 0.25 + 0.02, z * 0.39);
  }
  geo.computeVertexNormals();
  const skull = mesh(geo, skinM); g.add(skull);
  const jaw = new THREE.Group(); jaw.position.set(-0.18, 0.0, 0); g.add(jaw);
  const jgeo = sphere(1, 28, 12), jp = jgeo.attributes.position;
  for (let i = 0; i < jp.count; i++) { let x = jp.getX(i), y = jp.getY(i), z = jp.getZ(i); const f = Math.max(0, x); z *= 1 - f * 0.3; y = Math.min(0, y) * 0.5; jp.setXYZ(i, x * 0.46 + 0.18, y * 0.16, z * 0.35); }
  jgeo.computeVertexNormals();
  jaw.add(mesh(jgeo, skinM));
  const mouthM = phys('#7a1030', { roughness: 0.3, clearcoat: 1 });
  jaw.add(mesh(new THREE.CircleGeometry(1, 24), mouthM, { x: 0.18, y: 0.005, rx: -Math.PI / 2, s: [0.42, 0.3, 1], cast: false }));
  // eyes: big and glossy, with lids for blinking
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(0.14, 0.16, s * 0.2); g.add(e);
    e.add(mesh(sphere(0.1, 20, 14), mats().enamel));
    const pupil = mesh(sphere(0.062, 18, 12), mats().pupil, { x: 0.05, y: 0.02, z: s * 0.045 }); e.add(pupil);
    e.add(mesh(sphere(0.018, 8, 6), phys('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), { x: 0.085, y: 0.06, z: s * 0.05, cast: false }));
    const lid = mesh(new THREE.SphereGeometry(0.108, 20, 10, 0, TAU, 0, Math.PI / 2), skinM, { cast: false }); lid.scale.y = 0.05; e.add(lid);
    eyes.push({ e, lid, pupil });
  }
  for (const s of [-1, 1]) g.add(mesh(sphere(0.02, 8, 6), mats().pupil, { x: 0.46, y: 0.08, z: s * 0.07 }));
  // the tongue: a forked ribbon that flicks out of the mouth
  const tongue = new THREE.Group(); tongue.position.set(0.4, 0.0, 0); g.add(tongue);
  const tm = phys('#ff2d6a', { roughness: 0.3, clearcoat: 1 });
  tongue.add(mesh(new THREE.BoxGeometry(0.26, 0.018, 0.035), tm, { x: 0.13 }));
  for (const s of [-1, 1]) tongue.add(mesh(new THREE.BoxGeometry(0.1, 0.016, 0.022), tm, { x: 0.3, z: s * 0.025, ry: -s * 0.5 }));
  tongue.scale.set(0.001, 1, 1);
  // the salakot
  const hat = salakot(); hat.scale.setScalar(0.72); hat.position.set(-0.12, 0.2, 0); g.add(hat);
  return { group: g, skull, jaw, eyes, tongue, hat, skinM };
}
export function salakot() {
  const weave = T.sawali(12, { color: '#d8b16a', n: 18 });
  weave.map.wrapS = weave.map.wrapT = THREE.RepeatWrapping; weave.normalMap.wrapS = weave.normalMap.wrapT = THREE.RepeatWrapping;
  weave.map.repeat.set(4, 1); weave.normalMap.repeat.set(4, 1);
  const m = std('#ffffff', { map: weave.map, normalMap: weave.normalMap, roughness: 0.62, side: THREE.DoubleSide });
  const g = new THREE.Group(), cone = new THREE.Group(); g.add(cone);
  const prof = [[0.001, 0.26], [0.05, 0.245], [0.16, 0.18], [0.3, 0.09], [0.42, 0.03], [0.46, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
  cone.add(mesh(new THREE.LatheGeometry(prof, 40), m));
  cone.add(mesh(new THREE.TorusGeometry(0.455, 0.018, 8, 48), std('#6a3e1c', { roughness: 0.7 }), { y: 0.005, rx: Math.PI / 2 }));
  cone.add(mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 36), std('#ce1126', { roughness: 0.5 }), { y: 0.155, rx: Math.PI / 2 }));
  cone.add(mesh(sphere(0.035, 12, 8), mats().gold, { y: 0.27 }));
  cone.add(mesh(new THREE.ConeGeometry(0.016, 0.1, 8), mats().gold, { y: 0.33 }));
  return g;
}

// ---------- bamboo ----------
// A bamboo pole along +x, `len` long, with nodes; `bamb` picks the colouring.
const BAMB = new Map();
export function bambooMat(kind = 'dry') {
  if (!BAMB.has(kind)) {
    const t = kind === 'green' ? T.bamboo(8, { color: '#b7b85a', nodes: 3, green: 0.7 }) : kind === 'dark' ? T.bamboo(5, { color: '#a07a3e', nodes: 3 }) : T.bamboo(3, { color: '#d9b66a', nodes: 3 });
    t.map.wrapS = t.map.wrapT = THREE.RepeatWrapping; t.normalMap.wrapS = t.normalMap.wrapT = THREE.RepeatWrapping;
    BAMB.set(kind, { map: t.map, normalMap: t.normalMap });
  }
  const b = BAMB.get(kind);
  return phys('#ffffff', { map: b.map, normalMap: b.normalMap, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4 });
}
export function bambooPole(len, r, mat, { radial = 16 } = {}) {
  const geo = new THREE.CylinderGeometry(r, r * 1.04, len, radial, 1, false);
  // stretch the texture so the nodes sit about 1.4 cells apart
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (len / 4.2));
  const m = mesh(geo, mat, { rz: Math.PI / 2 });
  return m;
}

// ---------- the tinikling poles ----------
export function tiniklingPoles() {
  const mat = bambooMat('green'), g = new THREE.Group(), poles = [];
  for (let k = 0; k < 2; k++) { const p = new THREE.Group(); p.add(bambooPole(23.6, 0.15, mat)); g.add(p); poles.push(p); }
  // the wooden blocks they're struck on, at both ends
  const blocks = [];
  const wood = std('#7a5230', { roughness: 0.75 });
  for (const s of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(0.9, 0.47, 2.4), wood, { x: s * 11.45, y: 0.235 }); g.add(b); blocks.push(b); }
  return { group: g, poles, blocks };
}
