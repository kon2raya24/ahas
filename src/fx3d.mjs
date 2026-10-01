// The juice in 3D: glowing sparks, embers and flames (additive points that bloom), smoke and dust
// (soft puffs), tumbling confetti and petals (instanced), shockwave rings on the mat, flashes of light,
// and gold lettering that pops up in the world and floats away.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function pointSystem(max, map, blending) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, scale: { value: 400 } }, transparent: true, depthWrite: false, blending, vertexColors: true,
    vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * scale / -mv.z, 0.0, 256.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.004) discard; }',
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  const list = [];
  return {
    pts, list, mat,
    add(p) { if (list.length < max) list.push(p); },
    update(dt) {
      let n = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
        p.vy -= (p.g || 0) * dt; const d = Math.exp(-(p.drag || 0) * dt); p.vx *= d; p.vy *= d; p.vz *= d;
        if (p.wob) { p.vx += Math.sin(p.life * 7 + p.wob) * dt * 0.8; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
      for (const p of list) {
        const k = p.life / p.max;
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
        col[n * 3] = p.r; col[n * 3 + 1] = p.gg; col[n * 3 + 2] = p.b;
        size[n] = p.size * (p.grow ? 1 + (1 - k) * p.grow : 1) * (p.shrink ? k : 1);
        alpha[n] = (p.fadeIn ? Math.min(1, (1 - k) * 6) : 1) * Math.min(1, k * (p.fade || 2)) * (p.a ?? 1);
        n++;
      }
      geo.setDrawRange(0, n);
      for (const k of ['position', 'color', 'size', 'alpha']) geo.attributes[k].needsUpdate = true;
    },
    clear() { list.length = 0; },
  };
}

