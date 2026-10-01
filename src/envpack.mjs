// Real surroundings for the plaza: CC0 scans from Poly Haven (converted with the Bakbakan tools).
// - a photographed sky per festival lights and reflects everything, and another is seen behind
// - the big surfaces (the brick plaza, the church's coral stone, roof tiles, plaster, the stage's boards)
//   get scanned materials
// - real props stand at the stalls, round the stage and in each festival's dressing, drawn instanced
// Without the files the painted plaza stays as it is.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-mocap.min.js';
import { HDRLoader } from './vendor/three-fx.min.js';
import { M, STAGE } from './plaza.mjs';

// what each tagged surface becomes: [Poly Haven material, units a tile covers, roughness]
const SURF = {
  ground: ['herringbone_pavement', 4.2, 1], stone: ['coral_stone_wall', 7, 1], roof: ['clay_roof_tiles_02', 5, 0.9],
  plaster: ['painted_plaster_wall', 6, 1], wood: ['wood_floor_worn', 6, 1],
};
const H = Math.PI / 2;
// [prop, x, y, z, turn, scale (on top of metres → units)]; y 'table' puts it on a stall's counter
const COMMON = [
  // under the awnings: two tables a stall, laden
  ...[-11, 0, 11].flatMap((z) => [-1, 1].flatMap((s) => [
    ['wooden_table_02', s * 21, 0, z - 1.9, s * H, 1], ['wooden_table_02', s * 21, 0, z + 1.9, s * H, 1],
    ['wicker_basket_02', s * 21, 'table', z - 2.6, 0.3, 1.3], ['bananas', s * 21.1, 'table', z - 1.3, 1.2, 1.2], ['jug_01', s * 20.8, 'table', z + 1.2, 0.4, 1.3],
    ['wicker_basket_01', s * 21.2, 'table', z + 2.6, -0.4, 1.3], ['food_pomegranate_01', s * 20.7, 'table', z + 2.3, 0, 1.4], ['lemon', s * 20.9, 'table', z - 2.2, 0, 1.4],
    ['plastic_monobloc_chair_01', s * 17.4, 0, z - 1.5, s * -H + 0.3, 1], ['plastic_monobloc_chair_01', s * 17.2, 0, z + 1.8, s * -H - 0.4, 1],
  ])),
  ['wooden_crate_01', -24, 0, -15.5, 0.2, 1], ['wooden_crate_01', -24, 1.12, -15.4, -0.1, 1], ['Barrel_01', 24.2, 0, -15.8, 0, 1], ['wooden_bucket_01', 23.2, 0, 15.8, 0.5, 1],
  ['CoffeeCart_01', 6, 0, 19, 0.3, 1], ['painted_wooden_bench', -9, 0, -17.5, 0, 1], ['painted_wooden_bench', 0, 0, -17.8, 0, 1], ['painted_wooden_bench', 9, 0, -17.5, 0, 1],
  ['potted_plant_02', -15.6, 0, -15.6, 0, 1.3], ['potted_plant_02', 15.6, 0, -15.6, 1, 1.3], ['ceramic_pot', -15.4, 0, 15.4, 0, 1], ['ceramic_pot', 15.4, 0, 15.4, 0, 1],
  ...[[-33, -30], [33, -30], [-35, 22], [35, 22], [-28, 40], [28, 40], [-14, -36], [14, -36]].map(([x, z], k) => [k % 2 ? 'island_tree_03' : 'island_tree_01', x, 0, z, k * 1.3, k % 2 ? 1.6 : 1.1]),
];
const FEST = {
  Pahiyas: [['sweet_potato', -11.4, STAGE, 12.6, 0, 3], ['sweet_potato', 11.6, STAGE, 12.4, 1, 3], ['bananas', -12.4, STAGE, -12.6, 0.5, 1.4], ['bananas', 12.2, STAGE, -12.4, 2, 1.4]],
  Sinulog: [['brass_candleholders', -13.2, 0, -14.6, 0, 1.2], ['brass_candleholders', 13.2, 0, -14.6, 0, 1.2], ['brass_candleholders', -14.6, 0, 13.2, H, 1.2], ['brass_candleholders', 14.6, 0, 13.2, -H, 1.2]],
  Panagbenga: [...[-9, -3, 3, 9].flatMap((z) => [['flower_gazania', -14.2, 0, z, H, 1.3], ['flower_gazania', 14.2, 0, z, -H, 1.3]]), ...[-8, 0, 8].map((x) => ['flower_ursinia', x, 0, -14.2, 0, 1.5])],
  MassKara: [['wooden_lantern_01', -12.4, STAGE, -12.4, 0, 1.5], ['wooden_lantern_01', 12.4, STAGE, -12.4, 0, 1.5], ['Lantern_01', -12.4, STAGE, 12.4, 0, 2], ['Lantern_01', 12.4, STAGE, 12.4, 0, 2]],
  'Ati-Atihan': [['stone_fire_pit', 0, 0, -19, 0, 1.1]],
  Kadayawan: [['food_lychee_01', -11.6, STAGE + 1.4, 12.5, 0, 5], ['food_lime_01', 11.6, STAGE + 1.4, 12.5, 0, 4], ['bananas', -12.2, STAGE + 1.3, -12.2, 0.3, 1.5], ['bananas', 12.2, STAGE + 1.3, -12.2, 2.2, 1.5], ['wicker_basket_02', -22, 2.6 * 1, -8, 0, 1.4]],
};

