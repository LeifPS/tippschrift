// HDF-Hilfen im Textfeld (Beta):
//  1) Vorschläge: Wer „[“ tippt, bekommt eine Liste aller Elemente mit Kurzbeschreibung; innerhalb eines Elements
//     werden beim Tippen am Zeilenanfang die passenden Eigenschaften vorgeschlagen. Ein Tipp fügt ein Gerüst ein.
//  2) Formulare: Steht der Cursor in einem Graphen, einer Tabelle usw., erscheint „Bearbeiten“. Das Formular schreibt
//     den HDF-Text zurück – Zeilen, die das Formular nicht kennt, bleiben unverändert an ihrem Platz.
import { h } from './util.js';
import { btn, sheet, ic } from './ui.js';
import { normEl, normKey, splitBar, isColor } from './hdf.js';

// ---------------- Katalog ----------------
// s = Gerüst; ‹…› = wird nach dem Einfügen markiert (sofort überschreibbar)
export const CATALOG = [
  { n: 'titel', d: 'Überschrift des Blatts', c: 'Text', s: '[titel]‹Titel›[/titel]' },
  { n: 'ueberschrift', d: 'Zwischenüberschrift', c: 'Text', s: '[ueberschrift]‹Überschrift›[/ueberschrift]' },
  { n: 'beispiel', d: 'Kasten mit Titel, z. B. Merksatz', c: 'Text', s: '[beispiel]\ntitel: ‹Merke›\nText\n[/beispiel]' },
  { n: 'aufgabe', d: 'Nummerierte Aufgabe', c: 'Text', s: '[aufgabe]\nnummer: ‹1›\nAufgabentext\n[/aufgabe]' },
  { n: 'antwort', d: 'Leeres Feld zum Selbst-Ausfüllen', c: 'Text', s: '[antwort]\nlinien: ‹4›\n[/antwort]' },
  { n: 'zitat', d: 'Zitat mit Quelle', c: 'Text', s: '[zitat]\nquelle: ‹Quelle›\nText\n[/zitat]' },
  { n: 'liste', d: 'Aufzählung oder Nummerierung', c: 'Text', s: '[liste]\ntyp: nummeriert\n[eintrag]‹Erster Punkt›[/eintrag]\n[eintrag]Zweiter Punkt[/eintrag]\n[/liste]' },
  { n: 'spalten', d: 'Inhalt nebeneinander', c: 'Layout', s: '[spalten]\n[spalte]\n‹Links›\n[/spalte]\n[spalte]\nRechts\n[/spalte]\n[/spalten]' },
  { n: 'gruppe', d: 'Inhalt mit Rahmen zusammenfassen', c: 'Layout', s: '[gruppe]\nrand: ja\n‹Inhalt›\n[/gruppe]' },
  { n: 'abstand', d: 'Freier Platz', c: 'Layout', s: '[abstand]\nhoehe: ‹10mm›\n[/abstand]' },
  { n: 'trennlinie', d: 'Waagerechte Linie', c: 'Layout', s: '[trennlinie]' },
  { n: 'seitenumbruch', d: 'Neue Seite beginnen', c: 'Layout', s: '[seitenumbruch]' },
  { n: 'formel', d: 'Abgesetzte Formel', c: 'Mathe', s: '[formel]\n‹a^2 + b^2 = c^2›\n[/formel]' },
  { n: 'gleichung', d: 'Umformungen am = ausgerichtet', c: 'Mathe', s: '[gleichung]\nzeile: ‹2x + 3 = 7› | -3\nzeile: 2x = 4 | :2\nzeile: x = 2\n[/gleichung]' },
  { n: 'rechenweg', d: 'Schritte mit Hinweisen', c: 'Mathe', s: '[rechenweg]\ntitel: ‹Nullstellen›\nschritt: x^2 - 4 = 0 | +4\nschritt: x = ±2\n[/rechenweg]' },
  { n: 'bruch', d: 'Großer Bruch', c: 'Mathe', s: '[bruch]\nzaehler: ‹a+b›\nnenner: 2\n[/bruch]' },
  { n: 'wurzel', d: 'Wurzel', c: 'Mathe', s: '[wurzel]\nausdruck: ‹x^2+1›\n[/wurzel]' },
  { n: 'graph', d: 'Koordinatensystem mit Funktionen', c: 'Mathe', s: '[graph titel="‹Funktionen›"]\nxbereich: -5..5\nybereich: -5..5\nfunktion: x^2-2 | blau | name=f(x)\nnullstellen: ja\n[/graph]', form: true },
  { n: 'geometrie', d: 'Figuren, Spiegeln, Drehen, Strecken', c: 'Mathe', s: '[geometrie titel="‹Spiegelung›"]\nxbereich: -6..6\nybereich: -1..6\nfigur: A(1,1) B(4,1) C(2,4) | blau | ABC\nabbildung: ABC | spiegelung | achse=y\n[/geometrie]', form: true },
  { n: 'wertetabelle', d: 'Werte einer Funktion berechnen', c: 'Mathe', s: '[wertetabelle]\nfunktion: ‹x^2›\nxvon: -3\nxbis: 3\nschritt: 1\n[/wertetabelle]', form: true },
  { n: 'tabelle', d: 'Tabelle mit Kopfzeile', c: 'Daten', s: '[tabelle]\nkopf: ‹Spalte 1› | Spalte 2\nzeile: a | b\nzeile: c | d\n[/tabelle]', form: true },
  { n: 'diagramm', d: 'Balken-, Kreis- oder Liniendiagramm', c: 'Daten', s: '[diagramm titel="‹Diagramm›"]\ntyp: balken\nwert: A | 3 | blau\nwert: B | 5 | rot\n[/diagramm]', form: true },
  { n: 'streudiagramm', d: 'Messpunkte mit Ausgleichsgerade', c: 'Daten', s: '[streudiagramm titel="‹Messwerte›"]\npunkt: 1 | 2\npunkt: 2 | 4\npunkt: 3 | 5\ntrend: ja\n[/streudiagramm]', form: true },
  { n: 'vokabeln', d: 'Vokabelliste in zwei Spalten', c: 'Lernen', s: '[vokabeln]\n‹house› = Haus\ntree = Baum\n[/vokabeln]' },
  { n: 'zeitstrahl', d: 'Ereignisse auf einer Zeitachse', c: 'Schaubild', s: '[zeitstrahl]\nereignis: ‹1914› | Beginn Erster Weltkrieg\nereignis: 1918 | Ende\n[/zeitstrahl]' },
  { n: 'ablauf', d: 'Flussdiagramm mit Pfeilen', c: 'Schaubild', s: '[ablauf]\npfeil: ‹Start› -> Schritt -> Ende\n[/ablauf]' },
  { n: 'mindmap', d: 'Thema mit Zweigen', c: 'Schaubild', s: '[mindmap]\nzentrum: ‹Thema›\nzweig: Idee 1 | Punkt A; Punkt B | blau\nzweig: Idee 2 | Punkt C | rot\n[/mindmap]' },
  { n: 'mengen', d: 'Venn-Diagramm', c: 'Schaubild', s: '[mengen]\nmenge: ‹A› | blau | 1; 2\nmenge: B | rot | 4; 5\nschnitt: A,B | 3\n[/mengen]' },
  { n: 'baum', d: 'Baumdiagramm, z. B. Wahrscheinlichkeiten', c: 'Schaubild', s: '[baum]\npfeil: ‹Start› -> A | 0,5\npfeil: Start -> B | 0,5\n[/baum]' },
  { n: 'pyramide', d: 'Stufen von oben nach unten', c: 'Schaubild', s: '[pyramide]\nstufe: ‹Spitze›\nstufe: Mitte\nstufe: Basis\n[/pyramide]' },
  { n: 'kreislauf', d: 'Stufen im Kreis mit Pfeilen', c: 'Schaubild', s: '[kreislauf]\nstufe: ‹Verdunstung›\nstufe: Wolken\nstufe: Regen\n[/kreislauf]' },
  { n: 'schaltung', d: 'Schaltplan (Physik)', c: 'Naturwiss.', s: '[schaltung titel="‹Stromkreis›"]\nbauteil: batterie | 9 V\nbauteil: schalter | S\nbauteil: lampe | L\n[/schaltung]', form: true },
  { n: 'reaktion', d: 'Reaktionsgleichung (Chemie)', c: 'Naturwiss.', s: '[reaktion]\ngleichung: ‹2 H2 + O2 -> 2 H2O›\n[/reaktion]', form: true },
  { n: 'strukturformel', d: 'Strukturformel aus Zeichen', c: 'Naturwiss.', s: '[strukturformel]\n‹H - O - H›\n[/strukturformel]' },
  { n: 'noten', d: 'Noten in deiner Handschrift', c: 'Musik', s: '[noten]\n‹c4 d e f | g2 g›\n[/noten]' },
];
// Eigenschaften je Element (für die Vorschläge am Zeilenanfang)
const PROPS = {
  graph: ['xbereich', 'ybereich', 'funktion', 'punkt', 'strecke', 'gerade', 'kreis', 'label', 'nullstellen', 'extrema', 'schnittpunkte', 'legende', 'zahlen', 'raster', 'einheit', 'xbeschriftung', 'ybeschriftung', 'titel'],
  geometrie: ['xbereich', 'ybereich', 'figur', 'abbildung', 'punkt', 'strecke', 'gerade', 'kreis', 'titel'],
  table: ['kopf', 'zeile', 'titel', 'rahmen'], valuetable: ['funktion', 'xvon', 'xbis', 'schritt', 'nachkommastellen', 'kopf', 'richtung'],
  chart: ['typ', 'wert', 'kategorien', 'reihe', 'einheit', 'werte', 'prozent', 'legende', 'ymax', 'titel'], scatter: ['punkt', 'xbeschriftung', 'ybeschriftung', 'xbereich', 'ybereich', 'trend', 'titel'],
  circuit: ['bauteil', 'parallel', 'titel'], chem: ['gleichung'], task: ['nummer', 'punkte', 'titel'], answer: ['linien', 'hoehe', 'kaestchen'], example: ['titel'], note: ['titel'],
  timeline: ['ereignis', 'massstab', 'titel'], flow: ['knoten', 'pfeil', 'richtung', 'titel'], tree: ['pfeil', 'richtung', 'titel'], mindmap: ['zentrum', 'zweig', 'titel'], venn: ['menge', 'schnitt', 'titel'],
  calculation: ['titel', 'schritt'], equation: ['zeile'], list: ['typ'], quote: ['quelle'], spacer: ['hoehe'], group: ['rand'],
};
const ALN = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

