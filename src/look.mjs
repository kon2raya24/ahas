// How each festival looks in 3D: its time of day (the photographed sky, the sun, the fill light, fog,
// exposure), its colour grade, and what dresses the plaza. Keyed by the festival names in festivals.mjs.
// The sun is placed for play: it lights the mat from behind the camera, so shadows fall away from you.
// [sky for light, its strength, backdrop, backdrop turn, backdrop tint]
export const LOOK = {
  Fiesta: {
    time: 'Hapon · afternoon', sky: 'kloofendal_48d_partly_cloudy_puresky', env: 0.8, backdrop: 'kloofendal_48d_partly_cloudy_puresky', turn: 2.6, tint: '#ffffff',
    sun: { az: -0.75, el: 0.95, color: '#fff1da', i: 2.4 }, hemi: ['#dfeeff', '#b59a74', 0.6], fog: ['#cfe0f0', 60, 190], exposure: 1.0,
    grade: [1.12, 1.12, [1.02, 1.0, 0.96], 0.36, 0.2, 1.4], paint: ['#ce1126', '#fcd116', '#0038a8', '#f4f1e8'], night: 0,
    skyCol: ['#4f86c8', '#cfe2f2'],
  },
  Pahiyas: {
    time: 'Umaga · morning', sky: 'qwantani_morning_puresky', env: 0.7, backdrop: 'qwantani_morning_puresky', turn: 2.2, tint: '#fff4e6',
    sun: { az: -0.35, el: 0.62, color: '#ffe2b8', i: 3.1 }, hemi: ['#e6f0ff', '#9aa870', 0.9], fog: ['#e8e2d0', 55, 180], exposure: 1.02,
    grade: [1.08, 1.16, [1.04, 1.02, 0.94], 0.32, 0.2, 1.3], paint: ['#e53935', '#43a047', '#fdd835', '#8e24aa'], night: 0,
    skyCol: ['#5a8ad0', '#f2e2c8'],
  },
  Sinulog: {
    time: 'Tanghali · high noon', sky: 'qwantani_noon_puresky', env: 0.4, backdrop: 'qwantani_noon_puresky', turn: 2.0, tint: '#ffffff',
    sun: { az: -1.0, el: 1.12, color: '#fff6e6', i: 2.1 }, hemi: ['#d8ecff', '#c49a62', 0.55], fog: ['#dce8f2', 60, 200], exposure: 0.98,
    grade: [1.12, 1.18, [1.06, 1.0, 0.9], 0.36, 0.2, 1.3], paint: ['#d32f2f', '#fbc02d', '#d32f2f', '#fff8e1'], night: 0,
    skyCol: ['#3a78c8', '#d6e8f6'],
  },
  Panagbenga: {
    time: 'Maulap na umaga · misty morning', sky: 'kloofendal_misty_morning_puresky', env: 1.0, backdrop: 'kloofendal_misty_morning_puresky', turn: 0, tint: '#eef2f8',
    sun: { az: -0.6, el: 0.8, color: '#f4f0ff', i: 1.9 }, hemi: ['#eef2ff', '#9aa08a', 1.25], fog: ['#dfe3ea', 26, 120], exposure: 1.05,
    grade: [1.02, 1.08, [1.0, 0.98, 1.04], 0.3, 0.26, 1.2], paint: ['#ec407a', '#ab47bc', '#66bb6a', '#ffa726'], night: 0,
    skyCol: ['#aab8c8', '#e2e6ec'],
  },
  MassKara: {
    time: 'Gabi · night', sky: 'qwantani_night_puresky', env: 0.22, backdrop: 'qwantani_night_puresky', turn: 1.2, tint: '#44507e',
    sun: { az: -0.9, el: 0.95, color: '#9fb4ff', i: 0.55 }, hemi: ['#3a4a8a', '#2a1a3a', 0.45], fog: ['#141030', 40, 160], exposure: 1.12,
    grade: [1.1, 1.2, [0.96, 0.96, 1.1], 0.46, 0.45, 1.05], paint: ['#ffd54f', '#7e57c2', '#26c6da', '#ef5350'], night: 1,
    skyCol: ['#070a22', '#2a2450'],
  },
  'Ati-Atihan': {
    time: 'Takipsilim · dusk', sky: 'the_sky_is_on_fire', env: 0.55, backdrop: 'the_sky_is_on_fire', turn: 2.8, tint: '#ffd2b0',
    sun: { az: -0.5, el: 0.42, color: '#ffa060', i: 1.9 }, hemi: ['#b88aa8', '#4a2a1a', 0.7], fog: ['#6a4050', 45, 170], exposure: 1.06,
    grade: [1.12, 1.12, [1.08, 0.96, 0.9], 0.44, 0.55, 0.9], paint: ['#212121', '#e64a19', '#ffb300', '#6d4c41'], night: 0.6,
    skyCol: ['#4a3a6a', '#f0a070'],
  },
  Kadayawan: {
    time: 'Ginintuang hapon · golden hour', sky: 'qwantani_sunset_puresky', env: 0.7, backdrop: 'qwantani_sunset_puresky', turn: 2.4, tint: '#fff0dc',
    sun: { az: -0.55, el: 0.5, color: '#ffc47a', i: 2.8 }, hemi: ['#ffe0c0', '#8a6a3a', 0.85], fog: ['#f0d0a8', 55, 180], exposure: 1.0,
    grade: [1.08, 1.14, [1.08, 1.0, 0.9], 0.36, 0.28, 1.15], paint: ['#ff9800', '#7cb342', '#fdd835', '#8d6e63'], night: 0.1,
    skyCol: ['#5a7ab8', '#ffd09a'],
  },
};
export const lookOf = (name) => LOOK[name] || LOOK.Fiesta;