export async function loadEnv(base = 'assets/env/') {
  const res = await fetch(base + 'env.json');
  if (!res.ok) throw new Error('no env');
  return { base, index: await res.json(), props: new Map(), tex: new Map(), sky: new Map(), back: new Map() };
}
const gltf = new GLTFLoader(), texLoader = new THREE.TextureLoader();
const loadProp = (env, id) => {
  if (!env.index.props[id]) return Promise.resolve(null);
  if (!env.props.has(id)) env.props.set(id, gltf.loadAsync(env.base + 'props/' + id + '.glb').then((g) => g.scene).catch(() => null));
  return env.props.get(id);
};
const loadTex = (env, id) => {
  const t = env.index.tex[id];
  if (!t) return Promise.resolve(null);
  if (!env.tex.has(id)) env.tex.set(id, Promise.all(['diff', 'nor', 'arm'].map((k) => (t[k] ? texLoader.loadAsync(env.base + t[k]).catch(() => null) : null))).then(([diff, nor, arm]) => {
    if (diff) diff.colorSpace = THREE.SRGBColorSpace;
    for (const x of [diff, nor, arm]) if (x) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; }
    return { diff, nor, arm };
  }));
  return env.tex.get(id);
};

// The sky for a festival: [image-based light, backdrop]. Either may be null.
export function loadSky(env, look, pmrem) {
  const jobs = [];
  if (look.sky && env.index.sky[look.sky]) {
    if (!env.sky.has(look.sky)) env.sky.set(look.sky, new HDRLoader().loadAsync(env.base + env.index.sky[look.sky]).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; const rt = pmrem.fromEquirectangular(t); t.dispose(); return rt.texture; }).catch(() => null));
    jobs.push(env.sky.get(look.sky));
  } else jobs.push(null);
  const b = look.backdrop && env.index.backdrop && env.index.backdrop[look.backdrop];
  if (b) {
    if (!env.back.has(look.backdrop)) env.back.set(look.backdrop, texLoader.loadAsync(env.base + b).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }).catch(() => null));
    jobs.push(env.back.get(look.backdrop));
  } else jobs.push(null);
  return Promise.all(jobs);
}

// The scanned surfaces, once.
export async function dressSurfaces(env, root) {
  const mats = new Map();
  root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.userData.surface) mats.set(m, m.userData.surface); });
  await Promise.all([...mats].map(async ([m, s]) => {
    const [texId, tile, rough] = SURF[s.kind] || [];
    const t = texId && (await loadTex(env, texId));
    if (!t || !t.diff) return;
    const rep = [s.w / tile, s.h / tile], use = (x) => { if (!x) return null; const c = x.clone(); c.repeat.set(...rep); c.needsUpdate = true; return c; };
    if (s.detail) { m.normalMap = use(t.nor); if (t.arm) m.roughnessMap = use(t.arm); m.needsUpdate = true; return; }
    m.map = use(t.diff); m.normalMap = use(t.nor);
    if (t.arm) { m.roughnessMap = use(t.arm); m.aoMap = use(t.arm); m.aoMapIntensity = 0.7; }
    m.roughness = rough; m.color.set(s.tint || '#ffffff');
    m.needsUpdate = true;
  }));
}

// Props, drawn instanced: every mesh of every prop is one draw however many times it's placed.
export async function placeProps(env, list, parent) {
  const byId = new Map();
  for (const p of list) { if (!byId.has(p[0])) byId.set(p[0], []); byId.get(p[0]).push(p); }
  const group = new THREE.Group(); group.name = 'real props';
  const tableTop = (env.index.props.wooden_table_02 ? env.index.props.wooden_table_02.size[1] : 0.8) * M;
  let placed = 0;
  await Promise.all([...byId].map(async ([id, places]) => {
    const tpl = await loadProp(env, id);
    if (!tpl) return;
    tpl.updateMatrixWorld(true);
    const parts = [];
    tpl.traverse((o) => { if (o.isMesh) parts.push(o); });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const mats = places.map(([, x, y, z, ry, sc]) => m4.clone().compose(v.set(x, y === 'table' ? tableTop : y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), s.setScalar(M * sc)));
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geometry, part.material, mats.length);
      mats.forEach((w, i) => im.setMatrixAt(i, w.clone().multiply(part.matrixWorld)));
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
    placed += places.length;
  }));
  parent.add(group);
  return placed;
}

export async function dressPlaza(env, plaza) {
  await dressSurfaces(env, plaza.root);
  const n = await placeProps(env, COMMON, plaza.root);
  // the painted trees and stall goods step aside for the real ones
  if (n > COMMON.length / 2) for (const o of plaza.standIns) o.visible = false;
}
const dressed = new Set();
export async function dressFestival(env, plaza, name) {
  if (dressed.has(name) || !FEST[name]) return;
  dressed.add(name);
  const set = plaza.setOf(name);
  if (set) await placeProps(env, FEST[name], set);
}
