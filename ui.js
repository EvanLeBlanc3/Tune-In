/* ==========================================================
   TUNE IN — screens, click wheel, menus
   ========================================================== */
'use strict';
const stack = [];
const topV = () => stack[stack.length - 1];

function show(v, anim) {
  const box = $('#views'), el = v.render();
  el.classList.add('view'); if (anim) el.classList.add('in-' + anim);
  [...box.children].forEach(c => { if (anim) { c.classList.add('out-' + anim); setTimeout(() => c.remove(), 200); } else c.remove(); });
  box.append(el); v.el = el;
  $('#st-title').textContent = v.title;
  v.mounted && v.mounted();
}
function push(v) { stack.push(v); show(v, 'left'); }
function pop() {
  if (stack.length <= 1) { SFX.play('error'); shake(); return; }
  const v = stack.pop(); v.onPop && v.onPop();
  show(topV(), 'right'); SFX.play('back');
}
function redraw() { const v = topV(); if (!v) return; const sc = v.el && v.el.scrollTop; show(v); if (sc && v.el) v.el.scrollTop = sc; }
function pushNP() { if (topV() && topV().kind === 'np') { topV().track(); return; } push(NowPlaying()); }

/* ---------- Generic list ---------- */
function rowHTML(it) {
  const val = typeof it.value === 'function' ? it.value() : it.value;
  const chk = typeof it.checked === 'function' ? it.checked() : it.checked;
  const ic = typeof it.icon === 'function' ? it.icon() : it.icon;
  return (ic ? `<span class="ic">${icon(ic)}</span>` : '') +
    `<span class="lb"><span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>` +
    (val != null && val !== '' ? `<span class="rt">${esc(val)}</span>` : '') +
    (chk ? `<span class="cv">${icon('check')}</span>` : '') + (it.chev ? `<span class="cv">${icon('chev')}</span>` : '');
}
function List(title, itemsFn, o = {}) {
  const v = {
    title, sel: o.sel || 0, kind: 'list', items: [],
    render() {
      this.items = itemsFn();
      if (this.sel >= this.items.length) this.sel = Math.max(0, this.items.length - 1);
      const el = h('div', 'list' + (o.cls ? ' ' + o.cls : ''));
      if (o.header) el.append(o.header());
      if (!this.items.length) el.append(h('div', 'empty', o.empty || 'NOTHING HERE YET'));
      this.items.forEach((it, i) => {
        const r = h('div', 'row' + (i === this.sel ? ' sel' : '') + (it.sub ? ' two' : '') + (it.disabled ? ' dis' : ''), rowHTML(it));
        r.dataset.i = i; el.append(r);
      });
      let lp = null, sx = 0, sy = 0, held = false;
      el.addEventListener('pointerdown', e => {
        const r = e.target.closest('.row'); if (!r) return; held = false; sx = e.clientX; sy = e.clientY;
        clearTimeout(lp); lp = setTimeout(() => { const i = +r.dataset.i; if (this.items[i] && this.items[i].hold) { held = true; this.setSel(i, true); this.hold(); } }, 550);
      });
      el.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) clearTimeout(lp); });
      ['pointerup', 'pointercancel', 'scroll'].forEach(ev => el.addEventListener(ev, () => clearTimeout(lp), { passive: true }));
      el.addEventListener('click', e => {
        if (held) { held = false; return; }
        const r = e.target.closest('.row'); if (!r) return;
        this.setSel(+r.dataset.i, true); this.activate();
      });
      this.rows = el.getElementsByClassName('row');
      return el;
    },
    mounted() { this.ensure(); this.marquee(); o.mounted && o.mounted(this); },
    setSel(i, silent) {
      if (!this.items.length) return;
      i = clamp(i, 0, this.items.length - 1);
      if (i === this.sel) { if (!silent) { shake(); } return; }
      this.rows[this.sel] && this.rows[this.sel].classList.remove('sel');
      this.rows[i] && this.rows[i].classList.add('sel');
      this.sel = i; this.ensure(); this.marquee();
      if (!silent) { SFX.play('tick'); haptic(); }
      o.onMove && o.onMove(this.items[i], this);
    },
    wheel(d) { this.setSel(this.sel + d); },
    activate() {
      const it = this.items[this.sel];
      if (!it || it.disabled || !it.action) { SFX.play('error'); return; }
      if (it.sfx !== false) SFX.play(it.sfx || 'select');
      it.action(it, this);
      if (topV() === this && this.rows[this.sel]) this.refreshRows();
    },
    center() { this.activate(); },
    centerHold() { this.hold(); },
    hold() { const it = this.items[this.sel]; if (it && it.hold) { SFX.play('select'); haptic(); it.hold(it, this); } },
    refreshRows() { [...this.rows].forEach((r, i) => { if (this.items[i]) r.innerHTML = rowHTML(this.items[i]); }); this.marquee(); },
    ensure() {
      const r = this.rows && this.rows[this.sel], el = this.el; if (!r || !el) return;
      const t = r.offsetTop, b = t + r.offsetHeight;
      if (t < el.scrollTop) el.scrollTop = t - (this.sel === 0 ? 999 : 0);
      else if (b > el.scrollTop + el.clientHeight) el.scrollTop = b - el.clientHeight;
    },
    marquee() {
      this.el.querySelectorAll('.marq').forEach(x => x.classList.remove('marq'));
      const r = this.rows[this.sel], lb = r && r.querySelector('.lb');
      if (!lb) return;
      const inner = lb.firstElementChild, d = inner.scrollWidth - lb.clientWidth;
      if (d > 3) { lb.style.setProperty('--d', -(d + 10) + 'px'); lb.style.setProperty('--t', (2.5 + d / 25) + 's'); lb.classList.add('marq'); }
    }
  };
  if (o.extend) Object.assign(v, o.extend);
  return v;
}

