# Epochen – Versionsplan bis 1.0 und danach

Stand: 2026-09-28 · Grundlage: [KONZEPT.md](KONZEPT.md) · Aktuell: **0.3** (Karte, Einheiten, Kampf, Zeit, Wirtschaft, Speichern)

Jede Version ist für sich spielbar und wird auf Render ausgeliefert. Die Reihenfolge folgt der Frage:
*Was fehlt am meisten, damit eine Partie Spaß macht?* Deshalb kommen Wirtschaft und Speichern zuerst,
Online kommt direkt nach Fronten und Marine (entschieden 2026-09-28), damit ihr früh zusammen spielen könnt;
die Weltpolitik folgt danach und muss dann gleich online-fähig gebaut werden.

| Version | Name | Kern | Grob-Aufwand |
|---|---|---|---|
| 0.1 ✅ | Weltkarte | 1614 Provinzen, 80 Staaten 1936, Kartenstile | – |
| 0.2 ✅ | Erster Schuss | Divisionen, Marsch, Kampf, Gelände, Kapitulation, Zeit | – |
| 0.3 ✅ | Kriegswirtschaft | Fabriken, Rohstoffe, Produktion, Mannstärke, Speichern | groß |
| 0.4 | Fronten | Versorgung, Winter, Armeen + Generäle, Frontlinien, Angriffspfeile, KI 2 | groß |
| 0.5 | Über das Meer | Seezonen, Häfen, Flotten, Transporte, Invasionen, Luftwaffe light | groß |
| 0.6 | Gemeinsam | Online-Räume bis 8 Spieler, Online-Speicherstände (Supabase) | groß |
| 0.7 | Weltpolitik | Forschung, Fokusbäume, Fraktionen, Ereignisse, Frieden, Siegpunkte | sehr groß |
| 0.8 | Mittelalter | Epoche 1200 mit Pergament-Stil, Heeren, Belagerungen, Lehen | sehr groß |
| 0.9 | Feinschliff | Tutorial, Balance, iPad/Handy, Leistung, Kartenmodi | mittel |
| 1.0 | Epochen | zwei vollständige Epochen, solo und online | – |

---

## 0.3 „Kriegswirtschaft“ ✅ (2026-09-28)

> Umgesetzt in `public/wirtschaft.js` (Regeln + Wirtschafts-KI), `public/wirtschaftui.js`, `public/speichern.js`, Daten aus `werkzeug/wirtschaft-bauen.js` (Städte aus Natural Earth als Gewicht). Abweichungen vom Plan: Artillerie als eigene Ware verschoben auf 0.4; Produktion 2,5 statt 4,5 Punkte je MF (sonst zu viele Divisionen); Festungen 1936 (Maginot-, tschechische und Mannerheim-Linie) schon eingebaut. Test: `node werkzeug/simtest.js [seed] [jahre]` inkl. Determinismus nach Laden.

**Ziel:** Verluste lassen sich ersetzen, Staaten wachsen unterschiedlich stark, und eine Partie übersteht das Neuladen.

### Fabriken und Bau
- Jede Provinz hat **zivile Fabriken (ZF)** und **Militärfabriken (MF)** sowie **Infrastruktur 1–5** und **Festung 0–5**.
- Startwerte 1936 grob nach HoI-Größenordnung, verteilt auf die Industrieprovinzen:
  Deutsches Reich 32 ZF / 28 MF, Sowjetunion 105 ZF / 32 MF, USA 140 ZF / 5 MF, Vereinigtes Königreich 45 ZF / 12 MF,
  Frankreich 40 ZF / 12 MF, Japan 35 ZF / 17 MF, Italien 20 ZF / 12 MF; kleine Staaten 1–10.
- **Bauschlange:** Jede ZF liefert 5 Baupunkte pro Tag, höchstens 15 ZF pro Bauprojekt.
  Kosten: ZF 10 800, MF 7 200, Festungsstufe 500, Infrastrukturstufe 3 000 Baupunkte (≈ HoI-Verhältnisse).
- Ein Teil der ZF ist für **Konsumgüter** gebunden (20 %, im Krieg 10 %), damit reiche Staaten nicht alles in Rüstung stecken.

### Rohstoffe
- Drei Rohstoffe: **Stahl, Öl, Gummi**. Provinzen liefern feste Mengen aus einer Tabelle `werkzeug/rohstoffe-1936.js`
  (Namensmuster → Menge), z. B. Öl: Baku, Ploiești, Texas/Oklahoma, Persien, Venezuela, Niederländisch-Indien, Irak;
  Gummi: Malaya, Niederländisch-Indien, Ceylon, Liberia, Brasilien; Stahl: Ruhr, Schlesien, Lothringen, Donbass, Ural,
  Pennsylvania/Great Lakes, Kiruna, Mandschurei.
