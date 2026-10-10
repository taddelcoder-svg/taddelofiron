# Epochen

Grand-Strategy im Browser à la Hearts of Iron, epochenübergreifend. Plan und Roadmap: [KONZEPT.md](KONZEPT.md).

## Starten

```
node server.js
```

Läuft auf http://localhost:10500. Lokal ohne Passwort; auf Render sperrt `ZUGANG_PASSWORT` den Zugang.

## Karte neu bauen

Quellen nach `werkzeug/quellen/` laden (nicht im Repo):

- `admin1.geojson`: Natural Earth 10m Admin-1 (`ne_10m_admin_1_states_provinces.geojson`, gemeinfrei)
- `world_1938.geojson`: [historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0)

Dann `npm install` und `npm run karte`. Grenzen, Staaten und Namen für 1936 stehen in `werkzeug/grenzen-1936.js`.

## Lizenz

Die Kartendaten enthalten Grenzschnitte aus historical-basemaps (GPL-3.0), deshalb steht das Projekt unter GPL-3.0 (Volltext in [LICENSE](LICENSE)).

Copyright © 2026 Matteo Kohler. Kartendaten: historical-basemaps © Aourednik u. a. (GPL-3.0), Natural Earth (gemeinfrei).
