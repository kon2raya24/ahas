// The onlookers round the stage: townsfolk in fiesta shirts, drawn instanced (one draw per body part),
// who sway, chat and watch, and jump with their arms up when you chain a combo or a new festival
// arrives. If the baked Mixamo crowd from Tumbang Preso is in assets/people/ (it ships only in the
// Vercel deploy), real people stand in the same spots instead.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-mocap.min.js';
import { M } from './plaza.mjs';

const SHIRT = ['#ce1126', '#fcd116', '#0038a8', '#f4f1e8', '#ff8ae2', '#2ec4b6', '#ff9f1c', '#7e57c2', '#43a047', '#e0e0e0'];
const PANTS = ['#2a3a5a', '#3a3f4a', '#5a4a3a', '#1e2430', '#6a6a72'];
const SKIN = ['#c98a5a', '#b87a4a', '#d9a06b', '#a86a3a', '#8a5a34'];
const HAIR = ['#1b1320', '#2a1a14', '#3a2a20'];

// Where they stand: behind the benches at the far end, along the sides between the stage and the
// stalls, and further out in the plaza. Never on the near side, where they'd stand in front of the mat.
export function crowdSpots(rand) {
  const s = [];
  for (let k = 0; k < 14; k++) s.push({ x: -13 + k * 2 + (rand() - 0.5) * 0.8, z: -20.5 - rand() * 2.5 });
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) s.push({ x: side * (15.6 + rand() * 1.4), z: -12 + k * 2.6 + (rand() - 0.5) * 0.6 });
  for (let k = 0; k < 16; k++) { const a = Math.PI * (0.15 + 0.7 * rand()) + (k % 2 ? Math.PI : 0), r = 27 + rand() * 9; s.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 0.9 - 6 }); }
  return s.map((p) => ({ ...p, face: Math.atan2(-p.x, -p.z) }));
}

export function createCrowd(rand = Math.random) {
  const spots = crowdSpots(rand);
  const group = new THREE.Group(); group.name = 'crowd';
  const n = spots.length, H = 1.62 * M; // about 1.6 m tall
  const part = (geo, colors, mat = {}) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8, ...mat }), n);
    im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
    const c = new THREE.Color(); for (let i = 0; i < n; i++) im.setColorAt(i, c.set(colors[Math.floor(rand() * colors.length)]));
    group.add(im); return im;
  };
  const legs = part(new THREE.CapsuleGeometry(0.17 * M, 0.52 * M, 4, 8).translate(0, 0.43 * M, 0).scale(1.25, 1, 0.8), PANTS);
  const torso = part(new THREE.CapsuleGeometry(0.2 * M, 0.34 * M, 4, 10).translate(0, 1.12 * M, 0).scale(1.2, 1, 0.75), SHIRT);
  const head = part(new THREE.SphereGeometry(0.115 * M, 12, 10).scale(0.92, 1.08, 1).translate(0, 1.6 * M, 0), SKIN);
  const hair = part(new THREE.SphereGeometry(0.122 * M, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 1.63 * M, -0.012 * M), HAIR);
  const armGeo = new THREE.CapsuleGeometry(0.045 * M, 0.48 * M, 3, 6).translate(0, -0.28 * M, 0);
  const armL = part(armGeo, SKIN), armR = part(armGeo, SKIN);
  const who = spots.map((p) => ({ ...p, phase: rand() * 10, rate: 0.8 + rand() * 0.6, scale: 0.9 + rand() * 0.18, keen: rand(), turn: (rand() - 0.5) * 0.4 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), sh = new THREE.Matrix4(), base = new THREE.Matrix4();
  let real = null;
  function update(t, cheer = 0, reduced = false) {
    if (real) { real.update(t, cheer); return; }
    who.forEach((w, i) => {
      const c = cheer * (0.55 + w.keen * 0.45);
      const hop = reduced ? 0 : c > 0.15 ? Math.abs(Math.sin(t * 9 + w.phase)) * 0.35 * c * M * 0.4 : 0;
      const sway = reduced ? 0 : Math.sin(t * w.rate + w.phase) * 0.05;
      v.set(w.x, hop, w.z); q.setFromEuler(e.set(0, w.face + w.turn + sway, sway * 0.5)); s.setScalar(w.scale); base.compose(v, q, s);
      legs.setMatrixAt(i, base); torso.setMatrixAt(i, base); head.setMatrixAt(i, base); hair.setMatrixAt(i, base);
      // arms hang, or go up and wave in a cheer
      for (const [im, side] of [[armL, -1], [armR, 1]]) {
        const up = Math.min(1, c * 3) * (2.7 + (reduced ? 0 : Math.sin(t * 10 + w.phase + side) * 0.3));
        sh.compose(v.set(side * 0.25 * M, 1.36 * M, 0), q.setFromEuler(e.set(0, 0, side * (0.12 + up))), s.set(1, 1, 1));
        im.setMatrixAt(i, m4.multiplyMatrices(base, sh));
      }
    });
    for (const im of [legs, torso, head, hair, armL, armR]) im.instanceMatrix.needsUpdate = true;
  }
  update(0);
  // the baked Mixamo crowd, if it's there: same spots, real people
  async function loadReal(base = 'assets/people/') {
    const [gl, meta] = await Promise.all([new GLTFLoader().loadAsync(base + 'crowd.glb'), fetch(base + 'crowd.json').then((r) => { if (!r.ok) throw new Error('no crowd'); return r.json(); })]);
    const people = {};
    gl.scene.traverse((o) => { if (o.parent && o.name.includes('|') && o.name.split('|').length === 2) { const [id, pose] = o.name.split('|'); (people[id] ||= {})[pose] = o.children.filter((m) => m.isMesh); } });
    const ids = Object.keys(people).filter((id) => meta[id]);
    if (!ids.length) throw new Error('empty crowd');
    const g = new THREE.Group(); g.scale.setScalar(M); // the crowd is in metres
    const meshes = {};
    const list = who.map((w, i) => ({ ...w, id: ids[(i * 7) % ids.length] }));
    for (const id of ids) {
      const k = list.filter((w) => w.id === id).length; if (!k) continue;
      meshes[id] = {};
      for (const [pose, parts] of Object.entries(people[id])) meshes[id][pose] = parts.map((p) => { const im = new THREE.InstancedMesh(p.geometry, p.material, k); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; g.add(im); return im; });
    }
    group.add(g);
    for (const im of [legs, torso, head, hair, armL, armR]) im.visible = false;
    real = {
      update(t, cheer) {
        for (const id in meshes) for (const p in meshes[id]) for (const im of meshes[id][p]) im.count = 0;
        for (const w of list) {
          const pose = cheer * (0.55 + w.keen * 0.45) > 0.3 ? 'standUp' : 'standA'; // two poses, so idle costs half the draws
          const set = meshes[w.id][pose] ? pose : 'standA';
          const hop = cheer > 0.3 ? Math.abs(Math.sin(t * 7 + w.phase * 6)) * 0.1 : 0;
          v.set(w.x / M, hop, w.z / M); q.setFromEuler(e.set(0, w.face + w.turn, 0)); s.setScalar(w.scale); m4.compose(v, q, s);
          for (const im of meshes[w.id][set]) im.setMatrixAt(im.count++, m4);
        }
        for (const id in meshes) for (const p in meshes[id]) for (const im of meshes[id][p]) { im.instanceMatrix.needsUpdate = true; im.visible = im.count > 0; }
      },
    };
    return true;
  }
  return { group, update, loadReal, get real() { return !!real; } };
}