/* ---------- Menus ---------- */
function MainMenu() {
  return List('Tune In', () => [
    ...(!LIB.length ? [{ label: 'Add Music', icon: 'plus', chev: true, action: () => push(ImportView()) }] : []),
    { label: 'Music', icon: 'note', chev: true, action: () => push(MusicMenu()) },
    { label: 'Shuffle Songs', icon: 'shuffle', action: shuffleAll, sfx: false },
    ...(P.cur ? [{ label: 'Now Playing', icon: () => Engine.paused ? 'pause' : 'play', chev: true, action: pushNP }] : []),
    { label: 'Visualizer', icon: 'wave', chev: true, action: () => push(VizMenu()) },
    { label: 'Equalizer', icon: 'eq', chev: true, action: () => push(EQMenu()) },
    { label: 'Sleep Timer', icon: 'moon', value: sleepValue, chev: true, action: () => push(SleepMenu()) },
    { label: 'Themes', icon: 'palette', chev: true, action: () => push(ThemeMenu()) },
    { label: 'Player Stats', icon: 'trophy', chev: true, action: () => push(Stats()) },
    ...(LIB.length ? [{ label: 'Add Music', icon: 'plus', chev: true, action: () => push(ImportView()) }] : []),
    { label: 'Settings', icon: 'gear', chev: true, action: () => push(SettingsMenu()) }
  ], { extend: { tick() { if (Sleep.end && (this._t = (this._t || 0) + 1) % 30 === 0) this.refreshRows(); } } });
}
function MusicMenu() {
  return List('Music', () => [
    { label: 'Songs', icon: 'note', value: () => LIB.length, chev: true, action: () => push(SongList('Songs', () => LIB)) },
    { label: 'Artists', icon: 'person', chev: true, action: () => push(ArtistList()) },
    { label: 'Albums', icon: 'disc', chev: true, action: () => push(AlbumList()) },
    { label: 'Favorites', icon: 'heart', value: () => LIB.filter(t => t.fav).length, chev: true, action: () => push(SongList('Favorites', () => LIB.filter(t => t.fav), { empty: 'HOLD ● ON A SONG<br>TO ♥ IT' })) },
    { label: 'Most Played', icon: 'star', chev: true, action: () => push(SongList('Most Played', () => LIB.filter(t => t.plays).sort((a, b) => b.plays - a.plays).slice(0, 50), { sub: t => `${t.plays}× · ${t.artist || ''}` })) },
    { label: 'Recently Added', icon: 'clock', chev: true, action: () => push(SongList('Recently Added', () => LIB.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 50))) },
    { label: 'Recently Played', icon: 'clock', chev: true, action: () => push(SongList('Recently Played', () => LIB.filter(t => t.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 50))) }
  ]);
}
function SongList(title, tracksFn, o = {}) {
  let tracks = [];
  return List(title, () => {
    tracks = tracksFn(); const ids = tracks.map(t => t.id);
    const items = tracks.map((t, i) => ({
      label: t.title, sub: o.sub ? o.sub(t) : (t.artist || 'Unknown Artist'),
      icon: () => P.cur && P.cur.id === t.id ? 'speaker' : (t.fav ? 'heart' : null),
      action: () => { if (playIds(ids, i)) { SFX.play('play'); pushNP(); } }, sfx: false,
      hold: () => push(SongActions(t))
    }));
    if (tracks.length > 1) items.unshift({ label: 'Shuffle All', icon: 'shuffle', action: () => { playIds(ids, 0, { shuffle: true, randomStart: true }); SFX.play('whoosh'); pushNP(); }, sfx: false });
    return items;
  }, { empty: o.empty || 'NO SONGS HERE', header: o.header });
}
function ArtistList() {
  return List('Artists', () => [...groupBy(artistOf)].sort((a, b) => a[0].localeCompare(b[0])).map(([name, ts]) => ({
    label: name, value: ts.length, chev: true, action: () => push(ArtistView(name))
  })), { empty: 'NO ARTISTS YET' });
}
function ArtistView(name) {
  return List(name, () => {
    const ts = LIB.filter(t => artistOf(t) === name);
    const albums = [...new Set(ts.map(albumOf))].sort();
    return [
      { label: 'All Songs', icon: 'note', value: ts.length, chev: true, action: () => push(SongList(name, () => LIB.filter(t => artistOf(t) === name).sort((a, b) => albumOf(a).localeCompare(albumOf(b)) || albumSort(a, b)))) },
      ...albums.map(al => ({ label: al, icon: 'disc', chev: true, action: () => push(AlbumView(al, name)) }))
    ];
  });
}
function AlbumList() {
  return List('Albums', () => {
    const m = groupBy(t => albumOf(t) + '\u0001' + artistOf(t));
    return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([k, ts]) => {
      const [al, ar] = k.split('\u0001');
      return { label: al, sub: ar, chev: true, action: () => push(AlbumView(al, ar)) };
    });
  }, { empty: 'NO ALBUMS YET' });
}
function AlbumView(album, artist) {
  const get = () => LIB.filter(t => albumOf(t) === album && artistOf(t) === artist).sort(albumSort);
  return SongList(album, get, {
    sub: t => (t.track ? t.track + '. ' : '') + (t.duration ? fmt(t.duration) : ''),
    header: () => {
      const hd = h('div', 'alb-head', `<div class="alb-art"><img alt=""></div><div><b>${esc(album)}</b><small>${esc(artist)}</small><small>${get().length} SONGS</small></div>`);
      const first = get().find(t => t.artKey);
      if (first) artFor(first).then(async u => { if (u) hd.querySelector('img').src = S.pixelArt ? await pixelated(u) : u; });
      return hd;
    }
  });
}
function SongActions(t) {
  return List('Song', () => [
    { label: t.title, sub: `${t.artist || 'Unknown'} · ${albumOf(t)}${t.duration ? ' · ' + fmt(t.duration) : ''}`, disabled: true },
    { label: 'Play Now', icon: 'play', action: () => { playIds([t.id]); pushNP(); }, sfx: 'play' },
    { label: 'Play Next', icon: 'next', action: () => { playNext(t); pop(); }, sfx: false },
    { label: 'Favorite', icon: () => t.fav ? 'heart' : 'heartO', value: () => t.fav ? 'YES' : 'NO', action: () => toggleFav(t), sfx: false },
    { label: 'Go to Album', icon: 'disc', chev: true, action: () => push(AlbumView(albumOf(t), artistOf(t))) },
    { label: 'Go to Artist', icon: 'person', chev: true, action: () => push(ArtistView(artistOf(t))) },
    { label: 'Played', icon: 'star', value: () => (t.plays || 0) + '×', disabled: true },
    { label: 'Delete from Tune In', icon: 'trash', chev: true, action: () => push(Confirm('Delete Song?', 'Delete "' + t.title + '"', async () => { await deleteTrack(t); pop(); pop(); toast('DELETED'); })) }
  ], { sel: 1 });
}
function Confirm(title, label, fn) {
  return List(title, () => [
    { label: 'Cancel', icon: 'x', action: () => pop(), sfx: false },
    { label, icon: 'trash', action: fn, sfx: 'error' }
  ]);
}
async function deleteTrack(t) {
  await DB.delTrack(t.id);
  LIB = LIB.filter(x => x.id !== t.id); indexLib();
  if (P.cur && P.cur.id === t.id) { Engine.pause(); P.cur = null; P.queue = []; P.order = []; P.pos = -1; localStorage.removeItem('tunein.r'); updateStatus(); return; }
  if (P.queue.includes(t.id)) {
    const curId = P.queue[P.order[P.pos]]; P.queue = P.queue.filter(x => x !== t.id);
    const ci = P.queue.indexOf(curId); P.order = [...P.queue.keys()];
    if (S.shuffle) { buildOrder(ci); } else P.pos = ci;
  }
}

