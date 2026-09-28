// Kulintang gongs, bamboo clicks and a light fiesta loop, synthesized with Web Audio. Nothing plays
// until start() runs from a user gesture.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // pentatonic, like a kulintang row
const LOOP = [0, 4, 2, 4, 3, 4, 2, 1, 0, 4, 2, 4, 5, 4, 3, 2];
const STEP = 60 / 112 / 2;

export function createAudio() {
  let ctx = null, master = null, music = null, noise = null, muted = false, playing = false, step = 0, nextAt = 0, fast = 1;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.45; music.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextAt = ctx.currentTime + 0.1;
    setInterval(schedule, 90);
  }

  // a gong: a sine plus an inharmonic partial, quick strike, slow ring
  function gong(freq, when = 0, gain = 0.1, dur = 0.8, out = master) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    for (const [ratio, g] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * ratio;
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(gain * g, t + 0.006); v.gain.exponentialRampToValueAtTime(0.0001, t + dur / ratio ** 0.5);
      o.connect(v).connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function click(when = 0, freq = 1800, gain = 0.2, dur = 0.05, out = master) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain();
    s.buffer = noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 4;
    v.gain.setValueAtTime(gain, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(v).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  function schedule() {
    if (!ctx || muted) { if (ctx) nextAt = ctx.currentTime + 0.1; return; }
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
    eat(combo, special) {
      const n = SCALE[Math.min(SCALE.length - 1, combo)];
      gong(NOTE(72 + n), 0, 0.12, 0.7);
      if (special) [0, 4, 7].forEach((k, i) => gong(NOTE(84 + SCALE[k % SCALE.length]), 0.07 * (i + 1), 0.07, 0.6));
    },
    turn() { click(0, 2200, 0.03, 0.02); },
    spawn(special) { if (special) [0, 2, 4].forEach((k, i) => gong(NOTE(88 + SCALE[k]), i * 0.05, 0.04, 0.4)); },
    expire() { gong(NOTE(60), 0, 0.06, 0.5); gong(NOTE(55), 0.12, 0.05, 0.6); },
    tap() { click(0, 1400, 0.12, 0.05); },
    clap() { click(0, 1200, 0.5, 0.09); click(0.01, 600, 0.3, 0.12); },
    cut() { gong(NOTE(50), 0, 0.12, 0.8); },
    die() { [67, 64, 60, 55, 48].forEach((n, i) => gong(NOTE(n), i * 0.13, 0.1, 1)); },
    level() { [0, 2, 4, 7, 9, 12].forEach((k, i) => gong(NOTE(72 + k), i * 0.08, 0.09, 0.9)); gong(NOTE(48), 0, 0.12, 1.6); },
    // tik-ti-la-ok: four rising and falling squawks
    crow() {
      if (!ctx || muted) return;
      [[700, 900, 0.09], [800, 1100, 0.08], [900, 1300, 0.1], [1300, 700, 0.35]].reduce((when, [f0, f1, d]) => {
        const t = ctx.currentTime + when, o = ctx.createOscillator(), v = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
        v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(0.035, t + 0.02); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(v).connect(master); o.start(t); o.stop(t + d + 0.02);
        return when + d + 0.03;
      }, 0);
    },
    peck() { click(0, 3000, 0.2, 0.03); click(0.07, 3000, 0.15, 0.03); },
    shield() { [0, 4, 7, 12, 16].forEach((k, i) => gong(NOTE(84 + k), i * 0.04, 0.07, 0.8)); },
    medal() { [0, 7, 12].forEach((k, i) => gong(NOTE(79 + k), i * 0.12, 0.08, 1)); },
  };
}
