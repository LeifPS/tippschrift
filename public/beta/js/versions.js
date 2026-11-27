// Versionen: ältere Stände eines Dokuments, nur auf diesem Gerät (im kv-Speicher, nicht im Abgleich).
// Beim Speichern wird der neueste Stand fortgeschrieben, bis er 10 Minuten alt ist; dann beginnt ein neuer.
// Vor einer Wiederherstellung wird der aktuelle Stand fest gemerkt, damit nichts verloren geht.
import { h, toast } from './util.js';
import { btn, sheet, confirmBox } from './ui.js';
import { dbGet, rawPut, rawDel } from './store.js';
import { layout, drawPage, ensureImages } from './render.js';

const KEY = (id) => 'ver:' + id, SLOT = 10 * 60e3, MAX = 60, DAY = 864e5;

export async function listVersions(id) { try { const r = await dbGet('kv', KEY(id)); return (r && r.v) || []; } catch { return []; } }
export const dropVersions = (id) => rawDel('kv', KEY(id)).catch(() => {});

const same = (v, d) => v.text === (d.text || '') && JSON.stringify(v.s || {}) === JSON.stringify(d.s || {});

function thin(list) {   // jüngster Tag komplett, danach höchstens einer pro Stunde (bis 7 Tage) bzw. pro Tag
  const now = Date.now(), seen = new Set(), out = [];
  for (const v of list) {
    const age = now - v.t; if (age < DAY || v.lock) { out.push(v); continue; }
    const b = age < 7 * DAY ? 'h' + Math.floor(v.t / 36e5) : 'd' + Math.floor(v.t / DAY);
    if (!seen.has(b)) { seen.add(b); out.push(v); }
  }
  return out.slice(0, MAX);
}

let chain = Promise.resolve();
export function snapVersion(d, { lock = false } = {}) {
  if (!d || !d.id) return chain;
  return (chain = chain.then(async () => {
    const list = await listVersions(d.id), now = Date.now(), top = list[0];
    const v = { start: now, t: now, text: d.text || '', s: { ...(d.s || {}) }, title: d.title || '', lock };
    if (top && same(top, d)) { if (lock && !top.lock) top.lock = true; else return; }
    else if (top && !top.lock && !lock && now - top.start < SLOT) list[0] = { ...v, start: top.start };
    else list.unshift(v);
    await rawPut('kv', { k: KEY(d.id), v: thin(list) });
  }).catch(() => {}));
}

const when = (t) => {
  const d = new Date(t), now = new Date(), tag = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((tag(now) - tag(d)) / DAY), uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `Heute, ${uhr}`; if (diff === 1) return `Gestern, ${uhr}`;
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + `, ${uhr}`;
};

function delta(v, d) {
  const a = (v.text || '').length, b = (d.text || '').length, n = b - a;
  if (v.text === (d.text || '')) return 'Gleicher Text, andere Einstellungen';
  return n === 0 ? 'Gleich lang, Text geändert' : `${Math.abs(n)} Zeichen ${n > 0 ? 'weniger' : 'mehr'} als jetzt`;
}

// Liste der Versionen. onRestore(version) setzt den Stand ein (Editor oder Dokumentliste), onCopy legt eine Kopie an.
export async function openVersions(app, d, { onRestore, onCopy } = {}) {
  await snapVersion(d);
  const all = (await listVersions(d.id)).filter((v) => !same(v, d));
  sheet('Ältere Versionen', (b, api) => {
    if (!all.length) { b.append(h('p', { class: 'mut' }, 'Noch keine älteren Versionen. Tippschrift merkt sich beim Schreiben automatisch alle 10 Minuten einen Stand – nur auf diesem Gerät.')); return; }
    b.append(h('p', { class: 'sm mut', style: { margin: '0 0 12px' } }, 'Automatisch gemerkte Stände auf diesem Gerät. Beim Wiederherstellen wird der jetzige Stand vorher gesichert.'));
    let q = Promise.resolve();
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); q = q.then(() => paint(e.target)).catch(() => {}); } }, { rootMargin: '200px' });
    async function paint(box) {
      const v = all[+box.dataset.i]; if (!box.isConnected) return;
      const font = await app.getFont(d.fontId || app.fontId), txt = (v.text || '').slice(0, 2500);
      await font.prepare(txt + ' •');
      const L = layout(txt, v.s, font), ent = L.pages[0] || []; await ensureImages(ent);
      const cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;display:block'; drawPage(cv, ent, L, v.s, .3, false);
      box.replaceChildren(cv);
    }
    for (const [i, v] of all.entries()) {
      const pv = h('div', { 'data-i': i, style: { width: '84px', flex: '0 0 84px', aspectRatio: '0.72', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--line, #ddd)', background: '#fff' } });
      const row = h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line, #eee)' } }, pv,
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('b', null, when(v.t)),
          h('div', { class: 'sm mut' }, delta(v, d)),
          h('div', { class: 'sm mut', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, (v.text || '').replace(/\[[^\]\n]*\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || '(leer)'),
          h('div', { class: 'row', style: { gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
            btn('Wiederherstellen', { icon: 'refresh', cls: 'sm', onclick: async () => {
              if (!(await confirmBox(`Den Stand von ${when(v.t)} wiederherstellen? Der jetzige Stand bleibt als Version erhalten.`, 'Wiederherstellen'))) return;
              await snapVersion(d, { lock: true }); api.close(); await onRestore(v); toast('Version wiederhergestellt');
            } }),
            onCopy ? btn('Als Kopie öffnen', { icon: 'copy', cls: 'sm', onclick: async () => { api.close(); await onCopy(v); } }) : null)));
      b.append(row); io.observe(pv);
    }
  }, { onclose: () => {} });
}