/* ---------- Now Playing ---------- */
function NowPlaying() {
  return {
    title: 'Now Playing', kind: 'np', mode: 'vol',
    render() {
      const el = h('div', 'np', `
        <div class="np-top">
          <div class="np-art"><img alt=""><div class="np-noart">${icon('note')}</div></div>
          <div class="np-info">
            <div class="np-count"></div>
            <div class="np-title lb"><span></span></div>
            <div class="np-artist"></div>
            <div class="np-album"></div>
            <div class="np-btns">
              <button data-a="shuffle" aria-label="Shuffle">${icon('shuffle')}</button>
              <button data-a="repeat" aria-label="Repeat">${icon('repeat')}<i></i></button>
              <button data-a="fav" aria-label="Favorite"></button>
              <button data-a="sleep" aria-label="Sleep">${icon('moon')}</button>
            </div>
          </div>
        </div>
        <canvas class="np-mini"></canvas>
        <div class="np-prog"><div class="bar"><i></i><b></b></div><div class="times"><span class="t0">0:00</span><span class="mode"></span><span class="t1">-0:00</span></div></div>
        <div class="np-vol">${icon('speaker')}<div class="vbar">${'<i></i>'.repeat(16)}</div>${icon('loud')}</div>`);
      const q = s => el.querySelector(s);
      this.q = { img: q('.np-art img'), noart: q('.np-noart'), count: q('.np-count'), title: q('.np-title'), artist: q('.np-artist'), album: q('.np-album'), fill: q('.bar i'), knob: q('.bar b'), t0: q('.t0'), t1: q('.t1'), mode: q('.mode'), segs: el.querySelectorAll('.vbar i'), mini: q('.np-mini'), btns: el.querySelector('.np-btns') };
      this.q.btns.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
        if (a === 'shuffle') toggleShuffle(); else if (a === 'repeat') cycleRepeat(); else if (a === 'fav') toggleFav(P.cur); else if (a === 'sleep') { SFX.play('select'); push(SleepMenu()); return; }
        this.buttons();
      });
      q('.np-art').addEventListener('click', () => { SFX.play('whoosh'); FullViz.open(); });
      drag(q('.bar'), x => { if (Engine.duration) Engine.seek(x * Engine.duration); });
      drag(q('.vbar'), x => { setVol(x); this.vol(true); });
      return el;
    },
    mounted() { this.track(); this.modeLbl(); },
    track() {
      const t = P.cur, q = this.q; if (!q) return;
      if (!t) { q.title.firstElementChild.textContent = 'Nothing playing'; q.artist.textContent = 'Press ⏯ to shuffle'; q.album.textContent = ''; q.count.textContent = ''; q.img.style.display = 'none'; q.noart.style.display = ''; return; }
      q.count.textContent = `${P.pos + 1} of ${P.order.length}`;
      q.title.firstElementChild.textContent = t.title;
      q.artist.textContent = t.artist || 'Unknown Artist';
      q.album.textContent = t.album || '';
      q.img.style.display = 'none'; q.noart.style.display = '';
      const id = t.id;
      artFor(t).then(async u => {
        if (!u || !P.cur || P.cur.id !== id) return;
        q.img.src = S.pixelArt ? await pixelated(u) : u; q.img.style.display = ''; q.noart.style.display = 'none';
        q.img.classList.toggle('px', !!S.pixelArt);
      });
      this.buttons(); this.vol(true);
      const lb = q.title; lb.classList.remove('marq');
      requestAnimationFrame(() => { const d = lb.firstElementChild.scrollWidth - lb.clientWidth; if (d > 3) { lb.style.setProperty('--d', -(d + 10) + 'px'); lb.style.setProperty('--t', (3 + d / 25) + 's'); lb.classList.add('marq'); } });
      q.mini.style.display = S.miniViz ? '' : 'none';
    },
    buttons() {
      const b = this.q.btns.children;
      b[0].classList.toggle('on', S.shuffle);
      b[1].classList.toggle('on', S.repeat > 0); b[1].querySelector('i').textContent = S.repeat === 2 ? '1' : '';
      b[2].innerHTML = icon(P.cur && P.cur.fav ? 'heart' : 'heartO'); b[2].classList.toggle('on', !!(P.cur && P.cur.fav));
      b[3].classList.toggle('on', !!(Sleep.end || Sleep.eos));
    },
    vol(force) {
      const n = Math.round(S.vol * 16); if (!force && n === this._vn) return; this._vn = n;
      this.q.segs.forEach((s, i) => s.classList.toggle('on', i < n));
    },
    modeLbl() { this.q.mode.textContent = this.mode === 'vol' ? (Engine.routed ? '◎ VOLUME' : '◎ PHONE VOL') : '◎ SCRUB'; },
    tick() {
      const d = Engine.duration, t = Engine.time, q = this.q, p = d ? t / d : 0;
      q.fill.style.width = (p * 100) + '%'; q.knob.style.left = (p * 100) + '%';
      const s0 = fmt(t), s1 = '-' + fmt(d - t);
      if (q.t0.textContent !== s0) q.t0.textContent = s0;
      if (q.t1.textContent !== s1) q.t1.textContent = s1;
      if (S.miniViz) Viz.draw(q.mini, { width: 96, mode: 0 });
    },
    state() { this.buttons(); },
    wheel(d) {
      if (this.mode === 'vol') { setVol(S.vol + d * 0.03); this.vol(); SFX.play('tick'); }
      else { Engine.seek(Engine.time + d * 3); SFX.play('tick'); }
      haptic();
    },
    center() { this.mode = this.mode === 'vol' ? 'seek' : 'vol'; this.modeLbl(); SFX.play('toggle'); toast(this.mode === 'vol' ? 'WHEEL = VOLUME' : 'WHEEL = SCRUB', 900); },
    centerHold() { if (P.cur) { SFX.play('select'); push(SongActions(P.cur)); } }
  };
}
function drag(el, fn) {
  const go = e => { const r = el.getBoundingClientRect(); fn(clamp((e.clientX - r.left) / r.width, 0, 1)); };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); go(e); SFX.play('tick'); const mv = ev => go(ev), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); });
}