// ---------------- Block unter dem Cursor ----------------
const OPEN = /^\s*\[\s*([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß-]*)([^\]]*)\]\s*$/, CLOSE = /^\s*\[\s*\/\s*([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß-]*)\s*\]\s*$/;
/** Sucht das innerste Element (mit eigener Zeile für [x] und [/x]) um die Zeile li. Gibt {name, raw, open, close} (Zeilennummern) */
export function blockAt(lines, li) {
  const st = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i], o = OPEN.exec(L), c = !o && CLOSE.exec(L);
    if (o && !CLOSE.test(L)) st.push({ raw: o[1], name: normEl(o[1]), attrs: o[2], open: i });
    else if (c) {
      const n = normEl(c[1]); let k = st.length - 1; while (k >= 0 && st[k].name !== n) k--;
      if (k >= 0) { const b = st[k]; st.length = k; b.close = i; if (b.open <= li && li <= i) return b; }
    }
    if (i >= li && !st.length) return null;
  }
  return null;
}

// ---------------- Formulare ----------------
const COLORS = [['', 'automatisch'], ['schwarz', 'Schwarz'], ['blau', 'Blau'], ['rot', 'Rot'], ['gruen', 'Grün'], ['orange', 'Orange'], ['lila', 'Lila'], ['grau', 'Grau']];
const STYLES = [['', 'durchgezogen'], ['gestrichelt', 'gestrichelt'], ['gepunktet', 'gepunktet']];
const BAUTEILE = ['batterie', 'quelle', 'widerstand', 'lampe', 'schalter', 'schalter zu', 'motor', 'generator', 'diode', 'led', 'kondensator', 'spule', 'sicherung', 'amperemeter', 'voltmeter'].map((x) => [x, x]);
const ARTEN = ['spiegelung', 'punktspiegelung', 'drehung', 'streckung', 'verschiebung'].map((x) => [x, x]);
// Feldarten: kv (eine Zeile „k: v“), bool, rows (wiederholte Zeilen „k: a | b | …“), attrtitel (titel="…" im Kopf)
// Spalten von rows: pos (nach Reihenfolge), color (irgendein Farbwort), style (Linienart), kv:name (name=…), rest (alles Übrige)
const F = {
  graph: [{ t: 'attrtitel' }, { t: 'kv', k: 'xbereich', l: 'x-Bereich', ph: '-5..5' }, { t: 'kv', k: 'ybereich', l: 'y-Bereich', ph: '-5..5' },
    { t: 'rows', k: 'funktion', l: 'Funktionen', cols: [{ c: 'pos', l: 'Term', ph: 'x^2-4', w: 3 }, { c: 'color', l: 'Farbe' }, { c: 'style', l: 'Linie', w: 1.4 }, { c: 'kv', key: 'name', l: 'Name', ph: 'f(x)' }] },
    { t: 'rows', k: 'punkt', l: 'Punkte', cols: [{ c: 'pos', l: 'x', ph: '1' }, { c: 'pos', l: 'y', ph: '2' }, { c: 'pos', l: 'Name', ph: 'A' }, { c: 'color', l: 'Farbe' }] },
    { t: 'bool', k: 'nullstellen', l: 'Nullstellen beschriften' }, { t: 'bool', k: 'extrema', l: 'Hoch- und Tiefpunkte' }, { t: 'bool', k: 'schnittpunkte', l: 'Schnittpunkte' },
    { t: 'bool', k: 'legende', l: 'Legende statt Namen an den Kurven' }, { t: 'bool', k: 'zahlen', l: 'Zahlen an den Achsen', def: true }],
  geometrie: [{ t: 'attrtitel' }, { t: 'kv', k: 'xbereich', l: 'x-Bereich', ph: '-6..6' }, { t: 'kv', k: 'ybereich', l: 'y-Bereich', ph: '-6..6' },
    { t: 'rows', k: 'figur', l: 'Figuren', cols: [{ c: 'pos', l: 'Ecken', ph: 'A(1,1) B(4,1) C(2,4)', w: 3 }, { c: 'color', l: 'Farbe' }, { c: 'pos', l: 'Name', ph: 'ABC' }] },
    { t: 'rows', k: 'abbildung', l: 'Abbildungen', cols: [{ c: 'pos', l: 'Figur', ph: 'ABC' }, { c: 'pos', l: 'Art', sel: ARTEN }, { c: 'rest', l: 'Angaben', ph: 'achse=y | hilfslinien', w: 2 }] },
    { t: 'bool', k: 'zahlen', l: 'Zahlen an den Achsen', def: true }],
  valuetable: [{ t: 'kv', k: 'funktion', l: 'Funktion', ph: 'x^2' }, { t: 'kv', k: 'xvon', l: 'x von', ph: '-3' }, { t: 'kv', k: 'xbis', l: 'x bis', ph: '3' }, { t: 'kv', k: 'schritt', l: 'Schritt', ph: '1' },
    { t: 'kv', k: 'nachkommastellen', l: 'Nachkommastellen', ph: '2' }, { t: 'kv', k: 'kopf', l: 'Kopfzeile', ph: 'x | f(x)' }, { t: 'kv', k: 'richtung', l: 'Richtung', sel: [['', 'waagerecht'], ['senkrecht', 'senkrecht']] }],
  chart: [{ t: 'attrtitel' }, { t: 'kv', k: 'typ', l: 'Art', sel: [['balken', 'Balken'], ['kreis', 'Kreis'], ['linie', 'Linie']] },
    { t: 'rows', k: 'wert', l: 'Werte', cols: [{ c: 'pos', l: 'Name', ph: 'Mathe', w: 2 }, { c: 'pos', l: 'Wert', ph: '12' }, { c: 'color', l: 'Farbe' }] },
    { t: 'kv', k: 'einheit', l: 'Einheit', ph: 'Schüler' }, { t: 'bool', k: 'werte', l: 'Zahlen an den Balken' }, { t: 'bool', k: 'prozent', l: 'Prozent (Kreis)' }, { t: 'bool', k: 'legende', l: 'Legende' }],
  scatter: [{ t: 'attrtitel' }, { t: 'rows', k: 'punkt', l: 'Messpunkte', cols: [{ c: 'pos', l: 'x', ph: '1' }, { c: 'pos', l: 'y', ph: '2' }] },
    { t: 'kv', k: 'xbeschriftung', l: 'x-Achse', ph: 'cm' }, { t: 'kv', k: 'ybeschriftung', l: 'y-Achse', ph: 'kg' }, { t: 'kv', k: 'xbereich', l: 'x-Bereich', ph: 'automatisch' }, { t: 'kv', k: 'ybereich', l: 'y-Bereich', ph: 'automatisch' },
    { t: 'bool', k: 'trend', l: 'Ausgleichsgerade mit Gleichung' }],
  circuit: [{ t: 'attrtitel' }, { t: 'rows', k: 'bauteil', l: 'Bauteile in Reihe', cols: [{ c: 'pos', l: 'Bauteil', sel: BAUTEILE }, { c: 'pos', l: 'Beschriftung', ph: 'R1', w: 2 }] }],
  chem: [{ t: 'rows', k: 'gleichung', l: 'Gleichungen', cols: [{ c: 'pos', l: 'Gleichung', ph: '2 H2 + O2 -> 2 H2O', w: 3 }, { c: 'pos', l: 'Hinweis', ph: '', w: 2 }] }],
};
const FORM_OF = { graph: 'graph', geometrie: 'geometrie', geometry: 'geometrie', valuetable: 'valuetable', chart: 'chart', scatter: 'scatter', circuit: 'circuit', chem: 'chem', table: 'table' };
export const formFor = (name, raw) => (ALN(raw || '') === 'geometrie' ? 'geometrie' : FORM_OF[name] || null);
const TITLE = { graph: 'Koordinatensystem', geometrie: 'Geometrie', valuetable: 'Wertetabelle', chart: 'Diagramm', scatter: 'Streudiagramm', circuit: 'Schaltplan', chem: 'Reaktionsgleichung', table: 'Tabelle' };
export const formTitle = (f) => TITLE[f] || 'Element';

