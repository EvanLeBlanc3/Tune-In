/* ==========================================================
   TUNE IN — pixel MP3 player for iPhone (PWA)
   ========================================================== */
'use strict';
const $ = s => document.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const VERSION = '1.0';

/* ---------- Settings ---------- */
const DEF = {
  theme: 'classic', sfx: true, fxVol: 2, haptics: true, scan: 1, glow: true, backlight: 0, wheelSpeed: 1, pixelArt: false, bgPlay: false,
  vol: 0.8, shuffle: false, repeat: 0, eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], eqPreset: 'Flat', crunch: 0,
  vizMode: 0, vizColor: 0, vizRes: 'CLASSIC', vizTrails: true, vizFlash: true, vizSens: 3, vizAuto: 0, miniViz: true,
  xp: 0, plays: 0, secs: 0
};
const S = Object.assign({}, DEF, JSON.parse(localStorage.getItem('tunein.s') || '{}'));
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => localStorage.setItem('tunein.s', JSON.stringify(S)), 150); };

const PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  'Rock': [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  'Pop': [-1, 1, 3, 4, 3, 1, -1, -1, 1, 2],
  'Hip-Hop': [6, 5, 2, 3, -1, -1, 1, 0, 2, 3],
  'Electronic': [5, 4, 1, 0, -2, 2, 1, 2, 4, 5],
  'Jazz': [3, 2, 1, 2, -2, -2, 0, 1, 2, 3],
  'Classical': [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  'Acoustic': [4, 4, 3, 1, 2, 2, 3, 3, 2, 1],
  'Vocal Boost': [-2, -3, -2, 1, 4, 4, 3, 1, 0, -2],
  'Late Night': [3, 3, 2, 0, -1, 0, 1, 0, -2, -4],
  'Small Speakers': [-4, -2, 0, 2, 3, 3, 3, 2, 1, 0],
  'Arcade Cabinet': [-6, -4, -1, 2, 5, 6, 4, 0, -4, -8]
};
const RANKS = ['Mixtape Rookie', 'Cassette Kid', 'Walkman Warrior', 'Burned CD Hero', 'MP3 Pirate', 'Click Wheel Ace', 'Playlist Wizard', 'Shuffle Legend', 'Bass Boss', 'Audiophile Overlord', 'Eternal DJ'];
const level = xp => Math.floor(Math.sqrt(xp / 40)) + 1;
const xpFor = L => 40 * (L - 1) * (L - 1);
const rankOf = L => RANKS[Math.min(RANKS.length - 1, Math.floor((L - 1) / 2))];

/* ---------- Library ---------- */
let LIB = [];
const byId = new Map();
const artistOf = t => t.albumArtist || t.artist || 'Unknown Artist';
const albumOf = t => t.album || 'Unknown Album';
function indexLib() {
  LIB.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  byId.clear(); LIB.forEach(t => byId.set(t.id, t));
}
function groupBy(fn) { const m = new Map(); LIB.forEach(t => { const k = fn(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); return m; }
const albumSort = (a, b) => (a.track || 999) - (b.track || 999) || a.title.localeCompare(b.title);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const artCache = new Map(), pixCache = new Map();
async function artFor(t) {
  if (!t || !t.artKey) return null;
  if (artCache.has(t.artKey)) return artCache.get(t.artKey);
  const b = await DB.getArt(t.artKey);
  const u = b ? URL.createObjectURL(b) : null;
  artCache.set(t.artKey, u); return u;
}
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function pixelated(url, n = 36) {
  if (pixCache.has(url)) return pixCache.get(url);
  const img = await loadImg(url), c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, n, n);
  const d = c.toDataURL('image/png'); pixCache.set(url, d); return d;
}
async function shrinkArt(blob) {
  try {
    const u = URL.createObjectURL(blob), img = await loadImg(u), c = document.createElement('canvas'), n = 320;
    c.width = c.height = n; const g = c.getContext('2d');
    const s = Math.min(img.width, img.height); g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n);
    URL.revokeObjectURL(u);
    return await new Promise(r => c.toBlob(b => r(b || blob), 'image/jpeg', 0.85));
  } catch (e) { return blob; }
}

/* ---------- Player ---------- */
const P = { queue: [], order: [], pos: -1, cur: null, counted: false, listened: 0, lastT: 0 };
const Sleep = { end: 0, eos: false, label: 'Off' };

function buildOrder(startIdx, randomStart) {
  const n = P.queue.length, o = [...Array(n).keys()];
  if (S.shuffle) {
    for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [o[i], o[j]] = [o[j], o[i]]; }
    if (!randomStart && startIdx >= 0) { const k = o.indexOf(startIdx); [o[0], o[k]] = [o[k], o[0]]; }
    P.order = o; P.pos = 0;
  } else { P.order = o; P.pos = Math.max(0, startIdx); }
}
function playIds(ids, start = 0, opt = {}) {
  if (!ids.length) { toast('NO SONGS!'); SFX.play('error'); return false; }
  if (opt.shuffle != null) { S.shuffle = opt.shuffle; save(); }
  P.queue = ids.slice(); buildOrder(start, opt.randomStart);
  loadPos(true); return true;
}
function shuffleAll() {
  if (!LIB.length) { toast('ADD MUSIC FIRST!'); SFX.play('error'); return; }
  playIds(LIB.map(t => t.id), 0, { shuffle: true, randomStart: true });
  SFX.play('whoosh'); pushNP();
}
async function loadPos(autoplay, startAt = 0) {
  const id = P.queue[P.order[P.pos]], t = byId.get(id);
  if (!t) return;
  P.cur = t; P.counted = false; P.listened = 0; P.lastT = startAt;
  const blob = await DB.getBlob(id);
  if (!blob) { toast('FILE MISSING'); return; }
  await Engine.load(blob, autoplay, startAt);
  onTrackChange();
}
function next(user = true) {
  if (!P.queue.length) return;
  const wasPlaying = !Engine.paused;
  if (!user && S.repeat === 2) { Engine.seek(0); Engine.play(); return; }
  if (P.pos < P.order.length - 1) P.pos++;
  else if (S.repeat === 1 || user) { if (S.shuffle) buildOrder(-1, true); P.pos = 0; }
  else { P.pos = 0; loadPos(false); toast('END OF QUEUE'); return; }
  loadPos(user ? wasPlaying : true);
}
function prev() {
  if (!P.queue.length) return;
  if (Engine.time > 3) { Engine.seek(0); return; }
  const wasPlaying = !Engine.paused;
  if (P.pos > 0) P.pos--; else if (S.repeat === 1) P.pos = P.order.length - 1; else { Engine.seek(0); return; }
  loadPos(wasPlaying);
}
function togglePlay() {
  if (!P.cur) { if (LIB.length) shuffleAll(); else { toast('ADD MUSIC FIRST!'); push(ImportView()); } return; }
  if (Engine.paused) { Engine.play(); SFX.play('play'); } else { Engine.pause(); SFX.play('pause'); }
}
function toggleShuffle() {
  S.shuffle = !S.shuffle; save();
  if (P.queue.length) { const cur = P.order[P.pos]; if (S.shuffle) buildOrder(cur); else { P.order = [...P.queue.keys()]; P.pos = cur; } }
  toast(S.shuffle ? 'SHUFFLE ON' : 'SHUFFLE OFF'); SFX.play('toggle'); saveResume();
}
function cycleRepeat() { S.repeat = (S.repeat + 1) % 3; save(); toast(['REPEAT OFF', 'REPEAT ALL', 'REPEAT ONE'][S.repeat]); SFX.play('toggle'); }
function toggleFav(t) { if (!t) return; t.fav = !t.fav; DB.putTrack(t); SFX.play(t.fav ? 'heart' : 'toggle'); toast(t.fav ? '♥ FAVORITED' : 'UNFAVORITED'); }
function playNext(t) {
  if (!P.queue.length) { playIds([t.id]); return; }
  P.queue.push(t.id); P.order.splice(P.pos + 1, 0, P.queue.length - 1);
  toast('PLAYING NEXT'); SFX.play('coin'); saveResume();
}
function setVol(v) { S.vol = clamp(Math.round(v * 100) / 100, 0, 1); Engine.setVolume(S.vol); save(); }

