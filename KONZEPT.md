# Epochen – Konzept

Grand-Strategy im Browser à la Hearts of Iron, aber epochenübergreifend.
Eigener Name, eigene Umsetzung. Teil der Spielesammlung von Swimming Lions.

Stand: 2026-09-27

---

## 1. Kernidee

- Man führt **eine Nation** auf einer **Weltkarte aus Provinzen** durch eine historische Epoche.
- Zeit läuft in **Tagen** (Mittelalter: Wochen), pausierbar, Tempo 1–5.
- **„HoI light“**: eine Partie dauert 1–3 Stunden, aber mit **Speicherständen** für längere Kampagnen.
- **Solo gegen KI** und **Online (bis 8 Spieler)** sind gleich wichtig – freie Nationen spielt immer die KI.
- Ein **epochenunabhängiger Kern**: Mittelalter, WW2 usw. sind nur austauschbare **Epochen-Pakete** (Daten), kein eigenes Spiel.

## 2. Epochen

| Epoche | Startjahr | Version | Besonderheit |
|---|---|---|---|
| WW2 | 1936 | **1.0** | Fronten, Panzer, Luftwaffe, Industrie |
| Mittelalter | 1200 | **1.0** | Lehen/Vasallen, Burgen, Belagerungen, Heere statt Divisionen |
| WW1 | 1914 | später | Grabenkrieg, Gas, Blockade |
| Antike | 100 n. Chr. | später | Legionen, Provinzverwaltung, Straßen |
| Napoleon | 1805 | später | Koalitionen, Linieninfanterie, Kavallerie |
| Kalter Krieg | 1962 | später | Stellvertreterkriege, Atomdrohung als Abschreckung, Einflusszonen |

WW2 und Mittelalter zuerst, weil sie am weitesten auseinanderliegen – wenn beide mit demselben Kern laufen, ist der Kern wirklich epochenunabhängig.

Pro Epoche eventuell mehrere **Szenarien** (z. B. WW2: „1936 Volle Kampagne“, „1939 Kriegsbeginn“).

## 3. Karte

- **Ganze Welt**, ca. 800–1500 Provinzen (Europa feiner, Ozeanien/Sibirien grober).
- **Provinzen sind epochenübergreifend dieselben** (eine Geometrie), nur Besitzer, Gebäude und Werte kommen aus dem Epochen-Paket.
- **Historisch genaue Grenzen** pro Startjahr, Quelle: *historical-basemaps* (GeoJSON pro Jahr, GPL → passt zum öffentlichen Repo, Lizenz im Repo vermerken). Werkzeug-Skript ordnet jede Provinz dem Staat zu, der ihren Mittelpunkt besitzt; danach Handkorrektur.
- Seezonen für Marine/Transporte, Meerengen als Engpässe.
- Gelände pro Provinz: Ebene, Wald, Hügel, Berg, Sumpf, Wüste, Stadt, Fluss an Kanten.

### Kartenstil „G – Epochen-Hybrid“

Eine Geometrie, der **Look wechselt mit der Epoche** (nur Farben, Schriften, Symbole, Hintergrundtextur):

| Stil | Epochen |
|---|---|
| Pergament (Tinte, Burgen-Symbole, schraffiertes Meer, Serifenschrift) | Mittelalter, Antike |
| Generalstab (Papier, Gitternetz, Einheiten-Counter, rote Frontlinie) | WW1, WW2 |
| Aquarell-Atlas | Napoleon |
| Lagezentrum (dunkel, Linienzeichnung, Radar-Symbole) | Kalter Krieg |

Plus **Lesbarkeits-Schalter**: jederzeit auf „flach modern“ (satte Nationalfarben, klare Grenzen) umschaltbar.

Weitere Kartenmodi (wie HoI): politisch, Gelände, Versorgung, Industrie, Bündnisse.

Rendering: 2D-Canvas, Provinzen vorab zu Pfaden trianguliert/vereinfacht, **Level of Detail** beim Zoomen (weit weg nur Staaten, nah Provinzen + Einheiten). Zoom/Pan per Maus, Trackpad und Touch.

## 4. Spielsysteme (Kern, epochenunabhängig)

### 4.1 Wirtschaft
- **Zwei Fabrik-/Werkstatt-Typen**: zivil (baut Gebäude) und militärisch (produziert Ausrüstung).
  - Mittelalter: „Handwerk“ und „Schmieden“.
- **3 Rohstoffe pro Epoche** (WW2: Stahl, Öl, Gummi · Mittelalter: Eisen, Holz, Pferde), kein Handelsrouten-Micromanagement, nur einfache Handelsabkommen.
- **Bauschlange** für Gebäude (Fabriken, Festungen, Flugplätze/Burgen, Infrastruktur).
- **Mannstärke** aus Bevölkerung, beeinflusst durch Wehrpflicht-Gesetze.

