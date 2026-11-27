// Arbeitsblätter ausfüllen (Beta): Lücken finden, nummeriert an die eigene KI geben, Antworten einfügen.
// Aufteilung: Die App kennt die genaue Lage der Lücken (Bildanalyse), die KI des Nutzers (ChatGPT, Claude …) löst die
// Aufgaben und antwortet nur „1: …, 2: …“. So kommt die Intelligenz vom besten Modell und die Nutzung ist unbegrenzt.
import { h, toast } from './util.js';
import { btn, sheet } from './ui.js';
import { PXMM } from './render.js';

const WORK_W = 1000;   // Arbeitsbreite der Analyse in Pixeln

/** Findet Lücken auf einem Seitenbild. Rückgabe in Bild-Pixeln: [{ x0, x1, base, kind, h }] */
export function detectGaps(img) {
  const s = WORK_W / img.width, W = WORK_W, H = Math.round(img.height * s), mm = W / 210;   // A4-Breite als Maßstab
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data, D = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < D.length; i++, j += 4) D[i] = (px[j] * .3 + px[j + 1] * .59 + px[j + 2] * .11) < 160 ? 1 : 0;
  const dark = (x0, x1, y0, y1) => { x0 = Math.max(0, x0 | 0); x1 = Math.min(W, x1 | 0); y0 = Math.max(0, y0 | 0); y1 = Math.min(H, y1 | 0); let n = 0, t = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { n += D[y * W + x]; t++; } return t ? n / t : 0; };
  // 1) Kästchen und leere Tabellenzellen: geschlossene, fast leere helle Flächen
  const lab = new Int32Array(W * H), boxes = []; let id = 0; const qx = new Int32Array(W * H);
  for (let p0 = 0; p0 < W * H; p0++) {
    if (D[p0] || lab[p0]) continue; id++; let qh = 0, qt = 0; qx[qt++] = p0; lab[p0] = id;
    let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0, edge = false;
    while (qh < qt) {
      const p = qx[qh++], x = p % W, y = (p / W) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      if (x > 0 && !D[p - 1] && !lab[p - 1]) { lab[p - 1] = id; qx[qt++] = p - 1; }
      if (x < W - 1 && !D[p + 1] && !lab[p + 1]) { lab[p + 1] = id; qx[qt++] = p + 1; }
      if (y > 0 && !D[p - W] && !lab[p - W]) { lab[p - W] = id; qx[qt++] = p - W; }
      if (y < H - 1 && !D[p + W] && !lab[p + W]) { lab[p + W] = id; qx[qt++] = p + W; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (!edge && bw >= 10 * mm && bh >= 4.5 * mm && bw < W * .96 && bh < H * .5 && n / (bw * bh) > .9 && dark(x0 + .8 * mm, x1 - .8 * mm, y0 + .8 * mm, y1 - .8 * mm) < .002) boxes.push({ x0, x1, y0, y1 });   // fast rechteckig und innen leer
  }
  const gaps = boxes.map((b) => {
    const bh = b.y1 - b.y0, tall = bh > 16 * mm;
    return { x0: b.x0 + 1.5 * mm, x1: b.x1 - 1.5 * mm, base: tall ? b.y0 + 7 * mm : b.y0 + bh / 2 + 1.6 * mm, kind: 'box', top: b.y0, bot: b.y1 };
  });
  // 2) Schreiblinien und ____: lange, dünne waagerechte Striche mit leerem Platz darüber
  const lines = [];
  for (let y = 4; y < H - 4; y++) {
    let x = 0;
    while (x < W) {
      if (!D[y * W + x]) { x++; continue; }
      let e = x; while (e < W && (D[y * W + e] || (e + 1 < W && D[y * W + e + 1]))) e++;
      const len = e - x;
      if (len >= 9 * mm) {
        const a = x + len * .1, b = e - len * .1;
        if (dark(a, b, y - 4, y - 3) < .25 && dark(a, b, y + 4, y + 5) < .25) lines.push({ x0: x, x1: e, y });
      }
      x = e + 1;
    }
  }
  // benachbarte Zeilen derselben Linie zusammenfassen
  lines.sort((p, q) => p.y - q.y || p.x0 - q.x0);
  const merged = [];
  for (const l of lines) { const m = merged.find((q) => Math.abs(q.y - l.y) <= 3 && Math.min(q.x1, l.x1) - Math.max(q.x0, l.x0) > .7 * Math.min(q.x1 - q.x0, l.x1 - l.x0)); if (m) { m.y = Math.max(m.y, l.y); m.x0 = Math.min(m.x0, l.x0); m.x1 = Math.max(m.x1, l.x1); } else merged.push({ ...l }); }
  for (const l of merged) {
    if (dark(l.x0 + 3, l.x1 - 3, l.y - 7 * mm, l.y - 3) > .015) continue;   // über der Linie steht schon etwas -> keine Lücke
    let border = false; for (let x = l.x0 - 2; x <= l.x1 + 2 && !border; x++) if (dark(x - 1, x + 2, l.y - 4 * mm, l.y - 2) > .4 || dark(x - 1, x + 2, l.y + 2, l.y + 4 * mm) > .4) border = true;
    if (border) continue;   // senkrechte Striche an der Linie: Rand einer Tabelle oder eines Kastens
    if (gaps.some((b) => b.kind === 'box' && Math.abs(b.bot - l.y) < 2.5 * mm && Math.min(b.x1, l.x1) - Math.max(b.x0, l.x0) > .5 * (l.x1 - l.x0))) continue;   // Unterkante eines Kästchens
    gaps.push({ x0: l.x0 + 1 * mm, x1: l.x1 - 1 * mm, base: l.y - .9 * mm, kind: 'line' });
  }
  return gaps.map((q) => ({ x0: q.x0 / s, x1: q.x1 / s, base: q.base / s, kind: q.kind }));
}

/** Bild-Pixel -> mm auf der Seite (das Blatt ist eingepasst wie in drawPage) */
export function gapToField(q, img, L, seite) {
  const f = Math.min(L.PW / img.width, L.PH / img.height), ox = (L.PW - img.width * f) / 2, oy = (L.PH - img.height * f) / 2;
  const x = (ox + q.x0 * f) / PXMM, y = (oy + q.base * f) / PXMM, w = ((q.x1 - q.x0) * f) / PXMM;
  return { seite, x, y, breite: Math.max(8, w), text: '' };
}
export const readingOrder = (a, b) => (a.seite || 1) - (b.seite || 1) || (Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x);

// ---------- An die KI geben ----------
export const AI_PROMPT = `Auf dem Bild ist ein Arbeitsblatt. Die Lücken, in die eine Antwort gehört, sind mit roten Nummern markiert.
Löse die Aufgaben und gib für jede Nummer genau das an, was in diese Lücke geschrieben wird – so kurz, wie man es von Hand hineinschreiben würde.
Antworte ausschließlich in diesem Format, eine Zeile pro Nummer, ohne weiteren Text:
1: Antwort
2: Antwort
Formeln schreibst du zwischen $-Zeichen, z. B. $x^2 + 1$. Braucht eine Lücke keine Antwort, schreib: 3: -
Gib alles in einem einzigen Codeblock aus.`;

/** Seitenbilder mit roten Nummern an den leeren Lücken (JPEG-Dateien) */
export async function numberedPages(L, fields, bgs) {
  const files = [];
  for (let i = 0; i < L.pages.length; i++) {
    const c = document.createElement('canvas'), k = 1600 / L.PW; c.width = 1600; c.height = Math.round(L.PH * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    const bg = bgs && bgs[i]; if (bg) { const f = Math.min(L.PW / bg.width, L.PH / bg.height); g.drawImage(bg, (L.PW - bg.width * f) / 2 * k, (L.PH - bg.height * f) / 2 * k, bg.width * f * k, bg.height * f * k); }
    let any = false;
    for (const fd of fields) {
      if ((fd.seite || 1) !== i + 1 || !fd.nr) continue; any = true;
      const x = fd.x * PXMM * k, y = fd.y * PXMM * k, r = 19;
      g.fillStyle = '#e0241b'; g.beginPath(); g.arc(x + r, y - r * .9, r, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = `bold ${fd.nr > 9 ? 19 : 23}px -apple-system, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(fd.nr), x + r, y - r * .9 + 1);
    }
    if (!any && L.pages.length > 1) continue;
    const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', .9));
    files.push(new File([b], `Arbeitsblatt-Seite-${i + 1}.jpg`, { type: 'image/jpeg' }));
  }
  return files;
}

/** Antwort der KI lesen: „1: …“, „1) …“, „**1.** …“; Folgezeilen gehören zur vorigen Nummer */
export function parseAnswers(t) {
  const out = new Map(); let cur = null;
  for (let line of String(t || '').replace(/\r/g, '').split('\n')) {
    if (/^\s*```/.test(line)) continue;
    line = line.replace(/^\s*[-*]\s+(?=\**\s*(Lücke\s*)?\d)/i, '');
    const m = /^\s*\**\s*(?:Lücke\s*|Nr\.?\s*)?(\d{1,3})\s*\**\s*[:.)\]–-]\s*\**\s*(.*)$/i.exec(line);
    if (m) { cur = +m[1]; out.set(cur, m[2].replace(/\*\*$/, '').trim()); }
    else if (cur != null && line.trim()) out.set(cur, (out.get(cur) + '\n' + line.trim()).trim());
  }
  for (const [k, v] of out) if (/^[-–—]?$/.test(v.trim())) out.set(k, '');
  return out;
}

/** Fenster „An KI geben“ */
export function openAiShare(files) {
  sheet('Arbeitsblatt an deine KI geben', (b) => {
    const copy = async () => { try { await navigator.clipboard.writeText(AI_PROMPT); toast('Prompt kopiert', 1500); return true; } catch (_) { toast('Kopieren ging nicht – bitte den Text unten markieren', 3000, 'err'); return false; } };
    const save = () => { for (const f of files) { const a = h('a', { href: URL.createObjectURL(f), download: f.name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); } };
    const canShare = !!(navigator.canShare && navigator.canShare({ files }));
    b.append(
      h('ol', { class: 'wsteps' },
        h('li', null, h('b', null, 'Bild und Prompt an ChatGPT, Claude o. Ä. geben. '), canShare ? 'Am einfachsten über „Teilen“ – der Prompt wird dabei auch kopiert, falls die App ihn nicht mitnimmt.' : 'Speichere die Bilder und lade sie in deiner KI-App hoch, dann füge den Prompt ein.'),
        h('li', null, h('b', null, 'Antwort kopieren. '), 'Die KI antwortet mit „1: …, 2: …“ in einem Codeblock – dort gibt es einen Kopieren-Knopf.'),
        h('li', null, h('b', null, 'Zurück zu Tippschrift → „Antworten einfügen“. '), 'Jede Antwort landet in deiner Handschrift in ihrer Lücke.')),
      h('div', { class: 'row wrap2', style: { gap: '8px', margin: '6px 0 14px' } },
        canShare ? btn('Teilen …', { icon: 'share', cls: 'pri', onclick: async () => { await copy(); try { await navigator.share({ files, text: AI_PROMPT }); } catch (e) { if (e && e.name !== 'AbortError') save(); } } }) : null,
        btn(files.length > 1 ? `${files.length} Bilder speichern` : 'Bild speichern', { icon: 'download', cls: canShare ? '' : 'pri', onclick: save }),
        btn('Prompt kopieren', { icon: 'copy', onclick: copy })),
      h('details', { class: 'wprompt' }, h('summary', null, 'Prompt ansehen'), h('pre', null, AI_PROMPT)),
      h('p', { class: 'xs mut' }, 'Das Bild geht direkt von dir an deine KI – Tippschrift selbst schickt nichts an einen Server.'));
  });
}
