// Offline play: the game's own files (three.js and the sounds included) are cached on install and
// served cache-first; the plaza's scans (assets/env) and the webfont are cached the first time they load. Bump VERSION whenever a file changes so players get the update.
const VERSION = 'ahas-v16';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'src/main.mjs', 'src/game.mjs', 'src/render.mjs', 'src/audio.mjs', 'src/bot.mjs', 'src/rng.mjs', 'src/medals.mjs', 'src/festivals.mjs',
  'src/view3d.mjs', 'src/plaza.mjs', 'src/crowd3d.mjs', 'src/snake3d.mjs', 'src/models.mjs', 'src/fx3d.mjs', 'src/tex.mjs', 'src/post.mjs', 'src/envpack.mjs', 'src/look.mjs',
  'src/vendor/three.module.min.js', 'src/vendor/three-fx.min.js', 'src/vendor/three-mocap.min.js',
  'assets/sfx/impactWood_light_000.mp3', 'assets/sfx/impactWood_light_001.mp3', 'assets/sfx/impactWood_heavy_000.mp3', 'assets/sfx/impactWood_heavy_001.mp3',
  'assets/sfx/impactPlate_light_000.mp3', 'assets/sfx/impactPlate_light_001.mp3', 'assets/sfx/impactSoft_medium_000.mp3', 'assets/sfx/impactSoft_medium_001.mp3',
  'assets/sfx/impactSoft_medium_002.mp3', 'assets/sfx/impactPunch_medium_000.mp3', 'assets/sfx/impactBell_heavy_000.mp3', 'assets/sfx/impactGeneric_light_000.mp3', 'assets/sfx/impactGeneric_light_001.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match('index.html')) || Response.error();
    }
  }));
});
