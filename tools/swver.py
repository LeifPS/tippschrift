# Service-Worker-Liste aktualisieren: neue js-Dateien aufnehmen, Version aus dem Inhalt neu berechnen.
# Aufruf nach jeder Änderung an public/: python3 tools/swver.py
import re, hashlib, json, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public'))
s = open('sw.js').read()
m = re.search(r'const CORE = (\[.*?\]);', s, re.S); core = json.loads(m.group(1))
core = [c for c in core if c == '/' or os.path.exists('.' + c)]
for f in sorted(os.listdir('js')):
    if f.endswith('.js') and '/js/' + f not in core: core.append('/js/' + f); print('neu', f)
core.sort(key=lambda x: (x != '/', x))
h = hashlib.sha1()
for c in core:
    if c != '/': h.update(open('.' + c, 'rb').read())
h.update(open('index.html', 'rb').read())
s = s.replace(m.group(1), json.dumps(core, indent=0, ensure_ascii=False).replace('\n"', '\n "'))
s = re.sub(r"const VER = 'hs-[0-9a-f]+';", f"const VER = 'hs-{h.hexdigest()[:10]}';", s)
open('sw.js', 'w').write(s)
