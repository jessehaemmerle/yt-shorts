// Kleine IndexedDB-Ablage für hochgeladenes Gameplay und Musik (bleibt im Browser gespeichert).
const DB_NAME = 'brainrot-shorts';
const STORE = 'media';

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('IndexedDB abgebrochen (Speicher voll?)'));
  });
}

export async function addMedia(kind, file) {
  const item = { id: crypto.randomUUID(), kind, name: file.name, size: file.size, type: file.type, added: Date.now(), blob: file };
  await tx('readwrite', (s) => s.put(item));
  return item;
}

export async function listMedia(kind) {
  const all = (await tx('readonly', (s) => s.getAll())) || [];
  return all.filter((m) => m.kind === kind).sort((a, b) => a.added - b.added);
}

export async function getMedia(id) {
  return tx('readonly', (s) => s.get(id));
}

export async function deleteMedia(id) {
  await tx('readwrite', (s) => s.delete(id));
}
