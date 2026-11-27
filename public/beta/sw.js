// Service Worker der BETA (nur /beta/): macht die Beta offline nutzbar (alles wird beim ersten Besuch auf das Gerät geladen)
const VER = 'tsb-376df42d33';
const CORE = [
 "/beta/",
 "/beta/app.css",
 "/beta/data/LIZENZ-always-forever.txt",
 "/beta/data/leif.json",
 "/beta/icons/apple-touch-icon.png",
 "/beta/icons/favicon-32.png",
 "/beta/icons/icon-192.png",
 "/beta/icons/icon-512.png",
 "/beta/icons/icon-maskable-512.png",
 "/beta/icons/icon-maskable.svg",
 "/beta/icons/icon.svg",
 "/beta/js/app.js",
 "/beta/js/backup.js",
 "/beta/js/beta.js",
 "/beta/js/blocks.js",
 "/beta/js/chardesc.js",
 "/beta/js/docs.js",
 "/beta/js/draw.js",
 "/beta/js/editor.js",
 "/beta/js/exporter.js",
 "/beta/js/extra.js",
 "/beta/js/features.js",
 "/beta/js/fonts.js",
 "/beta/js/glyphs.js",
 "/beta/js/gn.js",
 "/beta/js/gnink.js",
 "/beta/js/gnpap.js",
 "/beta/js/gntpl.js",
 "/beta/js/gntpl2.js",
 "/beta/js/gnvorlagen.js",
 "/beta/js/grammar.js",
 "/beta/js/hdf.js",
 "/beta/js/hdfdoc.js",
 "/beta/js/imgops.js",
 "/beta/js/legal.js",
 "/beta/js/mathx.js",
 "/beta/js/more.js",
 "/beta/js/music.js",
 "/beta/js/packs.js",
 "/beta/js/papier.js",
 "/beta/js/pdfin.js",
 "/beta/js/pdfw.js",
 "/beta/js/reader.js",
 "/beta/js/render.js",
 "/beta/js/session.js",
 "/beta/js/sheet.js",
 "/beta/js/store.js",
 "/beta/js/sync.js",
 "/beta/js/templates.js",
 "/beta/js/texthl.js",
 "/beta/js/ui.js",
 "/beta/js/util.js",
 "/beta/js/vec.js",
 "/beta/js/versions.js",
 "/beta/js/video.js",
 "/beta/js/visuals.js",
 "/beta/js/vorlagen.js",
 "/beta/js/wizard.js",
 "/beta/manifest.webmanifest",
 "/beta/vendor/jsqr.js",
 "/beta/vendor/qrcode.js"
];
const OPT = ["/beta/vendor/pdf.min.mjs", "/beta/vendor/pdf.worker.min.mjs"];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    await c.addAll(CORE);
    for (const u of OPT) { try { await c.add(u); } catch (_) {} }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('tsb-') && k !== VER) await caches.delete(k);
    await self.clients.claim();
    for (const cl of await self.clients.matchAll()) cl.postMessage({ type: 'ready' });
  })());
});
self.addEventListener('message', async (e) => {
  if (!e.data || e.data.type !== 'status') return;
  const c = await caches.open(VER), have = await c.match(CORE[0], { ignoreSearch: true });
  if (have && e.source) e.source.postMessage({ type: 'ready' });
});
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const hit = await c.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' ? await c.match('/beta/', { ignoreSearch: true }) : null);
    if (hit) return hit;
    try { return await fetch(r); } catch (err) { return new Response('Offline', { status: 503, statusText: 'Offline' }); }
  })());
});