const PROP = /^(\s*)([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß -]{0,28}?)\s*[:=]\s?(.*)$/;
const bool = (v) => /^(ja|yes|true|an|on|1|wahr)$/i.test(String(v).trim());
function parseRow(v, cols) {
  const parts = splitBar(v), out = cols.map(() => ''), used = new Set();
  cols.forEach((c, i) => {
    if (c.c === 'color') { const j = parts.findIndex((p, k) => !used.has(k) && k > 0 && isColor(p)); if (j >= 0) { out[i] = parts[j]; used.add(j); } }
    else if (c.c === 'style') { const j = parts.findIndex((p, k) => !used.has(k) && /^(gestrichelt|gepunktet|durchgezogen)$/i.test(p)); if (j >= 0) { out[i] = parts[j]; used.add(j); } }
    else if (c.c === 'kv') { const j = parts.findIndex((p, k) => !used.has(k) && new RegExp('^' + c.key + '\\s*=', 'i').test(p)); if (j >= 0) { out[i] = parts[j].replace(/^[^=]*=\s*/, ''); used.add(j); } }
  });
  let k = 0;
  cols.forEach((c, i) => { if (c.c === 'pos') { while (k < parts.length && used.has(k)) k++; if (k < parts.length) { out[i] = parts[k]; used.add(k); k++; } } });
  const ri = cols.findIndex((c) => c.c === 'rest'), rest = parts.filter((_, j) => !used.has(j));
  if (ri >= 0) out[ri] = rest.join(' | ');
  return { vals: out, extra: ri >= 0 ? [] : rest };
}
function rowText(vals, cols, extra = []) {
  const pos = [], tail = [];
  cols.forEach((c, i) => { const v = String(vals[i] || '').trim(); if (c.c === 'pos') pos.push(v); else if (v) tail.push(c.c === 'kv' ? c.key + '=' + v : v); });
  while (pos.length > 1 && !pos[pos.length - 1]) pos.pop();
  return [...pos, ...tail, ...extra].join(' | ');
}