/* ---------- Visualizer ---------- */
function vizLabel() { return Viz.MODES[S.vizMode] + ' · ' + Viz.COLORS[S.vizColor]; }
function VizView() {
  return {
    title: 'Visualizer', kind: 'viz',
    render() {
      const el = h('div', 'vizview', `<canvas></canvas><div class="viz-label"></div><div class="viz-hint">WHEEL: STYLE · ●: COLOR · TAP: FULL</div>`);
      this.cv = el.querySelector('canvas'); this.lbl = el.querySelector('.viz-label');
      this.cv.addEventListener('click', () => { SFX.play('whoosh'); FullViz.open(); });
      return el;
    },
    mounted() { this.label(); },
    label() { this.lbl.textContent = vizLabel(); this.lbl.classList.remove('pop'); void this.lbl.offsetWidth; this.lbl.classList.add('pop'); },
    tick() { Viz.draw(this.cv); },
    wheel(d) { const n = Viz.MODES.length; S.vizMode = (S.vizMode + d + n) % n; save(); this.label(); SFX.play('tick'); haptic(); },
    center() { S.vizColor = (S.vizColor + 1) % Viz.COLORS.length; save(); this.label(); SFX.play('toggle'); },
    centerHold() { FullViz.open(); }
  };
}
const cyc = (key, n) => () => { S[key] = (S[key] + 1) % n; save(); };
const onoff = key => () => S[key] ? 'ON' : 'OFF';
function VizMenu() {
  return List('Visualizer', () => [
    { label: 'Open Visualizer', icon: 'wave', chev: true, action: () => push(VizView()) },
    { label: 'Full Screen Mode', icon: 'bigplay', action: () => FullViz.open(), sfx: 'whoosh' },
    { label: 'Style', value: () => Viz.MODES[S.vizMode], chev: true, action: () => push(VizModes()) },
    { label: 'Colors', value: () => Viz.COLORS[S.vizColor], action: cyc('vizColor', Viz.COLORS.length), sfx: 'toggle' },
    { label: 'Pixel Size', value: () => S.vizRes, action: () => { const k = Object.keys(Viz.RES); S.vizRes = k[(k.indexOf(S.vizRes) + 1) % k.length]; save(); }, sfx: 'toggle' },
    { label: 'Trails', value: onoff('vizTrails'), action: () => { S.vizTrails = !S.vizTrails; save(); }, sfx: 'toggle' },
    { label: 'Beat Flash', value: onoff('vizFlash'), action: () => { S.vizFlash = !S.vizFlash; save(); }, sfx: 'toggle' },
    { label: 'Sensitivity', value: () => '■'.repeat(S.vizSens) + '□'.repeat(5 - S.vizSens), action: () => { S.vizSens = S.vizSens % 5 + 1; save(); }, sfx: 'toggle' },
    { label: 'Auto-Cycle Styles', value: () => ['OFF', '15s', '30s', '60s'][S.vizAuto], action: cyc('vizAuto', 4), sfx: 'toggle' },
    { label: 'Mini Viz on Now Playing', value: onoff('miniViz'), action: () => { S.miniViz = !S.miniViz; save(); }, sfx: 'toggle' }
  ]);
}
function VizModes() {
  const prev = S.vizMode;
  let chosen = false;
  const v = List('Viz Style', () => Viz.MODES.map((m, i) => ({ label: m, checked: () => S.vizMode === i, action: () => { S.vizMode = i; chosen = true; save(); pop(); } })), {
    sel: S.vizMode, cls: 'with-preview',
    header: () => { const c = h('canvas', 'viz-preview'); v._cv = c; return c; },
    onMove: it => { S.vizMode = Viz.MODES.indexOf(it.label); },
    extend: { tick() { if (this._cv) Viz.draw(this._cv); }, onPop() { if (!chosen) S.vizMode = prev; } }
  });
  return v;
}

/* Full-screen visualizer overlay: hides the whole player */
const FullViz = (() => {
  let el, cv, hud, hideT, sx = 0, sy = 0, open = false;
  function init() {
    el = $('#fullviz'); cv = el.querySelector('canvas'); hud = el.querySelector('.fv-hud');
    el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    el.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const b = e.target.closest('button');
      if (b) { act(b.dataset.a); showHud(); return; }
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { mode(dx < 0 ? 1 : -1); showHud(); return; }
      if (dy > 80) { close(); return; }
      hud.classList.contains('show') ? hud.classList.remove('show') : showHud();
    });
  }
  function act(a) {
    if (a === 'close') close(); else if (a === 'next') mode(1); else if (a === 'prev') mode(-1);
    else if (a === 'color') { S.vizColor = (S.vizColor + 1) % Viz.COLORS.length; save(); SFX.play('toggle'); }
    else if (a === 'play') togglePlay(); else if (a === 'skip') { next(true); SFX.play('next'); }
    label();
  }
  function mode(d) { const n = Viz.MODES.length; S.vizMode = (S.vizMode + d + n) % n; save(); SFX.play('tick'); label(); }
  function label() {
    el.querySelector('.fv-mode').textContent = vizLabel();
    el.querySelector('.fv-track').textContent = P.cur ? `${P.cur.title} — ${P.cur.artist || ''}` : 'NOTHING PLAYING';
    el.querySelector('[data-a=play]').innerHTML = icon(Engine.paused ? 'play' : 'pause');
  }
  function showHud() { label(); hud.classList.add('show'); clearTimeout(hideT); hideT = setTimeout(() => hud.classList.remove('show'), 3000); }
  function openIt() { open = true; el.classList.add('open'); wake(); showHud(); }
  function close() { open = false; el.classList.remove('open'); SFX.play('back'); }
  return { init, open: openIt, close, tick() { if (open) Viz.draw(cv, { width: Math.round(Viz.RES[S.vizRes] * 1.25) }); }, get isOpen() { return open; }, label };
})();

