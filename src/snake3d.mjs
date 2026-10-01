// The serpent in 3D: one glossy tube, rebuilt every frame along the path its segments take, with
// rounded corners, a slither that stays put in the world while the body slides through it, a bulge
// that travels down after each meal, and a tapering tail that whips. The head is a crafted model in a
// salakot that turns crisply with the grid, glances where you've steered, opens its mouth before food
// and chomps when it actually gets there. Reads the game state only.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { snakeHead } from './models.mjs';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerpAngle = (a, b, k) => a + ((((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI) * k;
export const RADIUS = 0.3, FILLET = 0.45;

export function createSnake({ radial = 14, perCell = 8, Y0 = 0, cols = 20, rows = 20 } = {}) {
  const skins = { flag: T.scales('flag'), gold: T.scales('gold'), ice: T.scales('ice') };
  for (const k in skins) { skins[k].normalMap.repeat.set(2, 2); }
  const mat = new THREE.MeshPhysicalMaterial({ map: skins.flag.map, normalMap: skins.flag.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, emissive: '#000000' });
  const group = new THREE.Group(); group.name = 'snake';
  // the board's edges, for walang pader: the body is clipped there and a copy comes in the other side
  const clips = [new THREE.Plane(new THREE.Vector3(1, 0, 0), cols / 2), new THREE.Plane(new THREE.Vector3(-1, 0, 0), cols / 2), new THREE.Plane(new THREE.Vector3(0, 0, 1), rows / 2), new THREE.Plane(new THREE.Vector3(0, 0, -1), rows / 2)];

  // ---------- the body's geometry, grown as needed ----------
  let cap = 0, geo = null;
  const tubes = [];
  function alloc(rings) {
    cap = Math.ceil(rings * 1.5);
    if (geo) geo.dispose();
    geo = new THREE.BufferGeometry();
    const V = cap * (radial + 1);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(V * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(V * 2), 2).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint32Array((cap - 1) * radial * 6);
    let k = 0;
    for (let i = 0; i < cap - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1; idx[k++] = a + 1;
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 40);
    for (const t of tubes) t.geometry = geo;
  }
  alloc(200);
  // the main body and up to three copies (shifted a board across) for wrapping
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.visible = k === 0;
    group.add(m); tubes.push(m);
  }

  const H = snakeHead();
  group.add(H.group);
  H.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---------- state ----------
  const V = []; // the path's corners, unwrapped
  const R = []; // each corner's fillet radius
  let ticks = 0, bulges = [], yaw = 0, hatYaw = 0, hatSpin = 0, jaw = 0, chomp = 0, squash = 0, blinkT = 2, tongueT = 0, look = { x: 0, z: 0 }, dying = -1, hatFly = null, lunge = null;
  let uHead = 0, uTail = 0, legLast = 1, a = 0;
  const P = new THREE.Vector3(), TG = new THREE.Vector3();

  // Where the body is at path parameter u (0 = the head's cell, counting cells toward the tail).
  function at(u, out, tan) {
    const n = V.length - 1;
    let k = Math.floor(u); if (k < 0) k = 0; if (k > n - 1) k = Math.max(0, n - 1);
    const f = u - k;
    const arc = (m, s) => {
      const r = R[m], A = V[m - 1], B = V[m], C = V[m + 1];
      const ix = B.x - A.x, iz = B.z - A.z, ox = C.x - B.x, oz = C.z - B.z;
      const cx = B.x + r * (ox - ix), cz = B.z + r * (oz - iz), phi = s * Math.PI / 2, c = Math.cos(phi), sn = Math.sin(phi);
      out.set(cx + r * (-ox * c + ix * sn), 0, cz + r * (-oz * c + iz * sn));
      if (tan) tan.set(ox * sn + ix * c, 0, oz * sn + iz * c).normalize();
    };
    if (n < 1) { out.set(V[0].x, 0, V[0].z); if (tan) tan.set(-1, 0, 0); return out; }
    if (k + 1 < n && R[k + 1] > 0 && f > 1 - R[k + 1]) { arc(k + 1, (f - (1 - R[k + 1])) / (2 * R[k + 1])); return out; }
    if (k > 0 && R[k] > 0 && f < R[k]) { arc(k, (f + R[k]) / (2 * R[k])); return out; }
    const A = V[k], B = V[k + 1];
    out.set(A.x + (B.x - A.x) * f, 0, A.z + (B.z - A.z) * f);
    if (tan) { tan.set(B.x - A.x, 0, B.z - A.z); if (tan.lengthSq() < 1e-6) tan.set(A.x - (V[k - 1] || A).x, 0, A.z - (V[k - 1] || A).z); if (tan.lengthSq() < 1e-6) tan.set(-1, 0, 0); tan.normalize(); }
    return out;
  }

  function buildPath(g, prog) {
    const s = g.snake, pv = g.prev, n = s.length;
    V.length = 0; R.length = 0;
    const W = g.cols, Hh = g.rows;
    const un = (p, ref) => {
      let x = p.x, z = p.y;
      if (ref) { if (x - ref.x > 1.5) x -= W; else if (ref.x - x > 1.5) x += W; if (z - ref.z > 1.5) z -= Hh; else if (ref.z - z > 1.5) z += Hh; }
      return { x, z };
    };
    V.push(un(s[0], null));
    for (let i = 1; i < n; i++) V.push(un(s[i], V[i - 1]));
    const tailOld = pv[n - 1] || s[n - 1];
    V.push(un(tailOld, V[n - 1]));
    legLast = Math.abs(V[n].x - V[n - 1].x) + Math.abs(V[n].z - V[n - 1].z) > 0.5 ? 1 : 0;
    a = prog;
    for (let m = 0; m < V.length; m++) {
      if (m === 0 || m === V.length - 1) { R.push(0); continue; }
      const ix = V[m].x - V[m - 1].x, iz = V[m].z - V[m - 1].z, ox = V[m + 1].x - V[m].x, oz = V[m + 1].z - V[m].z;
      const turn = Math.abs(ix * oz - iz * ox) > 0.5;
      R.push(turn ? (m === 1 ? Math.min(FILLET, a) : FILLET) : 0);
    }
    uHead = 1 - a; uTail = (n - 1) + legLast * (1 - a);
  }

  // ---------- each frame ----------
  function update(g, dt, t, o = {}) {
    const prog = o.progress ?? 1;
    buildPath(g, prog);
    const reduced = !!o.reduced;
    // bulges travel down the body
    for (const b of bulges) b.pos += dt * 11;
    bulges = bulges.filter((b) => b.pos < g.snake.length + 2);
    // the death: the body pops from the head toward the tail
    let u0 = uHead + 0.12;
    if (dying >= 0) {
      dying += dt;
      const cut = uHead + Math.max(0, dying - 0.28) * 34;
      if (o.onPop) for (let i = Math.floor(popped); i < Math.min(g.snake.length, cut - uHead); i++) { at(uHead + i, P); o.onPop(P.x - g.cols / 2 + 0.5, P.z - g.rows / 2 + 0.5, i); }
      popped = Math.max(popped, Math.min(g.snake.length, cut - uHead));
      u0 = Math.max(u0, cut);
    }
    const len = uTail - u0;
    const show = len > 0.05;
    tubes[0].visible = show;
    if (show) {
      const rings = Math.max(2, Math.ceil(len * perCell) + 1);
      if (rings > cap) alloc(rings);
      const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, uv = geo.attributes.uv.array;
      const lt = clamp(len * 0.45, 0.8, 2.6), amp = (reduced ? 0.05 : 0.085), idle = o.still ? t * 1.1 : 0;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < rings; i++) {
        const u = u0 + (len * i) / (rings - 1);
        at(u, P, TG);
        const sx = -TG.z, sz = TG.x; // sideways, on the mat
        const b = u + a - 1; // body coordinate: segment centres sit on whole numbers
        let r = RADIUS;
        let lump = 0; for (const q of bulges) lump = Math.max(lump, Math.exp(-((b - q.pos) ** 2) / 0.45)); r += 0.13 * lump;
        const x = clamp((uTail - u) / lt, 0, 1);
        r *= 0.12 + 0.88 * Math.pow(smooth(0, 1, x), 0.75);
        // the slither: fixed in the world, faded in behind the head, a flick at the tail
        const w = ticks - u, env = smooth(uHead + 0.25, uHead + 1.7, u) * (1 + 0.8 * smooth(uTail - 1.6, uTail, u));
        const off = amp * env * Math.sin((w / 2.3) * TAU + idle) * (dying >= 0 ? 0 : 1);
        const cx = P.x + sx * off - g.cols / 2 + 0.5, cz = P.z + sz * off - g.rows / 2 + 0.5, cy = Y0 + r * 0.86;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cz < minZ) minZ = cz; if (cz > maxZ) maxZ = cz;
        for (let j = 0; j <= radial; j++) {
          const phi = (j / radial) * TAU, c = -Math.cos(phi), s = Math.sin(phi);
          const flat = c < 0 ? 0.72 : 0.9; // a flatter belly
          const ox = sx * s * r, oz = sz * s * r, oy = c * r * flat;
          const p = (i * (radial + 1) + j) * 3;
          pos[p] = cx + ox; pos[p + 1] = cy + oy; pos[p + 2] = cz + oz;
          const nx = sx * s, ny = c / flat, nz = sz * s, nl = Math.hypot(nx, ny, nz) || 1;
          nor[p] = nx / nl; nor[p + 1] = ny / nl; nor[p + 2] = nz / nl;
          const q = (i * (radial + 1) + j) * 2;
          uv[q] = (b + 0.5) / 4; uv[q + 1] = j / radial;
        }
      }
      geo.setDrawRange(0, (rings - 1) * radial * 6);
      geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.uv.needsUpdate = true;
      // wrapping: copies a board across, all clipped to the board
      const wrapped = minX < -g.cols / 2 || maxX > g.cols / 2 || minZ < -g.rows / 2 || maxZ > g.rows / 2;
      mat.clippingPlanes = wrapped ? clips : null;
      const shifts = [];
      if (wrapped) {
        const sx = minX < -g.cols / 2 ? g.cols : maxX > g.cols / 2 ? -g.cols : 0, sz = minZ < -g.rows / 2 ? g.rows : maxZ > g.rows / 2 ? -g.rows : 0;
        if (sx) shifts.push([sx, 0]); if (sz) shifts.push([0, sz]); if (sx && sz) shifts.push([sx, sz]);
      }
      for (let k = 1; k < 4; k++) { const s = shifts[k - 1]; tubes[k].visible = !!s; if (s) tubes[k].position.set(s[0], 0, s[1]); }
    } else for (let k = 1; k < 4; k++) tubes[k].visible = false;

    // ---------- the head ----------
    at(uHead, P);
    let hx = P.x - g.cols / 2 + 0.5, hz = P.z - g.rows / 2 + 0.5;
    if (hx < -g.cols / 2) hx += g.cols; else if (hx > g.cols / 2) hx -= g.cols;
    if (hz < -g.rows / 2) hz += g.rows; else if (hz > g.rows / 2) hz -= g.rows;
    const dx = g.dir.x, dz = g.dir.y;
    let target = Math.atan2(-dz, dx);
    // a queued turn: the head leans into it before the tick
    const q = g.queue && g.queue[0];
    if (q && g.alive) target += clamp(lerpAngle(0, Math.atan2(-q.y, q.x) - target, 1), -1, 1) * 0.3;
    yaw = lerpAngle(yaw, target, 1 - Math.exp(-dt * (o.snap ? 60 : 32)));
    // the hat lags behind a turn and swings back
    hatSpin += (lerpAngle(0, yaw - hatYaw, 1) * 90 - hatSpin * 9) * dt; hatYaw += hatSpin * dt;
    H.group.position.set(hx, Y0 + 0.1, hz); H.group.scale.multiplyScalar(1);
    H.group.rotation.set(0, yaw, 0);
    // lunge into whatever killed you, then recoil
    if (lunge) { lunge.t += dt; const k = lunge.t < 0.09 ? lunge.t / 0.09 : Math.max(0, 1 - (lunge.t - 0.09) / 0.25); H.group.position.x += dx * k * 0.32; H.group.position.z += dz * k * 0.32; }
    // food ahead: the mouth opens as the head closes in
    const ahead = g.foods && g.foods.find((f) => f.x === (g.snake[0].x + dx + g.cols) % g.cols && f.y === (g.snake[0].y + dz + g.rows) % g.rows);
    const want = o.bite ? 1 : ahead ? smooth(0.25, 0.95, prog) * 0.8 : 0;
    jaw += (Math.max(want, chomp > 0 ? 0 : 0) - jaw) * (1 - Math.exp(-dt * 18));
    chomp = Math.max(0, chomp - dt);
    squash = Math.max(0, squash - dt * 5);
    const sq = Math.sin(squash * Math.PI) * 0.22;
    H.group.scale.set(1 + sq, 1 - sq * 0.6, 1 + sq * 0.4);
    H.jaw.rotation.z = -jaw * 0.55;
    H.skull.rotation.z = jaw * 0.12;
    // blinking, and the tongue now and then
    blinkT -= dt; if (blinkT < -0.14) blinkT = 1.8 + Math.random() * 3;
    const lid = reduced ? 0.05 : blinkT < 0 ? 1 : 0.05;
    tongueT -= dt; if (tongueT < -0.5) tongueT = 1.4 + Math.random() * 2.4;
    const tk = tongueT < 0 && !jaw ? Math.sin((-tongueT / 0.5) * Math.PI) : 0;
    H.tongue.scale.x = Math.max(0.001, tk);
    H.tongue.rotation.y = Math.sin(t * 40) * 0.15 * tk;
    // eyes look at the nearest food
    const food = g.foods && g.foods.reduce((best, f) => { const d = Math.abs(f.x - g.snake[0].x) + Math.abs(f.y - g.snake[0].y); return !best || d < best.d ? { f, d } : best; }, null);
    let lx = 0, lz = 0;
    if (food) { const fx = food.f.x - g.cols / 2 + 0.5 - hx, fz = food.f.y - g.rows / 2 + 0.5 - hz, l = Math.hypot(fx, fz) || 1; const c = Math.cos(-yaw), s = Math.sin(-yaw); lx = (fx * c - fz * s) / l; lz = (fx * s + fz * c) / l; }
    look.x += (lx - look.x) * Math.min(1, dt * 8); look.z += (lz - look.z) * Math.min(1, dt * 8);
    H.eyes.forEach(({ lid: L, pupil }, i) => {
      L.scale.y = lid; L.visible = lid > 0.06;
      const s = i ? 1 : -1;
      pupil.position.set(0.05 + look.x * 0.015, 0.02, s * 0.045 + look.z * 0.03);
    });
    // the salakot sits on top, lagging on turns, or flies off at the end
    if (hatFly) {
      hatFly.vy -= 16 * dt; hatFly.p.addScaledVector(hatFly.v.setY(hatFly.vy), dt); hatFly.spin += dt * 9;
      if (hatFly.p.y < Y0 + 0.02) { hatFly.p.y = Y0 + 0.02; hatFly.vy *= -0.3; hatFly.v.multiplyScalar(0.6); }
      H.hat.position.copy(hatFly.p); H.hat.rotation.set(hatFly.spin * 0.4, hatFly.spin, 0.3);
    } else {
      H.hat.position.set(-0.13, 0.19 + sq * 0.2 + jaw * 0.03, 0);
      H.hat.rotation.set(0, hatYaw - yaw, 0.22 + jaw * 0.1 + clamp(hatSpin * 0.02, -0.2, 0.2));
    }
    // the head during the death pop
    if (dying >= 0) { const k = dying < 0.12 ? 1 + dying * 2.5 : Math.max(0, 1.3 - (dying - 0.12) * 7); H.skull.parent.scale.setScalar(Math.max(0.001, k)); if (k <= 0.01) H.group.visible = false; }
    return { x: hx, z: hz, yaw };
  }

  let popped = 0;
  function event(e, g) {
    switch (e.type) {
      case 'move': ticks++; break;
      case 'eat': bulges.push({ pos: 0 }); if (bulges.length > 8) bulges.shift(); break;
      default: break;
    }
  }
  // the visual bite, when the head actually reaches the food
  function bite() { chomp = 0.12; jaw = 0; squash = 1; }
  function die(g) {
    dying = 0; popped = 0; lunge = { t: 0 };
    // the hat pops off: a world-space copy that tumbles to the mat
    const wp = new THREE.Vector3(); H.hat.getWorldPosition(wp);
    group.add(H.hat); H.hat.position.copy(wp);
    hatFly = { p: wp.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3), vy: 6, spin: 0 };
  }
  function reset() {
    ticks = 0; bulges = []; dying = -1; popped = 0; hatFly = null; lunge = null; chomp = 0; jaw = 0; squash = 0;
    H.group.visible = true; H.group.scale.setScalar(1); H.skull.parent.scale.setScalar(1);
    if (H.hat.parent !== H.group) H.group.add(H.hat);
  }
  function setSkin(kind, { emissive = '#000000', intensity = 0 } = {}) {
    const s = skins[kind] || skins.flag;
    if (mat.map !== s.map) { mat.map = s.map; mat.normalMap = s.normalMap; }
    mat.metalness = kind === 'gold' ? 0.55 : 0;
    mat.roughness = kind === 'gold' ? 0.22 : kind === 'ice' ? 0.2 : 0.3;
    mat.emissive.set(emissive); mat.emissiveIntensity = intensity;
  }
  return { group, update, event, bite, die, reset, setSkin, head: H, mat, get dying() { return dying >= 0; } };
}
