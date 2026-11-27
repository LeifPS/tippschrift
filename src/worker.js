// Tippschrift – Worker (Cloudflare). Liefert die App aus public/ und zwei kleine, freiwillige Schnittstellen (siehe hsapi.js).
//  - tippschrift.de: die App, /api/titel, /api/sync/..., /hdf (Format-Beschreibung für KIs als reiner Text)
//  - www.tippschrift.de, tippschrift.com/.info/.store (auch mit www): dauerhafte Weiterleitung auf tippschrift.de (Pfad bleibt)
//  - alte Adressen st.leifps.de und handschrift.leifps.de: nur noch die Umzugsseite (die App erkennt die Adresse selbst und zeigt
//    „Neue Adresse“ + Sicherung, weil die alten Daten im Browser an dieser Adresse liegen); keine Schnittstellen, /hdf leitet weiter
//  - jede andere Adresse (z. B. tippschrift.<konto>.workers.dev zum Testen): wie tippschrift.de, aber nicht für Suchmaschinen
// Die App hat kein Konto: alle Daten bleiben im Browser.
import { hsApi } from './hsapi.js';
import { betaGate } from './beta.js';
import { HDF_DOC } from '../public/js/hdfdoc.js';

export const HOST = 'tippschrift.de';
export const ALIAS = ['www.tippschrift.de', 'tippschrift.com', 'www.tippschrift.com', 'tippschrift.info', 'www.tippschrift.info', 'tippschrift.store', 'www.tippschrift.store'];
export const OLD = ['st.leifps.de', 'handschrift.leifps.de'];
const HDF_PATH = /^\/(hdf|hdf\.txt|ki-hdf)\/?$/i;
const notFound = () => new Response('Nicht gefunden', { status: 404, headers: { 'x-robots-tag': 'noindex' } });

export async function handle(request, env) {
  const url = new URL(request.url), host = url.hostname.toLowerCase(), path = url.pathname;
  if (ALIAS.includes(host)) return Response.redirect('https://' + HOST + path + url.search, 301);
  const old = OLD.includes(host), main = host === HOST;
  if (old && HDF_PATH.test(path)) return Response.redirect('https://' + HOST + '/hdf', 301);   // alte KI-Links funktionieren weiter
  if (!old && (path === '/api/titel' || path.startsWith('/api/sync/'))) return hsApi(request, env);
  const isBeta = path === '/beta' || path.startsWith('/beta/');
  if (isBeta) { if (old) return notFound(); const g = await betaGate(request, env, path); if (g) return g; }   // Beta nur mit Zugangscode
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Nicht erlaubt', { status: 405, headers: { allow: 'GET, HEAD' } });
  if (path === '/api' || path.startsWith('/api/')) return notFound();
  if (HDF_PATH.test(path)) return new Response(request.method === 'HEAD' ? null : HDF_DOC, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*' } });
  if (!env.ASSETS) return notFound();
  const r = await env.ASSETS.fetch(new Request(new URL(path === '/index.html' ? '/' : path === '/beta/index.html' ? '/beta/' : path, request.url), request));
  const h = new Headers(r.headers);
  if (!main || isBeta) h.set('x-robots-tag', 'noindex, nofollow, noarchive');
  if (isBeta) h.set('cache-control', 'no-cache, private');   // nur tippschrift.de soll in Suchmaschinen auftauchen
  h.set('referrer-policy', 'no-referrer');
  h.set('x-frame-options', 'DENY');   // nicht in fremde Seiten einbetten (Klick-Fallen)
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (main) h.set('strict-transport-security', 'max-age=31536000');
  h.set('x-content-type-options', 'nosniff');
  if (path === '/sw.js') h.set('service-worker-allowed', '/');
  // Programmdateien immer beim Server nachfragen (ETag), die Offline-Fassung kommt vom Service Worker der App
  if (!isBeta && !/^\/(icons|data|vendor)\//.test(path)) h.set('cache-control', 'no-cache');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

export default { fetch: handle };
