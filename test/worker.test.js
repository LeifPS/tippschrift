import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { makeD1 } from './helpers/d1.js';

// Falsche Asset-Ablage: gibt den angefragten Pfad zurück, damit man sieht, was der Worker geholt hat.
const env = { ASSETS: { fetch: async (req) => new Response('asset:' + new URL(req.url).pathname, { headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=60' } }) } };
const r = (url, method = 'GET') => new Request(url, { method });
const handschriftWeiche = (req, e) => handle(req, e);

test('tippschrift.de: App kommt aus public/, Service Worker darf die ganze Adresse abdecken, Daten dürfen in den Cache', async () => {
  assert.equal(await (await handle(r('https://tippschrift.de/'), env)).text(), 'asset:/');
  assert.equal(await (await handle(r('https://tippschrift.de/index.html'), env)).text(), 'asset:/');
  assert.equal(await (await handle(r('https://TIPPSCHRIFT.de/js/app.js'), env)).text(), 'asset:/js/app.js');
  const s = await handle(r('https://tippschrift.de/sw.js'), env);
  assert.equal(s.headers.get('service-worker-allowed'), '/'); assert.equal(s.headers.get('cache-control'), 'no-cache'); assert.equal(s.headers.get('x-robots-tag'), null);
  const d = await handle(r('https://tippschrift.de/data/leif.json'), env);
  assert.equal(d.headers.get('cache-control'), 'public, max-age=60'); assert.equal(d.headers.get('service-worker-allowed'), null);
});

test('tippschrift.de: kein Konto-Server, nur Lesen; Test-Adressen nicht in Suchmaschinen', async () => {
  assert.equal((await handle(r('https://tippschrift.de/api/ich'), env)).status, 404);
  assert.equal((await handle(r('https://tippschrift.de/api'), env)).status, 404);
  assert.equal((await handle(r('https://tippschrift.de/', 'POST'), env)).status, 405);
  assert.equal((await handle(r('https://tippschrift.de/'), {})).status, 404);
  assert.match((await handle(r('https://tippschrift.leifps.workers.dev/'), env)).headers.get('x-robots-tag'), /noindex/);
});

test('Tippschrift-Abgleich: Stücke hochladen, festschreiben, wieder holen; alte Fassung verschwindet', async () => {
  const env2 = { ...env, DB: makeD1() }, B = 'https://tippschrift.de/api/sync/abcd1234';
  const call = (u, method = 'GET', body) => handschriftWeiche(new Request(B + u, { method, body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), env2);
  assert.equal((await call('')).status, 404);
  assert.equal((await call('/v00001/0', 'PUT', 'QUJD')).status, 200);
  assert.equal((await call('/v00001/1', 'PUT', 'REVG')).status, 200);
  assert.equal((await call('/commit', 'POST', { v: 'v00001', parts: 3, updated: 5 })).status, 409, 'fehlendes Stück');
  assert.equal((await call('/commit', 'POST', { v: 'v00001', parts: 2, updated: 5 })).status, 200);
  assert.deepEqual(await (await call('')).json(), { v: 'v00001', parts: 2, updated: 5 });
  assert.equal(await (await call('/v00001/1')).text(), 'REVG');
  await call('/v00002/0', 'PUT', 'WFla'); await call('/commit', 'POST', { v: 'v00002', parts: 1, updated: 9 });
  assert.equal((await call('/v00001/0')).status, 404, 'alte Fassung gelöscht');
  assert.equal((await call('/v00002/0', 'PUT', '<script>')).status, 413, 'nur Base64');
  assert.equal((await handschriftWeiche(new Request('https://tippschrift.de/api/sync/../x'), env2)).status, 404);
  assert.equal((await handschriftWeiche(new Request('https://tippschrift.de/api/ich'), env2)).status, 404, 'sonst keine API');
});
test('Tippschrift-Titel: ohne KI-Anbindung freundliche Fehlermeldung, mit KI kurzer Titel', async () => {
  const req = (e) => handschriftWeiche(new Request('https://tippschrift.de/api/titel', { method: 'POST', body: JSON.stringify({ text: 'Die pq-Formel löst quadratische Gleichungen' }) }), e);
  assert.equal((await req({ ...env })).status, 503);
  const e2 = { ...env, DB: makeD1(), AI: { run: async () => ({ response: '„Die pq-Formel.“\nmehr' }) } };
  assert.deepEqual(await (await req(e2)).json(), { titel: 'Die pq-Formel' });
});

test('tippschrift.de/hdf: Format-Beschreibung als reiner Text (für KIs per Link), ohne Auftrag', async () => {
  for (const u of ['https://tippschrift.de/hdf', 'https://tippschrift.de/hdf.txt', 'https://tippschrift.de/ki-hdf', 'https://tippschrift.de/HDF']) {
    const a = await handschriftWeiche(r(u), env);
    assert.equal(a.status, 200, u);
    assert.match(a.headers.get('content-type'), /^text\/plain; charset=utf-8/);
    const t = await a.text();
    assert.match(t, /^# HDF/);
    assert.doesNotMatch(t, /Antworte NUR|Qualitätsregeln|Erstelle für mich/);
  }
});

test('Umzug: Zweit-Domains leiten auf tippschrift.de, alte Adresse nur noch Umzug (keine API, /hdf weiter, noindex)', async () => {
  for (const h of ['www.tippschrift.de', 'tippschrift.com', 'www.tippschrift.info', 'tippschrift.store']) {
    const a = await handschriftWeiche(r(`https://${h}/hdf?x=1`), env);
    assert.equal(a.status, 301, h); assert.equal(a.headers.get('location'), 'https://tippschrift.de/hdf?x=1');
  }
  const k = await handschriftWeiche(r('https://st.leifps.de/hdf'), env); assert.equal(k.status, 301); assert.equal(k.headers.get('location'), 'https://tippschrift.de/hdf');
  assert.equal((await handschriftWeiche(new Request('https://st.leifps.de/api/titel', { method: 'POST', body: '{}' }), { ...env, DB: makeD1() })).status, 405, 'alte Adresse: keine API mehr');
  assert.equal((await handschriftWeiche(r('https://st.leifps.de/api/sync/abcd1234'), env)).status, 404);
  const alt = await handschriftWeiche(r('https://st.leifps.de/'), env); assert.equal(alt.status, 200); assert.match(alt.headers.get('x-robots-tag') || '', /noindex/);
  const neu = await handschriftWeiche(r('https://tippschrift.de/'), env); assert.equal(neu.status, 200); assert.equal(neu.headers.get('x-robots-tag'), null);
});

test('Beta: nur mit Zugangscode, Cookie gilt nur für /beta, alte Adressen haben keine Beta', async () => {
  const e = { ...env, BETA_CODES: 'test-test-1234' }, code = 'TEST-TEST-1234';   // Testcode nur über die Umgebung
  const page = await handle(r('https://tippschrift.de/beta/'), e);
  assert.equal(page.status, 401); assert.match(await page.text(), /Zugangscode/);
  assert.equal((await handle(r('https://tippschrift.de/beta/js/app.js'), e)).status, 401);
  assert.equal((await handle(r('https://tippschrift.de/beta'), e)).status, 302);
  const bad = await handle(new Request('https://tippschrift.de/beta/anmelden', { method: 'POST', body: new URLSearchParams({ code: 'AAAA-BBBB-CCCC' }) }), e);
  assert.equal(bad.status, 401);
  const ok = await handle(new Request('https://tippschrift.de/beta/anmelden', { method: 'POST', body: new URLSearchParams({ code: ' test test 1234 ' }) }), e);
  assert.equal(ok.status, 303); const ck = ok.headers.get('set-cookie'); assert.match(ck, /tsbeta=TEST-TEST-1234/); assert.match(ck, /Path=\/beta/); assert.match(ck, /HttpOnly/);
  const withC = (u) => new Request(u, { headers: { cookie: 'tsbeta=' + code } });
  const a = await handle(withC('https://tippschrift.de/beta/js/app.js'), e);
  assert.equal(await a.text(), 'asset:/beta/js/app.js'); assert.match(a.headers.get('x-robots-tag'), /noindex/);
  assert.equal(await (await handle(withC('https://tippschrift.de/beta/index.html'), e)).text(), 'asset:/beta/');
  assert.equal((await handle(withC('https://st.leifps.de/beta/'), e)).status, 404);
  assert.equal((await handle(withC('https://tippschrift.de/beta/'), env)).status, 401);   // ohne den Umgebungscode ungültig
});