export function createFx(scene, { max = 1400, overlay = scene } = {}) {
  const dotTex = T.dot(), puffTex = T.puff();
  const glow = pointSystem(max, dotTex, THREE.AdditiveBlending);
  const smoke = pointSystem(Math.floor(max / 3), puffTex, THREE.NormalBlending);
  scene.add(glow.pts, smoke.pts);
  const C = new THREE.Color();
  const col = (c, k = 1) => { C.set(c); return { r: C.r * k, gg: C.g * k, b: C.b * k }; };

  // ---------- confetti, petals and crumbs: little tumbling cards ----------
  const CMAX = 900;
  const cGeo = new THREE.PlaneGeometry(0.2, 0.12);
  const cMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
  const cards = new THREE.InstancedMesh(cGeo, cMat, CMAX);
  cards.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cards.count = 0; cards.frustumCulled = false; cards.castShadow = false;
  cards.setColorAt(0, new THREE.Color('#fff'));
  scene.add(cards);
  const clist = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  function card(p) { if (clist.length < CMAX) clist.push({ rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6), wx: rnd(-9, 9), wy: rnd(-9, 9), wz: rnd(-6, 6), scale: 1, floor: null, ...p }); }

  // ---------- shockwave rings on the mat ----------
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 4; scene.add(m); rings.push({ m, life: 0 });
  }
  function ring(x, y, z, color, { size = 2, life = 0.5, k = 2.5 } = {}) {
    const r = rings.find((q) => q.life <= 0) || rings[0];
    r.life = r.max = life; r.size = size; r.m.position.set(x, y, z); r.m.material.color.set(color).multiplyScalar(k); r.m.visible = true;
  }

  // ---------- flashes of light ----------
  const lights = [];
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight('#fff', 0, 9, 1.6); scene.add(l); lights.push(l); }
  let li = 0;
  function flash(x, y, z, color, intensity = 30, dist = 8) { const l = lights[li++ % lights.length]; l.position.set(x, y, z); l.color.set(color); l.intensity = intensity; l.distance = dist; l.userData.max = intensity; }

  // ---------- floating lettering ----------
  const texCache = new Map();
  const pops = [];
  function popup(text, x, y, z, { color = null, size = 0.9, sub = null, life = 1.1, rise = 1.4, delay = 0 } = {}) {
    const key = `${text}|${color}|${sub}`;
    if (!texCache.has(key)) { texCache.set(key, T.textTex(text, { color, sub })); if (texCache.size > 80) { const k = texCache.keys().next().value; texCache.get(k).tex.dispose(); texCache.delete(k); } }
    const { tex, aspect } = texCache.get(key);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
    sp.renderOrder = 20; sp.position.set(x, y, z); sp.visible = delay <= 0;
    overlay.add(sp);
    pops.push({ sp, t: -delay, life, rise, h: size * (sub ? 1.4 : 1), aspect, y0: y });
  }

  // ---------- recipes ----------
  function sparks(x, y, z, color, n = 16, { speed = 4, up = 2, g = 6, size = 0.28, life = 0.6, k = 2.2 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      glow.add({ x, y, z, vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * sp, g, drag: 2.2, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), shrink: true, ...col(color, k) });
    }
  }
  function puffs(x, y, z, color, n = 8, { speed = 1.2, up = 1, size = 1.2, life = 0.9, a = 0.5, grow = 1.5 } = {}) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random());
      smoke.add({ x: x + Math.cos(ang) * 0.1, y, z: z + Math.sin(ang) * 0.1, vx: Math.cos(ang) * sp, vy: up * (0.4 + Math.random() * 0.6), vz: Math.sin(ang) * sp, drag: 2.5, life: life * (0.7 + Math.random() * 0.5), max: life, size: size * (0.7 + Math.random() * 0.6), grow, fade: 1.4, a, ...col(color) });
    }
  }
  function confetti(x, y, z, colors, n = 30, { speed = 5, up = 5, life = 1.6, scale = 1, g = 9 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.9);
      card({ x, y, z, vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random() * 0.8), vz: Math.sin(a) * sp, g, drag: 1.6, life: life * (0.7 + Math.random() * 0.6), max: life, color: new THREE.Color(pick(colors)), scale: scale * (0.7 + Math.random() * 0.6) });
    }
  }
  // falling from the sky over an area: confetti rain, petals, kiping leaves
  function rain(cx, cz, w, colors, n, { y = 16, life = 5, scale = 1, g = 0.7, drift = 0.6 } = {}) {
    for (let i = 0; i < n; i++) card({ x: cx + rnd(-w, w), y: y + rnd(0, 6), z: cz + rnd(-w, w), vx: rnd(-drift, drift), vy: -rnd(0.8, 1.6), vz: rnd(-drift, drift), g, drag: 1.2, flutter: true, life: life * rnd(0.8, 1.2), max: life, color: new THREE.Color(pick(colors)), scale: scale * rnd(0.7, 1.3) });
  }

  // ---------- each frame ----------
  function update(dt, camera, floorY = 0) {
    glow.update(dt); smoke.update(dt);
    let n = 0;
    for (let i = clist.length - 1; i >= 0; i--) {
      const p = clist[i];
      p.life -= dt;
      if (p.life <= 0) { clist[i] = clist[clist.length - 1]; clist.pop(); continue; }
      p.vy -= p.g * dt; const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d;
      if (p.flutter) { p.vx += Math.sin(p.life * 3 + p.wx) * dt * 1.5; p.vz += Math.cos(p.life * 2.6 + p.wz) * dt * 1.5; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const fl = p.floor ?? floorY;
      if (p.y < fl) { p.y = fl; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; p.wx *= 0.9; p.wy *= 0.9; p.wz *= 0.9; }
      p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
    }
    for (const p of clist) {
      const k = Math.min(1, (p.life / p.max) * 4);
      v.set(p.x, p.y, p.z); q.setFromEuler(e.set(p.rx, p.ry, p.rz)); s.setScalar(p.scale * k); m4.compose(v, q, s);
      cards.setMatrixAt(n, m4); cards.setColorAt(n, p.color); n++;
    }
    cards.count = n; cards.instanceMatrix.needsUpdate = true; if (cards.instanceColor) cards.instanceColor.needsUpdate = true;
    for (const r of rings) {
      if (r.life <= 0) { r.m.visible = false; continue; }
      r.life -= dt; const k = 1 - r.life / r.max;
      r.m.scale.setScalar(0.2 + r.size * Math.pow(k, 0.6)); r.m.material.opacity = Math.max(0, 1 - k) * 0.9;
    }
    for (const l of lights) { if (l.intensity > 0) l.intensity = Math.max(0, l.intensity - dt * (l.userData.max || 1) * 3.5); }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt;
      if (p.t < 0) continue;
      p.sp.visible = true;
      const k = p.t / p.life;
      if (k >= 1) { overlay.remove(p.sp); p.sp.material.dispose(); pops.splice(i, 1); continue; }
      const pop = p.t < 0.12 ? 1.7 - (p.t / 0.12) * 0.7 : 1;
      p.sp.scale.set(p.h * p.aspect * pop, p.h * pop, 1);
      p.sp.position.y = p.y0 + p.rise * Math.pow(k, 0.7);
      p.sp.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }
  }
  function resize(heightPx, fov) { const sc = heightPx / (2 * Math.tan((fov * Math.PI) / 360)); glow.mat.uniforms.scale.value = sc; smoke.mat.uniforms.scale.value = sc; }
  function clear() { glow.clear(); smoke.clear(); clist.length = 0; for (const p of pops) { overlay.remove(p.sp); p.sp.material.dispose(); } pops.length = 0; for (const r of rings) r.life = 0; }
  return { update, resize, clear, sparks, puffs, confetti, rain, ring, flash, popup, glow, smoke, card, get count() { return glow.list.length + smoke.list.length + clist.length; } };
}
