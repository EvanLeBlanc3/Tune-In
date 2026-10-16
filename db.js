/* Tune In — IndexedDB storage (songs live on your phone, offline) */
const DB = (() => {
  let db;
  const p = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('tunein', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
        if (!d.objectStoreNames.contains('art')) d.createObjectStore('art');
      };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }
  const st = (s, m = 'readonly') => db.transaction(s, m).objectStore(s);
  return {
    open,
    allTracks: () => p(st('tracks').getAll()),
    putTrack: t => p(st('tracks', 'readwrite').put(t)),
    delTrack: id => Promise.all([p(st('tracks', 'readwrite').delete(id)), p(st('blobs', 'readwrite').delete(id))]),
    putBlob: (id, b) => p(st('blobs', 'readwrite').put(b, id)),
    getBlob: id => p(st('blobs').get(id)),
    putArt: (k, b) => p(st('art', 'readwrite').put(b, k)),
    getArt: k => p(st('art').get(k)),
    hasArt: k => p(st('art').count(k)).then(n => n > 0),
    clear: () => Promise.all(['tracks', 'blobs', 'art'].map(s => p(st(s, 'readwrite').clear())))
  };
})();
