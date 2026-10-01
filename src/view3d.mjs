// Ahas sa Fiesta in 3D, with three.js. It reads the game (game.mjs) and its events and never changes
// them. The plaza (plaza.mjs) is built in code and dressed with real scans (envpack.mjs); the snake,
// the food, the banga, the tandang and the tinikling poles are crafted models (snake3d.mjs,
// models.mjs); the juice is fx3d.mjs; the frame goes through the film look (post.mjs).
//
// The camera: a tilted three-quarter view that fits the whole board to the screen (or straight down,
// in the settings), an establishing flyover when a game starts, a swing out over the plaza when a
// new festival arrives, a punch-in when you crash, and slow orbits behind the menus.
import * as THREE from './vendor/three.module.min.js';
import { FOODS, progress, festival, interval, ROOSTER_STEP, POLE_WARN } from './game.mjs';
import { createPost } from './post.mjs';
import { buildPlaza, Y0, STAGE } from './plaza.mjs';
import { createSnake } from './snake3d.mjs';
import { food as foodModel, SPECIAL_GLOW, banga, rooster as roosterModel, tiniklingPoles } from './models.mjs';
import { createFx } from './fx3d.mjs';
import { lookOf } from './look.mjs';
import { loadSky, dressPlaza, dressFestival } from './envpack.mjs';
import * as T from './tex.mjs';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wx = (x) => x - 9.5, wz = (y) => y - 9.5;
const FLAGC = ['#ce1126', '#fcd116', '#0038a8', '#f4f1e8'];
const CRUMBS = { fishball: ['#b5732f', '#8a4a1a', '#5a2410'], kwekkwek: ['#ff7414', '#ffb070', '#fff0c0'], turon: ['#d68a2c', '#b8661a', '#f2c230'], bananacue: ['#7c3e0e', '#b8661a', '#f2c230'], balut: ['#f2e6cc', '#fcd116', '#ffffff'], sili: ['#d9150f', '#ff6a2a', '#2e7d32'], halohalo: ['#6b2d91', '#f4fbff', '#ff6fb5', '#f2b632'], anting: ['#ffcc4d', '#fff0a0', '#ffffff'] };
const YUM = ['SARAP!', 'ANG SARAP!', 'BUSOG!', 'SOLB!', 'LODI!'];

