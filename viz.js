/* Tune In — pixel visualizers. Everything renders to a tiny canvas that gets scaled up = chunky real pixels. */
const Viz = (() => {
  const MODES = ['PIXEL BARS', 'MIRROR', 'SCOPE', 'RADIAL', 'WARP SPEED', 'PIXEL FIRE', 'WATERFALL', 'SYNTHWAVE', 'INVADERS', 'LED MATRIX'];
  const COLORS = ['THEME', 'RAINBOW', 'HEAT', 'MONO'];
  const RES = { CHUNKY: 56, CLASSIC: 84, CRISP: 128 };
  const freq = new Uint8Array(1024), wave = new Uint8Array(2048);
  let bass = 0, mid = 0, treb = 0, energy = 0, avgBass = 0.2, beat = false, lastBeat = 0, time = 0, simPhase = 0;
  let pal = { bg: [0, 0, 0], fg: [255, 255, 255], dim: [90, 90, 90], v: [[255, 0, 0], [0, 255, 0], [0, 0, 255]] };
  let lut = [], lutRGB = [];
  const states = new WeakMap();

  const hex = h => { h = h.trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb = a => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [255 * f(0), 255 * f(8), 255 * f(4)]; }

  function setPalette(p) { pal = { bg: hex(p.bg), fg: hex(p.fg), dim: hex(p.dim), v: [hex(p.v1), hex(p.v2), hex(p.v3)] }; }
  function buildLut() {
    lut = []; lutRGB = [];
    for (let i = 0; i < 32; i++) {
      const t = i / 31; let c;
      switch (S.vizColor) {
        case 1: c = hsl((t * 300 + time * 50) % 360, 100, 55); break;
        case 2: c = t < 0.33 ? mix([20, 0, 0], [230, 20, 0], t / 0.33) : t < 0.7 ? mix([230, 20, 0], [255, 200, 0], (t - 0.33) / 0.37) : mix([255, 200, 0], [255, 255, 230], (t - 0.7) / 0.3); break;
        case 3: c = mix(pal.dim, pal.fg, Math.min(1, t * 1.6)); break;
        default: c = t < 0.5 ? mix(pal.v[0], pal.v[1], t * 2) : mix(pal.v[1], pal.v[2], (t - 0.5) * 2);
      }
      lutRGB.push(c); lut.push(rgb(c));
    }
  }
  const col = t => lut[Math.max(0, Math.min(31, (t * 31) | 0))];
  const sens = () => [0.6, 0.8, 1, 1.25, 1.55][(S.vizSens || 3) - 1];

  function update(dt) {
    time += dt;
    const an = Engine.analyser, playing = !Engine.paused;
    if (an) { an.getByteFrequencyData(freq); an.getByteTimeDomainData(wave); }
    else if (playing) simulate(dt);
    else { for (let i = 0; i < freq.length; i++) freq[i] *= 0.9; for (let i = 0; i < wave.length; i++) wave[i] = 128 + (wave[i] - 128) * 0.85; }
    const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += freq[i]; return s / (b - a) / 255; };
    bass = avg(1, 8); mid = avg(10, 100); treb = avg(100, 400); energy = (bass + mid + treb) / 3;
    avgBass = avgBass * 0.96 + bass * 0.04;
    const now = performance.now();
    beat = playing && bass > avgBass * 1.18 && bass > 0.45 && now - lastBeat > 280;
    if (beat) lastBeat = now;
    buildLut();
  }
  // Fake-but-groovy data when Background Play mode is on (iOS can't analyse audio there)
  function simulate(dt) {
    simPhase += dt;
    const bpm = 2.1, kick = Math.pow(Math.max(0, Math.cos(simPhase * Math.PI * bpm)), 8);
    for (let i = 0; i < freq.length; i++) {
      const fall = Math.max(0, 1 - i / 700);
      const n = (Math.sin(i * 0.13 + simPhase * 3.1) + Math.sin(i * 0.051 - simPhase * 1.7) + 2) / 4;
      const target = 255 * fall * (0.35 + 0.45 * n + (i < 20 ? kick * 0.5 : 0)) * (0.8 + Math.random() * 0.2);
      freq[i] = freq[i] * 0.6 + target * 0.4;
    }
    for (let i = 0; i < wave.length; i++) wave[i] = 128 + 60 * (0.3 + kick) * Math.sin(i * 0.02 + simPhase * 9) * Math.sin(i * 0.003 + simPhase);
  }
  function bands(n) {
    const out = new Float32Array(n), lo = Math.log(2), hi = Math.log(740), k = sens();
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.exp(lo + (hi - lo) * i / n)), b = Math.max(a + 1, Math.floor(Math.exp(lo + (hi - lo) * (i + 1) / n)));
      let m = 0; for (let j = a; j < b; j++) if (freq[j] > m) m = freq[j];
      let v = Math.max(0, (m / 255 - 0.18) / 0.82);
      v = Math.pow(v, 1.25) * k * (1 + (i / n) * 0.5);
      out[i] = Math.min(1, v);
    }
    return out;
  }

  function stateFor(cv, W, H, mode) {
    let st = states.get(cv);
    if (!st || st.W !== W || st.H !== H || st.mode !== mode || st.res !== S.vizRes) { st = { W, H, mode, res: S.vizRes, peaks: new Float32Array(256), phase: 0, rot: 0, frame: 0, shots: [], shipX: W / 2 }; states.set(cv, st); st.fresh = true; }
    return st;
  }
  const px = (g, x, y, w = 1, h = 1) => g.fillRect(x | 0, y | 0, w, h);
  function line(g, x0, y0, x1, y1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; px(g, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)); } }

  function draw(cv, opts = {}) {
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw || !ch) return;
    const W = opts.width || RES[S.vizRes] || 84, H = Math.max(8, Math.round(W * ch / cw));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const mode = opts.mode != null ? opts.mode : S.vizMode;
    const st = stateFor(cv, W, H, mode);
    const bg = pal.bg, selfDrawn = mode === 5 || mode === 6 || mode === 7;
    if (st.fresh || (!selfDrawn && !S.vizTrails)) { g.fillStyle = rgb(bg); g.fillRect(0, 0, W, H); st.fresh = false; }
    else if (!selfDrawn) { g.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},0.38)`; g.fillRect(0, 0, W, H); }
    (DRAW[mode] || DRAW[0])(g, W, H, st);
  }

  const DRAW = [
    // 0 PIXEL BARS — segmented LED bars with falling peak caps
    (g, W, H, st) => {
      const n = Math.floor(W / 3), b = bands(n), off = Math.floor((W - n * 3) / 2) + 1;
      for (let i = 0; i < n; i++) {
        const h = Math.round(b[i] * (H - 3)), x = off + i * 3;
        for (let y = 0; y < h; y += 2) { g.fillStyle = col(y / H); px(g, x, H - 1 - y, 2, 1); }
        st.peaks[i] = Math.max(h, st.peaks[i] - 0.45);
        g.fillStyle = rgb(pal.fg); px(g, x, H - 2 - Math.round(st.peaks[i]), 2, 1);
      }
    },
    // 1 MIRROR — symmetric bars from the centre line
    (g, W, H, st) => {
      const half = Math.floor(W / 4), b = bands(half), cx = W >> 1, cy = H >> 1;
      for (let i = 0; i < half; i++) {
        const hh = Math.round(b[i] * (cy - 1)); g.fillStyle = col(b[i]);
        px(g, cx + i * 2, cy - hh, 1, hh * 2 + 1); px(g, cx - 2 - i * 2, cy - hh, 1, hh * 2 + 1);
      }
    },
    // 2 SCOPE — retro oscilloscope
    (g, W, H) => {
      g.fillStyle = rgb(pal.dim);
      for (let x = 0; x < W; x += 8) for (let y = 0; y < H; y += 8) px(g, x, y);
      let prev = null; const k = sens();
      for (let x = 0; x < W; x++) {
        const v = (wave[Math.floor(x / W * wave.length)] - 128) / 128;
        const y = Math.round(H / 2 + v * H * 0.45 * k);
        const y0 = prev == null ? y : prev; g.fillStyle = col(Math.abs(v) * 2 + 0.2);
        px(g, x, Math.min(y, y0), 1, Math.abs(y - y0) + 1); prev = y;
      }
    },
    // 3 RADIAL — pulsing pixel sun-burst
    (g, W, H, st) => {
      const cx = W / 2, cy = H / 2, m = Math.min(W, H), r0 = m * 0.16 * (1 + bass * 0.5), n = 48, b = bands(24);
      st.rot += 0.004 + treb * 0.03;
      for (let i = 0; i < n; i++) {
        const v = b[i < 24 ? i : 47 - i], a = st.rot + i / n * Math.PI * 2, len = v * m * 0.34;
        g.fillStyle = col(v);
        line(g, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      }
      g.fillStyle = rgb(pal.fg);
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; px(g, Math.round(cx + Math.cos(a) * (r0 - 2)), Math.round(cy + Math.sin(a) * (r0 - 2))); }
    },
    // 4 WARP SPEED — starfield that punches it on the beat
    (g, W, H, st) => {
      if (!st.stars) st.stars = Array.from({ length: 140 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
      const sp = 0.004 + energy * 0.035 + (beat ? 0.03 : 0), cx = W / 2, cy = H / 2;
      for (const s of st.stars) {
        s.z -= sp; if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; }
        const x = cx + s.x / s.z * W * 0.35, y = cy + s.y / s.z * H * 0.35;
        if (x < 0 || y < 0 || x >= W || y >= H) { s.z = 0; continue; }
        g.fillStyle = col(1 - s.z); const z = s.z < 0.25 ? 2 : 1; px(g, x, y, z, z);
      }
    },
    // 5 PIXEL FIRE — DOOM-style fire fed by the spectrum
    (g, W, H, st) => {
      if (!st.fire) st.fire = new Uint8Array(W * H);
      const f = st.fire, b = bands(W);
      for (let x = 0; x < W; x++) { const mx = Math.abs(x - W / 2) / (W / 2); f[(H - 1) * W + x] = Math.min(36, Math.floor(b[Math.min(W - 1, Math.floor(mx * W * 0.8))] * 48 * (0.7 + energy))); }
      for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
        const s = y * W + x, r = (Math.random() * 3.3) | 0, d = s - W - r + 1;
        if (d >= 0) f[d] = Math.max(0, f[s] - (r & 1));
      }
      const img = g.createImageData(W, H), D = img.data;
      for (let i = 0; i < W * H; i++) {
        const v = f[i]; let c;
        if (!v) c = pal.bg; else c = lutRGB[Math.min(31, Math.round(v / 36 * 31))];
        D[i * 4] = c[0]; D[i * 4 + 1] = c[1]; D[i * 4 + 2] = c[2]; D[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    },
    // 6 WATERFALL — scrolling spectrogram
    (g, W, H) => {
      g.drawImage(g.canvas, 0, -1);
      const b = bands(W);
      for (let x = 0; x < W; x++) { g.fillStyle = b[x] < 0.04 ? rgb(pal.bg) : col(b[x]); px(g, x, H - 1); }
    },
    // 7 SYNTHWAVE — sun, spectrum mountains, endless grid
    (g, W, H, st) => {
      g.fillStyle = rgb(pal.bg); g.fillRect(0, 0, W, H);
      const hz = Math.round(H * 0.56), cx = W / 2, r = Math.round(H * 0.24 * (1 + bass * 0.18)), sy = hz - Math.round(r * 0.35);
      st.phase = (st.phase + 0.006 + energy * 0.05) % 1;
      for (let y = -r; y <= r; y++) {
        const yy = sy + y; if (yy >= hz) break;
        const t = (y + r) / (2 * r); if (t > 0.55 && (Math.floor((yy + st.phase * 6)) % 4 === 0)) continue;
        const w = Math.round(Math.sqrt(r * r - y * y)); g.fillStyle = col(1 - t); px(g, cx - w, yy, w * 2, 1);
      }
      const b = bands(20);
      g.fillStyle = rgb(pal.dim);
      for (let x = 0; x < W; x++) { const i = Math.floor(Math.abs(x - cx) / (W / 2) * 19); const mh = Math.round(b[19 - i] * H * 0.22 + 1); px(g, x, hz - mh, 1, mh); }
      g.fillStyle = col(0.9);
      px(g, 0, hz, W, 1);
      for (let k = 0; k < 9; k++) { const p = ((k / 9) + st.phase) % 1; const y = hz + Math.round((H - hz) * p * p); px(g, 0, y, W, 1); }
      for (let i = -10; i <= 10; i++) line(g, cx + i * 2, hz, cx + i * W / 6, H);
    },
    // 8 INVADERS — dancing aliens + a tiny ship that shoots on the beat
    (g, W, H, st) => {
      const A = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
      const B = ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'];
      if (beat) st.frame ^= 1;
      const spr = st.frame ? B : A, n = W >= 90 ? 5 : 4, b = bands(n * 2), gap = (W - n * 11) / (n + 1);
      for (let i = 0; i < n; i++) {
        const v = (b[i * 2] + b[i * 2 + 1]) / 2, x = Math.round(gap + i * (11 + gap)), y = Math.round(H * 0.45 - v * H * 0.38);
        g.fillStyle = col(0.25 + v * 0.75);
        for (let r = 0; r < 8; r++) for (let c = 0; c < 11; c++) if (spr[r][c] === '1') px(g, x + c, y + r);
      }
      let best = 0; for (let i = 1; i < n; i++) if (b[i * 2] > b[best * 2]) best = i;
      const tx = gap + best * (11 + gap) + 5; st.shipX += (tx - st.shipX) * 0.12;
      if (beat) st.shots.push({ x: Math.round(st.shipX), y: H - 6 });
      g.fillStyle = rgb(pal.fg);
      st.shots = st.shots.filter(s => (s.y -= 2) > 0); st.shots.forEach(s => px(g, s.x, s.y, 1, 2));
      const sx = Math.round(st.shipX); px(g, sx - 3, H - 3, 7, 2); px(g, sx - 1, H - 4, 3, 1); px(g, sx, H - 5, 1, 1);
    },
    // 9 LED MATRIX — chunky dot-matrix display
    (g, W, H, st) => {
      const cell = 4, cols = Math.floor(W / cell), rows = Math.floor(H / cell), b = bands(cols);
      const ox = Math.floor((W - cols * cell) / 2), oy = Math.floor((H - rows * cell) / 2);
      for (let c = 0; c < cols; c++) {
        const lit = Math.round(b[c] * rows);
        st.peaks[c] = Math.max(lit, st.peaks[c] - 0.15);
        for (let r = 0; r < rows; r++) {
          const fromBot = rows - r, on = fromBot <= lit, pk = fromBot === Math.round(st.peaks[c]);
          g.fillStyle = on ? col(fromBot / rows) : pk ? rgb(pal.fg) : `rgba(${pal.dim[0]},${pal.dim[1]},${pal.dim[2]},0.35)`;
          px(g, ox + c * cell + 1, oy + r * cell + 1, cell - 1, cell - 1);
        }
      }
    }
  ];

  return {
    MODES, COLORS, RES, update, draw, setPalette, bands,
    get beat() { return beat; }, get bass() { return bass; }, get energy() { return energy; }
  };
})();
