// Editor (Beta): auf den fertigen Seiten schreiben und zeichnen – im Stil von GoodNotes, gemacht fürs iPad mit Apple Pencil.
// Werkzeuge: Stift (druckabhängig), Textmarker, Radierer (ganze Striche), Lasso (auswählen, verschieben, Größe, löschen).
// Stift halten statt loslassen macht aus dem Strich eine gerade Linie. Mit dem Finger wird gescrollt (Handballen werden
// ignoriert, solange der Stift schreibt); wer keinen Stift hat, kann „Mit dem Finger zeichnen“ einschalten.
// Die Striche gehören zum Dokument (doc.ink) und kommen in alle Exporte, auch als echte GoodNotes-Striche.
import { h, toast } from './util.js';
import { btn, ic } from './ui.js';
import { drawPage, ensureImages } from './render.js';
import { drawStrokes, bboxStrokes, pw } from './ink.js';

const PENS = ['#1d1d22', '#1d3a9a', '#c62828', '#1b7a3a', '#d9730d', '#7b3fa0'];
const MARKS = ['#ffe14d', '#9be38c', '#ff9ad5', '#8ec5ff', '#ffb35c'];
const PEN_W = [2.2, 3.4, 5.5], MARK_W = [12, 20, 30];
const LS = (k, d) => { try { const v = localStorage.getItem('hs:ink:' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
const SS = (k, v) => { try { localStorage.setItem('hs:ink:' + k, JSON.stringify(v)); } catch (_) { /* egal */ } };

/** @param o { L, S, onSave(inkPages) } – L: fertiges Layout ohne Striche */
export function openInkEditor(doc, { L, S, onSave }) {
  let pages = JSON.parse(JSON.stringify((doc.ink && doc.ink.pages) || {}));
  const st = { tool: LS('tool', 'pen'), pen: LS('pen', 0), mark: LS('mark', 0), penW: LS('penW', 1), markW: LS('markW', 1), finger: LS('finger', false) };
  const hist = [JSON.stringify(pages)]; let hi = 0, sel = null;   // sel = { pi, idx:[…], box }
  const save = () => { for (const k of Object.keys(pages)) if (!pages[k] || !pages[k].length) delete pages[k]; onSave(JSON.parse(JSON.stringify(pages))); };
  const commit = () => { hist.length = hi + 1; hist.push(JSON.stringify(pages)); if (hist.length > 80) hist.shift(); hi = hist.length - 1; updBar(); save(); };
  const go = (d) => { const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n; pages = JSON.parse(hist[hi]); clearSel(); redrawAll(); updBar(); save(); };

  // ---------- Oberfläche ----------
  const root = h('div', { class: 'inked', role: 'dialog', 'aria-label': 'Editor' });
  const toolBtn = (id, icon, label) => h('button', { type: 'button', class: 'ietool', 'data-t': id, title: label, 'aria-label': label, onclick: () => setTool(id) }, ic(icon));
  const tools = h('div', { class: 'iegrp' }, toolBtn('pen', 'pen', 'Stift'), toolBtn('marker', 'highlighter', 'Textmarker'), toolBtn('eraser', 'eraser', 'Radierer'), toolBtn('lasso', 'lasso', 'Lasso'));
  const colors = h('div', { class: 'iegrp iecols' }), sizes = h('div', { class: 'iegrp iesizes' });
  const undoB = btn('Rückgängig', { icon: 'undo', cls: 'icon ghost', onclick: () => go(-1) }), redoB = btn('Wiederholen', { icon: 'redo', cls: 'icon ghost', onclick: () => go(1) });
  const fingerB = h('button', { type: 'button', class: 'ietool iefinger', title: 'Mit dem Finger zeichnen', onclick: () => { st.finger = !st.finger; SS('finger', st.finger); updBar(); toast(st.finger ? 'Finger zeichnet – zum Scrollen zwei Finger nehmen' : 'Finger scrollt, gezeichnet wird mit dem Stift', 2500); } }, ic('hand'));
  const done = btn('Fertig', { cls: 'pri sm', onclick: () => close() });
  const bar = h('div', { class: 'iebar' }, done, h('div', { class: 'iemid' }, tools, h('i', { class: 'vs' }), colors, h('i', { class: 'vs' }), sizes), h('div', { class: 'ieend' }, undoB, redoB, fingerB));
  const scroller = h('div', { class: 'iescroll' });
  root.append(bar, scroller); document.body.append(root); document.documentElement.classList.add('inked-open');

  function updBar() {
    tools.querySelectorAll('.ietool').forEach((b) => b.classList.toggle('on', b.dataset.t === st.tool));
    const isM = st.tool === 'marker', list = isM ? MARKS : PENS, cur = isM ? st.mark : st.pen;
    colors.hidden = sizes.hidden = !(st.tool === 'pen' || isM);
    colors.replaceChildren(...list.map((c, i) => h('button', { type: 'button', class: 'iecol' + (i === cur ? ' on' : ''), style: { '--c': c }, 'aria-label': 'Farbe ' + (i + 1), onclick: () => { if (isM) { st.mark = i; SS('mark', i); } else { st.pen = i; SS('pen', i); } updBar(); } })));
    const W = isM ? MARK_W : PEN_W, cw = isM ? st.markW : st.penW;
    sizes.replaceChildren(...W.map((w, i) => h('button', { type: 'button', class: 'iesz' + (i === cw ? ' on' : ''), 'aria-label': ['dünn', 'mittel', 'dick'][i], onclick: () => { if (isM) { st.markW = i; SS('markW', i); } else { st.penW = i; SS('penW', i); } updBar(); } }, h('i', { style: { width: (6 + i * 5) + 'px', height: (6 + i * 5) + 'px' } }))));
    undoB.disabled = hi <= 0; redoB.disabled = hi >= hist.length - 1; fingerB.classList.toggle('on', st.finger);
  }
  function setTool(t) { st.tool = t; SS('tool', t); if (t !== 'lasso') clearSel(); updBar(); }

  // ---------- Seiten ----------
  const P = L.pages.map((ents, i) => {
    const base = h('canvas', { class: 'iebase' }), ink = h('canvas', { class: 'ieink' }), box = h('div', { class: 'iepage', style: { aspectRatio: `${L.PW} / ${L.PH}` } }, base, ink);
    scroller.append(h('div', { class: 'iepw' }, box, h('div', { class: 'iecap' }, `Seite ${i + 1} von ${L.pages.length}`)));
    return { i, ents, base, ink, box, k: 1 };
  });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  async function layoutPages() {
    for (const p of P) {
      const cssW = p.box.clientWidth || 600; p.k = cssW / L.PW; const sc = Math.min(1.6, p.k * dpr);
      const e = p.ents.slice(); e.ink = null; await ensureImages(e); drawPage(p.base, e, L, S, sc, false);
      p.ink.width = Math.round(L.PW * sc); p.ink.height = Math.round(L.PH * sc); p.sc = sc; redraw(p);
    }
  }
  function redraw(p, extra) {
    const g = p.ink.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, p.ink.width, p.ink.height); g.setTransform(p.sc, 0, 0, p.sc, 0, 0);
    const list = pages[p.i] || [];
    drawStrokes(g, list.filter((s) => s.t === 'marker')); drawStrokes(g, list.filter((s) => s.t !== 'marker'));
    if (extra) extra(g);
  }
  const redrawAll = () => P.forEach((p) => redraw(p));
  const ro = new ResizeObserver(() => { clearTimeout(ro.t); ro.t = setTimeout(() => { layoutPages(); placeSel(); }, 120); }); ro.observe(scroller);

  // ---------- Eingabe ----------
  const pageAt = (x, y) => P.find((p) => { const r = p.box.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top - 40 && y <= r.bottom + 40; });
  const toPage = (p, e) => { const r = p.box.getBoundingClientRect(); return [(e.clientX - r.left) / p.k, (e.clientY - r.top) / p.k]; };
  let act = null, penSeen = false, penDown = false; const touches = new Map();
  scroller.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'pen') { penSeen = true; penDown = true; }
    if (e.pointerType === 'touch' && (penDown || !st.finger || touches.size || (act && act.touch))) {   // Finger: scrollen
      touches.set(e.pointerId, { y: e.clientY, x: e.clientX, t: performance.now(), v: 0 }); if (act && act.touch) cancelAct(); scroller.setPointerCapture(e.pointerId); momentum = 0; return;
    }
    if (act) return;
    const p = pageAt(e.clientX, e.clientY); if (!p) return;
    e.preventDefault(); scroller.setPointerCapture(e.pointerId);
    const [x, y] = toPage(p, e), pr = e.pointerType === 'pen' ? Math.max(.05, e.pressure || .5) : .5;
    if (st.tool === 'lasso') {
      if (sel && sel.pi === p.i && inBox(sel.box, x, y, 8 / p.k)) { act = { kind: 'move', p, id: e.pointerId, x0: x, y0: y, orig: sel.idx.map((j) => JSON.parse(JSON.stringify(pages[p.i][j]))), touch: e.pointerType === 'touch' }; return; }
      clearSel(); act = { kind: 'lasso', p, id: e.pointerId, poly: [[x, y]], touch: e.pointerType === 'touch' }; return;
    }
    if (st.tool === 'eraser') { act = { kind: 'erase', p, id: e.pointerId, hit: false, touch: e.pointerType === 'touch' }; erase(p, x, y, act); return; }
    const isM = st.tool === 'marker', s = { t: isM ? 'marker' : 'pen', c: isM ? MARKS[st.mark] : PENS[st.pen], w: isM ? MARK_W[st.markW] : PEN_W[st.penW], pts: [[x, y, pr]] };
    (pages[p.i] ||= []).push(s);
    act = { kind: 'draw', p, id: e.pointerId, s, lastMove: performance.now(), hold: 0, straight: false, touch: e.pointerType === 'touch', hx: x, hy: y };
    armHold(); redraw(p);
  }, { passive: false });
  scroller.addEventListener('pointermove', (e) => {
    const t = touches.get(e.pointerId);
    if (t) { const dy = e.clientY - t.y, dx = e.clientX - t.x, now = performance.now(); scroller.scrollTop -= dy; scroller.scrollLeft -= dx; t.v = dy / Math.max(1, now - t.t); t.y = e.clientY; t.x = e.clientX; t.t = now; return; }
    if (!act || e.pointerId !== act.id) return; e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e], p = act.p;
    for (const ev of (evs.length ? evs : [e])) {
      const [x, y] = toPage(p, ev);
      if (act.kind === 'draw') {
        const pts = act.s.pts, last = pts[pts.length - 1];
        if (act.straight) { pts[pts.length - 1] = [x, y, last[2]]; continue; }
        if (Math.hypot(x - last[0], y - last[1]) < .7) continue;
        pts.push([x, y, ev.pointerType === 'pen' ? Math.max(.05, ev.pressure || last[2]) : .5]);
        if (Math.hypot(x - act.hx, y - act.hy) > 4) { act.lastMove = performance.now(); act.hx = x; act.hy = y; armHold(); }
      } else if (act.kind === 'erase') erase(p, x, y, act);
      else if (act.kind === 'lasso') act.poly.push([x, y]);
      else if (act.kind === 'move') moveSel(x - act.x0, y - act.y0, act);
      else if (act.kind === 'scale') scaleSel(x, y, act);
    }
    if (act.kind === 'draw') drawLive(); else if (act.kind === 'lasso') redraw(p, (g) => lassoPath(g, act.poly, p));
  }, { passive: false });
  const end = (e) => {
    const t = touches.get(e.pointerId);
    if (t) { touches.delete(e.pointerId); if (!touches.size && Math.abs(t.v) > .3) glide(t.v * 16); return; }
    if (e.pointerType === 'pen') penDown = false;
    if (!act || e.pointerId !== act.id) return; const a = act; act = null; clearTimeout(a.hold);
    if (e.type === 'pointercancel' && a.kind === 'draw') { pages[a.p.i].pop(); redraw(a.p); return; }
    if (a.kind === 'draw') { if (a.s.pts.length === 1 && a.s.t === 'pen') a.s.pts[0][2] = Math.max(.4, a.s.pts[0][2]); redraw(a.p); commit(); }
    else if (a.kind === 'erase') { if (a.hit) commit(); }
    else if (a.kind === 'lasso') { pickLasso(a.p, a.poly); redraw(a.p); }
    else if (a.kind === 'move' || a.kind === 'scale') { if (a.changed) commit(); }
  };
  scroller.addEventListener('pointerup', end); scroller.addEventListener('pointercancel', end);
  const cancelAct = () => { if (act && act.kind === 'draw') { pages[act.p.i].pop(); redraw(act.p); } act = null; };
  let momentum = 0;
  function glide(v) { momentum = v; const step = () => { if (Math.abs(momentum) < .4) return; scroller.scrollTop -= momentum; momentum *= .94; requestAnimationFrame(step); }; requestAnimationFrame(step); }
  scroller.addEventListener('wheel', () => { momentum = 0; }, { passive: true });

  // Live-Strich: nur das letzte Stück zeichnen (schnell)
  function drawLive() {
    const a = act, p = a.p, g = p.ink.getContext('2d'), s = a.s, n = s.pts.length;
    if (s.t === 'marker' || a.straight) { redraw(p); return; }   // Marker (durchsichtig) und gerade Linie: komplett neu
    g.setTransform(p.sc, 0, 0, p.sc, 0, 0); g.lineCap = 'round'; g.strokeStyle = s.c;
    for (let i = Math.max(1, a.drawn || 1); i < n; i++) { const q = s.pts[i - 1], r = s.pts[i]; g.lineWidth = (pw(s, q[2]) + pw(s, r[2])) / 2; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(r[0], r[1]); g.stroke(); }
    a.drawn = n;
  }
  // Halten macht gerade: nach 0,55 s ohne Bewegung wird der Strich zur Linie (Endpunkt folgt danach weiter dem Stift)
  function armHold() {
    if (!act || act.kind !== 'draw') return; clearTimeout(act.hold); const a = act;
    a.hold = setTimeout(() => {
      if (act !== a || a.straight) return; const p = a.s.pts, d = Math.hypot(p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]);
      let len = 0; for (let i = 1; i < p.length; i++) len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (d < 25 || len > d * 1.6) return;   // nur fast gerade Striche begradigen (keine Schrift)
      const avg = p.reduce((s, q) => s + q[2], 0) / p.length; a.s.pts = [[p[0][0], p[0][1], avg], [p[p.length - 1][0], p[p.length - 1][1], avg]]; a.straight = true; redraw(a.p);
    }, 550);
  }

  // ---------- Radierer ----------
  const segD = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((px - a[0]) * dx + (py - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
  function hitStroke(s, x, y, r) { const p = s.pts, rr = r + s.w / 2; if (p.length === 1) return Math.hypot(p[0][0] - x, p[0][1] - y) < rr; for (let i = 1; i < p.length; i++) if (segD(x, y, p[i - 1], p[i]) < rr) return true; return false; }
  function erase(p, x, y, a) { const list = pages[p.i]; if (!list) return; const r = 9, n = list.length; pages[p.i] = list.filter((s) => !hitStroke(s, x, y, r)); if (pages[p.i].length !== n) { a.hit = true; redraw(p); } }

  // ---------- Lasso ----------
  function lassoPath(g, poly, p) { g.save(); g.setLineDash([6 / p.k, 5 / p.k]); g.lineWidth = 1.4 / p.k; g.strokeStyle = '#2f6bff'; g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.restore(); }
  const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const inBox = (b, x, y, m = 0) => x >= b.x0 - m && x <= b.x1 + m && y >= b.y0 - m && y <= b.y1 + m;
  function pickLasso(p, poly) {
    if (poly.length < 4) return; const list = pages[p.i] || [], idx = [];
    list.forEach((s, j) => { const n = s.pts.filter(([x, y]) => inPoly(x, y, poly)).length; if (n >= Math.max(1, s.pts.length * .6)) idx.push(j); });
    if (!idx.length) return; sel = { pi: p.i, idx }; placeSel();
  }
  const selEl = h('div', { class: 'iesel', hidden: true }), selBar = h('div', { class: 'ieselbar' }), handle = h('div', { class: 'iehandle', title: 'Größe ändern' });
  selEl.append(selBar, handle);
  selBar.append(btn('Löschen', { icon: 'trash', cls: 'sm', onclick: () => { const p = P[sel.pi]; pages[sel.pi] = pages[sel.pi].filter((_, j) => !sel.idx.includes(j)); clearSel(); redraw(p); commit(); } }),
    btn('Duplizieren', { icon: 'copy', cls: 'sm', onclick: () => { const p = P[sel.pi], list = pages[sel.pi], add = sel.idx.map((j) => { const s = JSON.parse(JSON.stringify(list[j])); s.pts.forEach((q) => { q[0] += 24; q[1] += 24; }); return s; }); const n0 = list.length; list.push(...add); sel = { pi: sel.pi, idx: add.map((_, k) => n0 + k) }; redraw(p); placeSel(); commit(); } }));
  for (const t of ['pointerdown']) selBar.addEventListener(t, (e) => e.stopPropagation());
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault(); const p = P[sel.pi]; handle.setPointerCapture(e.pointerId);
    const b = sel.box, orig = sel.idx.map((j) => JSON.parse(JSON.stringify(pages[p.i][j])));
    const mv = (ev) => { const [x, y] = toPage(p, ev), f = Math.max(.15, Math.min(8, Math.max((x - b.x0) / Math.max(1, b.x1 - b.x0), (y - b.y0) / Math.max(1, b.y1 - b.y0)))); sel.idx.forEach((j, k) => { const o = orig[k], s = pages[p.i][j]; s.pts = o.pts.map(([px, py, pr]) => [b.x0 + (px - b.x0) * f, b.y0 + (py - b.y0) * f, pr]); s.w = o.w * Math.sqrt(f); }); redraw(p); placeSel(); };
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); commit(); };
    handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
  function moveSel(dx, dy, a) { const p = a.p; sel.idx.forEach((j, k) => { pages[p.i][j].pts = a.orig[k].pts.map(([x, y, pr]) => [x + dx, y + dy, pr]); }); a.changed = true; redraw(p); placeSel(); }
  function placeSel() {
    if (!sel) { selEl.hidden = true; return; } const p = P[sel.pi], list = sel.idx.map((j) => pages[p.i][j]).filter(Boolean); if (!list.length) { clearSel(); return; }
    const b = sel.box = bboxStrokes(list), m = 6 / p.k; b.x0 -= m; b.y0 -= m; b.x1 += m; b.y1 += m;
    if (selEl.parentNode !== p.box) p.box.append(selEl);
    Object.assign(selEl.style, { left: (b.x0 / L.PW * 100) + '%', top: (b.y0 / L.PH * 100) + '%', width: ((b.x1 - b.x0) / L.PW * 100) + '%', height: ((b.y1 - b.y0) / L.PH * 100) + '%' }); selEl.hidden = false;
  }
  function clearSel() { sel = null; selEl.hidden = true; }

  // ---------- Öffnen / Schließen ----------
  const key = (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); go(e.shiftKey ? 1 : -1); }
    else if (e.key === 'Escape') { if (sel) clearSel(); else close(); }
    else if ((e.key === 'Backspace' || e.key === 'Delete') && sel) { selBar.firstChild.click(); }
  };
  document.addEventListener('keydown', key, true);
  function close() { ro.disconnect(); document.removeEventListener('keydown', key, true); document.documentElement.classList.remove('inked-open'); root.remove(); save(); }
  updBar(); requestAnimationFrame(() => layoutPages());
  return { close };
}