- Fehlt ein Rohstoff, sinkt die Leistung der betroffenen Produktionslinien (je 10 % Mangel −10 % Leistung, höchstens −50 %).
- **Handel light:** Ein Staat kann Rohstoffe von Neutralen kaufen; jede 8 gekauften Einheiten kosten 1 ZF. Kein Routen-Mikromanagement.

### Produktion
- **Produktionslinien** mit zugeteilten MF: Infanterieausrüstung, Panzer, Artillerie (neu, erhöht Angriff der Infanterie), später Flugzeuge/Schiffe.
- Effizienz steigt pro Linie langsam von 10 % auf 50 % (Anlaufkurve), damit Umstellen etwas kostet.
- **Divisionen ausheben:** Division kostet Ausrüstung + Mannstärke, erscheint nach 30 Tagen Ausbildung in der Hauptstadt.
  Inf: 100 Ausrüstung, 10 000 Mann · Kav: 120, 8 000 · Pz: 60 Panzer + 40 Ausrüstung, 8 000.
- **Verstärken:** Stärke füllt sich nur noch, wenn Ausrüstung und Mannstärke im Lager sind (statt kostenlos wie in 0.2).

### Mannstärke
- Bevölkerung pro Provinz (Tabelle nach Staat, verteilt nach Fläche/Industrie), **Wehrgesetz** in 3 Stufen
  (Freiwillige 1 %, Wehrpflicht 2,5 %, Mobilmachung 5 %; höhere Stufen kosten ZF-Leistung).

### Speichern (vorgezogen aus Schritt 6)
- `Spiel.speichern()` / `Spiel.laden()` serialisieren den ganzen Zustand samt Zufallsgenerator (deterministisch).
- 3 Speicherplätze + **Autosave jeden Spielmonat** in IndexedDB, dazu **Export/Import als Datei** (`.epochen`).
- Startmenü: *Neues Spiel* (Szenario + Nation) · *Fortsetzen* · *Laden*.

### Oberfläche
- Neue Leiste mit Ressourcen: ZF/MF, Stahl/Öl/Gummi (+/−), Mannstärke, Ausrüstung im Lager.
- Panels **Produktion** und **Bau** (Tasten P und B), Provinz-Panel zeigt Fabriken, Infrastruktur, Rohstoffe.
- Kartenmodi: *politisch* · *Gelände* · *Industrie* · *Rohstoffe* (Taste M wechselt).

### Fertig, wenn
- Ein Staat verliert Divisionen und kann sie mit eigener Industrie ersetzen.
- Die KI baut und produziert (einfache Regel: 70 % Infanterie, Rest nach Rohstofflage).
- Simulation 1936–1940 ohne Spieler: kein Staat mit negativer Wirtschaft, Deutschland/Sowjetunion/USA deutlich vorne.
- Speichern → Neuladen → Laden ergibt denselben Spielverlauf (Determinismus-Test in `werkzeug/test-speichern.js`).

---

## 0.4 „Fronten“

**Ziel:** Das HoI-Gefühl. Große Armeen lassen sich mit wenigen Klicks führen, und Einkesselungen entscheiden Kriege.

### Versorgung
- Jede Provinz hat einen **Versorgungswert** aus Infrastruktur und Entfernung zum nächsten Versorgungsknoten
  (Hauptstadt, später Häfen). Berechnung einmal pro Tag per Wegsuche über eigenes/verbündetes Gebiet.
- Mehr Divisionen als Versorgung in einer Provinz → −Organisation-Erholung, bei starker Überlast −Stärke.
- **Abgeschnitten** (kein Weg zum Knoten): nach 3 Tagen −2 % Stärke pro Tag, keine Erholung, Angriff −50 %.
  Einkesseln wird damit das wichtigste Kriegsziel.

### Wetter und Jahreszeit
- **Winter** Nov–März nördlich ~45° Breite (Tundra/Wald stärker): Angriff −30 %, Marsch +50 %.
- **Schlamm** im Frühjahr/Herbst in Osteuropa: Marsch +100 % für 3–4 Wochen.
- Kartenoverlay zeigt Schnee und Schlamm.

### Armeen, Generäle, Fronten
- Divisionen werden zu **Armeen** zusammengefasst (bis 24 Divisionen) mit einem **General** (Fertigkeit 1–5, eine Eigenschaft
  wie *Panzerführer*, *Verteidiger*, *Winterexperte*). Generäle aus einer kleinen Namensliste pro Staat, historisch neutral.
