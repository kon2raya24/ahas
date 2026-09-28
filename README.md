# Ahas sa Fiesta

Classic snake at a Pinoy fiesta. Steer a flag-colored snake in a salakot across a woven banig mat, eat street food, and keep your head out of the tinikling poles.

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

Every 8 meals is a new **barangay**. Each one adds banga (clay pots) to steer around, and from barangay 2 a **tandang** (rooster) struts around pecking your fishball before you can. Don't run into either.

After six meals, the **tinikling** starts. A row or column turns red, the bamboo poles tap twice, then clap. If your head is in the line, it's game over. If only your body is, the poles snip your tail and cost 5 points per segment.

Ten **medalya** unlock as you play: Unang Kagat, Busog, Tinikling Master, Sanlibo and more. Each mode keeps a top 5, and **I-share** copies your score to paste anywhere.

## Run locally

No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Tests (Node 20+): `node --test test/*.test.mjs`

## How it's built

- `src/game.mjs` holds the rules as a pure `step(game, dt)` that returns events. It's seeded, so tests are deterministic.
- `src/render.mjs` draws everything on a canvas: the banig (painted once), the bamboo frame, bunting, parols, food sprites, the snake with smooth interpolation, the poles, confetti and popups.
- `src/audio.mjs` makes kulintang-style gongs, bamboo clicks and a fiesta loop with Web Audio.
- `src/bot.mjs` plays the title screen and doubles as a playtest in the tests, in every mode.
- `src/medals.mjs` works out medals from a finished game state.

Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT
