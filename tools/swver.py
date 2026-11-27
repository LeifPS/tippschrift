# Service-Worker-Listen aktualisieren (normale App in public/ und Beta in public/beta/): neue js-Dateien aufnehmen,
# Version aus dem Inhalt neu berechnen. Aufruf nach jeder Änderung an public/: python3 tools/swver.py
import re, hashlib, json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')

def run(d, base, pre):
    os.chdir(os.path.join(ROOT, d))
    s = open('sw.js').read()
    m = re.search(r'const CORE = (\[.*?\]);', s, re.S); core = json.loads(m.group(1))
    rel = lambda c: '.' + c[len(base) - 1:]
    core = [c for c in core if c == base or os.path.exists(rel(c))]
    for f in sorted(os.listdir('js')):
        if f.endswith('.js') and base + 'js/' + f not in core: core.append(base + 'js/' + f); print(d or '.', 'neu', f)
    core.sort(key=lambda x: (x != base, x))
    h = hashlib.sha1()
    for c in core:
        if c != base: h.update(open(rel(c), 'rb').read())
    h.update(open('index.html', 'rb').read()); h.update(open('sw.js', 'rb').read().split(b'const CORE')[1].split(b'];', 1)[1])
    s = s.replace(m.group(1), json.dumps(core, indent=0, ensure_ascii=False).replace('\n"', '\n "'))
    s = re.sub(r"const VER = '" + pre + r"-[0-9a-f]+';", f"const VER = '{pre}-{h.hexdigest()[:10]}';", s)
    open('sw.js', 'w').write(s)

run('', '/', 'hs')
if os.path.exists(os.path.join(ROOT, 'beta', 'sw.js')): run('beta', '/beta/', 'tsb')
