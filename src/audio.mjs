// Kulintang gongs, bamboo clicks and a light fiesta loop, synthesized with Web Audio, plus real
// recordings (CC0, Kenney's Impact Sounds): the crunch of a bite, bamboo on wood for the tinikling,
// clay for the banga, a bell for the anting-anting. Nothing plays until start() runs from a user gesture.
const SAMPLES = { impactWood_light_: 2, impactWood_heavy_: 2, impactPlate_light_: 2, impactSoft_medium_: 3, impactPunch_medium_: 1, impactBell_heavy_: 1, impactGeneric_light_: 2 };
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // pentatonic, like a kulintang row
const LOOP = [0, 4, 2, 4, 3, 4, 2, 1, 0, 4, 2, 4, 5, 4, 3, 2];
const STEP = 60 / 112 / 2;

export function createAudio({ base = 'assets/sfx/' } = {}) {
  const buf = {}, mix = { music: 1, sfx: 1 };
  let sfx = null;
  let ctx = null, master = null, music = null, noise = null, muted = false, musicOn = true, playing = false, step = 0, nextAt = 0, fast = 1;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.45 * mix.music; music.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = mix.sfx; sfx.connect(master);
    for (const [k, n] of Object.entries(SAMPLES)) for (let i = 0; i < n; i++) fetch(`${base}${k}00${i}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => ctx.decodeAudioData(a)).then((b) => { buf[k + i] = b; }).catch(() => { /* synth only */ });
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextAt = ctx.currentTime + 0.1;
    setInterval(schedule, 90);
  }

  // a gong: a sine plus an inharmonic partial, quick strike, slow ring
  function gong(freq, when = 0, gain = 0.1, dur = 0.8, out = sfx) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    for (const [ratio, g] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * ratio;
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(gain * g, t + 0.006); v.gain.exponentialRampToValueAtTime(0.0001, t + dur / ratio ** 0.5);
      o.connect(v).connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function click(when = 0, freq = 1800, gain = 0.2, dur = 0.05, out = sfx) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain();
    s.buffer = noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 4;
    v.gain.setValueAtTime(gain, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(v).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // one of a recording's takes, a little higher or lower each time
  function play(name, gain = 1, rate = 1, vary = 0.08, when = 0) {
    if (!ctx || muted) return false;
    const takes = Array.from({ length: SAMPLES[name] || 0 }, (_, i) => buf[name + i]).filter(Boolean);
    if (!takes.length) return false;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = takes[Math.floor(Math.random() * takes.length)]; s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    g.gain.value = gain; s.connect(g).connect(sfx); s.start(ctx.currentTime + when);
    return true;
  }
  function schedule() {
    if (!ctx || muted || !musicOn) { if (ctx) nextAt = ctx.currentTime + 0.1; return; }
    const stepLen = STEP / fast;
    while (nextAt < ctx.currentTime + 0.25) {
      const rel = Math.max(0, nextAt - ctx.currentTime), b = step % 16;
      gong(NOTE(67 + SCALE[LOOP[b]]), rel, playing ? 0.03 : 0.022, 0.5, music);
      if (b % 4 === 0) gong(NOTE(43 + (b === 8 ? 5 : 0)), rel, 0.05, 1.2, music); // agung, the low gong
      if (playing) click(rel, b % 2 ? 2600 : 1600, b % 4 === 2 ? 0.07 : 0.035, 0.04, music); // bamboo
      nextAt += stepLen; step++;
    }
  }

  return {
    start,
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    set(isPlaying, tempo = 1) { playing = isPlaying; fast = tempo; },
    setMusic(on) { musicOn = on; },
    setMix(m) { Object.assign(mix, m); if (music) music.gain.value = 0.45 * mix.music; if (sfx) sfx.gain.value = mix.sfx; },
    eat(combo, special) {
      play('impactSoft_medium_', 0.9, 1.5); play('impactGeneric_light_', 0.5, 1.7, 0.1);
      const n = SCALE[Math.min(SCALE.length - 1, combo)];
      gong(NOTE(72 + n), 0, 0.12, 0.7);
      if (special) [0, 4, 7].forEach((k, i) => gong(NOTE(84 + SCALE[k % SCALE.length]), 0.07 * (i + 1), 0.07, 0.6));
    },
    turn() { click(0, 2200, 0.03, 0.02); },
    spawn(special) { if (special) [0, 2, 4].forEach((k, i) => gong(NOTE(88 + SCALE[k]), i * 0.05, 0.04, 0.4)); },
    expire() { gong(NOTE(60), 0, 0.06, 0.5); gong(NOTE(55), 0.12, 0.05, 0.6); },
    tap() { if (!play('impactWood_light_', 0.55, 1.2)) click(0, 1400, 0.12, 0.05); },
    pot() { play('impactPlate_light_', 0.35, 0.7); },
    clap() { play('impactWood_heavy_', 1, 1.1); click(0, 1200, 0.35, 0.09); click(0.01, 600, 0.2, 0.12); },
    cut() { play('impactPunch_medium_', 0.7, 0.9); gong(NOTE(50), 0, 0.12, 0.8); },
    die() { play('impactPunch_medium_', 0.9, 0.7); play('impactPlate_light_', 0.4, 0.6); [67, 64, 60, 55, 48].forEach((n, i) => gong(NOTE(n), i * 0.13, 0.1, 1)); },
    level() { play('impactBell_heavy_', 0.35, 1.2); [0, 2, 4, 7, 9, 12].forEach((k, i) => gong(NOTE(72 + k), i * 0.08, 0.09, 0.9)); gong(NOTE(48), 0, 0.12, 1.6); },
    // tik-ti-la-ok: four rising and falling squawks
    crow() {
      if (!ctx || muted) return;
      [[700, 900, 0.09], [800, 1100, 0.08], [900, 1300, 0.1], [1300, 700, 0.35]].reduce((when, [f0, f1, d]) => {
        const t = ctx.currentTime + when, o = ctx.createOscillator(), v = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
        v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(0.035, t + 0.02); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(v).connect(sfx); o.start(t); o.stop(t + d + 0.02);
        return when + d + 0.03;
      }, 0);
    },
    peck() { click(0, 3000, 0.2, 0.03); click(0.07, 3000, 0.15, 0.03); },
    shield() { play('impactBell_heavy_', 0.5, 1.5); [0, 4, 7, 12, 16].forEach((k, i) => gong(NOTE(84 + k), i * 0.04, 0.07, 0.8)); },
    medal() { [0, 7, 12].forEach((k, i) => gong(NOTE(79 + k), i * 0.12, 0.08, 1)); },
  };
}