/** Liest den Block in ein Formular-Modell */
function readModel(lines, b, kind) {
  const body = lines.slice(b.open + 1, b.close), spec = F[kind], m = { title: '', titleAttr: false, kv: {}, rows: {}, extra: {} };
  const ta = /titel\s*=\s*"([^"]*)"/i.exec(b.attrs || ''); if (ta) { m.title = ta[1]; m.titleAttr = true; }
  for (const f of spec) if (f.t === 'rows') { m.rows[f.k] = []; m.extra[f.k] = []; }
  for (const L of body) {
    const p = PROP.exec(L); if (!p) continue; const k = normKey(p[2]);
    const f = spec.find((x) => (x.t === 'kv' || x.t === 'bool' || x.t === 'rows') && normKey(x.k) === k);
    if (!f) { if (k === 'titel' && spec.some((x) => x.t === 'attrtitel') && !m.titleAttr) m.title = p[3].trim(); continue; }
    if (f.t === 'rows') { const r = parseRow(p[3], f.cols); m.rows[f.k].push(r.vals); m.extra[f.k].push(r.extra); }
    else m.kv[f.k] = p[3].trim();
  }
  return m;
}
/** Schreibt das Modell zurück: bekannte Zeilen werden an Ort und Stelle ersetzt, neue angehängt, Unbekanntes bleibt */
function writeModel(lines, b, kind, m) {
  const spec = F[kind], body = lines.slice(b.open + 1, b.close).map((L) => ({ L }));
  const keyOf = (L) => { const p = PROP.exec(L); return p ? normKey(p[2]) : null; };
  let head = lines[b.open];
  if (spec.some((x) => x.t === 'attrtitel')) {
    const t = (m.title || '').replace(/"/g, '”').trim(), had = /titel\s*=\s*"[^"]*"/i.test(head);
    const titleLine = body.findIndex((x) => keyOf(x.L) === 'titel');
    if (titleLine >= 0 && !m.titleAttr) { if (t) body[titleLine].L = body[titleLine].L.replace(/([:=]\s?).*$/, '$1' + t); else body[titleLine].L = null; }
    else if (had) head = t ? head.replace(/titel\s*=\s*"[^"]*"/i, `titel="${t}"`) : head.replace(/\s*titel\s*=\s*"[^"]*"/i, '');
    else if (t) head = head.replace(/\]\s*$/, ` titel="${t}"]`);
  }
  const lastIdx = (k) => { let r = -1; body.forEach((x, i) => { if (x.L != null && keyOf(x.L) === normKey(k)) r = i; }); return r; };
  const ins = [];   // [Index, Zeile] zum Einfügen
  for (const f of spec) {
    if (f.t === 'kv' || f.t === 'bool') {
      let v = f.t === 'bool' ? (m.kv[f.k] === true ? 'ja' : m.kv[f.k] === false ? 'nein' : '') : String(m.kv[f.k] || '').trim();
      if (f.t === 'bool' && ((f.def && m.kv[f.k] !== false) || (!f.def && m.kv[f.k] !== true))) v = '';   // Standardwert: Zeile weglassen
      const i = lastIdx(f.k);
      if (i >= 0) body[i].L = v ? body[i].L.replace(/^(\s*[^:=]+[:=]\s?).*$/, '$1' + v) : null;
      else if (v) ins.push([-1, f.k + ': ' + v]);
    } else if (f.t === 'rows') {
      const rows = m.rows[f.k].filter((r) => r.some((x) => String(x || '').trim())), idx = [];
      body.forEach((x, i) => { if (x.L != null && keyOf(x.L) === normKey(f.k)) idx.push(i); });
      rows.forEach((r, j) => { const t = f.k + ': ' + rowText(r, f.cols, m.extra[f.k][j] || []); if (j < idx.length) body[idx[j]].L = body[idx[j]].L.replace(/^(\s*).*/, '$1') + t; else ins.push([idx.length ? idx[idx.length - 1] : -1, t, j]); });
      for (let j = rows.length; j < idx.length; j++) body[idx[j]].L = null;
    }
  }
  // Einfügen: hinter die letzte Zeile derselben Art, sonst ans Ende
  const out = [];
  body.forEach((x, i) => { if (x.L != null) out.push(x.L); for (const [at, t] of ins.filter((q) => q[0] === i)) out.push(t); });
  for (const [at, t] of ins.filter((q) => q[0] === -1)) out.push(t);
  return [head, ...out, lines[b.close]];
}

// Tabelle: eigenes Raster-Formular
function readTable(lines, b) {
  const body = lines.slice(b.open + 1, b.close), rows = []; let head = null, title = '', rahmen = '';
  for (const L of body) { const p = PROP.exec(L); if (!p) continue; const k = normKey(p[2]);
    if (k === 'kopf') head = splitBar(p[3]); else if (k === 'zeile') rows.push(splitBar(p[3])); else if (k === 'titel') title = p[3].trim(); else if (k === 'rahmen') rahmen = p[3].trim(); }
  return { head, rows, title, rahmen };
}
function writeTable(lines, b, t) {
  const body = lines.slice(b.open + 1, b.close).filter((L) => { const p = PROP.exec(L); return !(p && ['kopf', 'zeile', 'titel', 'rahmen'].includes(normKey(p[2]))); });
  const j = (r) => r.map((x) => String(x || '').trim()).join(' | ').trimEnd();
  const out = [];
  if (t.title.trim()) out.push('titel: ' + t.title.trim());
  if (t.rahmen) out.push('rahmen: ' + t.rahmen);
  if (t.head) out.push('kopf: ' + j(t.head));
  for (const r of t.rows) if (r.some((x) => String(x || '').trim())) out.push('zeile: ' + j(r));
  return [lines[b.open], ...out, ...body, lines[b.close]];
}

const fld = (label, el) => h('label', { class: 'af' }, h('span', null, label), el);
const inp = (v, ph, on) => { const i = h('input', { type: 'text', value: v || '', placeholder: ph || '', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }); i.addEventListener('input', () => on(i.value)); return i; };
const sel = (opts, v, on) => { const s = h('select', null, ...opts.map(([k, t]) => h('option', { value: k, selected: ALN(k) === ALN(v || '') ? true : null }, t))); if (v && !opts.some(([k]) => ALN(k) === ALN(v))) s.prepend(h('option', { value: v, selected: true }, v)); s.addEventListener('change', () => on(s.value)); return s; };

/** Öffnet das Formular für den Block b; apply(newLines) ersetzt die Zeilen b.open..b.close */
export function openForm(lines, b, kind, apply) {
  sheet(formTitle(kind) + ' bearbeiten', (body, api) => {
    body.classList.add('aform');
    if (kind === 'table') {
      const t = readTable(lines, b); let hasHead = !!t.head; if (!t.head) t.head = (t.rows[0] || ['', '']).map(() => '');
      const ncols = () => Math.max(t.head.length, ...t.rows.map((r) => r.length), 1);
      const grid = h('div', { class: 'agrid' });
      const draw = () => {
        const n = ncols(); grid.style.gridTemplateColumns = `repeat(${n}, minmax(80px, 1fr)) 34px`;
        const cell = (row, i, cls) => { const c = inp(row[i], '', (v) => { row[i] = v; }); c.className = cls || ''; return c; };
        grid.replaceChildren(
          ...(hasHead ? [...Array.from({ length: n }, (_, i) => cell(t.head, i, 'ahead')), h('span')] : []),
          ...t.rows.flatMap((r, ri) => [...Array.from({ length: n }, (_, i) => cell(r, i)), btn('Zeile löschen', { icon: 'trash', cls: 'icon ghost sm', onclick: () => { t.rows.splice(ri, 1); draw(); } })]));
      };
      draw();
      body.append(fld('Titel (optional)', inp(t.title, '', (v) => { t.title = v; })),
        h('label', { class: 'acheck' }, (() => { const c = h('input', { type: 'checkbox', checked: hasHead ? true : null }); c.addEventListener('change', () => { hasHead = c.checked; draw(); }); return c; })(), ' Erste Zeile ist Kopfzeile'),
        h('div', { class: 'agridwrap' }, grid),
        h('div', { class: 'row wrap2', style: { gap: '8px', margin: '10px 0' } },
          btn('Zeile', { icon: 'plus', cls: 'sm', onclick: () => { t.rows.push(Array(ncols()).fill('')); draw(); } }),
          btn('Spalte', { icon: 'plus', cls: 'sm', onclick: () => { t.head.push(''); t.rows.forEach((r) => r.push('')); draw(); } }),
          btn('Spalte entfernen', { cls: 'sm ghost', onclick: () => { if (ncols() < 2) return; t.head.length = Math.min(t.head.length, ncols() - 1); t.rows.forEach((r) => { r.length = Math.min(r.length, ncols() - 1); }); draw(); } })),
        fld('Rahmen', sel([['', 'Standard'], ['ja', 'mit Rahmen'], ['nein', 'ohne Rahmen']], t.rahmen, (v) => { t.rahmen = v; })));
      body.append(h('div', { class: 'aact' }, btn('Abbrechen', { cls: 'ghost', onclick: () => api.close() }), btn('Übernehmen', { cls: 'pri', icon: 'check', onclick: () => { const n = ncols(); const fix = (r) => { const x = r.slice(0, n); while (x.length < n) x.push(''); return x; }; apply(writeTable(lines, b, { ...t, head: hasHead ? fix(t.head) : null, rows: t.rows.map(fix) })); api.close(); } })));
      return;
    }
    const spec = F[kind], m = readModel(lines, b, kind);
    for (const f of spec) {
      if (f.t === 'attrtitel') body.append(fld('Titel (optional)', inp(m.title, '', (v) => { m.title = v; })));
      else if (f.t === 'kv') body.append(fld(f.l, f.sel ? sel(f.sel, m.kv[f.k], (v) => { m.kv[f.k] = v; }) : inp(m.kv[f.k], f.ph, (v) => { m.kv[f.k] = v; })));
      else if (f.t === 'bool') { const cur = m.kv[f.k] == null ? !!f.def : bool(m.kv[f.k]); m.kv[f.k] = cur; const c = h('input', { type: 'checkbox', checked: cur ? true : null }); c.addEventListener('change', () => { m.kv[f.k] = c.checked; }); body.append(h('label', { class: 'acheck' }, c, ' ' + f.l)); }
      else if (f.t === 'rows') {
        const list = h('div', { class: 'arows' }), rows = m.rows[f.k];
        const draw = () => {
          list.replaceChildren(h('div', { class: 'arow ahd', style: { gridTemplateColumns: f.cols.map((c) => (c.w || 1) + 'fr').join(' ') + ' 34px' } }, ...f.cols.map((c) => h('span', null, c.l)), h('span')),
            ...rows.map((r, ri) => h('div', { class: 'arow', style: { gridTemplateColumns: f.cols.map((c) => (c.w || 1) + 'fr').join(' ') + ' 34px' } },
              ...f.cols.map((c, ci) => c.c === 'color' ? sel(COLORS, r[ci], (v) => { r[ci] = v; }) : c.c === 'style' ? sel(STYLES, r[ci], (v) => { r[ci] = v; }) : c.sel ? sel(c.sel, r[ci], (v) => { r[ci] = v; }) : inp(r[ci], c.ph, (v) => { r[ci] = v; })),
              btn('Entfernen', { icon: 'trash', cls: 'icon ghost sm', onclick: () => { rows.splice(ri, 1); m.extra[f.k].splice(ri, 1); draw(); } }))));
        };
        draw();
        body.append(h('div', { class: 'asec' }, h('h4', null, f.l), list, btn('Hinzufügen', { icon: 'plus', cls: 'sm', onclick: () => { rows.push(f.cols.map((c) => (c.sel ? c.sel[0][0] : ''))); m.extra[f.k].push([]); draw(); list.querySelector('.arow:last-child input')?.focus(); } })));
      }
    }
    body.append(h('p', { class: 'xs mut' }, 'Alles, was das Formular nicht kennt, bleibt im Text unverändert erhalten.'),
      h('div', { class: 'aact' }, btn('Abbrechen', { cls: 'ghost', onclick: () => api.close() }), btn('Übernehmen', { cls: 'pri', icon: 'check', onclick: () => { apply(writeModel(lines, b, kind, m)); api.close(); } })));
  }, { wide: true });
}

// ---------------- Vorschläge im Textfeld ----------------
function caretXY(ta, pos) {   // Position des Cursors im Textfeld (über ein unsichtbares Spiegel-Element gemessen)
  const cs = getComputedStyle(ta), d = document.createElement('div');
  for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize', 'wordSpacing'])d.style[p] = cs[p];
  Object.assign(d.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '-9999px' });
  d.textContent = ta.value.slice(0, pos); const s = document.createElement('span'); s.textContent = ta.value.slice(pos, pos + 1) || '.'; d.append(s);
  document.body.append(d); const x = s.offsetLeft, y = s.offsetTop, lh = parseFloat(cs.lineHeight) || 24; d.remove();
  return { x: x - ta.scrollLeft, y: y - ta.scrollTop, lh };
}