- **Frontlinie ziehen:** Armee wählen → Linie entlang der Grenze zum Gegner. Die Divisionen verteilen sich selbst nach Bedrohung.
- **Angriffspfeil:** Von der Front aus einen Pfeil zeichnen (mehrere Provinzen tief). Die Armee greift entlang an,
  wenn das Kräfteverhältnis reicht, und rückt die Front nach.
- **Verteidigungslinie** hinter der Front als Rückfallposition.
- Touch: Zeichenmodus-Knopf, dann Finger ziehen. Maus: Strg+Ziehen oder Werkzeugleiste.

### KI 2
- Die KI nutzt dieselben Werkzeuge: je Kriegsgegner eine Front, Reserven bilden, gezielt Einkesselungen versuchen
  (Angriff auf die schwächste Stelle, zwei Pfeile, die sich treffen).
- Die KI produziert passend zum Gegner (mehr Panzer bei Ebene, mehr Infanterie bei langer Front).
- Automatik für den Spieler bleibt, jetzt pro Armee einstellbar.

### Fertig, wenn
- Ein Krieg mit 30+ Divisionen lässt sich mit Fronten und Pfeilen führen, ohne einzelne Zählsteine anzufassen.
- Balance-Läufe (`werkzeug/balance.js`, 20 Seeds): Polen hält gegen Deutschland 4–8 Wochen, Finnland gegen die Sowjetunion 2–5 Monate.

---

## 0.5 „Über das Meer“

**Ziel:** Großbritannien, die USA und Japan können Krieg führen. Inseln und Kolonien werden erreichbar.

### Seezonen und Häfen
- Das Meer wird im Werkzeug in **ca. 250 Seezonen** geteilt (Voronoi über Meerespunkte, dichter an Küsten, Meerengen als eigene Zonen:
  Ärmelkanal, Gibraltar, Bosporus, Suez, Malakka, Panama). Küstenprovinzen bekommen **Häfen** (Stufe 1–5) aus einer Tabelle großer Häfen.
- Häfen sind Versorgungsknoten, wenn die Seewege nicht gesperrt sind.

### Flotten
- Schiffsklassen: Schlachtschiff, Träger, Kreuzer, Zerstörer, U-Boot (Produktion über MF-Linie „Werften“).
- Flotten bekommen einen **Auftrag** für ein Seegebiet: *Überlegenheit*, *Konvois jagen*, *Konvois schützen*, *Invasion decken*.
- Seeschlacht automatisch, wenn feindliche Flotten im selben Gebiet sind; Ergebnis aus Feuerkraft, Panzerung, Luftunterstützung.

### Transporte und Invasionen
- Divisionen können von Hafen zu Hafen **verschifft** werden (braucht Konvois, dauert nach Entfernung).
- **Invasion** einer Küstenprovinz: Vorbereitungszeit, braucht Seeüberlegenheit; Angriff mit −50 % am ersten Tag.
- **Konvois** für Rohstoffhandel und Versorgung Übersee; versenkte Konvois = Rohstoff- und Versorgungsverlust.

### Luftwaffe light
- Flugzeuge als Produktionslinie (Jäger, Bomber). Pro **Luftregion** (Gruppen von Provinzen) ein Einsatz: *Luftüberlegenheit* oder *Bodenunterstützung*.
- Luftüberlegenheit gibt bis zu +20 % Angriff/Verteidigung am Boden. Keine einzelnen Flugzeuge auf der Karte.

### Fertig, wenn
- Japan kann China über das Meer angreifen, Großbritannien kann in Frankreich landen, die USA können den Pazifik überqueren.
- U-Boot-Krieg schneidet ein Inselreich spürbar von Rohstoffen ab.

---

## 0.6 „Gemeinsam“

**Ziel:** Mit Freunden spielen, bis zu 8 Spieler, Partien über mehrere Abende.

- **Räume:** Code aus 4 Buchstaben, Einladungslink `/?raum=CODE`, Lobby mit Szenario- und Nationswahl, Spitznamen.
- **Server rechnet** mit derselben `logik.js`; Clients schicken nur Befehle. Täglich ein Delta-Snapshot, dazwischen Vorhersage für Marsch.
- **Host** steuert Tempo und Pause; jeder Spieler kann „Pause erbitten“ (kleiner Hinweis beim Host).
- **Spieler weg:** KI übernimmt seine Nation, beim Wiederkommen gibt sie zurück.
- **Koop:** mehrere Spieler in derselben Fraktion; optional zwei Spieler für eine Nation (einer Armee, einer Wirtschaft).
- **Online-Speicherstände** in **Supabase** (EU/Frankfurt): Autosave jeden Spielmonat, die letzten 5 pro Raum; Host setzt mit dem Code fort.
  Datenschutzseite um Supabase und Online-Spiel ergänzen.