/* ---------- Equalizer ---------- */
function setBand(i, v) { S.eq[i] = clamp(v, -12, 12); S.eqPreset = 'Custom'; Engine.setBand(i, S.eq[i]); save(); }
function EQMenu() {
  return List('Equalizer', () => [
    ...(S.bgPlay ? [{ label: '⚠ EQ is off in Background Play', sub: 'Settings → Playback Mode → Full FX', disabled: true }] : []),
    { label: 'Adjust Bands', icon: 'eq', chev: true, action: () => push(EQView()) },
    { label: 'Preset', value: () => S.eqPreset, chev: true, action: () => push(PresetList()) },
    { label: '8-Bit Crunch', icon: 'joy', value: () => ['OFF', 'LIGHT', 'HEAVY'][S.crunch], action: () => { S.crunch = (S.crunch + 1) % 3; Engine.setCrunch(S.crunch); save(); toast(S.crunch ? 'CRUNCHY!' : 'CRUNCH OFF'); }, sfx: 'toggle' },
    { label: 'Reset to Flat', icon: 'x', action: () => { S.eq = PRESETS.Flat.slice(); S.eqPreset = 'Flat'; Engine.setEQ(S.eq); save(); toast('EQ FLAT'); }, sfx: 'toggle' }
  ]);
}
function PresetList() {
  const prev = { eq: S.eq.slice(), name: S.eqPreset }; let chosen = false;
  const names = Object.keys(PRESETS);
  return List('Presets', () => names.map(n => ({ label: n, checked: () => S.eqPreset === n, action: () => { chosen = true; S.eq = PRESETS[n].slice(); S.eqPreset = n; Engine.setEQ(S.eq); save(); toast(n.toUpperCase()); pop(); } })), {
    sel: Math.max(0, names.indexOf(S.eqPreset)),
    onMove: it => Engine.setEQ(PRESETS[it.label]),
    extend: { onPop() { if (!chosen) { S.eq = prev.eq; S.eqPreset = prev.name; Engine.setEQ(S.eq); } } }
  });
}
function EQView() {
  return {
    title: 'Equalizer', kind: 'eq', band: 0,
    render() {
      const el = h('div', 'eqv', `<div class="eq-top"><span class="eq-preset"></span><span class="eq-db"></span></div>
        <div class="eq-bands">${Engine.BANDS.map((f, i) => `<div class="eqb" data-i="${i}"><div class="eq-track">${'<i></i>'.repeat(12)}<b></b></div><label>${f >= 1000 ? f / 1000 + 'K' : f}</label></div>`).join('')}</div>
        <div class="eq-hint">WHEEL: ± · ●: NEXT BAND · DRAG BARS</div>`);
      el.querySelectorAll('.eq-track').forEach((tr, i) => {
        const go = e => { const r = tr.getBoundingClientRect(); const v = Math.round((0.5 - (e.clientY - r.top) / r.height) * 24); this.band = i; setBand(i, v); this.draw(); };
        tr.addEventListener('pointerdown', e => { tr.setPointerCapture(e.pointerId); go(e); SFX.play('tick'); const mv = ev => go(ev), up = () => { tr.removeEventListener('pointermove', mv); tr.removeEventListener('pointerup', up); }; tr.addEventListener('pointermove', mv); tr.addEventListener('pointerup', up); });
      });
      return el;
    },
    mounted() { this.draw(); },
    draw() {
      const el = this.el;
      el.querySelector('.eq-preset').textContent = S.eqPreset.toUpperCase();
      const f = Engine.BANDS[this.band];
      el.querySelector('.eq-db').textContent = `${f >= 1000 ? f / 1000 + 'kHz' : f + 'Hz'} ${S.eq[this.band] > 0 ? '+' : ''}${S.eq[this.band]}dB`;
      el.querySelectorAll('.eqb').forEach((b, i) => {
        b.classList.toggle('sel', i === this.band);
        const g = S.eq[i], segs = b.querySelectorAll('i'), lit = Math.round(Math.abs(g) / 2);
        segs.forEach((s, k) => { const fromMid = k < 6 ? 6 - k : k - 5; const up = k < 6; s.classList.toggle('on', fromMid <= lit && (g > 0 ? up : g < 0 ? !up : false)); });
        b.querySelector('b').style.top = (50 - g / 24 * 100) + '%';
      });
    },
    wheel(d) { setBand(this.band, S.eq[this.band] + d); this.draw(); SFX.play('tick'); haptic(); },
    center() { this.band = (this.band + 1) % 10; this.draw(); SFX.play('toggle'); }
  };
}

