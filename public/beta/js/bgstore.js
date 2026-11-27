// Arbeitsblätter: die importierten Seiten (PDF oder Foto) als JPEG im Gerätespeicher (kv 'bg:<Dokument>').
// Sie liegen getrennt vom Dokument, damit der Abgleich klein bleibt; die Sicherung nimmt sie mit.
import { dbGet, rawPut, rawDel } from './store.js';
import { blobOf } from './util.js';

const KEY = (id) => 'bg:' + id, cache = new Map(), MAXPX = 2200;

/** Seiten (Canvas) speichern. Gibt die Anzahl und die Ausrichtung der ersten Seite zurück. */
export async function saveBg(id, canvases) {
  const list = [];
  for (const c of canvases) {
    const k = Math.min(1, MAXPX / Math.max(c.width, c.height)); let src = c;
    if (k < 1) { src = document.createElement('canvas'); src.width = Math.round(c.width * k); src.height = Math.round(c.height * k); const g = src.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, src.width, src.height); }
    list.push({ b: await blobOf(src, 'image/jpeg', .86), w: src.width, h: src.height });
  }
  await rawPut('kv', { k: KEY(id), v: list }); cache.delete(id);
  return { n: list.length, quer: list[0] && list[0].w > list[0].h };
}
export async function loadBg(id) {
  if (!id) return null; if (cache.has(id)) return cache.get(id);
  const p = (async () => { try { const r = await dbGet('kv', KEY(id)); if (!r || !r.v || !r.v.length) return null; return await Promise.all(r.v.map((x) => createImageBitmap(x.b))); } catch { return null; } })();
  cache.set(id, p); return p;
}
export async function hasBg(id) { try { const r = await dbGet('kv', KEY(id)); return !!(r && r.v && r.v.length); } catch { return false; } }
/** Seitenbilder an das Layout hängen (drawPage zeichnet sie unter die Schrift) */
export function attachBg(L, imgs) { if (L && imgs) L.pages.forEach((p, i) => { p.bg = imgs[i] || null; }); return L; }
export async function copyBg(from, to) { try { const r = await dbGet('kv', KEY(from)); if (r) await rawPut('kv', { k: KEY(to), v: r.v }); } catch { /* egal */ } }
export const dropBg = (id) => { cache.delete(id); return rawDel('kv', KEY(id)).catch(() => {}); };

// Für die Sicherung: Blobs als data:-URLs und zurück
const toUrl = (b) => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => fail(r.error); r.readAsDataURL(b); });
export async function bgForBackup(ids) {
  const out = {};
  for (const id of ids) { try { const r = await dbGet('kv', KEY(id)); if (r && r.v && r.v.length) out[id] = await Promise.all(r.v.map(async (x) => ({ src: await toUrl(x.b), w: x.w, h: x.h }))); } catch { /* egal */ } }
  return out;
}
export async function bgFromBackup(o) {
  for (const [id, list] of Object.entries(o || {})) {
    if (!Array.isArray(list) || !list.every((x) => x && typeof x.src === 'string' && x.src.startsWith('data:image/'))) continue;
    const v = await Promise.all(list.map(async (x) => ({ b: await (await fetch(x.src)).blob(), w: x.w, h: x.h })));
    await rawPut('kv', { k: KEY(id), v }); cache.delete(id);
  }
}