/** Hängt Vorschläge und Formular-Knopf an das Textfeld. onEdit(newValue, selStart, selEnd) setzt den Text (mit Rückgängig). */
export function attachAssist(ta, { onEdit }) {
  const wrap = ta.parentNode;   // .tawrap (position: relative)
  const pop = h('div', { class: 'acpop', hidden: true, role: 'listbox' });
  const chip = h('button', { type: 'button', class: 'acchip', hidden: true }, ic('edit'), h('span'));
  wrap.append(pop, chip);
  let items = [], sel = 0, ctx = null, dismissedAt = -1;

  const close = () => { pop.hidden = true; items = []; ctx = null; };
  function choose(i) {
    const it = items[i]; if (!it || !ctx) return;
    const v = ta.value; let ins = it.s, a = ctx.from, e = ta.selectionStart;
    if (ctx.kind === 'prop') ins = it.n + ': ';
    // Rest der Zeile bis „]“ mit ersetzen, wenn schon etwas dahinter steht
    if (ctx.kind === 'el') { const after = v.slice(e).match(/^[\wäöüß-]*\]?/i); if (after) e += after[0].length; }
    let s0 = ins.indexOf('‹'), s1 = ins.indexOf('›'); ins = ins.replace('‹', '').replace('›', '');
    if (s0 < 0) { s0 = s1 = ins.length; } else s1 -= 1;
    const nv = v.slice(0, a) + ins + v.slice(e);
    close(); onEdit(nv, a + s0, a + s1);
  }
  function render() {
    if (!items.length) { close(); return; }
    sel = Math.min(sel, items.length - 1);
    let lastCat = null;
    pop.replaceChildren(...items.flatMap((it, i) => {
      const row = h('div', { class: 'acit' + (i === sel ? ' on' : ''), role: 'option', onpointerdown: (e) => { e.preventDefault(); choose(i); } },
        h('b', null, ctx.kind === 'el' ? '[' + it.n + ']' : it.n + ':'), h('span', null, it.d || ''), it.form ? h('i', { class: 'acf' }, 'Formular') : null);
      const out = []; if (ctx.kind === 'el' && it.c !== lastCat && !ctx.q) { out.push(h('div', { class: 'accat' }, it.c)); lastCat = it.c; }
      out.push(row); return out;
    }));
    const p = caretXY(ta, ctx.from), W = wrap.clientWidth, pw = Math.min(360, W - 16);
    pop.style.width = pw + 'px';
    pop.style.left = Math.max(8, Math.min(p.x + ta.offsetLeft, W - pw - 8)) + 'px';
    const below = p.y + p.lh + ta.offsetTop + 4, room = wrap.clientHeight - below;
    pop.style.maxHeight = Math.max(160, Math.min(320, room > 200 ? room - 8 : p.y - 8)) + 'px';
    pop.style.top = (room > 200 ? below : Math.max(4, p.y + ta.offsetTop - Math.min(320, p.y - 8) - 4)) + 'px';
    pop.hidden = false;
    pop.querySelector('.acit.on')?.scrollIntoView({ block: 'nearest' });
  }
  function update() {
    const v = ta.value, p = ta.selectionStart;
    if (p !== ta.selectionEnd) { close(); return; }
    const ls = v.lastIndexOf('\n', p - 1) + 1, before = v.slice(ls, p);
    let m = /\[([A-Za-zÄÖÜäöüß]*)$/.exec(before);
    if (m && !/\[\//.test(before.slice(m.index)) && dismissedAt !== ls + m.index) {
      const q = ALN(m[1]);
      items = CATALOG.filter((it) => !q || it.n.startsWith(q) || ALN(it.d).includes(q)).sort((a, b) => (q ? (b.n.startsWith(q) - a.n.startsWith(q)) : 0));
      ctx = { kind: 'el', from: ls + m.index, q }; render(); return;
    }
    m = /^(\s*)([a-zäöüß]{1,20})$/i.exec(before);
    if (m) {
      const lines = v.split('\n'), li = v.slice(0, p).split('\n').length - 1, b = blockAt(lines, li);
      if (b && li > b.open) {
        const q = ALN(m[2]), list = (PROPS[ALN(b.raw)] || PROPS[b.name] || []).filter((k) => k.startsWith(q) && k !== q);
        if (list.length) { items = list.map((n) => ({ n })); ctx = { kind: 'prop', from: ls + m[1].length, q }; render(); return; }
      }
    }
    close();
  }
  function updChip() {
    const v = ta.value, li = v.slice(0, ta.selectionStart).split('\n').length - 1, lines = v.split('\n'), b = blockAt(lines, li), kind = b && formFor(b.name, b.raw);
    if (!kind || document.activeElement !== ta && !chip.matches(':hover')) { chip.hidden = true; return; }
    chip.lastChild.textContent = formTitle(kind) + ' bearbeiten'; chip.hidden = false;
    chip.onclick = (e) => { e.preventDefault(); const L = ta.value.split('\n'), bb = blockAt(L, ta.value.slice(0, ta.selectionStart).split('\n').length - 1); if (!bb) return;
      openForm(L, bb, formFor(bb.name, bb.raw), (nl) => { const nv = [...L.slice(0, bb.open), ...nl, ...L.slice(bb.close + 1)].join('\n'); const off = L.slice(0, bb.open).join('\n').length + (bb.open ? 1 : 0); onEdit(nv, off, off); }); };
  }
  ta.addEventListener('input', () => { update(); updChip(); });
  ta.addEventListener('keydown', (e) => {
    if (pop.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); choose(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); if (ctx) dismissedAt = ctx.from; close(); }
  }, true);
  for (const t of ['click', 'keyup', 'focus']) ta.addEventListener(t, (e) => { if (t !== 'keyup' || /Arrow|Home|End/.test(e.key)) { if (t !== 'keyup') close(); } updChip(); });
  ta.addEventListener('blur', () => setTimeout(() => { close(); if (document.activeElement !== ta) chip.hidden = true; }, 150));
  ta.addEventListener('scroll', close);
  chip.addEventListener('pointerdown', (e) => e.preventDefault());   // Fokus im Textfeld lassen
  return { close };
}
