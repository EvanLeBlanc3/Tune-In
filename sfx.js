/* Tune In — 8-bit sound effects, synthesized live (no files needed) */
const SFX = (() => {
  let ctx, out;
  function init(c) { ctx = c; out = c.createGain(); out.connect(c.destination); setVol(); }
  function setVol() { if (out) out.gain.value = [0, 0.05, 0.1, 0.18][S.fxVol] || 0.1; }
  function tone(f, t0, dur, type = 'square', v = 1, slide) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  const arp = (t, fs, step, dur, type = 'square', v = 0.7) => fs.forEach((f, i) => tone(f, t + i * step, dur, type, v));
  const S_ = {
    tick: t => tone(2200, t, 0.012, 'square', 0.35),
    select: t => { tone(660, t, 0.06); tone(990, t + 0.05, 0.09); },
    back: t => { tone(740, t, 0.05); tone(440, t + 0.045, 0.08); },
    play: t => arp(t, [523, 659, 784, 1047], 0.045, 0.08),
    pause: t => { tone(784, t, 0.06); tone(523, t + 0.06, 0.1); },
    next: t => tone(380, t, 0.1, 'square', 0.5, 1400),
    prev: t => tone(1400, t, 0.1, 'square', 0.5, 380),
    coin: t => { tone(988, t, 0.07); tone(1319, t + 0.07, 0.28); },
    levelup: t => arp(t, [523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.075, 0.13),
    error: t => tone(160, t, 0.22, 'sawtooth', 0.6, 80),
    toggle: t => tone(1250, t, 0.045, 'triangle', 0.9),
    sleep: t => arp(t, [784, 659, 523, 392, 330], 0.16, 0.22, 'triangle', 0.9),
    heart: t => { tone(880, t, 0.05); tone(1760, t + 0.05, 0.12, 'triangle'); },
    boot: t => arp(t, [262, 330, 392, 523, 659, 784, 1047, 1319], 0.055, 0.12, 'square', 0.6),
    whoosh: t => tone(200, t, 0.18, 'sawtooth', 0.3, 1800)
  };
  function play(name) {
    if (!ctx || !S.sfx || ctx.state !== 'running') return;
    try { S_[name] && S_[name](ctx.currentTime + 0.005); } catch (e) {}
  }
  return { init, play, setVol };
})();
