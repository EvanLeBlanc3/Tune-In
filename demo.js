/* Tune In — built-in chiptune "Demo Cartridge": synthesized on your phone so the app works before you import anything */
const Demo = (() => {
  const SONGS = [
    { title: 'Pixel Sunrise', bpm: 132, root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 7, 9, 5], seed: 11, art: 'sun' },
    { title: 'Dungeon Groove', bpm: 104, root: 57, scale: [0, 3, 5, 7, 10], prog: [0, 5, 8, 7], seed: 42, art: 'brick' },
    { title: 'Boss Rush', bpm: 168, root: 52, scale: [0, 2, 3, 7, 8], prog: [0, 8, 3, 10], seed: 1337, art: 'skull' }
  ];
  const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  async function render(song) {
    const sr = 44100, step = 60 / song.bpm / 4, bars = 8, steps = bars * 16, loops = 2, dur = steps * step * loops + 1.2;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(1, Math.ceil(sr * dur), sr);
    const master = ctx.createGain(); master.gain.value = 0.42; master.connect(ctx.destination);
    const nb = ctx.createBuffer(1, sr, sr), nd = nb.getChannelData(0); for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
    const note = (type, f, t, d, v) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.setValueAtTime(v, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
    };
    const noise = (t, d, v, ft, ff) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = nb; f.type = ft; f.frequency.value = ff;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.02);
    };
    const kick = t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2); };
    const R = rng(song.seed);
    const phrase = () => { const p = []; let deg = 2; for (let s = 0; s < 32; s++) { if (R() < (s % 4 === 0 ? 0.85 : 0.45)) { deg = Math.max(0, Math.min(9, deg + Math.round((R() - 0.5) * 4))); p.push({ deg, len: R() < 0.3 ? 2 : 1 }); } else p.push(null); } return p; };
    const A = phrase(), B = phrase();
    for (let L = 0; L < loops; L++) for (let s = 0; s < steps; s++) {
      const t = (L * steps + s) * step + 0.05, bar = Math.floor(s / 16), bs = s % 16, chord = song.root + song.prog[bar % 4];
      const mel = (bar < 4 ? A : B)[(s % 32)];
      if (mel) { const d = mel.deg, m = song.root + 12 + song.scale[d % 5] + 12 * Math.floor(d / 5); note('square', mtof(m), t, step * mel.len * 0.95, 0.16); }
      const arp = [0, 4, 7, 12][bs % 4] - (song.scale[1] === 3 || song.scale[2] === 3 ? (bs % 4 === 1 ? 1 : 0) : 0);
      note('square', mtof(chord + arp), t, step * 0.5, 0.05);
      if (bs % 2 === 0) note('triangle', mtof(chord - 24 + (bs % 4 === 2 ? 12 : 0)), t, step * 1.8, 0.5);
      if (bs === 0 || bs === 8 || (bs === 10 && bar % 2)) kick(t);
      if (bs === 4 || bs === 12) noise(t, 0.16, 0.45, 'bandpass', 1800);
      if (bs % 2 === 0) noise(t, 0.04, 0.18, 'highpass', 7000);
    }
    const buf = await new Promise((res, rej) => { ctx.oncomplete = e => res(e.renderedBuffer); const p = ctx.startRendering(); if (p && p.then) p.then(res, rej); });
    return wav(buf);
  }

  function wav(buf) {
    const d = buf.getChannelData(0), n = d.length, sr = buf.sampleRate, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([ab], { type: 'audio/wav' });
  }

  function art(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    if (kind === 'sun') {
      ['#2b0f54', '#5a1a7a', '#a2307a', '#e0525f', '#ff8a3d', '#ffc24a'].forEach((col, i) => P(0, i * 4, 32, 4, col));
      for (let y = -9; y <= 0; y++) { const w = Math.round(Math.sqrt(81 - y * y)); if (y % 3 !== -1) P(16 - w, 20 + y, w * 2, 1, '#fff27a'); }
      for (let x = 0; x < 32; x++) { const h = 4 + Math.round(3 * Math.abs(Math.sin(x * 0.35)) + 2 * Math.abs(Math.sin(x * 0.9))); P(x, 24 - h + 4, 1, h + 4, '#1b0a33'); }
      P(0, 26, 32, 6, '#120624'); for (let x = 0; x < 32; x += 4) P(x, 26, 1, 6, '#ff4fd8'); P(0, 28, 32, 1, '#ff4fd8');
    } else if (kind === 'brick') {
      P(0, 0, 32, 32, '#1d1a26');
      for (let y = 0; y < 32; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < 32; x += 8) P(x + 1, y + 1, 7, 3, '#3b3550');
      P(14, 12, 4, 14, '#6b4a2a'); P(12, 10, 8, 3, '#8a6338');
      ['#ffe14a', '#ff9a2a', '#ff4a2a'].forEach((col, i) => P(14 - i, 4 + i * 2, 4 + i * 2, 4, col)); P(15, 2, 2, 3, '#fff6b0');
    } else {
      P(0, 0, 32, 32, '#3a0010'); for (let i = 0; i < 40; i++) P((i * 13) % 32, (i * 7) % 32, 1, 1, '#ff3a3a');
      const sk = ['0011111100', '0111111110', '1111111111', '1100110011', '1100110011', '1111111111', '0111001110', '0011111100', '0010101100', '0011111100'];
      sk.forEach((r, y) => [...r].forEach((b, x) => b === '1' && P(6 + x * 2, 6 + y * 2, 2, 2, '#f4f0e0')));
      P(0, 28, 32, 4, '#ff2a2a');
    }
    const big = document.createElement('canvas'); big.width = big.height = 256; const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(c, 0, 0, 256, 256);
    return new Promise(r => big.toBlob(r, 'image/png'));
  }

  return { SONGS, render, art };
})();
