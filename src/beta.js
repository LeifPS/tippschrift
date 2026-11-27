// Beta unter tippschrift.de/beta: nur mit Zugangscode.
// Der Code wird nie im Klartext gespeichert, hier stehen nur SHA-256-Prüfsummen. Zusätzliche Codes können ohne
// Code-Änderung als Umgebungsvariable BETA_CODES (Komma-getrennt) im Cloudflare-Dashboard hinterlegt werden.
// Nach der Anmeldung liegt der Code in einem Cookie (HttpOnly, nur für /beta). Wird ein Code entfernt, kommt dieser
// Tester nicht mehr an neue Dateien; die installierte Beta sperrt sich spätestens nach 7 Tagen ohne Verbindung (session.js).
const HASHES = new Set([
  '7a4dd8c70e5d1757712a50fade459406f7eb30b7ef3efb798d691fa6247001f1',   // Code für alle Tester (2026-11-27)
]);
const COOKIE = 'tsbeta';

export const normBeta = (s) => { const t = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24); return t.length === 12 ? t.match(/.{4}/g).join('-') : t; };
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export async function validBeta(code, env) {
  const c = normBeta(code); if (c.length < 8) return false;
  const extra = String((env && env.BETA_CODES) || '').split(',').map(normBeta).filter((x) => x.length >= 8);
  return HASHES.has(await sha(c)) || extra.includes(c);
}
const cookieOf = (req) => { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; };

const page = (err) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Tippschrift Beta</title><link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f4f0;font:16px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:#1d1d22}
form{background:#fff;border-radius:18px;padding:28px 26px;width:min(360px,88vw);box-shadow:0 6px 30px rgba(0,0,0,.08);text-align:center}
img{width:56px;height:56px}h1{font-size:22px;margin:10px 0 2px}.b{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:#ffd84d;color:#3d3200;font-size:12px;font-weight:700;vertical-align:middle}
p{color:#6b6b73;font-size:14px;margin:6px 0 18px}input{width:100%;box-sizing:border-box;font:600 20px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-align:center;text-transform:uppercase;padding:12px;border:1.5px solid #d9d8d3;border-radius:12px;outline:none}
input:focus{border-color:#2f6bff}button{margin-top:14px;width:100%;padding:12px;border:0;border-radius:12px;background:#2f6bff;color:#fff;font:600 16px inherit;cursor:pointer}
.e{color:#c0392b;font-size:14px;margin:10px 0 0}a{display:block;margin-top:16px;color:#6b6b73;font-size:14px}</style></head>
<body><form method="post" action="/beta/anmelden"><img src="/icons/icon.svg" alt=""><h1>Tippschrift<span class="b">Beta</span></h1>
<p>Die Beta ist nur für eingeladene Tester. Gib deinen Zugangscode ein.</p>
<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" maxlength="20" required autofocus>
<button type="submit">Weiter</button>${err ? '<div class="e">Der Code stimmt nicht.</div>' : ''}<a href="/">Zur normalen App</a></form></body></html>`;
const html = (s, status = 200, extra = {}) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-frame-options': 'DENY', ...extra } });

/** Gibt eine Antwort zurück, wenn die Beta-Sperre greift; sonst null (dann wird die Datei normal ausgeliefert). */
export async function betaGate(request, env, path) {
  if (path === '/beta') return Response.redirect(new URL('/beta/', request.url).toString(), 302);
  if (path === '/beta/anmelden') {
    if (request.method !== 'POST') return Response.redirect(new URL('/beta/', request.url).toString(), 302);
    let code = ''; try { const f = await request.formData(); code = String(f.get('code') || ''); } catch (_) { /* leer */ }
    if (!(await validBeta(code, env))) return html(page(true), 401);
    return new Response(null, { status: 303, headers: { location: '/beta/', 'cache-control': 'no-store', 'set-cookie': `${COOKIE}=${encodeURIComponent(normBeta(code))}; Path=/beta; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax` } });
  }
  if (await validBeta(cookieOf(request), env)) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Nicht erlaubt', { status: 405 });
  // Ohne Anmeldung: Seiten zeigen die Anmeldung, alles andere (Programmdateien) gibt es nicht
  return /^\/beta\/(index\.html)?$/.test(path) || (request.headers.get('accept') || '').includes('text/html') ? html(page(false), 401) : new Response('Nicht angemeldet', { status: 401, headers: { 'cache-control': 'no-store' } });
}
