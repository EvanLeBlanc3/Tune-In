/* Tune In — tiny tag reader: ID3 (mp3), MP4/M4A (iTunes AAC/ALAC), FLAC. Pulls title/artist/album/art. */
const Tags = (() => {
  const dec = {};
  const td = enc => dec[enc] || (dec[enc] = (() => { try { return new TextDecoder(enc); } catch (e) { return new TextDecoder('utf-8'); } })());
  const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const syncsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
  const bytes = async (f, s, n) => new Uint8Array(await f.slice(s, s + n).arrayBuffer());
  const str = (b, o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]); return s; };

  function text(b, enc) {
    let s;
    if (enc === 0) s = td('iso-8859-1').decode(b);
    else if (enc === 1) {
      if (b[0] === 0xFE && b[1] === 0xFF) s = td('utf-16be').decode(b.subarray(2));
      else if (b[0] === 0xFF && b[1] === 0xFE) s = td('utf-16le').decode(b.subarray(2));
      else s = td('utf-16le').decode(b);
    } else if (enc === 2) s = td('utf-16be').decode(b);
    else s = td('utf-8').decode(b);
    return s.split('\0')[0].trim();
  }
  function term(b, start, enc) {
    if (enc === 1 || enc === 2) { for (let i = start; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i; return b.length; }
    for (let i = start; i < b.length; i++) if (b[i] === 0) return i;
    return b.length;
  }
  function unsync(b) {
    const out = new Uint8Array(b.length); let j = 0;
    for (let i = 0; i < b.length; i++) { out[j++] = b[i]; if (b[i] === 0xFF && b[i + 1] === 0) i++; }
    return out.subarray(0, j);
  }
  const ID3MAP = { TIT2: 'title', TT2: 'title', TPE1: 'artist', TP1: 'artist', TALB: 'album', TAL: 'album', TPE2: 'albumArtist', TP2: 'albumArtist', TRCK: 'track', TRK: 'track' };

  async function id3(f) {
    const h = await bytes(f, 0, 10);
    if (!(h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33)) return null;
    const ver = h[3], flags = h[5], size = syncsafe(h, 6);
    let b = await bytes(f, 10, size);
    if ((flags & 0x80) && ver < 4) b = unsync(b);
    let o = 0; const out = {};
    if (flags & 0x40) o = ver === 3 ? u32(b, 0) + 4 : (ver === 4 ? syncsafe(b, 0) : 0);
    const v22 = ver === 2, hl = v22 ? 6 : 10;
    while (o + hl < b.length) {
      const id = v22 ? str(b, o, 3) : str(b, o, 4);
      const fs = v22 ? (b[o + 3] << 16) | (b[o + 4] << 8) | b[o + 5] : (ver === 4 ? syncsafe(b, o + 4) : u32(b, o + 4));
      if (!/^[A-Z0-9]{3,4}$/.test(id) || fs <= 0 || o + hl + fs > b.length) break;
      let d = b.subarray(o + hl, o + hl + fs);
      if (ver === 4 && (b[o + 9] & 0x02)) d = unsync(d);
      o += hl + fs;
      if (ID3MAP[id]) { if (!out[ID3MAP[id]]) out[ID3MAP[id]] = text(d.subarray(1), d[0]); }
      else if ((id === 'APIC' || id === 'PIC') && !out.art) {
        const enc = d[0]; let i, mime;
        if (id === 'PIC') { mime = str(d, 1, 3).toLowerCase() === 'png' ? 'image/png' : 'image/jpeg'; i = 4; }
        else { const e = term(d, 1, 0); mime = td('iso-8859-1').decode(d.subarray(1, e)) || 'image/jpeg'; i = e + 1; }
        if (!mime.includes('/')) mime = /png/i.test(mime) ? 'image/png' : 'image/jpeg';
        i++; // picture type
        const de = term(d, i, enc); i = de + ((enc === 1 || enc === 2) ? 2 : 1);
        if (i < d.length) out.art = new Blob([d.slice(i)], { type: mime });
      }
    }
    return out;
  }

  async function mp4(f) {
    const h = await bytes(f, 4, 4);
    if (str(h, 0, 4) !== 'ftyp') return null;
    let pos = 0, moov = null; const size = f.size;
    for (let guard = 0; pos + 8 <= size && guard < 200; guard++) {
      const a = await bytes(f, pos, 16);
      let len = u32(a, 0); const type = str(a, 4, 4);
      if (len === 1) len = u32(a, 8) * 4294967296 + u32(a, 12); else if (len === 0) len = size - pos;
      if (len < 8) break;
      if (type === 'moov') { moov = await bytes(f, pos, len); break; }
      pos += len;
    }
    const out = {};
    if (!moov) return out;
    const M = { '\u00a9nam': 'title', '\u00a9ART': 'artist', '\u00a9alb': 'album', 'aART': 'albumArtist' };
    (function walk(b, s, e, inIlst) {
      let o = s;
      while (o + 8 <= e) {
        let len = u32(b, o); const type = str(b, o + 4, 4);
        if (len < 8 || o + len > e) len = e - o;
        if (len < 8) break;
        const cs = o + 8, ce = o + len;
        if (inIlst) {
          if (cs + 16 <= ce && str(b, cs + 4, 4) === 'data') {
            const dl = Math.min(u32(b, cs), ce - cs), kind = u32(b, cs + 8) & 0xffffff, pl = b.subarray(cs + 16, cs + dl);
            if (type === 'covr' && !out.art) out.art = new Blob([pl.slice()], { type: kind === 14 ? 'image/png' : 'image/jpeg' });
            else if (type === 'trkn' && pl.length >= 4) out.track = String((pl[2] << 8) | pl[3]);
            else if (M[type] && !out[M[type]]) out[M[type]] = td('utf-8').decode(pl).trim();
          }
        } else if (type === 'moov' || type === 'udta') walk(b, cs, ce, false);
        else if (type === 'meta') walk(b, cs + 4, ce, false);
        else if (type === 'ilst') walk(b, cs, ce, true);
        o += len;
      }
    })(moov, 0, moov.length, false);
    return out;
  }

  async function flac(f) {
    const h = await bytes(f, 0, 4);
    if (str(h, 0, 4) !== 'fLaC') return null;
    let pos = 4; const out = {};
    const M = { TITLE: 'title', ARTIST: 'artist', ALBUM: 'album', ALBUMARTIST: 'albumArtist', TRACKNUMBER: 'track' };
    for (let n = 0; n < 64; n++) {
      const bh = await bytes(f, pos, 4);
      const last = bh[0] & 0x80, type = bh[0] & 0x7f, len = (bh[1] << 16) | (bh[2] << 8) | bh[3];
      pos += 4;
      if (type === 4 || type === 6) {
        const d = await bytes(f, pos, len);
        if (type === 4) {
          const le = o => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
          let o = 4 + le(0); const cnt = le(o); o += 4;
          for (let i = 0; i < cnt && o < d.length; i++) {
            const l = le(o); o += 4; const s = td('utf-8').decode(d.subarray(o, o + l)); o += l;
            const eq = s.indexOf('='); const k = s.slice(0, eq).toUpperCase();
            if (M[k] && !out[M[k]]) out[M[k]] = s.slice(eq + 1);
          }
        } else if (!out.art) {
          let o = 4; const ml = u32(d, o); o += 4; const mime = td('utf-8').decode(d.subarray(o, o + ml)); o += ml;
          const dl = u32(d, o); o += 4 + dl + 16; const pl = u32(d, o); o += 4;
          out.art = new Blob([d.slice(o, o + pl)], { type: mime || 'image/jpeg' });
        }
      }
      pos += len; if (last) break;
    }
    return out;
  }

  async function read(file) {
    let t = null;
    try { t = (await id3(file)) || (await mp4(file)) || (await flac(file)); } catch (e) { console.warn('tag read', e); }
    t = t || {};
    const base = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
    if (!t.title) {
      const m = base.match(/^(?:\d+[\s.\-]+)?(.+?)\s+-\s+(.+)$/);
      if (m && !t.artist) { t.artist = m[1]; t.title = m[2]; } else t.title = base.replace(/^\d+[\s.\-]+/, '') || base;
    }
    t.track = parseInt(t.track, 10) || 0;
    return t;
  }
  return { read };
})();
