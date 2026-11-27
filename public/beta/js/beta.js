// Beta (tippschrift.de/beta): läuft getrennt von der normalen App.
// Die Dokumente liegen in einer eigenen Datenbank (store.js), die Einstellungen bekommen hier einen eigenen Präfix:
// Alle Schlüssel „hs:…“ werden in der Beta zu „tsb:…“, damit Beta und normale App sich nichts überschreiben.
export const BETA = true, MAIN_DB = 'handschrift';
try {
  const P = Storage.prototype, map = (k) => (typeof k === 'string' && k.startsWith('hs:') ? 'tsb:' + k.slice(3) : k);
  for (const m of ['getItem', 'removeItem']) { const o = P[m]; P[m] = function (k) { return o.call(this, map(k)); }; }
  const set = P.setItem; P.setItem = function (k, v) { return set.call(this, map(k), v); };
} catch (_) { /* ohne Speicher läuft die App trotzdem */ }

// Daten aus der normalen App übernehmen (nur lesen dort, hier hinzufügen bzw. überschreiben)
export async function importFromMain(onStep) {
  const src = await new Promise((ok, fail) => {
    const r = indexedDB.open(MAIN_DB);
    r.onupgradeneeded = () => { r.transaction.abort(); };   // gibt es nicht -> nichts anlegen
    r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error || new Error('Keine Daten der normalen App gefunden'));
  });
  const all = (store) => new Promise((ok, fail) => { if (!src.objectStoreNames.contains(store)) return ok([]); const q = src.transaction(store).objectStore(store).getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => fail(q.error); });
  const { rawPut, rawDel, dbAll } = await import('./store.js'), n = {};
  // das automatisch angelegte Willkommens-Dokument der Beta weglassen, wenn die normale App Dokumente mitbringt
  if ((await all('docs')).length) for (const d of await dbAll('docs')) if (d.title === 'Willkommen' && String(d.text || '').startsWith('# Hallo!')) await rawDel('docs', d.id);
  for (const s of ['fonts', 'docs', 'kv']) {
    const rows = await all(s); n[s] = rows.length; onStep && onStep(s, rows.length);
    for (const row of rows) { if (s === 'kv' && /^(ver:|syncCode|sync)/.test(row.k)) continue; await rawPut(s, row); }
  }
  src.close();
  return n;
}
