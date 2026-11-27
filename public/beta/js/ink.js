// Gezeichnete Striche (Editor): Datenformat und Zeichnen.
// doc.ink = { v: 1, pages: { "0": [Strich, …], "1": … } }, Koordinaten in Seiten-Pixeln (150 dpi, wie das Layout).
// Strich = { t: 'pen' | 'marker', c: '#rrggbb', w: Grunddicke, pts: [[x, y, Druck 0..1], …] }
export const hasInk = (doc) => !!(doc && doc.ink && doc.ink.pages && Object.values(doc.ink.pages).some((a) => a && a.length));
export const inkOf = (doc, i) => (doc && doc.ink && doc.ink.pages && doc.ink.pages[i]) || null;
/** Hängt die Striche an die Seiten eines Layouts (drawPage und die Exporte lesen L.pages[i].ink) */
export function attachInk(L, doc) { if (L) L.pages.forEach((p, i) => { p.ink = inkOf(doc, i); }); return L; }

export const pw = (s, p) => s.w * (s.t === 'marker' ? 1 : .35 + .9 * (p == null ? .5 : p));   // Dicke an einem Punkt (Druck)

/** Zeichnet Striche in einen Kontext, der schon auf Seiten-Pixel skaliert ist. which: 'marker' | 'pen' | undefined (beide) */
export function drawStrokes(ctx, strokes, which) {
  if (!strokes) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (which && s.t !== which) continue; const p = s.pts; if (!p || !p.length) continue;
    if (s.t === 'marker') {
      ctx.globalAlpha = .42; ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (p.length === 1) ctx.lineTo(p[0][0] + .1, p[0][1]); ctx.stroke();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
    } else {
      ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], pw(s, p[0][2]) / 2, 0, 7); ctx.fill(); continue; }
      for (let i = 1; i < p.length; i++) { ctx.lineWidth = (pw(s, p[i - 1][2]) + pw(s, p[i][2])) / 2; ctx.beginPath(); ctx.moveTo(p[i - 1][0], p[i - 1][1]); ctx.lineTo(p[i][0], p[i][1]); ctx.stroke(); }
    }
  }
  ctx.restore();
}
export const bboxStrokes = (list) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const s of list) for (const [x, y] of s.pts) { const r = s.w / 2; if (x - r < x0) x0 = x - r; if (y - r < y0) y0 = y - r; if (x + r > x1) x1 = x + r; if (y + r > y1) y1 = y + r; } return { x0, y0, x1, y1 }; };
