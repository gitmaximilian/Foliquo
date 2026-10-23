# An TranslateOCR mitarbeiten

## Entwicklungsumgebung

Node.js 24 LTS (mindestens 22), Git und LibreOffice installieren. Auf Windows PowerShell mit `npm.cmd` verwenden, falls die Ausführungsrichtlinie das npm-PowerShell-Skript sperrt. Keine Richtlinien herabsetzen.

```sh
npm run setup
npm test
npm run benchmark
npm start
```

Die Anwendung öffnet unter http://127.0.0.1:4318/. „Demo ohne Konto“ verarbeitet nur feste fiktive Daten. Für technische Tests ist keine Anmeldung notwendig. Für echte Modelltests verwendet jeder Entwickler seine eigene persönlich autorisierte Verbindung. Keine fremden Kontodateien kopieren.

## Code und Änderungen

`server.mjs` enthält die lokalen HTTP-Routen. `lib/` trennt Modelladapter, Dateinormalisierung, Exporte, verschlüsselten Workspace, Prüflogik und Versionen. `dist/` enthält die buildfreie Oberfläche. `tests/` verwendet ausschließlich fiktive Daten. Die zehn Funktionen des Ausbaus 0.7 stehen in FEATURES.md.

Eine funktionale Änderung mit einem reproduzierbaren Test absichern. Bei Dokumentlayoutänderungen PDF und Word rendern und alle betroffenen Seiten visuell kontrollieren. UI-Änderungen im Browser auf der bestehenden Fensterbreite prüfen; insbesondere Buttonausrichtung, schmale Ansichten, Lade- und Fehlerzustände. Den bestehenden Loopback-, Origin-, CSRF- und OAuth-Schutz erhalten.

## Benchmark

`benchmarks/cases.json` enthält vollständig fiktive englische und arabische Muster sowie deklarierte Referenzangaben. Diese Referenzen sind technische Testdaten, keine fachlich beglaubigten Goldübersetzungen. Vor Aussagen über professionelle Übersetzungsqualität müssen Sprachkundige die Referenzen fachlich freigeben und die Sammlung erweitern.

`npm run benchmark` prüft den Export mit vorgegebenen Referenztexten. Der Bericht kennzeichnet dies ausdrücklich als Offline-Pipeline-Test, nicht als KI-Qualität.

Eigene Modellantworten als JSON-Array mit `id`, `text` und optional `regions` auswerten:

```sh
node scripts/benchmark.mjs --results pfad/ergebnisse.json --output outputs/benchmark-model
node scripts/benchmark.mjs --results pfad/ergebnisse.json --baseline pfad/report.json
```

Ein bewusst gestarteter Live-Test überträgt ausschließlich die öffentlichen fiktiven Fixtures an den eigenen Modellanbieter und verbraucht Modellnutzung:

```sh
node scripts/benchmark.mjs --live --model VERFUEGBARE_MODELL_ID
```

Der einfache Referenzvergleich bewertet Namen, Daten, Nummern und bestimmte Pflichtinhalte. Er ersetzt keine semantische Qualitätsbewertung. Berichte mit echten Daten gehören nicht in Git.

## Datenschutz und Berichte

Keine `.local/`, Backups, echten Urkunden, personenbezogenen Beispiele, Tokens oder Zugangsdaten veröffentlichen. Fehler mit fiktiven Dokumenten reproduzieren und nur bereinigte Diagnosecodes beilegen. Eine Vorlage für Fehlermeldungen liegt unter `.github/ISSUE_TEMPLATE/`.

Die CI-Konfiguration prüft Node 24 auf Windows, macOS und Linux mit LibreOffice. Sie wird erst nach Veröffentlichung im GitHub-Repository tatsächlich ausgeführt; eine lokal erstellte Konfiguration ist kein Nachweis bestandener Windows- oder Linux-Läufe.

Projektlizenz und Drittanbieterhinweise werden vor der öffentlichen Veröffentlichung gesondert fertiggestellt. Diese Anleitung stellt keine zusätzliche Lizenz für fremde Bestandteile dar.