/* ---------- Sleep, Themes, Settings, Stats ---------- */
function SleepMenu() {
  const opts = [0, 'eos', 5, 10, 15, 20, 30, 45, 60, 90, 120];
  const lab = m => !m ? 'Off' : m === 'eos' ? 'End of Song' : m + ' Minutes';
  return List('Sleep Timer', () => [
    { label: 'Time Left', icon: 'moon', value: sleepValue, disabled: true },
    ...opts.map(m => ({ label: lab(m), checked: () => (m === 0 && !Sleep.end && !Sleep.eos) || (m === 'eos' && Sleep.eos) || (typeof m === 'number' && m && Sleep.label === m + ' min' && Sleep.end), action: () => { setSleep(m); }, sfx: false }))
  ], { sel: 1, extend: { tick() { this._t = (this._t || 0) + 1; if (this._t % 30 === 0 && this.rows[0]) this.rows[0].innerHTML = rowHTML(this.items[0]); } } });
}
function ThemeMenu() {
  const prev = S.theme; let chosen = false; const keys = Object.keys(THEMES);
  return List('Themes', () => keys.map(k => ({ label: THEMES[k].name, checked: () => S.theme === k, action: () => { chosen = true; S.theme = k; save(); applyTheme(k); SFX.play('coin'); toast('THEME EQUIPPED!'); pop(); }, sfx: false })), {
    sel: Math.max(0, keys.indexOf(S.theme)),
    onMove: it => applyTheme(keys.find(k => THEMES[k].name === it.label)),
    extend: { onPop() { if (!chosen) applyTheme(prev); } }
  });
}
function SettingsMenu() {
  return List('Settings', () => [
    { label: 'Sound FX', icon: 'speaker', value: onoff('sfx'), action: () => { S.sfx = !S.sfx; save(); SFX.play('toggle'); }, sfx: false },
    { label: 'FX Volume', value: () => ['MUTE', 'LOW', 'MED', 'HIGH'][S.fxVol], action: () => { S.fxVol = S.fxVol % 3 + 1; SFX.setVol(); save(); }, sfx: 'coin' },
    { label: 'Haptics (iOS 18+)', value: onoff('haptics'), action: () => { S.haptics = !S.haptics; save(); haptic(); }, sfx: 'toggle' },
    { label: 'Scanlines', value: () => ['OFF', 'LIGHT', 'HEAVY'][S.scan], action: () => { S.scan = (S.scan + 1) % 3; save(); applyScreenFX(); }, sfx: 'toggle' },
    { label: 'LCD Glow', value: onoff('glow'), action: () => { S.glow = !S.glow; save(); applyScreenFX(); }, sfx: 'toggle' },
    { label: 'Backlight Timer', value: () => ['ALWAYS', '10s', '30s', '60s'][S.backlight], action: cyc('backlight', 4), sfx: 'toggle' },
    { label: 'Wheel Speed', value: () => ['SLOW', 'NORMAL', 'FAST'][S.wheelSpeed], action: cyc('wheelSpeed', 3), sfx: 'toggle' },
    { label: 'Pixelated Album Art', value: onoff('pixelArt'), action: () => { S.pixelArt = !S.pixelArt; save(); }, sfx: 'toggle' },
    { label: 'Playback Mode', sub: S.bgPlay ? 'Lock-screen friendly · EQ & live viz off' : 'EQ + live visualizer + volume', value: () => S.bgPlay ? 'BACKGROUND' : 'FULL FX', action: (it, v) => { S.bgPlay = !S.bgPlay; save(); Engine.setup(!S.bgPlay); Engine.setEQ(S.eq); Engine.setCrunch(S.crunch); Engine.setVolume(S.vol); toast(S.bgPlay ? 'BACKGROUND PLAY ON' : 'FULL FX ON'); setTimeout(() => redraw(), 50); }, sfx: 'toggle' },
    { label: 'Storage Used', icon: 'cart', value: () => storageTxt, disabled: true },
    { label: 'Reset Stats & XP', icon: 'trophy', chev: true, action: () => push(Confirm('Reset Stats?', 'Reset XP & play counts', () => { S.xp = 0; S.plays = 0; S.secs = 0; save(); LIB.forEach(t => { if (t.plays || t.lastPlayed) { t.plays = 0; t.lastPlayed = 0; DB.putTrack(t); } }); pop(); toast('STATS RESET'); })) },
    { label: 'Delete All Music', icon: 'trash', chev: true, action: () => push(Confirm('Delete All?', 'Delete ALL ' + LIB.length + ' songs', async () => { Engine.pause(); await DB.clear(); LIB = []; indexLib(); P.cur = null; P.queue = []; localStorage.removeItem('tunein.r'); updateStatus(); stack.length = 0; push(MainMenu()); toast('LIBRARY WIPED'); })) },
    { label: 'About Tune In', icon: 'joy', value: 'v' + VERSION, disabled: true }
  ], { mounted: () => refreshStorage() });
}
let storageTxt = '…';
async function refreshStorage() {
  try { const e = await navigator.storage.estimate(); storageTxt = (e.usage / 1048576).toFixed(0) + ' MB'; const v = topV(); if (v && v.title === 'Settings') v.refreshRows(); } catch (e) { storageTxt = '?'; }
}
function Stats() {
  return {
    title: 'Player Stats', kind: 'stats',
    render() {
      const L = level(S.xp), a = xpFor(L), b = xpFor(L + 1), pct = (S.xp - a) / (b - a) * 100;
      const hrs = Math.floor(S.secs / 3600), mins = Math.floor(S.secs % 3600 / 60);
      const topArtist = [...groupBy(artistOf)].map(([k, ts]) => [k, ts.reduce((s, t) => s + (t.plays || 0), 0)]).sort((x, y) => y[1] - x[1])[0];
      const topSong = LIB.slice().sort((x, y) => (y.plays || 0) - (x.plays || 0))[0];
      const el = h('div', 'stats', `
        <div class="lv"><div class="lv-badge">${icon('trophy')}<b>LV ${L}</b></div><div class="lv-rank">${esc(rankOf(L).toUpperCase())}</div></div>
        <div class="xpbar"><i style="width:${pct}%"></i></div>
        <div class="xptxt">${S.xp - a} / ${b - a} XP TO LV ${L + 1}</div>
        <div class="srow"><span>Songs Played</span><b>${S.plays}</b></div>
        <div class="srow"><span>Time Listened</span><b>${hrs}h ${mins}m</b></div>
        <div class="srow"><span>Library</span><b>${LIB.length} songs</b></div>
        <div class="srow"><span>Favorites</span><b>${LIB.filter(t => t.fav).length}</b></div>
        <div class="srow"><span>Top Artist</span><b>${esc(topArtist && topArtist[1] ? topArtist[0] : '—')}</b></div>
        <div class="srow"><span>Top Song</span><b>${esc(topSong && topSong.plays ? topSong.title : '—')}</b></div>
        <div class="xptip">+10 XP per song played · +5 XP per song added</div>`);
      return el;
    },
    wheel(d) { this.el.scrollTop += d * 24; }
  };
}

