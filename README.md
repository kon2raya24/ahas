# Ahas sa Fiesta

Classic snake at a Pinoy fiesta, in 3D. Steer a glossy, flag-colored serpent in a salakot across a giant woven banig in the middle of a town plaza, eat street food, and keep your head out of the tinikling poles.

**Play:** https://ahas-sa-fiesta.vercel.app · https://kon2raya24.github.io/ahas/

## Modes

- **Klasiko:** the bamboo frame is a wall.
- **Walang Pader:** no walls. Slip out one side and come back in the other.
- **Araw-araw:** a daily challenge. Everyone gets the same board each day, and your best for the day is kept.

## How to play

- **Arrow keys / WASD** steer, or swipe on a phone (there's a d-pad too). Two quick turns are both remembered, so corners feel tight.
- **P / Esc** pauses, **M** toggles sound.

| Food | Effect |
| --- | --- |
| Fishball, kwek-kwek | +10, grow 1 |
| Turon, banana cue | +15, grow 2 |
| Balut (timed) | +50, and every point ×2 for 8 s |
| Sili (timed) | faster for 6 s, points ×2 |
| Halo-halo (timed) | slow motion for 6 s ("brain freeze") |
| Anting-anting (timed) | saves you from one crash, then you phase for 1.5 s |

Eat again within 2.5 s to build a **sunod-sunod** combo (up to ×4). The bonuses stack.

Every 8 meals is a new **barangay**, and each barangay is a real Philippine festival with its own banig colors and bunting: Pahiyas (Lucban), Sinulog (Cebu), Panagbenga (Baguio), MassKara (Bacolod), Ati-Atihan (Kalibo) and Kadayawan (Davao). Each one also adds banga (clay pots) to steer around, and from barangay 2 a **tandang** (rooster) struts around pecking your fishball before you can. Don't run into either.

After six meals, the **tinikling** starts. A row or column turns red, the bamboo poles tap twice, then clap. If your head is in the line, it's game over. If only your body is, the poles snip your tail and cost 5 points per segment.

Ten **medalya** unlock as you play: Unang Kagat, Busog, Tinikling Master, Sanlibo and more. Each mode keeps a top 5, and **I-share** copies your score to paste anywhere. Sound and music toggle separately, and your first game shows short hints.

**Install it:** on a phone, use *Add to Home Screen*. It works offline after the first visit.

## Run locally

No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Tests (Node 20+): `node --test test/*.test.mjs`

## The look

The board is a banig on an entablado in the middle of a town plaza: food stalls under striped awnings either side, a coral-stone church with twin bell towers at the far end, bahay na bato all round, trees, lamp posts and bunting on tall bamboo posts. The mat's strips are one cell wide, so the weave itself is the grid and stays readable at speed.

Each barangay's festival re-dresses the plaza and changes the time of day:

| Barangay | Festival | Time | Dressing |
| --- | --- | --- | --- |
| 1 | Fiesta | afternoon | banderitas, parols, balloons |
| 2 | Pahiyas | morning | kiping chandeliers and garlands, rice stalks, harvest heaps |
| 3 | Sinulog | high noon | red and yellow banners, candles by the hundred |
| 4 | Panagbenga | misty morning | flower arches and garlands, pines, falling petals |
| 5 | MassKara | night | giant smiling masks, neon arches, string lights, fireworks |
| 6 | Ati-Atihan | dusk | torches, drums, tribal banners, a bonfire, embers |
| 7 | Kadayawan | golden hour | fruit heaps, woven t'nalak banners, orchid garlands |

The camera is a tilted three-quarter view that always fits the whole board above the HUD and d-pad (or straight down: *Ayos → Kamera → Itaas*). A game opens with a flyover, each new festival swings out over the plaza and back, and a crash punches in. Eating is a real bite: the mouth opens as the head closes in, then chomps when it gets there, with crumbs, sparks, a flash of light and the score floating up. The snake glances where you've steered before it turns.

**Settings (Ayos):** graphics auto/high/medium/low (auto steps down on slow devices; `?gfx=0|1|2` pins it), music and effects volume, camera shake (Kalmado turns off shake, flashes and the camera swings; `prefers-reduced-motion` does too), the camera angle and stronger grid lines. Keyboard, swipes, the d-pad and gamepads all steer.

Townsfolk stand round the stage and jump with their arms up when you chain a combo, survive on an anting-anting or reach a new festival, which also opens with fireworks. On the Vercel deploy they're the baked Mixamo crowd from Tumbang Preso (`assets/people/`, git-ignored; `?people=0` skips it); everywhere else they're instanced townsfolk built in code. Food bobs and glints, the tinikling's clack sends a shockwave across its line, and a crash punches in on the head as the body pops into confetti and the salakot tumbles to the mat.

A busy frame is under 200 draws at medium graphics: static decor is merged per material (per festival too), the bunting, flowers, crowd and props are instanced, and only things near the stage throw shadows. Sound goes through a limiter, with the music under the effects and every recording normalised.

If WebGL won't start, the game falls back to the original 2D board (`?flat=1` forces it).

## How it's built

- `src/game.mjs` holds the rules as a pure `step(game, dt)` that returns events. It's seeded, so tests are deterministic.
- `src/view3d.mjs` is the three.js view: lights, the per-festival time of day, the food, banga, tandang and tinikling, the camera and its shots. It only reads the game.
- `src/plaza.mjs` builds the plaza and each festival's dressing; `src/snake3d.mjs` is the serpent (one tube rebuilt each frame along the path, rounded corners, a slither fixed in the world, bulges after meals); `src/models.mjs` the crafted pieces; `src/fx3d.mjs` particles, rings, light flashes and floating lettering; `src/tex.mjs` procedural canvas textures; `src/look.mjs` each festival's sky, sun and grade; `src/post.mjs` the film look (ambient occlusion, bloom, grade, vignette, grain, SMAA), adapted from Tumbang Preso.
- `src/envpack.mjs` swaps in CC0 [Poly Haven](https://polyhaven.com) scans from `assets/env/`: seven skies (light and backdrop), herringbone brick, coral stone, clay tiles, plaster and boards, and real props (tables, chairs, baskets, fruit, a cart, candle holders, flowers, a fire pit); the mango and acacia trees are built in code. They were converted with the Bakbakan tools (`tools/env-run.mjs`). Without them the painted plaza stays.
- `assets/sfx/` holds CC0 [Kenney](https://kenney.nl) impact sounds (the bite, bamboo on wood, clay, a bell); `src/audio.mjs` mixes them with the synthesized gongs and fiesta loop.
- `src/render.mjs` is the original 2D canvas renderer, kept as the fallback.
- `src/audio.mjs` makes kulintang-style gongs, bamboo clicks and a fiesta loop with Web Audio.
- `src/bot.mjs` plays the title screen and doubles as a playtest in the tests, in every mode.
- `src/medals.mjs` works out medals from a finished game state, and `src/festivals.mjs` holds the festival themes.
- `sw.js` precaches the code, three.js and the sounds for offline play (the scans are cached as they load). Bump its `VERSION` whenever a file changes, and a test checks that every module is in its list.

Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT
