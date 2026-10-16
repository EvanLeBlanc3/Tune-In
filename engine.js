/* Tune In — audio engine: <audio> → preamp → 10-band EQ → 8-bit crunch → analyser → volume → speakers */
const Engine = (() => {
  const BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  let ctx = null, audio = null, src = null, pre, eq = [], shaper, analyser, vol, routed = false, url = null;
  let volume = 0.8, fade = 1, eqGains = BANDS.map(() => 0), crunch = 0;
  const L = {};
  const on = (e, f) => (L[e] = L[e] || []).push(f);
  const emit = (e, ...a) => (L[e] || []).forEach(f => f(...a));

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    pre = ctx.createGain();
    eq = BANDS.map((f, i) => {
      const b = ctx.createBiquadFilter();
      b.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking';
      b.frequency.value = f; b.Q.value = 1.1; b.gain.value = 0; return b;
    });
    pre.connect(eq[0]);
    for (let i = 0; i < eq.length - 1; i++) eq[i].connect(eq[i + 1]);
    shaper = ctx.createWaveShaper();
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.72;
    vol = ctx.createGain();
    eq[eq.length - 1].connect(shaper); shaper.connect(analyser); analyser.connect(vol); vol.connect(ctx.destination);
    applyEQ(); applyCrunch();
    return ctx;
  }

  function makeAudio() {
    const a = new Audio();
    a.preload = 'auto'; a.setAttribute('playsinline', ''); a.playsInline = true;
    a.addEventListener('ended', () => emit('ended'));
    a.addEventListener('timeupdate', () => emit('time'));
    a.addEventListener('play', () => emit('state'));
    a.addEventListener('pause', () => emit('state'));
    a.addEventListener('loadedmetadata', () => emit('meta'));
    a.addEventListener('error', () => emit('error', a.error));
    return a;
  }

  /* fx=true routes through Web Audio (EQ / visualizer / volume slider). fx=false = plain playback (best for lock screen). */
  function setup(fx) {
    init();
    const old = audio, oldSrc = src;
    const t = old ? old.currentTime : 0, wasPlaying = old ? !old.paused : false;
    audio = makeAudio();
    if (fx) {
      try { src = ctx.createMediaElementSource(audio); src.connect(pre); routed = true; }
      catch (e) { console.warn(e); routed = false; src = null; }
    } else { routed = false; src = null; }
    if (old) {
      old.pause();
      if (oldSrc) try { oldSrc.disconnect(); } catch (e) {}
      if (url) {
        audio.src = url;
        audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = t; } catch (e) {} if (wasPlaying) play(); }, { once: true });
        audio.load();
      }
      old.removeAttribute('src'); try { old.load(); } catch (e) {}
    }
    applyVolume();
  }

  function load(blob, autoplay, startAt = 0) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    audio.src = url;
    audio.load();
    if (startAt) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = startAt; } catch (e) {} }, { once: true });
    if (autoplay) return play();
    return Promise.resolve();
  }
  function play() {
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    return audio.play().catch(e => { console.warn('play', e); emit('state'); });
  }
  const pause = () => audio && audio.pause();
  function seek(t) { if (!audio || !isFinite(audio.duration)) return; audio.currentTime = Math.max(0, Math.min(audio.duration - 0.05, t)); emit('time'); }

  function applyVolume() {
    const v = Math.max(0, Math.min(1, volume)) * fade;
    if (routed && vol) { vol.gain.setTargetAtTime(v * v, ctx.currentTime, 0.02); if (audio) audio.volume = 1; }
    else if (audio) { audio.volume = v; if (vol) vol.gain.value = 1; }
  }
  function setVolume(v) { volume = v; applyVolume(); }
  function setFade(f) { fade = f; applyVolume(); }

  function applyEQ() {
    if (!ctx) return;
    eq.forEach((b, i) => b.gain.setTargetAtTime(eqGains[i], ctx.currentTime, 0.03));
    const maxBoost = Math.max(0, ...eqGains);
    pre.gain.setTargetAtTime(Math.pow(10, -maxBoost * 0.6 / 20), ctx.currentTime, 0.03); // headroom so boosts don't clip
  }
  function setEQ(arr) { eqGains = arr.slice(); applyEQ(); }
  function setBand(i, db) { eqGains[i] = db; applyEQ(); }

  function applyCrunch() {
    if (!shaper) return;
    if (!crunch) { shaper.curve = null; return; }
    const bits = crunch === 1 ? 6 : 4, n = 4096, c = new Float32Array(n), q = Math.pow(2, bits - 1);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * q) / q; }
    shaper.curve = c;
  }
  function setCrunch(level) { crunch = level; applyCrunch(); }

  return {
    BANDS, on, init, setup, load, play, pause, seek, setVolume, setFade, setEQ, setBand, setCrunch,
    get ctx() { return ctx; },
    get audio() { return audio; },
    get analyser() { return routed ? analyser : null; },
    get routed() { return routed; },
    get paused() { return !audio || audio.paused; },
    get time() { return audio ? audio.currentTime || 0 : 0; },
    get duration() { return audio && isFinite(audio.duration) ? audio.duration : 0; },
    resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
  };
})();