/* ---------- Import ---------- */
let importing = null;
function ImportView() {
  return {
    title: 'Add Music', kind: 'import',
    render() {
      const el = h('div', 'imp', `
        <button class="pxbtn" data-a="pick">${icon('plus')} CHOOSE SONGS</button>
        <button class="pxbtn alt" data-a="demo">${icon('cart')} INSERT DEMO CARTRIDGE</button>
        <div class="imp-prog"><i></i></div>
        <div class="imp-msg"></div>`);
      el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; b.dataset.a === 'pick' ? pickFiles() : loadDemo(); });
      return el;
    },
    mounted() { this.status(); },
    status() {
      const m = this.el.querySelector('.imp-msg'), bar = this.el.querySelector('.imp-prog');
      if (importing) { bar.classList.add('on'); bar.firstElementChild.style.width = (importing.done / importing.total * 100) + '%'; m.innerHTML = `LOADING ${importing.done}/${importing.total}<br><small>${esc(importing.name || '')}</small>`; }
      else { bar.classList.remove('on'); m.innerHTML = `Pick MP3 · M4A · AAC · WAV · FLAC · AIFF from the <b>Files</b> app. Songs are saved inside Tune In for offline play.<br><br><small>● = CHOOSE SONGS</small>`; }
    },
    center() { pickFiles(); }
  };
}
function pickFiles() { if (importing) { toast('HOLD ON, LOADING…'); return; } const f = $('#file'); f.value = ''; f.click(); }
const AUDIO_RX = /\.(mp3|m4a|aac|wav|wave|flac|aif|aiff|caf|mp4|m4b|ogg|oga|opus|alac)$/i;
const guessMime = n => { const e = (n.split('.').pop() || '').toLowerCase(); return { mp3: 'audio/mpeg', m4a: 'audio/mp4', m4b: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', wave: 'audio/wav', flac: 'audio/flac', aif: 'audio/aiff', aiff: 'audio/aiff', caf: 'audio/x-caf', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg' }[e] || 'audio/mpeg'; };
function probeDuration(blob) {
  return new Promise(res => {
    const a = new Audio(), u = URL.createObjectURL(blob); let done = false;
    const fin = d => { if (done) return; done = true; URL.revokeObjectURL(u); a.removeAttribute('src'); res(isFinite(d) ? d : 0); };
    a.preload = 'metadata'; a.onloadedmetadata = () => fin(a.duration); a.onerror = () => fin(0); setTimeout(() => fin(0), 4000); a.src = u;
  });
}
async function addTrack(blob, meta, artBlob) {
  const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const artKey = norm(meta.albumArtist || meta.artist) + '|' + norm(meta.album || meta.title);
  if (artBlob && !(await DB.hasArt(artKey))) await DB.putArt(artKey, await shrinkArt(artBlob));
  const hasArt = artBlob ? true : await DB.hasArt(artKey);
  const t = { id, title: meta.title, artist: meta.artist || '', album: meta.album || '', albumArtist: meta.albumArtist || '', track: meta.track || 0, duration: meta.duration || 0, artKey: hasArt ? artKey : null, addedAt: Date.now(), plays: 0, fav: false, size: blob.size };
  await DB.putBlob(id, blob); await DB.putTrack(t);
  LIB.push(t); return t;
}
async function importFiles(list) {
  const files = [...list].filter(f => (f.type && f.type.startsWith('audio')) || AUDIO_RX.test(f.name));
  if (!files.length) { toast('NO AUDIO FILES'); SFX.play('error'); return; }
  importing = { total: files.length, done: 0, name: '' };
  const upd = () => { const v = topV(); v && v.kind === 'import' && v.status(); };
  upd(); let added = 0, skipped = 0;
  for (const f of files) {
    importing.name = f.name; upd();
    try {
      const tags = await Tags.read(f);
      if (LIB.some(t => t.size === f.size && norm(t.title) === norm(tags.title))) { skipped++; }
      else {
        const blob = new Blob([await f.arrayBuffer()], { type: f.type || guessMime(f.name) });
        tags.duration = await probeDuration(blob);
        await addTrack(blob, tags, tags.art); added++; SFX.play('coin');
      }
    } catch (e) { console.warn('import fail', f.name, e); }
    importing.done++; upd();
  }
  importing = null; indexLib(); upd();
  if (added) { toast(`+${added} SONG${added > 1 ? 'S' : ''}!${skipped ? `<br><small>${skipped} already here</small>` : ''}`, 2200, true); addXP(added * 5); }
  else toast(skipped ? 'ALREADY IN LIBRARY' : 'NOTHING ADDED');
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
async function loadDemo() {
  if (importing) return;
  if (LIB.some(t => t.album === 'Demo Cartridge')) { toast('CARTRIDGE ALREADY IN!'); SFX.play('error'); return; }
  importing = { total: Demo.SONGS.length, done: 0, name: 'Blowing on the cartridge…' };
  const upd = () => { const v = topV(); v && v.kind === 'import' && v.status(); }; upd();
  for (const s of Demo.SONGS) {
    importing.name = s.title; upd();
    try {
      const blob = await Demo.render(s), art = await Demo.art(s.art);
      await addTrack(blob, { title: s.title, artist: 'The Tune In Band', album: 'Demo Cartridge', albumArtist: 'The Tune In Band', track: Demo.SONGS.indexOf(s) + 1, duration: blob.size / 88200 }, art);
      SFX.play('coin');
    } catch (e) { console.warn(e); toast('DEMO FAILED'); }
    importing.done++; upd();
  }
  importing = null; indexLib(); upd();
  toast('DEMO LOADED!<br><small>Music → Albums</small>', 2200, true); addXP(15);
}

/* ---------- Click wheel ---------- */
function pixelCircle(R) {
  const rows = []; for (let y = 0; y < 2 * R; y++) { const yc = y + 0.5 - R; rows.push(Math.round(Math.sqrt(Math.max(0, R * R - yc * yc)))); }
  const pts = [];
  for (let y = 0; y < 2 * R; y++) { const x = R + rows[y]; pts.push([x, y], [x, y + 1]); }
  for (let y = 2 * R - 1; y >= 0; y--) { const x = R - rows[y]; pts.push([x, y + 1], [x, y]); }
  return 'polygon(' + pts.map(([x, y]) => `${(x / (2 * R) * 100).toFixed(2)}% ${(y / (2 * R) * 100).toFixed(2)}%`).join(',') + ')';
}
function initWheel() {
  const wheel = $('#wheel'), center = $('#center');
  const pc = pixelCircle(22); $('#wheel-shell').style.clipPath = pc; wheel.style.clipPath = pc; center.style.clipPath = pixelCircle(10);
  $('#wheel-shell').style.webkitClipPath = pc; wheel.style.webkitClipPath = pc; center.style.webkitClipPath = pixelCircle(10);
  const ang = e => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  const zone = a => a > -135 && a <= -45 ? 'menu' : a > -45 && a <= 45 ? 'next' : a > 45 && a <= 135 ? 'play' : 'prev';
  let wp = null;
  wheel.addEventListener('pointerdown', e => {
    if (e.target.closest('#center')) return;
    e.preventDefault(); wheel.setPointerCapture(e.pointerId); wake(); Engine.resume();
    const a = ang(e); wp = { last: a, acc: 0, moved: 0, zone: zone(a), holding: false };
    wheel.dataset.press = wp.zone;
    if (wp.zone === 'next' || wp.zone === 'prev') {
      const z = wp.zone, me = wp;
      me.hold = setTimeout(() => { if (wp !== me) return; me.holding = true; me.iv = setInterval(() => { Engine.seek(Engine.time + (z === 'next' ? 5 : -5)); SFX.play('tick'); }, 160); }, 480);
    }
  });
  wheel.addEventListener('pointermove', e => {
    if (!wp) return;
    const a = ang(e); let d = a - wp.last; if (d > 180) d -= 360; if (d < -180) d += 360;
    wp.last = a; wp.acc += d; wp.moved += Math.abs(d);
    if (wp.moved > 14) { clearTimeout(wp.hold); delete wheel.dataset.press; }
    const step = [26, 17, 11][S.wheelSpeed];
    while (wp.acc >= step) { wp.acc -= step; wheelTurn(1); }
    while (wp.acc <= -step) { wp.acc += step; wheelTurn(-1); }
  });
  const end = () => {
    if (!wp) return; clearTimeout(wp.hold); clearInterval(wp.iv); delete wheel.dataset.press;
    if (!wp.holding && wp.moved < 14) wheelButton(wp.zone);
    wp = null;
  };
  wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', () => { if (wp) { clearTimeout(wp.hold); clearInterval(wp.iv); wp = null; delete wheel.dataset.press; } });

  let ct = null, cheld = false;
  center.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault(); center.setPointerCapture(e.pointerId); wake(); Engine.resume(); center.classList.add('down'); cheld = false;
    ct = setTimeout(() => { cheld = true; const v = topV(); v && v.centerHold && v.centerHold(); }, 600);
  });
  center.addEventListener('pointerup', e => {
    e.stopPropagation(); center.classList.remove('down'); clearTimeout(ct);
    if (!cheld) { haptic(); const v = topV(); v && v.center && v.center(); }
  });
  center.addEventListener('pointercancel', () => { center.classList.remove('down'); clearTimeout(ct); });
}
function wheelTurn(d) { const v = topV(); v && v.wheel && v.wheel(d); }
function wheelButton(z) {
  haptic();
  const v = topV();
  if (z === 'menu') { if (v && v.menu) v.menu(); else pop(); }
  else if (z === 'play') togglePlay();
  else if (z === 'next') { if (P.cur) { next(true); SFX.play('next'); } else SFX.play('error'); }
  else if (z === 'prev') { if (P.cur) { prev(); SFX.play('prev'); } else SFX.play('error'); }
}