- Test mit zwei und acht Browser-Tabs (headless), Messung der Datenmenge pro Spieltag.

### Fertig, wenn
- Eine Partie mit 3 Personen läuft 2 Stunden ohne Abweichungen zwischen Server und Clients und lässt sich am nächsten Tag fortsetzen.

---

## 0.7 „Weltpolitik“

**Ziel:** Der Weg in den Krieg ist Teil des Spiels. Jede Nation hat Ziele und Entscheidungen.

### Forschung
- 3 Forschungsplätze (große Staaten 4). Bäume: Infanterie, Panzer, Artillerie, Luft, Marine, Industrie, Elektronik, Doktrin.
- Jahreszahlen wie 1936–1945; zu frühes Forschen kostet mehr Zeit. Neue Stufen verbessern Einheiten-Werte oder Fabrikleistung.

### Fokusbäume
- **Generischer Baum** für alle (≈ 25 Fokusse: Industrie, Armee, Marine, Luft, Diplomatie).
- **Eigene Bäume zuerst** für die sieben Großmächte (Deutsches Reich, Sowjetunion, USA, Vereinigtes Königreich, Frankreich, Italien, Japan),
  danach China, Polen, Spanien, Türkei, Britisch-Indien und nach und nach alle.
- Fokus dauert 70 Tage (wie HoI), gibt Boni, Kriegsgründe, Bündnisse oder löst Ereignisse aus.
- Format: `daten/epochen/1936/fokus/<TAG>.json`, damit Bäume einzeln nachgeliefert werden können.
- Historisch neutral formuliert (siehe KONZEPT § 5): Ideologien sind Spielmechanik (Stabilität, Kriegsbereitschaft), keine Verherrlichung.

### Diplomatie
- **Fraktionen:** Achse, Alliierte, Komintern, Co-Prosperity; Beitritt, Garantie, Nichtangriffspakt, Militärzugang.
- **Spannung** (Welt-Spannung 0–100 %): steigt durch Kriege und aggressive Fokusse; Demokratien dürfen erst ab bestimmter Spannung
  Krieg erklären oder brauchen einen Kriegsgrund.
- **Frieden:** Nach einer Kapitulation eine **Friedenskonferenz** mit Punkten nach Kriegsbeitrag: Provinzen annektieren,
  Marionetten gründen, Staaten befreien. Danach ändert sich der Besitz (Kernland) dauerhaft.

### Ereignisse
- Historische Ereignisse mit 2–3 Auswahlmöglichkeiten, z. B. Rheinlandbesetzung (1936), Spanischer Bürgerkrieg (Juli 1936, Aufspaltung Spaniens),
  Anschluss Österreichs, Münchner Abkommen, Nichtangriffspakt 1939, Winterkrieg. Auslösung über Bedingungen, nicht fest nach Datum,
  damit alternative Geschichte möglich ist. Der Spanische Bürgerkrieg kommt erst hier (entschieden), nicht schon in 0.3.
- Ereignistexte sachlich im Geschichtsbuch-Ton.

### Stabilität, Kriegsmüdigkeit, Sieg
- **Stabilität** 0–100 % beeinflusst Fabrikleistung und Kapitulationsgrenze; Kriegsmüdigkeit senkt sie.
- **Siegpunkte** in Schlüsselprovinzen (Hauptstädte, Industriezentren). Kapitulation danach statt der einfachen 30-%-Regel.
- **Spielende** 1. Januar 1949 mit Wertung nach Siegpunkten der Fraktionen, oder früher bei Kapitulation aller Gegner.

### Fertig, wenn
- Eine Partie ohne Eingreifen des Spielers verläuft grob historisch (Achse gegen Alliierte, Krieg ab 1939 ± 1 Jahr),
  aber nicht jedes Mal gleich.
- Jede Großmacht hat einen eigenen Baum mit etwa 30 Fokussen (entschieden: reicht erstmal, später ausbauen).

---

## 0.8 „Mittelalter“

**Ziel:** Beweis, dass der Kern wirklich epochenunabhängig ist.

- **Startlage 1200** aus `world_1200.geojson` (historical-basemaps) mit derselben Korrektur-Tabelle wie 1936: Heiliges Römisches Reich,
  Frankreich, England, Byzanz, Kreuzfahrerstaaten, Kalifate, Song/Jin, Mongolen (kurz vor der Expansion), Khmer, Mali usw.