Engine.on('ended', () => { if (Sleep.eos) { doSleep(); return; } next(false); });
Engine.on('state', () => { updateStatus(); updateMS(); const v = topV(); v && v.state && v.state(); });
Engine.on('error', () => { toast("CAN'T PLAY FILE"); SFX.play('error'); });
Engine.on('time', () => {
  const t = Engine.time, d = t - P.lastT; P.lastT = t;
  if (Engine.paused || d <= 0 || d > 1.5 || !P.cur) return;
  P.listened += d; S.secs += d;
  if (!P.counted && P.listened >= Math.min(30, (Engine.duration || 60) * 0.5)) {
    P.counted = true; P.cur.plays = (P.cur.plays || 0) + 1; P.cur.lastPlayed = Date.now(); DB.putTrack(P.cur);
    S.plays++; addXP(10);
  }
});
function addXP(n) {
  const L0 = level(S.xp); S.xp += n; save();
  const L1 = level(S.xp);
  if (L1 > L0) { setTimeout(() => { toast(`LEVEL UP! LV ${L1}<br><small>${rankOf(L1).toUpperCase()}</small>`, 2600, true); SFX.play('levelup'); flash(true); }, 300); }
}
function onTrackChange() {
  updateStatus(); updateMS(); saveResume();
  if (P.cur && !P.cur.duration) { Engine.audio.addEventListener('loadedmetadata', () => { if (P.cur && Engine.duration) { P.cur.duration = Engine.duration; DB.putTrack(P.cur); } }, { once: true }); }
  const v = topV(); v && v.track && v.track();
}
function saveResume() {
  if (!P.queue.length) return;
  localStorage.setItem('tunein.r', JSON.stringify({ q: P.queue, o: P.order, p: P.pos, t: Engine.time }));
}
async function restoreResume() {
  try {
    const r = JSON.parse(localStorage.getItem('tunein.r') || 'null'); if (!r || !r.q) return;
    const q = r.q.filter(id => byId.has(id)); if (q.length !== r.q.length || !q.length) return;
    P.queue = r.q; P.order = r.o; P.pos = clamp(r.p, 0, r.o.length - 1);
    await loadPos(false, r.t || 0);
  } catch (e) { console.warn(e); }
}