### 4.2 Armee
- **Einheiten aus Vorlagen** (WW2: Division aus Bataillonen · Mittelalter: Heer aus Rittern, Fußvolk, Bogenschützen, Belagerungsgerät).
- Steuerung wie HoI:
  - **Front ziehen** (Linie entlang der Grenze), Einheiten verteilen sich selbst.
  - **Angriffspfeil** zeichnen, Einheiten greifen entlang an.
  - Oder einzelne Einheiten direkt bewegen.
- **Generäle/Heerführer** mit 1–2 Eigenschaften, gruppieren mehrere Einheiten.

### 4.3 Kampf
- Automatisch, stündlich/täglich abgerechnet.
- Werte: Angriff, Verteidigung, Organisation, Stärke, Panzerung/Rüstung, Durchschlag.
- Modifikatoren: Gelände, Fluss, Festung, Versorgung, Luftherrschaft, Wetter/Jahreszeit (Winter in Russland!).
- **Versorgung & Einkesselung**: Einheiten ohne Verbindung zur Hauptstadt/einem Hafen verlieren Organisation.
- Mittelalter-Sonderfall: **Belagerung** von Burgen/Städten dauert, statt direkter Eroberung.

### 4.4 Luft & See (vereinfacht)
- Luftwaffe als **Zonen-Einsätze** (Luftüberlegenheit, Bodenunterstützung, Bombardierung) – keine Einzelflugzeuge.
- Marine: Flotten in Seezonen (Überlegenheit, Konvois, Invasionen). Kein Schiffsdesigner in 1.0.

### 4.5 Politik
- **Fokusbäume**: jede Nation ist spielbar.
  - Große Nationen bekommen **eigene Bäume** (20–35 Fokusse).
  - Kleine Nationen einen **generischen Baum** (Industrie, Armee, Diplomatie).
  - Ziel: nach und nach bekommt **jede Nation einen eigenen, coolen Baum** – die Datenstruktur ist darauf ausgelegt, Bäume einzeln nachzuliefern.
- **Forschung**: kleiner Baum pro Epoche (Infanterie, Panzer/Kavallerie, Luft, Marine, Industrie, Doktrin), 2–3 Forschungsplätze.
- **Diplomatie**: Bündnisse/Fraktionen, Kriegserklärung (braucht Kriegsgrund oder kostet Stabilität), Frieden per Verhandlung/Kapitulation, Garantien.
- **Stabilität & Kriegsmüdigkeit**.
- **Ereignisse**: historische Ereignisse mit Auswahl-Optionen.

### 4.6 Sieg
- **Siegpunkte** in Schlüsselprovinzen, Wertung am Enddatum des Szenarios.
- Vorzeitig: alle Gegner kapitulieren.
- Optional: Weltherrschaft (Einstellung beim Start).

## 5. Historischer Umgang

- **Historisch akkurat**: echte Staaten, Grenzen, Anführer, Ideologien (als Spielmechanik), Kriegsziele, Ereignisse.
- **Keine verbotenen Symbole** (§ 86a StGB): z. B. Deutsches Reich 1936 mit Schwarz-Weiß-Rot statt Hakenkreuzflagge, keine SS-Runen o. Ä. – wie in der deutschen HoI-Version.
- **Ereignistexte sachlich** im Geschichtsbuch-Ton, keine Propaganda, keine Verherrlichung; Verbrechen werden nicht als „Belohnung“ modelliert.

## 6. Spielmodi

- **Solo**: Nation wählen, alle anderen KI.
- **Online**: Raum mit 4-Buchstaben-Code / Einladungslink `/?raum=CODE`, bis 8 Spieler, jeder wählt eine Nation, Rest KI.
  - **Host steuert Tempo und Pause.**
  - Spieler verlässt → KI übernimmt, beim Wiederkommen gibt KI zurück.
  - Koop möglich (mehrere Spieler in einer Fraktion).
- **Speicherstände**:
  - Solo: im Browser (IndexedDB), zusätzlich Export/Import als Datei.
  - Online: Server speichert den Raum (Autosave, z. B. jeden Spielmonat), Host kann später mit dem Code fortsetzen.
  - Speicherort: **Supabase** (kostenloser Tarif, Region EU/Frankfurt). Nur der Server greift zu (Service-Key als Render-Umgebungsvariable), Tabelle `spielstaende` (raum, epoche, spieldatum, zeit, stand = gzip-JSON). Die letzten 5 Autosaves pro Raum behalten. Wöchentlicher Ping gegen das Pausieren inaktiver Projekte. Supabase in `datenschutz.html` als Auftragsverarbeiter nennen.

## 7. Bedienung & Plattformen