- **Pergament-Kartenstil**, Serifenschrift, Burg-Symbole. Zeit läuft **wie 1936 in Stunden/Tagen** (entschieden); Heere bewegen sich
  entsprechend langsamer, Belagerungen dauern Wochen bis Monate.
- **Heere** statt Divisionen: Ritter, Fußvolk, Bogenschützen, Belagerungsgerät; Heerführer = Adelige.
- **Burgen und Belagerungen:** Provinzen mit Burg werden nicht durch Kampf, sondern durch Belagerung (Wochen bis Monate) eingenommen.
- **Lehnswesen:** Vasallen als eigene KI-Staaten mit Loyalität; zu schwache Lehnsherren verlieren Vasallen.
- **Wirtschaft:** Handwerk/Schmieden statt ZF/MF, Rohstoffe Eisen, Holz, Pferde; Mannstärke über Aufgebote.
- **Politik:** Heiraten/Erbfolge light, Kirche/Bann, Kreuzzüge als Ereignisse; eigene Bäume zuerst für HRR, Frankreich, England, Byzanz, Mongolen.

### Fertig, wenn
- Beide Epochen laufen mit derselben `logik.js`; epochenspezifisches steckt nur in Daten und kleinen Regel-Modulen.

---

## 0.9 „Feinschliff“

- **Tutorial:** 10 Minuten geführter Einstieg (Polen oder Finnland 1939 als Mini-Szenario).
- **Szenarien:** „1936 Volle Kampagne“, „1939 Kriegsbeginn“, „1941 Unternehmen im Osten“ (neutral benannt), „1200 Zeitalter der Burgen“.
- **Balance-Paket:** automatische Läufe aller Szenarien, Grenzen für Kriegsdauer und Wirtschaftswachstum.
- **Leistung:** iPad-Messung, Ziel < 8 ms pro Bild bei 1500 Divisionen; Web Worker für die Simulation, falls nötig.
- **Bedienung:** Handy-Layout mit Schubladen, Tastenkürzel-Übersicht, Einstellungen (Schriftgröße, Kartenstil, Tempo).
- Provinz-Namen pro Epoche vollständig historisch (Namenstabelle je Epoche).

## 1.0 „Epochen“

- Zwei vollständige Epochen (1936, 1200), solo und online bis 8 Spieler, Speicherstände lokal und online.
- Eintrag in der Spielesammlung von „In Arbeit“ auf „Strategie“ umstellen.

---

## Danach (1.x)

| Version | Inhalt |
|---|---|
| 1.1 | **WW1 1914:** Grabenkrieg (Festungen wachsen schnell, Angriffe teuer), Gas, Blockade, Mobilmachungsfahrpläne |
| 1.2 | **Napoleon 1805:** Koalitionen, Linieninfanterie/Kavallerie/Artillerie, Aquarell-Stil |
| 1.3 | **Antike 100 n. Chr.:** Legionen, Straßenbau, Provinzverwaltung, Rom/Parther/Han |
| 1.4 | **Kalter Krieg 1962:** Einflusszonen, Stellvertreterkriege, Abschreckung (kein Atomkrieg als Spielziel), Lagezentrum-Stil |
| laufend | Eigene Fokusbäume für weitere Nationen, historische Provinznamen, neue Szenarien |

---

## Querschnitt für alle Versionen

- **Tests:** `werkzeug/simtest.js` (KI gegen KI, mehrere Seeds) nach jeder Regeländerung; Determinismus-Test ab 0.3.
- **Leistung:** Simulation < 1 ms pro Spielstunde bei 1000 Divisionen; Karte < 8 ms pro Bild.
- **Daten statt Code:** Neue Staaten, Einheiten, Fokusse, Ereignisse nur als Daten in `daten/epochen/<jahr>/`.
- **Historischer Umgang** nach KONZEPT § 5 bei allen Texten, Flaggen und Ereignissen.
- **Datenschutz:** Seite bei jeder neuen Datenverarbeitung ergänzen (Speichern lokal in 0.3, Online und Supabase in 0.6).

## Entschieden (2026-09-28)

1. Online (0.6) kommt vor die Weltpolitik (0.7).
2. Spanischer Bürgerkrieg erst mit dem Ereignissystem in 0.7.
3. Etwa 30 Fokusse pro Großmacht reichen erstmal.
4. Mittelalter läuft im selben Zeittakt wie 1936, nur mit langsamerer Bewegung.
