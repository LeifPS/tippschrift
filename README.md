# Tippschrift

Text tippen, in der eigenen Handschrift bekommen – mit Formeln, Graphen, Tabellen, Noten und mehr. Export als PDF, Bild oder echte Stiftstriche für GoodNotes.
Läuft komplett im Browser (installierbar, offline nutzbar), kein Konto.

- **App:** https://tippschrift.de (früher „STools“ auf st.leifps.de)
- **Textformat für KIs:** https://tippschrift.de/hdf

## Aufbau
- `public/` – die App (statische Dateien, Service Worker `sw.js`)
- `src/worker.js` – Cloudflare Worker: liefert die App aus, Weiterleitungen der Zweit-Domains, Umzugsseite auf den alten Adressen, `/hdf`
- `src/hsapi.js` – die zwei freiwilligen Schnittstellen: Titelvorschlag (Workers AI) und verschlüsselter Abgleich zwischen Geräten (D1)
- `tools/swver.py` – nach Änderungen an `public/` ausführen: aktualisiert Dateiliste und Version des Service Workers
- `test/` – `npm test`

## Domains (im Cloudflare-Dashboard beim Worker „tippschrift“ als benutzerdefinierte Domains)
tippschrift.de, www.tippschrift.de, tippschrift.com, www.tippschrift.com, tippschrift.info, www.tippschrift.info, tippschrift.store, www.tippschrift.store, st.leifps.de, handschrift.leifps.de