- **Fokus auf große Bildschirme**: Desktop, Laptop, iPad.
- Handy **voll spielbar**, aber mit vereinfachtem Layout (Panels als Schubladen).
- Touch: Pinch-Zoom, Ziehen = Front/Pfeil zeichnen im Zeichenmodus, langes Drücken = Kontextmenü.
- Tastatur: Leertaste Pause, 1–5 Tempo, Kartenmodi auf F-Tasten.

## 8. Technik

Gleiches Grundgerüst wie die anderen Spiele:

- Node-Server (`server.js`) + `ws`, `zugang.js`-Passwort, `datenschutz.html`, selbst gehostete Schriften/Assets, Dockerfile, Render.
- Klassische Skripte, kein Build-Schritt.

```
epochen/
  server.js, zugang.js, raeume.js      Server, Passwort, Online-Räume
  public/
    index.html
    logik.js        reine Regeln + KI (läuft im Browser UND auf dem Server)
    karte.js        Canvas-Karte, Stile, LOD, Eingabe
    ui.js           Panels: Produktion, Forschung, Fokus, Diplomatie
    online.js       Lobby, Snapshots
    speichern.js    IndexedDB, Export/Import
    stile/          Kartenstile pro Epoche
  daten/
    provinzen.json  Geometrie (einmal für alle Epochen)
    epochen/1936/   nationen, grenzen, einheiten, forschung, fokus/, ereignisse
    epochen/1200/
  werkzeug/
    provinzen-bauen.js    aus Natural Earth / historical-basemaps
    grenzen-bauen.js      Provinz → Staat pro Startjahr
    balance.js            KI gegen KI im Schnelldurchlauf
```

- **Deterministische Simulation** (fester Zufalls-Seed pro Partie), damit Server und Clients gleich rechnen und Speicherstände reproduzierbar sind.
- Online: Server rechnet autoritativ, schickt Deltas pro Spieltag; Clients schicken nur Befehle.
- Debug wie gewohnt: `epochen.sim(tage)`, `epochen.zustand`.

## 9. Roadmap

Ausführlicher Plan pro Version (0.3 bis 1.0 und danach): **[VERSIONEN.md](VERSIONEN.md)**. Die Liste unten ist die ursprüngliche Grobplanung.

1. ✅ **Prototyp Karte** (2026-09-27): 1614 Weltprovinzen aus Natural Earth, 79 Staaten zum 1.1.1936 (Tabelle `werkzeug/grenzen-1936.js`, Schnitte entlang historical-basemaps 1938 mit Korrekturen), Canvas-Karte mit Zoom/Pan/Pinch/Weltumlauf/LOD, Stile Generalstab + Lesbar, Provinz-Panel, Nationswahl.
2. ✅ **Bewegung & Kampf** (2026-09-27): Divisionen (Inf/Kav/Pz, Stärken grob nach HoI 1936), Marsch per Wegsuche, stündlicher Kampf mit Organisation/Stärke, Gelände (Natural-Earth-Regionen + Klimazonen), Verschanzung, Kampfbreite 6, Rückzug/Einkesselung, Eroberung mit Besatzungs-Schraffur, Kapitulation (≤30 % Kernland oder Hauptstadt weg und ≤60 %), Zeit mit Pause/Tempo 1–5, Kriegserklärung, Meldungen, Gegner-KI + Automatik für den Spieler. Start: Italien–Äthiopien-Krieg läuft.
3. ✅ **Wirtschaft** (2026-09-28, Version 0.3): Fabriken, Bauschlange, Rohstoffe mit Handel, Produktion, Mannstärke/Wehrgesetz, Ausbildung, Verstärkung aus dem Lager, Kartenmodi, Speicherstände. Versorgung/Einkesselung → 0.4.
4. ✅ **Fronten & KI** (2026-09-28, Version 0.4): Versorgung/Einkesselung, Winter/Schlamm, Armeen mit Generälen, Frontlinien, Angriffspfeile, Armee-Automatik, KI 2.
5. **Politik**: Forschung, Fokusbäume (generisch + erste große Nationen), Diplomatie, Ereignisse, Siegpunkte.
6. **Speicherstände & Online**: Solo-Saves, Online-Räume bis 8 Spieler, Host-Tempo, Online-Saves.
7. **Zweite Epoche: Mittelalter 1200**: Pergament-Stil, Heere, Belagerungen, Lehen – beweist den epochenunabhängigen Kern.
8. **Luft & See**, Handy-Layout-Feinschliff, Balance.
9. Danach: weitere Epochen, mehr eigene Fokusbäume.

## 10. Noch offen (später entscheiden)

- Genaue Provinzanzahl nach erstem Performance-Test auf dem iPad.
- Mittelalter: wie viel Lehnswesen (Vasallen als eigene KI-Staaten?).