/* ---------- Sleep timer ---------- */
function setSleep(mins) {
  Sleep.eos = mins === 'eos'; Sleep.end = typeof mins === 'number' && mins > 0 ? Date.now() + mins * 60000 : 0;
  Sleep.label = !mins ? 'Off' : mins === 'eos' ? 'End of Song' : mins + ' min';
  Engine.setFade(1); updateStatus();
  toast(mins ? 'SLEEP: ' + Sleep.label.toUpperCase() : 'SLEEP TIMER OFF'); SFX.play(mins ? 'select' : 'toggle');
}
function sleepRemaining() { return Sleep.end ? Math.max(0, Sleep.end - Date.now()) / 1000 : 0; }
function sleepValue() { return Sleep.eos ? 'EOS' : Sleep.end ? fmt(sleepRemaining()) : 'Off'; }
function doSleep() {
  Engine.pause(); Sleep.end = 0; Sleep.eos = false; Sleep.label = 'Off';
  setTimeout(() => Engine.setFade(1), 400);
  updateStatus(); toast('SWEET DREAMS<br><small>Z z z . . .</small>', 3000, true); SFX.play('sleep');
}
function sleepTick() {
  if (!Sleep.end) return;
  const rem = Sleep.end - Date.now();
  if (rem <= 0) doSleep(); else if (rem < 15000) Engine.setFade(rem / 15000);
}

/* ---------- Media Session (lock screen / Control Center) ---------- */
let msArtKey = null, msArtData = [];
async function updateMS() {
  if (!('mediaSession' in navigator) || !P.cur) return;
  const t = P.cur;
  try {
    if (msArtKey !== t.artKey) {
      msArtKey = t.artKey; msArtData = [];
      const u = await artFor(t);
      if (u) { const img = await loadImg(u), c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(img, 0, 0, 256, 256); msArtData = [{ src: c.toDataURL('image/jpeg', 0.85), sizes: '256x256', type: 'image/jpeg' }]; }
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || '', album: t.album || '', artwork: msArtData });
    navigator.mediaSession.playbackState = Engine.paused ? 'paused' : 'playing';
  } catch (e) {}
}
function msPosition() {
  try { if (P.cur && Engine.duration && navigator.mediaSession && navigator.mediaSession.setPositionState) navigator.mediaSession.setPositionState({ duration: Engine.duration, position: Math.min(Engine.time, Engine.duration), playbackRate: 1 }); } catch (e) {}
}
if ('mediaSession' in navigator) {
  const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
  set('play', () => Engine.play()); set('pause', () => Engine.pause());
  set('nexttrack', () => next(true)); set('previoustrack', () => prev());
  set('seekto', d => Engine.seek(d.seekTime));
}

/* ---------- Themes / screen FX ---------- */
function applyTheme(key) {
  const t = THEMES[key] || THEMES.classic, r = document.documentElement.style;
  for (const [k, v] of Object.entries(t)) if (k !== 'name') r.setProperty('--' + k, v);
  Viz.setPalette({ bg: t.lcd, fg: t.fg, dim: t.dim, v1: t.v1, v2: t.v2, v3: t.v3 });
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t.body2;
}
function applyScreenFX() {
  document.body.dataset.scan = S.scan;
  document.body.classList.toggle('glow', !!S.glow);
}
let toastT;
function toast(msg, ms = 1500, big = false) {
  const el = $('#toast'); el.innerHTML = msg; el.className = 'show' + (big ? ' big' : '');
  clearTimeout(toastT); toastT = setTimeout(() => el.className = '', ms);
}
function flash(strong) { const f = $('#flash'); f.className = strong ? 'on strong' : 'on'; setTimeout(() => f.className = '', strong ? 220 : 90); }
function shake() { const s = $('#screen'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
const hapticEl = () => document.getElementById('haptic');
function haptic() { if (S.haptics) try { hapticEl().click(); } catch (e) {} }

/* Backlight: the screen dims after inactivity like the old days */
let lastTouch = Date.now();
function wake() { lastTouch = Date.now(); $('#screen').classList.remove('dim'); }
function backlightTick() {
  const secs = [0, 10, 30, 60][S.backlight];
  if (secs && Date.now() - lastTouch > secs * 1000 && !FullViz.isOpen) $('#screen').classList.add('dim');
}

/* ---------- Status bar ---------- */
function updateStatus() {
  $('#st-play').innerHTML = P.cur ? icon(Engine.paused ? 'pause' : 'play') : '';
  $('#st-sleep').innerHTML = (Sleep.end || Sleep.eos) ? icon('moon') : '';
  const v = topV(); if (v) $('#st-title').textContent = v.title;
}
function clockTick() { const d = new Date(); $('#st-clock').textContent = d.getHours() % 12 + (d.getHours() % 12 ? 0 : 12) + ':' + String(d.getMinutes()).padStart(2, '0'); }