/* ---------- Boot + main loop ---------- */
let lastFrame = performance.now(), autoT = 0, wasHidden = false;
function loop(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  Viz.update(dt);
  const v = topV(); v && v.tick && v.tick(dt);
  FullViz.tick();
  const vizOn = FullViz.isOpen || (v && (v.kind === 'viz'));
  if (vizOn && S.vizFlash && Viz.beat) flash();
  if (vizOn && S.vizAuto && !Engine.paused) { autoT += dt; if (autoT > [0, 15, 30, 60][S.vizAuto]) { autoT = 0; S.vizMode = (S.vizMode + 1) % Viz.MODES.length; save(); v && v.label && v.label(); FullViz.isOpen && FullViz.label(); } }
  requestAnimationFrame(loop);
}
let secN = 0;
function everySecond() {
  sleepTick(); backlightTick();
  if (++secN % 15 === 0) clockTick();
  if (!Engine.paused) { if (secN % 5 === 0) { saveResume(); save(); } msPosition(); }
}

async function boot() {
  applyTheme(S.theme); applyScreenFX(); clockTick();
  $('#file').addEventListener('change', e => { if (e.target.files && e.target.files.length) importFiles(e.target.files); });
  document.addEventListener('pointerdown', wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveResume(); else Engine.resume(); });
  window.addEventListener('pagehide', () => { saveResume(); localStorage.setItem('tunein.s', JSON.stringify(S)); });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  initWheel(); FullViz.init();
  try { await DB.open(); LIB = await DB.allTracks(); indexLib(); } catch (e) { console.warn('DB', e); toast('STORAGE ERROR'); }
  push(MainMenu());
  const b = $('#boot'); b.classList.add('ready');
  b.querySelector('.boot-sub').textContent = LIB.length ? `${LIB.length} SONGS LOADED · LV ${level(S.xp)}` : 'NEW GAME';
  b.addEventListener('click', start, { once: true });
  setInterval(everySecond, 1000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
function start() {
  Engine.setup(!S.bgPlay);
  const ctx = Engine.ctx; if (ctx.state !== 'running') ctx.resume();
  SFX.init(ctx);
  Engine.setEQ(S.eq); Engine.setCrunch(S.crunch); Engine.setVolume(S.vol);
  // iOS: play a silent blip to fully unlock audio output
  try { const o = ctx.createBufferSource(); o.buffer = ctx.createBuffer(1, 1, 22050); o.connect(ctx.destination); o.start(0); } catch (e) {}
  setTimeout(() => SFX.play('boot'), 30);
  $('#boot').classList.add('gone'); setTimeout(() => $('#boot').remove(), 700);
  restoreResume();
  requestAnimationFrame(loop);
}
boot();