export function createView(canvas, { low = false, gfx = null, onBite = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const maxPR = low ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cfe0f0', 60, 190);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
  scene.add(camera);
  const fixed = gfx !== null && gfx !== '' && gfx !== undefined;
  let level = fixed ? +gfx : low ? 1 : 2;
  const post = createPost(renderer, scene, camera, { level, auto: !fixed, onLevel: (l) => quality(l) });
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight('#dfeeff', '#b59a74', 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1da', 3);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const nightLights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ff9a4a', 0, 26, 1.4); scene.add(l); nightLights.push(l); }
  function quality(l) {
    level = l;
    const size = l >= 2 ? 2048 : l === 1 ? 1024 : 512;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    renderer.shadowMap.type = THREE.PCFShadowMap; sun.shadow.radius = l >= 1 ? 3 : 1; sun.castShadow = l >= 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, l >= 2 ? maxPR : l === 1 ? 1.25 : 1));
    resize();
  }

  // ---------- sky: painted until the photographed one arrives ----------
  const skyU = { top: { value: new THREE.Color('#4f86c8') }, low: { value: new THREE.Color('#cfe2f2') }, sunDir: { value: new THREE.Vector3(0, 1, 0) } };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 low; uniform vec3 sunDir; varying vec3 v; void main(){ float h = clamp(v.y, 0.0, 1.0); vec3 c = mix(low, top, pow(h, 0.6)); float s = max(dot(v, sunDir), 0.0); c += vec3(1.0, 0.9, 0.7) * pow(s, 60.0) * 0.8; gl_FragColor = vec4(c, 1.0); }',
  });
  const backMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat); sky.renderOrder = -1; scene.add(sky);

  // ---------- the plaza, the snake, the juice ----------
  const plaza = buildPlaza({ low }); scene.add(plaza.root);
  const snake = createSnake({ Y0, radial: low ? 10 : 14, perCell: low ? 6 : 8 }); scene.add(snake.group);
  // the floating lettering is drawn after the film look, so occlusion and grain never dim it
  const overlay = new THREE.Scene();
  const fx = createFx(scene, { max: low ? 900 : 1500, overlay });
  // the strong-grid option: fine lines between the cells
  const gridCanvas = T.canvas(640, 640), gc = gridCanvas.getContext('2d');
  gc.strokeStyle = 'rgba(40,20,8,1)'; gc.lineWidth = 2; for (let k = 0; k <= 20; k++) { gc.beginPath(); gc.moveTo(k * 32, 0); gc.lineTo(k * 32, 640); gc.moveTo(0, k * 32); gc.lineTo(640, k * 32); gc.stroke(); }
  const gridM = new THREE.MeshBasicMaterial({ map: T.toTex(gridCanvas), transparent: true, opacity: 0, depthWrite: false });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), gridM); grid.rotation.x = -Math.PI / 2; grid.position.y = Y0 + 0.006; grid.renderOrder = 1; scene.add(grid);

  // ---------- food ----------
  const templates = {};
  const tpl = (type) => (templates[type] ||= foodModel(type));
  const ringMat = (color) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { frac: { value: 1 }, warn: { value: 0 }, time: { value: 0 }, color: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float frac, warn, time; uniform vec3 color; varying vec2 vUv; void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.x, p.y) / 6.2831853 + 0.5; float ring = smoothstep(0.74, 0.79, r) * (1.0 - smoothstep(0.9, 0.95, r)); float on = step(a, frac); float glow = (1.0 - smoothstep(0.0, 0.8, r)) * 0.25; float blink = warn > 0.5 ? 0.45 + 0.55 * step(0.0, sin(time * 22.0)) : 1.0; gl_FragColor = vec4(color * 1.6, (ring * (on * 0.95 + 0.1) + glow) * blink); }',
  });
  const foods = new Map(); // game food → its model
  // every food fills about 0.75 of a cell, whatever its model's size
  const scales = {};
  const foodScale = (type) => { if (!scales[type]) { const b = new THREE.Box3().setFromObject(tpl(type)), sz = b.getSize(new THREE.Vector3()); scales[type] = Math.min(0.78 / Math.max(sz.x, sz.z, 0.01), 0.85 / Math.max(sz.y, 0.01)); } return scales[type]; };
  const blobTex = (() => { const c = T.canvas(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return T.toTex(c, { color: false }); })();
  const blobGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const blobM = new THREE.MeshBasicMaterial({ color: '#1a0c04', alphaMap: blobTex, transparent: true, opacity: 0.55, depthWrite: false });
  const glowMats = {};
  const glowM = (c) => (glowMats[c] ||= new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.55), alphaMap: blobTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  function addFood(f) {
    const g = new THREE.Group(); g.position.set(wx(f.x), Y0, wz(f.y));
    const model = tpl(f.type).clone(true); const holder = new THREE.Group(); holder.scale.setScalar(foodScale(f.type)); holder.add(model); g.add(holder);
    // a soft contact shadow and a warm glow, so food pops off the mat
    const sh = new THREE.Mesh(blobGeo, blobM); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; sh.renderOrder = 1; g.add(sh);
    const gl = new THREE.Mesh(blobGeo, glowM(FOODS[f.type].special ? SPECIAL_GLOW[f.type] : '#ffd27a')); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.016; gl.scale.setScalar(1.25); gl.renderOrder = 2; g.add(gl);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const e = { f, g, model, type: f.type, x: f.x, y: f.y, t: 0, special: !!FOODS[f.type].special, eaten: null, leaving: -1, spin: Math.random() * TAU };
    if (e.special) {
      e.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), ringMat(SPECIAL_GLOW[f.type])); e.ring.rotation.x = -Math.PI / 2; e.ring.position.y = 0.02; e.ring.renderOrder = 3; g.add(e.ring);
    }
    scene.add(g); foods.set(f, e);
    fx.sparks(wx(f.x), Y0 + 0.4, wz(f.y), e.special ? SPECIAL_GLOW[f.type] : '#fff4d0', e.special ? 18 : 7, { speed: 2.4, up: 2, size: 0.22, life: 0.5 });
    return e;
  }
  function dropFood(e) { scene.remove(e.g); if (e.ring) e.ring.material.dispose(); foods.delete(e.f); }

  // ---------- banga ----------
  const pots = new Map();
  let potDelay = 0;
  function addPot(p) {
    const g = banga(); g.position.set(wx(p.x), Y0, wz(p.y)); g.scale.setScalar(1.05); scene.add(g);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    pots.set(p, { g, t: -potDelay - Math.random() * 0.25, landed: false });
  }

  // ---------- the tandang ----------
  const R = roosterModel(); R.group.visible = false; scene.add(R.group);
  R.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const rs = { x: 0, y: 0, px: 0, py: 0, hop: 1, yaw: 0, peck: 0, crow: 0, seen: false };

  // ---------- the tinikling ----------
  const TP = tiniklingPoles(); TP.group.visible = false; scene.add(TP.group);
  TP.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const dangerM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, urg: { value: 0 }, clap: { value: 0 }, color: { value: new THREE.Color('#ff1a2e') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float time, urg, clap; uniform vec3 color; varying vec2 vUv; void main(){ float st = step(0.5, fract(vUv.x * 30.0 + vUv.y * 1.2 - time * 1.6)); float edge = smoothstep(0.1, 0.0, vUv.y) + smoothstep(0.9, 1.0, vUv.y); float dash = step(0.5, fract(vUv.x * 40.0 - time * 3.0)); float pulse = 0.5 + 0.5 * sin(time * (8.0 + urg * 24.0)); float a = (0.28 + urg * 0.3) * (0.55 + 0.45 * pulse) + st * 0.1 + edge * dash * 0.85; vec3 c = mix(color * 1.6, vec3(2.0), edge * dash * 0.8 + clap); gl_FragColor = vec4(c, clamp(a + clap, 0.0, 0.95)); }',
  });
  const danger = new THREE.Mesh(new THREE.PlaneGeometry(20, 1), dangerM); danger.rotation.x = -Math.PI / 2; danger.position.y = Y0 + 0.01; danger.renderOrder = 2; danger.visible = false; scene.add(danger);
  const ps = { axis: 'row', index: 0, in: 0, out: 0, clapT: -1, active: false };

  // ---------- the anting-anting's glow ----------
  const shieldM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, k: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float time, k; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float band = 0.5 + 0.5 * sin(vN.y * 14.0 + time * 4.0); gl_FragColor = vec4(vec3(1.0, 0.8, 0.3) * 2.2, (f * 0.9 + band * f * 0.3) * k); }',
  });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 16), shieldM); shield.visible = false; shield.renderOrder = 6; scene.add(shield);
  const amulet = tpl('anting').clone(true); amulet.scale.setScalar(0.4); amulet.visible = false; scene.add(amulet);

  // ---------- look: time of day per festival, blended ----------
  let env = null, fest = festival(1), look = lookOf(fest.name), lookFrom = look, lookK = 1;
  const cur = {};
  const colorsOf = (L) => ({ sun: new THREE.Color(L.sun.color), hs: new THREE.Color(L.hemi[0]), hg: new THREE.Color(L.hemi[1]), fog: new THREE.Color(L.fog[0]), top: new THREE.Color(L.skyCol[0]), low: new THREE.Color(L.skyCol[1]), tint: new THREE.Color(L.tint) });
  let cFrom = colorsOf(look), cTo = cFrom;
  function blendLook(dt) {
    if (lookK < 1) lookK = Math.min(1, lookK + dt / 1.6);
    const k = ease(lookK), A = lookFrom, B = look;
    const el = lerp(A.sun.el, B.sun.el, k), az = lerp(A.sun.az, B.sun.az, k);
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    sun.position.copy(d).multiplyScalar(60); sun.target.position.set(0, 0, 0);
    sun.color.copy(cFrom.sun).lerp(cTo.sun, k); sun.intensity = lerp(A.sun.i, B.sun.i, k);
    hemi.color.copy(cFrom.hs).lerp(cTo.hs, k); hemi.groundColor.copy(cFrom.hg).lerp(cTo.hg, k); hemi.intensity = lerp(A.hemi[2], B.hemi[2], k);
    scene.fog.color.copy(cFrom.fog).lerp(cTo.fog, k);
    cur.fogNear = lerp(A.fog[1], B.fog[1], k); cur.fogFar = lerp(A.fog[2], B.fog[2], k);
    renderer.toneMappingExposure = lerp(A.exposure, B.exposure, k);
    scene.environmentIntensity = lerp(A.env, B.env, k) * (scene.environment ? 1 : 0);
    skyU.top.value.copy(cFrom.top).lerp(cTo.top, k); skyU.low.value.copy(cFrom.low).lerp(cTo.low, k); skyU.sunDir.value.copy(d);
    backMat.color.copy(cFrom.tint).lerp(cTo.tint, k);
    cur.night = lerp(A.night, B.night, k);
  }
  let skyJob = 0;
  function applySky(L) {
    if (!env) return;
    const job = ++skyJob;
    loadSky(env, L, pmrem).then(([ibl, back]) => {
      if (job !== skyJob) return;
      if (ibl) { scene.environment = ibl; scene.environmentRotation.set(0, L.turn, 0); }
      if (back) { backMat.map = back; backMat.needsUpdate = true; sky.material = backMat; sky.rotation.y = L.turn; } else sky.material = skyMat;
    });
  }
  function setFestival(lvl, { instant = false } = {}) {
    const f = festival(lvl);
    if (f.name === fest.name && !instant) return;
    fest = f; lookFrom = instant ? lookOf(f.name) : look; cFrom = instant ? colorsOf(lookOf(f.name)) : colorsOf(look);
    look = lookOf(f.name); cTo = colorsOf(look); lookK = instant ? 1 : 0;
    plaza.setFestival(f, look, { instant });
    post.setStage(f.name);
    applySky(look);
    if (env) dressFestival(env, plaza, f.name);
  }
  plaza.setFestival(fest, look, { instant: true });
  blendLook(0);

  // ---------- the camera ----------
  const cam = { pos: new THREE.Vector3(0, 40, 60), look: new THREE.Vector3(0, 0, 0), fov: 30, shake: 0, flash: 0, punch: 0, split: 0 };
  let shot = null; // { kind, t, dur }
  const fit = { D: 45, tx: 0, tz: 0, fov: 30, key: '' };
  const tmpV = new THREE.Vector3(), probe = new THREE.PerspectiveCamera();
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { corners.push(new THREE.Vector3(sx * 10.95, Y0 + 0.45, sz * 10.95), new THREE.Vector3(sx * 10.95, Y0, sz * 10.95)); }
  // Find the distance and aim that fit the whole board inside the safe part of the screen.
  function playPose(o, out) {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    const top = o.camStyle === 'top';
    const pitch = top ? 1.53 : aspect < 0.8 ? 1.02 : 0.9;
    const fov = top ? 30 : aspect >= 1 ? 40 : clamp((2 * Math.atan(Math.tan((16 * Math.PI) / 180) / aspect) * 180) / Math.PI, 40, 56);
    const safe = o.safe || { top: 60, bottom: 20, left: 8, right: 8 };
    const key = `${w}x${h}:${pitch}:${safe.top}:${safe.bottom}:${safe.left}:${safe.right}`;
    if (key !== fit.key) {
      fit.key = key; fit.fov = fov;
      const sl = (safe.left / w) * 2 - 1, sr = 1 - (safe.right / w) * 2, st = 1 - (safe.top / h) * 2, sb = (safe.bottom / h) * 2 - 1;
      probe.fov = fov; probe.aspect = aspect; probe.near = 0.5; probe.far = 600; probe.updateProjectionMatrix();
      let D = 45, tx = 0, tz = 0;
      for (let it = 0; it < 24; it++) {
        probe.position.set(tx, Y0 + D * Math.sin(pitch), tz + D * Math.cos(pitch)); probe.up.set(0, 1, 0); if (top) probe.up.set(0, 0, -1);
        probe.lookAt(tx, Y0, tz); probe.updateMatrixWorld();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const c of corners) { tmpV.copy(c).project(probe); x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x); y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y); }
        const s = Math.max((x1 - x0) / (sr - sl), (y1 - y0) / (st - sb));
        D *= lerp(1, s, 0.8);
        const hw = D * Math.tan((fov * Math.PI) / 360) * aspect, hh = D * Math.tan((fov * Math.PI) / 360);
        tx -= (((x0 + x1) / 2 - (sl + sr) / 2) * hw) * 0.8;
        tz -= (((y0 + y1) / 2 - (sb + st) / 2) * hh / Math.max(0.3, Math.sin(pitch))) * 0.8;
      }
      fit.D = D; fit.tx = tx; fit.tz = tz; fit.pitch = pitch;
    }
    out.fov = fit.fov;
    out.pos.set(fit.tx, Y0 + fit.D * Math.sin(fit.pitch), fit.tz + fit.D * Math.cos(fit.pitch));
    out.look.set(fit.tx, Y0, fit.tz);
    out.up = top ? 1 : 0;
    return out;
  }
  const P0 = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30 }, P1 = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30 };
  function orbit(out, t, { r = 46, h = 20, lookY = 3, lz = -6, speed = 0.05, a0 = 0 } = {}) {
    const a = a0 + t * speed;
    out.pos.set(Math.sin(a) * r, h, lz + Math.cos(a) * r); out.look.set(0, lookY, lz * 0.3); out.fov = 38; out.up = 0;
    return out;
  }

  // ---------- events ----------
  const bites = [];
  let lastHead = { x: 0, z: 0 }, lvlShotAt = -1, fireworkT = 0, ambT = 0;
  function event(e, g) {
    snake.event(e, g);
    switch (e.type) {
      case 'eat': {
        const ent = [...foods.values()].find((f) => f.x === e.x && f.y === e.y && !f.eaten);
        if (ent) { ent.eaten = e; ent.eatT = 0; ent.limit = interval(g) * 1.2 + 0.05; } else doBite({ x: e.x, y: e.y, type: e.food }, e);
        break;
      }
      case 'expire': case 'peck': {
        const ent = [...foods.values()].find((f) => f.x === e.x && f.y === e.y && !f.eaten);
        if (ent) ent.leaving = 0;
        const x = wx(e.x), z = wz(e.y);
        if (e.type === 'expire') { fx.puffs(x, Y0 + 0.3, z, '#9a8a80', 8, { size: 1, a: 0.45 }); fx.popup('SAYANG!', x, Y0 + 1.2, z, { color: '#e8d8c0', size: 0.7 }); }
        else { fx.confetti(x, Y0 + 0.6, z, ['#9a2a10', '#e2801f', '#0c2a22', '#f4f1e8'], 14, { speed: 2, up: 3, life: 1.4, scale: 0.8, g: 3 }); fx.popup('NAUNAHAN KA!', x, Y0 + 1.4, z, { color: '#ffb36b', size: 0.7 }); rs.peck = 0.35; }
        break;
      }
      case 'pole': ps.axis = e.axis; ps.index = e.index; ps.in = 0; ps.active = true; ps.clapT = -1; break;
      case 'clap': {
        ps.clapT = 0;
        const row = e.axis === 'row', c = row ? wz(e.index) : wx(e.index);
        for (let k = 0; k < 14; k++) { const t = -9.5 + k * 1.46; const x = row ? t : c, z = row ? c : t; fx.puffs(x, Y0 + 0.2, z, '#d8c8a8', 2, { speed: 1.4, up: 0.8, size: 0.9, a: 0.5, life: 0.7 }); fx.sparks(x, Y0 + 0.3, z, '#fff0c0', 2, { speed: 2.5, up: 3, size: 0.18, life: 0.4 }); }
        fx.popup('KLAK!', row ? 0 : c, Y0 + 1.6, row ? c : 0, { size: 1.3, life: 0.8 });
        cam.shake = Math.max(cam.shake, 0.35); cam.flash = Math.max(cam.flash, 0.25);
        break;
      }
      case 'cut': {
        const row = e.axis === 'row', c = row ? wz(e.index) : wx(e.index);
        fx.confetti(row ? 0 : c, Y0 + 0.5, row ? c : 0, FLAGC, 24, { speed: 4, up: 4, life: 1.2 });
        fx.popup(`NAIPIT! −${e.lost * 5}`, row ? 0 : c, Y0 + 2.4, row ? c : 0, { color: '#ff6b6b', size: 1 });
        cam.flash = 0.5; cam.split = 0.25;
        break;
      }
      case 'level': {
        potDelay = 1.1;
        break;
      }
      case 'rooster': rs.crow = 1.2; rs.seen = false; fx.popup('TIKTILAOK!', wx(e.x), Y0 + 1.8, wz(e.y), { color: '#ffb36b', size: 0.8 }); break;
      case 'shield': {
        const h = lastHead;
        fx.ring(h.x, Y0 + 0.05, h.z, '#ffd23f', { size: 5, life: 0.6, k: 3 }); fx.sparks(h.x, Y0 + 0.5, h.z, '#ffd23f', 40, { speed: 6, up: 3, size: 0.3 });
        fx.popup('ANTING-ANTING!', h.x, Y0 + 1.8, h.z, { size: 1.1 }); fx.flash(h.x, Y0 + 2, h.z, '#ffd23f', 60, 14);
        cam.shake = Math.max(cam.shake, 0.3); cam.flash = 0.6;
        break;
      }
      case 'die': {
        snake.die(g);
        cam.shake = 0.8; cam.flash = 0.8; cam.split = 0.35;
        shot = { kind: 'death', t: 0, dur: 1.4, at: { ...lastHead } };
        const h = lastHead;
        fx.ring(h.x, Y0 + 0.05, h.z, '#ff4a3a', { size: 4, life: 0.5, k: 3 }); fx.flash(h.x, Y0 + 2, h.z, '#ff5a3a', 50, 12);
        fx.popup({ kawayan: 'NAIPIT NG KAWAYAN!', pader: 'BANGGA!', banga: 'BASAG ANG BANGA!', manok: 'TINUKA NG TANDANG!' }[e.by] || 'NAKAGAT ANG SARILI!', h.x, Y0 + 2.2, h.z, { color: '#ffffff', size: 1.1, life: 1.4 });
        if (e.by === 'banga') { const p = [...pots.entries()].find(([q]) => q.x === g.snake[0].x + g.dir.x && q.y === g.snake[0].y + g.dir.y); if (p) { fx.confetti(wx(p[0].x), Y0 + 0.5, wz(p[0].y), ['#b25a34', '#8a4020', '#f0e0c0'], 30, { speed: 4, up: 5, life: 2, scale: 1.4 }); p[1].g.visible = false; } }
        break;
      }
      default: break;
    }
  }
  function doBite(ent, e) {
    const x = wx(ent.x), z = wz(ent.y), special = !!FOODS[ent.type].special;
    snake.bite();
    fx.confetti(x, Y0 + 0.5, z, CRUMBS[ent.type] || ['#fff'], special ? 22 : 12, { speed: 2.6, up: 3.2, life: 1.1, scale: 0.55, g: 12 });
    fx.sparks(x, Y0 + 0.5, z, special ? SPECIAL_GLOW[ent.type] : '#ffe8a0', special ? 26 : 10, { speed: 3.5, up: 2.5, size: 0.24, life: 0.45 });
    fx.ring(x, Y0 + 0.03, z, special ? SPECIAL_GLOW[ent.type] : '#fff0c0', { size: special ? 3 : 1.6, life: 0.4, k: special ? 2.4 : 1.2 });
    fx.flash(x, Y0 + 1.2, z, special ? SPECIAL_GLOW[ent.type] : '#ffd890', special ? 40 : 12, special ? 10 : 5);
    fx.popup(`+${e.points}`, x, Y0 + 1, z, { color: e.mult > 1 ? null : '#fff8e1', size: 0.7 + Math.min(0.5, e.mult * 0.1) });
    const sub = { balut: ['SUWERTE!', '×2 lahat'], sili: ['ANGHANG!', '×2 at bilis'], halohalo: ['BRAIN FREEZE!', 'bagal muna'], anting: ['ANTING-ANTING', 'ligtas ka minsan'] }[ent.type];
    if (sub) { fx.popup(sub[0], x, Y0 + 2, z, { size: 1.05, sub: sub[1], life: 1.3, delay: 0.08 }); cam.punch = 1; }
    else if (e.combo >= 3) fx.popup(pick(YUM), x, Y0 + 1.8, z, { color: '#ff8ae2', size: 0.8, delay: 0.06 });
    if (special) cam.flash = Math.max(cam.flash, 0.25);
    cam.shake = Math.max(cam.shake, special ? 0.2 : 0.06);
    if (onBite) onBite(e);
  }

  // Cinematics the page asks for. Each returns how long play should hold.
  function intro(kind = 'start') { shot = { kind: 'intro', t: 0, dur: kind === 'start' ? 2.2 : 1.3 }; return shot.dur; }
  function levelShot(lvl, reduced) {
    lvlShotAt = 0;
    if (reduced) { setFestival(lvl); shot = null; return 0.9; }
    shot = { kind: 'level', t: 0, dur: 2.5, lvl, switched: false, side: Math.random() < 0.5 ? -1 : 1 };
    return shot.dur;
  }
  function skip() { if (shot && (shot.kind === 'intro' || shot.kind === 'level')) { if (shot.kind === 'level' && !shot.switched) setFestival(shot.lvl); shot.t = Math.max(shot.t, shot.dur - 0.35); } }
  const holding = () => !!shot && (shot.kind === 'intro' || shot.kind === 'level');

  function reset(g) {
    for (const e of [...foods.values()]) dropFood(e);
    for (const [, p] of pots) scene.remove(p.g); pots.clear();
    snake.reset(); fx.clear(); bites.length = 0; rs.seen = false; R.group.visible = false; ps.active = false; TP.group.visible = false; danger.visible = false;
    cam.shake = 0; cam.flash = 0; potDelay = 0;
    setFestival(g ? g.level : 1, { instant: true });
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    camera.aspect = Math.max(0.3, r.width / Math.max(1, r.height));
    camera.updateProjectionMatrix();
    post.resize();
    fit.key = '';
    fx.resize(r.height * renderer.getPixelRatio(), camera.fov);
  }

  // ---------- each frame ----------
  let lastT = performance.now() / 1000;
  function frame(g, dt, o = {}) {
    const t = performance.now() / 1000;
    const reduced = !!o.reduced;
    blendLook(dt);
    // ---- the snake ----
    const prog = g.alive ? progress(g) : 1;
    const still = o.mode === 'pause' || holding() || (o.ready > 0);
    const h = snake.update(g, dt, t, { progress: prog, reduced, still, onPop: (x, z, i) => { if (i % 2 === 0) fx.confetti(x, Y0 + 0.4, z, [FLAGC[i % 4], FLAGC[(i + 1) % 4]], 5, { speed: 2.4, up: 4, life: 1.6, scale: 0.8 }); if (i % 3 === 0) fx.sparks(x, Y0 + 0.4, z, '#fff0c0', 3, { speed: 2, size: 0.2 }); } });
    lastHead = h;
    // effects on the skin
    const e = g.effects || {};
    if (e.balut > 0) snake.setSkin('gold', { emissive: '#ffb020', intensity: 0.12 });
    else if (e.halo > 0) snake.setSkin('ice', { emissive: '#4f9fe0', intensity: 0.05 });
    else snake.setSkin('flag', { emissive: g.phase > 0 ? '#ffd23f' : '#000000', intensity: g.phase > 0 ? 0.35 + 0.35 * Math.sin(t * 20) : 0 });
    snake.head.skinM.emissive.set(e.sili > 0 ? '#ff3010' : '#000000'); snake.head.skinM.emissiveIntensity = e.sili > 0 ? 0.35 + 0.25 * Math.sin(t * 12) : 0;
    if (e.sili > 0 && !reduced && Math.random() < 0.6) fx.glow.add({ x: h.x + (Math.random() - 0.5) * 0.4, y: Y0 + 0.5, z: h.z + (Math.random() - 0.5) * 0.4, vx: 0, vy: 1.8, vz: 0, drag: 1, life: 0.35, max: 0.35, size: 0.35, shrink: true, r: 3, gg: 1.2, b: 0.2 });
    if (e.halo > 0 && !reduced && Math.random() < 0.25) fx.glow.add({ x: h.x + (Math.random() - 0.5) * 1.2, y: Y0 + 0.9, z: h.z + (Math.random() - 0.5) * 1.2, vx: 0, vy: -0.4, vz: 0, drag: 0, life: 0.8, max: 0.8, size: 0.14, r: 1.6, gg: 2, b: 2.4 });
    // the shield
    shield.visible = !!g.shield && g.alive; amulet.visible = shield.visible;
    if (shield.visible) {
      shield.position.set(h.x, Y0 + 0.36, h.z); shield.scale.setScalar(1 + (reduced ? 0 : Math.sin(t * 5) * 0.04)); shieldM.uniforms.time.value = t;
      amulet.position.set(h.x + Math.cos(t * 2.4) * 0.9, Y0 + 0.9, h.z + Math.sin(t * 2.4) * 0.9); amulet.rotation.y = -t * 2.4;
    }
    // ---- food ----
    for (const f of g.foods) if (!foods.has(f)) addFood(f);
    for (const ent of [...foods.values()]) {
      const live = g.foods.includes(ent.f);
      ent.t += dt;
      const pop = ent.t < 0.35 ? 1 + Math.sin((ent.t / 0.35) * Math.PI) * 0.35 - (1 - ent.t / 0.35) * 0.9 : 1;
      const bob = reduced ? 0 : Math.sin(t * 3 + ent.x * 1.3 + ent.y) * 0.06;
      if (ent.eaten) {
        ent.eatT += dt;
        const d = Math.hypot(h.x - wx(ent.x), h.z - wz(ent.y));
        if (!ent.bitten && (d < 0.42 || ent.eatT > ent.limit || !g.alive)) { ent.bitten = true; ent.biteT = 0; doBite(ent, ent.eaten); }
        if (ent.bitten) {
          ent.biteT += dt; const k = clamp(ent.biteT / 0.12, 0, 1);
          ent.model.scale.setScalar(Math.max(0.001, 1 - k)); ent.model.position.set((h.x - ent.g.position.x) * k, 0.15, (h.z - ent.g.position.z) * k);
          if (ent.ring) ent.ring.visible = false;
          if (k >= 1) dropFood(ent);
          continue;
        }
      } else if (!live && ent.leaving < 0) ent.leaving = 0;
      if (ent.leaving >= 0) { ent.leaving += dt; const k = clamp(ent.leaving / 0.3, 0, 1); ent.model.scale.setScalar(Math.max(0.001, 1 - k)); if (ent.ring) ent.ring.material.uniforms.frac.value = 0; if (k >= 1) dropFood(ent); continue; }
      ent.model.scale.setScalar(Math.max(0.001, pop));
      ent.model.position.set(0, 0.16 + bob + (ent.special ? 0.06 : 0), 0);
      ent.model.rotation.y = ent.spin + (reduced ? 0 : t * (ent.special ? 1.4 : 0.6));
      if (ent.ring) { const u = ent.ring.material.uniforms; u.frac.value = clamp((ent.f.life ?? 0) / FOODS[ent.type].life, 0, 1); u.warn.value = (ent.f.life ?? 9) < 2.2 && !reduced ? 1 : 0; u.time.value = t; }
    }
    // ---- banga ----
    for (const p of g.pots) if (!pots.has(p)) addPot(p);
    for (const [p, v] of pots) {
      if (!g.pots.includes(p)) { scene.remove(v.g); pots.delete(p); continue; }
      if (holding() && shot && shot.kind === 'level' && shot.t < 1.1) { v.g.visible = false; continue; }
      v.g.visible = v.g.visible || !v.landed;
      v.t += dt;
      if (v.t < 0) { v.g.visible = false; continue; }
      v.g.visible = true;
      const k = clamp(v.t / 0.45, 0, 1), y = (1 - k * k) * 8;
      v.g.position.y = Y0 + y;
      const sq = v.t > 0.45 && v.t < 0.75 ? Math.sin(((v.t - 0.45) / 0.3) * Math.PI) * 0.22 : 0;
      v.g.scale.set(1.05 + sq, 1.05 - sq, 1.05 + sq);
      if (k >= 1 && !v.landed) { v.landed = true; fx.puffs(v.g.position.x, Y0 + 0.1, v.g.position.z, '#c8b090', 10, { speed: 2, up: 0.5, size: 1, a: 0.5 }); fx.ring(v.g.position.x, Y0 + 0.02, v.g.position.z, '#e0c890', { size: 1.8, life: 0.4, k: 1 }); cam.shake = Math.max(cam.shake, 0.1); }
    }
    potDelay = Math.max(0, potDelay - dt);
    // ---- the tandang ----
    if (g.rooster) {
      const r = g.rooster;
      if (!R.group.visible || !rs.seen) { rs.x = rs.px = r.x; rs.y = rs.py = r.y; rs.hop = 1; rs.seen = true; R.group.visible = true; rs.yaw = Math.atan2(-r.dir.y, r.dir.x); fx.confetti(wx(r.x), Y0 + 0.6, wz(r.y), ['#9a2a10', '#e2801f', '#0c2a22'], 12, { speed: 2, up: 3, life: 1.2, scale: 0.7, g: 3 }); }
      if (r.x !== rs.x || r.y !== rs.y) { rs.px = rs.x; rs.py = rs.y; rs.x = r.x; rs.y = r.y; rs.hop = 0; }
      rs.hop = Math.min(1, rs.hop + dt / Math.min(0.2, ROOSTER_STEP * 0.6));
      const wrapJump = Math.abs(rs.px - rs.x) + Math.abs(rs.py - rs.y) > 1;
      const k = wrapJump ? 1 : ease(rs.hop), x = wx(lerp(rs.px, rs.x, k)), z = wz(lerp(rs.py, rs.y, k));
      R.group.position.set(x, Y0 + (reduced ? 0 : Math.sin(rs.hop * Math.PI) * 0.25), z);
      rs.yaw += (((Math.atan2(-r.dir.y, r.dir.x) - rs.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI) * Math.min(1, dt * 18);
      R.group.rotation.y = rs.yaw;
      rs.peck = Math.max(0, rs.peck - dt); rs.crow = Math.max(0, rs.crow - dt);
      const bobN = reduced ? 0 : Math.sin(t * 9) * 0.06;
      R.neck.rotation.z = rs.peck > 0 ? -Math.sin((rs.peck / 0.35) * Math.PI) * 1.1 : rs.crow > 0 ? Math.sin(Math.min(1, (1.2 - rs.crow) * 3) * Math.PI / 2) * 0.5 : bobN - (1 - rs.hop) * 0.3;
      R.tail.rotation.x = reduced ? 0 : Math.sin(t * 3) * 0.05;
      R.legs.forEach((l, i) => { l.rotation.z = rs.hop < 1 ? Math.sin(rs.hop * Math.PI * 2 + i * Math.PI) * 0.5 : 0; });
    } else if (R.group.visible) { R.group.visible = false; rs.seen = false; }
    // ---- the tinikling ----
    const pole = g.pole;
    if (pole) { if (!ps.active) { ps.active = true; ps.axis = pole.axis; ps.index = pole.index; ps.in = 0; ps.clapT = -1; } ps.out = 0; }
    if (ps.active) {
      TP.group.visible = true;
      const row = ps.axis === 'row', c = row ? wz(ps.index) : wx(ps.index);
      TP.group.rotation.y = row ? 0 : Math.PI / 2;
      TP.group.position.set(row ? 0 : c, STAGE, row ? c : 0);
      ps.in = Math.min(1, ps.in + dt / 0.35);
      if (!pole) ps.out += dt / 0.4;
      const slide = (1 - ease(ps.in)) * 26 + ease(Math.min(1, ps.out)) * 26;
      let gap, lift = 0;
      if (pole && pole.warn > 0) {
        const beat = (pole.warn * 2.5) % 1;
        gap = 0.66; lift = reduced ? 0 : Math.abs(Math.sin(beat * Math.PI)) * 0.3;
      } else { if (ps.clapT >= 0) ps.clapT += dt; gap = ps.clapT >= 0 && ps.clapT < 0.07 ? lerp(0.66, 0.15, ps.clapT / 0.07) : 0.15 + (ps.clapT > 0.07 && ps.clapT < 0.2 ? Math.sin(((ps.clapT - 0.07) / 0.13) * Math.PI) * 0.08 : 0); }
      TP.poles.forEach((p, i) => p.position.set(slide, 0.62 + lift, (i ? 1 : -1) * gap));
      TP.blocks.forEach((b) => { b.position.z = 0; b.visible = ps.out < 1; });
      danger.visible = !!pole && pole.warn > 0;
      if (danger.visible) {
        danger.rotation.z = row ? 0 : Math.PI / 2; danger.position.set(row ? 0 : c, Y0 + 0.012, row ? c : 0);
        dangerM.uniforms.time.value = reduced ? 0 : t; dangerM.uniforms.urg.value = 1 - pole.warn / POLE_WARN; dangerM.uniforms.clap.value = 0;
      }
      if (ps.out >= 1) { ps.active = false; TP.group.visible = false; }
    }
    // ---- the plaza ----
    plaza.update(t, dt, { reduced, wrap: !!g.wrap });
    // torches, candles, the bonfire
    const night = cur.night || 0;
    const fl = plaza.flames;
    for (const f of fl) {
      const rate = (f.fire ? 30 : f.torch ? 10 : 1.5) * (level >= 1 ? 1 : 0.5);
      if (Math.random() < rate * dt) fx.glow.add({ x: f.x + (Math.random() - 0.5) * 0.2 * f.s, y: f.y, z: f.z + (Math.random() - 0.5) * 0.2 * f.s, vx: (Math.random() - 0.5) * 0.3, vy: 1.2 * f.s * (0.6 + Math.random() * 0.5), vz: (Math.random() - 0.5) * 0.3, drag: 1.4, life: 0.5, max: 0.5, size: 0.5 * f.s, shrink: true, r: 3, gg: 1.1, b: 0.25 });
      if (f.torch && Math.random() < rate * dt * 0.15) fx.glow.add({ x: f.x, y: f.y + 0.3, z: f.z, vx: (Math.random() - 0.5), vy: 2.5, vz: (Math.random() - 0.5), drag: 0.5, wob: Math.random() * 6, life: 1.8, max: 1.8, size: 0.12, r: 3, gg: 1.4, b: 0.3 });
    }
    // night lights: the nearest glows light the plaza
    const gl = plaza.glows;
    nightLights.forEach((l, i) => { const q = gl[i]; if (!q || night < 0.05) { l.intensity = 0; return; } l.position.copy(q.p); l.color.set(q.color); l.intensity = night * 14 * q.power * (0.85 + (reduced ? 0 : Math.random() * 0.3)); });
    // the air: petals, embers, dust, fireworks at night
    ambT += dt;
    if (ambT > 0.2) {
      ambT = 0;
      const n = fest.name;
      if (n === 'Panagbenga') fx.rain(0, -2, 22, fest.flags, level >= 1 ? 3 : 1, { y: 14, life: 7, scale: 0.7 });
      else if (n === 'Pahiyas' && Math.random() < 0.5) fx.rain(0, -4, 24, fest.flags, 1, { y: 14, life: 7, scale: 1.1 });
      else if (n === 'MassKara' && Math.random() < 0.6) fx.rain(0, -2, 20, fest.flags, 2, { y: 14, life: 6, scale: 0.5 });
    }
    fireworkT -= dt;
    const party = shot && shot.kind === 'level' && shot.t > 0.6;
    if ((night > 0.4 || party || o.mode === 'title') && fireworkT <= 0 && !reduced) {
      fireworkT = party ? 0.25 : 1.6 + Math.random() * 2;
      const x = (Math.random() - 0.5) * 70, y = 34 + Math.random() * 16, z = -40 - Math.random() * 30, c = pick(fest.flags);
      fx.sparks(x, y, z, c, 60, { speed: 11, up: 0, g: 3, size: 1.1, life: 1.4, k: 3 });
    }
    // ---- the camera ----
    const P = playPose(o, P0);
    let want = P;
    const tMode = o.mode;
    if (shot) {
      shot.t += dt;
      const k = clamp(shot.t / shot.dur, 0, 1);
      if (shot.kind === 'intro') {
        orbit(P1, 0, { r: 70, h: 34, lookY: 6, lz: -10, a0: 0.35 }); P1.look.set(0, 2, -14);
        const e2 = ease(k); want = P1; P1.pos.lerp(P.pos, e2); P1.look.lerp(P.look, e2); P1.fov = lerp(P1.fov, P.fov, e2); P1.up = P.up * e2;
      } else if (shot.kind === 'level') {
        const out = k < 0.45 ? ease(k / 0.45) : k < 0.62 ? 1 : 1 - ease((k - 0.62) / 0.38);
        if (!shot.switched && k > 0.28) { shot.switched = true; setFestival(shot.lvl); fx.rain(0, 0, 18, fest.flags, 90, { y: 18, life: 4, scale: 1.2 }); }
        P1.pos.set(shot.side * 22, 28, 36); P1.look.set(0, 3, -14); P1.fov = 44; P1.up = 0;
        want = P1; P1.pos.lerp(P.pos, 1 - out); P1.look.lerp(P.look, 1 - out); P1.fov = lerp(P.fov, 42, out); P1.up = P.up * (1 - out);
      } else if (shot.kind === 'death') {
        const e2 = ease(clamp(k * 1.6, 0, 1)) * (reduced ? 0 : 1);
        want = P1; P1.pos.copy(P.pos); P1.look.copy(P.look); P1.fov = P.fov; P1.up = P.up;
        const hx = shot.at.x, hz = shot.at.z;
        P1.look.lerp(tmpV.set(hx, Y0 + 0.3, hz), e2); P1.pos.lerp(tmpV.set(hx, Y0 + P.pos.y * 0.42, hz + (P.pos.z - P.look.z) * 0.42), e2 * 0.75); P1.fov = lerp(P.fov, P.fov * 0.9, e2);
      }
      if (shot.t >= shot.dur && shot.kind !== 'death') { if (shot.kind === 'level' && !shot.switched) setFestival(shot.lvl); shot = null; }
      if (shot && shot.kind === 'death' && tMode !== 'play') shot = null;
    }
    if (!shot && (tMode === 'title' || tMode === 'medals' || tMode === 'settings')) want = orbit(P1, t, { r: 40, h: 27, lookY: 1, lz: -2, speed: 0.045 });
    else if (!shot && tMode === 'over') want = orbit(P1, t, { r: 34, h: 24, lookY: 0, lz: 0, speed: 0.06, a0: -0.3 });
    else if (!shot && tMode === 'play' && g.alive) {
      // a whisper of follow toward the head, never enough to lose the board
      P.look.x += clamp(h.x, -10, 10) * 0.018; P.look.z += clamp(h.z, -10, 10) * 0.018; P.pos.x += clamp(h.x, -10, 10) * 0.018; P.pos.z += clamp(h.z, -10, 10) * 0.018;
    }
    const tight = shot || tMode === 'play' || tMode === 'pause' ? 1 - Math.exp(-dt * (shot ? 30 : 10)) : 1 - Math.exp(-dt * 1.8);
    cam.pos.lerp(want.pos, tight); cam.look.lerp(want.look, tight); cam.fov = lerp(cam.fov, want.fov, tight);
    cam.up = lerp(cam.up ?? 0, want.up || 0, tight);
    // shake and a punch-in for the big moments (none of it with calm on)
    cam.punch = Math.max(0, cam.punch - dt * 3);
    const shake = reduced ? 0 : cam.shake * cam.shake;
    cam.shake = Math.max(0, cam.shake - dt * 1.6);
    camera.position.copy(cam.pos);
    if (shake > 0) camera.position.add(tmpV.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
    camera.up.set(0, 1, 0).lerp(tmpV.set(0, 0, -1), clamp(cam.up, 0, 1)).normalize();
    camera.lookAt(cam.look);
    if (o.debugCam) { const d = o.debugCam; camera.position.set(d[0], d[1], d[2]); camera.up.set(0, 1, 0); camera.lookAt(d[3], d[4], d[5]); }
    camera.fov = cam.fov * (1 - (reduced ? 0 : Math.sin(cam.punch * Math.PI) * 0.03));
    camera.updateProjectionMatrix();
    // fog never reaches the mat
    const dist = camera.position.distanceTo(cam.look);
    scene.fog.near = Math.max(cur.fogNear, dist + 12); scene.fog.far = Math.max(cur.fogFar, scene.fog.near + 40);
    gridM.opacity = o.grid === 'strong' ? 0.32 : 0;
    fx.update(dt, camera, Y0);
    fx.resize(canvas.clientHeight * renderer.getPixelRatio(), camera.fov);
    cam.flash = Math.max(0, cam.flash - dt * 2.2); cam.split = Math.max(0, cam.split - dt * 1.5);
    post.render(dt, { flash: reduced ? 0 : cam.flash * 0.35, split: reduced ? 0 : cam.split * 0.5, bloomBoost: cam.flash * 0.3 });
    if (overlay.children.length) { const ac = renderer.autoClear, tm = renderer.toneMapping; renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping; renderer.clearDepth(); renderer.render(overlay, camera); renderer.autoClear = ac; renderer.toneMapping = tm; }
  }

  function setEnv(e) {
    env = e;
    dressPlaza(e, plaza).catch(() => {});
    dressFestival(e, plaza, fest.name).catch(() => {});
    applySky(look);
  }

  resize(); quality(level);
  return { frame, event, reset, resize, intro, levelShot, skip, holding, setFestival, setEnv, post, get level() { return level; }, renderer, scene, camera, snake, plaza, fx, get shot() { return shot; } };
}
