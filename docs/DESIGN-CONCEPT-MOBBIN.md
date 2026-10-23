# TranslateOCR – Designkonzept nach Mobbin MCP

Datum: 23.10.2026. Status: umgesetzt und geprüft; bleibt Referenz für spätere Iterationen.

Referenz: https://mobbin.com/mcp. Die Seite wurde im Browser visuell betrachtet und ihre sichtbaren Überschriften, Navigation und Typografie geprüft. Das private lokale Studio und die statische Demo verwenden jetzt die monochrome Richtung. PDF- und Word-Vorlagen sowie Arbeitsabläufe blieben erhalten.

## 1. Gestaltungsrichtung

TranslateOCR wird ein ruhiger, moderner privater Arbeitsplatz mit weißem Hintergrund, fast schwarzer Typografie, großzügigen Abständen und klaren Aktionen. Die Demo übernimmt die großzügigere Präsentation der Referenz. Im Studio bleibt der verfügbare Platz auf Dokumente und Prüfung ausgerichtet.

An der Referenz beobachtet: weißer Hintergrund, dunkle Schrift, zurückhaltende graue Nebentexte, große eng gesetzte Überschriften, kompakte horizontale Navigation, schwarze pillenförmige Hauptaktionen, hellgraue Zweitaktionen und große abgerundete Präsentationsflächen. Die dort eingesetzte Schrift heißt Saans; die Desktop-Hauptüberschrift wurde mit 80 px, der Abschnittstitel mit 44 px beobachtet. Das sind Referenzwerte, keine Vorgabe für sämtliche App-Seiten.

Die folgenden Farben, Maße und Komponenten sind eigene Vorschläge für TranslateOCR. Mobbin-Logo, proprietäre Schriftdateien, Bilder, Screenshots fremder Apps und Werbetexte werden nicht in das Produkt übernommen.

## 2. Verbindliche Grundlagen

| Element | Umsetzungsvorgabe |
| --- | --- |
| Seitenhintergrund | Weiß `#FFFFFF` |
| Haupttext / Hauptaktion | Fast Schwarz `#141414` |
| Sekundärtext | Dunkelgrau `#626262`; relevante Hinweise nicht in sehr hellem Grau |
| Dezente Flächen | `#F5F5F5`, bei Interaktion `#EEEEEE` |
| Trennlinien | `#E8E8E8`; Formularumrandung etwas kräftiger `#D4D4D4` |
| Primäraktion | Schwarze Fläche, weiße Beschriftung; Hover `#303030` |
| Status | Grün für erledigt, Amber für Rückfrage, Rot für Fehler; jeweils Text und Symbol ergänzen |
| Fokus | Gut sichtbarer Fokusrahmen, darf funktional Blau verwenden |
| Auswahl / Dokumentfundstelle | Dezente blau-graue Markierung und klare Umrandung; nicht allein Farbe |
| Schrift | Lokale Systemschrift: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`; keine fremde Saans-Datei herunterladen |
| Lauftext | 15–16 px, Zeilenhöhe 1,5–1,65 |
| Labels / Metadaten | 13–14 px; unter 12 px nur unkritische technische Details |
| App-H1 | Desktop 44–48 px, mobil 32–36 px, Gewicht 650–700 |
| Demo-H1 | Desktop 64–72 px, mobil 38–42 px; kurze klar geplante Zeilen |
| H2 / H3 | H2 24–28 px, H3 17–20 px; Arbeitsbereich bei Bedarf kompakter |
| Abstandsmaß | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px |
| Radien | 12 px Eingaben, 18–24 px große Flächen, 999 px Aktionsbuttons |
| Schatten | Nur sehr schwach bei schwebenden Elementen oder Dokumentpapier; Flächen vor allem über Abstand und Hintergrund trennen |
| Icons | Einheitliche kleine Linienicons, 18–20 px; reine Iconbuttons mit eindeutigem zugänglichem Namen |

Die Dokumentdarstellung behält ihre eigene Schrift und ihre Papierproportionen. Die UI-Typografie darf keine PDF-/Word-Vorlage, Tabellenbreite, Beglaubigungsüberschrift oder Exportdatei verändern.

## 3. Kopfzeile und Marke

- Wordmark „TranslateOCR“ in Schwarz, ausgewogene gleichwertige Wortteile; bisheriges violettes Icon durch ein einfaches monochromes Dokument-/Scan-Zeichen ersetzen.
- „personal“-Badge zurücknehmen; der private Charakter wird durch die Anwendung selbst deutlich.
- Desktop-Kopfzeile ungefähr 72 px hoch, Inhaltsbreite 1200–1280 px, dünne untere Linie. Navigation: Übersetzen, Dateien, Bibliothek, Dossiers. Hinweise und Hilfe als ruhige Nebenaktionen.
- Aktiven Bereich mit kräftiger Schrift und kleinem Indikator kennzeichnen. Browserfokus, aktive Seite und Hover müssen unterscheidbar bleiben.
- ChatGPT-Verbindung als kompakte Statuszeile mit Text und Statuspunkt gestalten. Bei fehlender Verbindung klarer Anmeldebutton. Modellwahl und Diagnose bleiben aufklappbar.
- Keine großen dekorativen Verbindungsbanner im fertigen Arbeitsplatz.

## 4. Upload und Startansicht

- Kurzer Kopf: „Dokument übersetzen.“ plus ein erklärender Satz. Keine vollflächige Landingpage vor jedem Auftrag.
- Desktop: Uploadfläche links, Zielsprache und Auftragsinfos rechts, Verhältnis ungefähr 60:40. Maximal ein klarer großer Container pro Aufgabenbereich.
- Uploadfläche weiß/hellgrau mit zurückhaltender gestrichelter Linie und monochromem Dokumenticon. Keine violetten Verläufe oder schrägen Papierillustrationen.
- „Dateien auswählen“ als Aktion in der Uploadfläche; „Übersetzen“ bleibt die entscheidende schwarze Abschlussaktion unter den Einstellungen. PDF + Word als verständlicher Ergebnishinweis daneben.
- Dateiliste: Dateiname, Typ/Seitenrolle, Größe, Reihenfolge und Entfernen in gut lesbarer Zeile. Lange Namen umbrechen, Symbole nicht zusammenschieben.
- Vorder-/Rückseite und PDF-Seitenreihenfolge erhalten einen einheitlichen kleinen Werkzeugstil. Duplikatmeldung direkt an der Dateiliste.
- Zusatzinfos und Namensschreibweise logisch gruppieren. Vorlagen, Referenzen, Dossier und Scanwerkzeuge bleiben eingeklappt, aber gut auffindbar.
- Die statische Demo erhält einen klaren Link „Demo ansehen“. Interner Demoauftrag und andere Beispielaktionen bleiben erreichbar, werden aber visuell untergeordnet und kurz erklärt.

## 5. Warteschlange und Fortschritt

- Kompakte Liste mit stabilen Spalten: Dokument/Auftrag, Status, geschätzte Restzeit und passende Aktionen.
- Fortschrittsbalken schwarz/grau, keine violette Akzentfläche. Status „Rückfrage“ und „Fehlgeschlagen“ deutlich anders kennzeichnen.
- Zeitangabe ausdrücklich als Schätzung beschriften; unbekannte Dauer als solche zeigen. Keine erfundenen präzisen Countdowns.
- Laufender Auftrag hervorgehoben, wartende Aufgaben ruhiger. Fertig bearbeitbare Aufgaben mit klarer Öffnen-/Prüfen-Aktion.
- Debug-Verlauf in einem lesbaren, eingeklappten technischen Bereich. Kopieren/Download als Nebenaktionen.
- Leere Warteschlange und pausierte Verarbeitung brauchen eigenständige, knappe Zustandsdarstellungen.

## 6. Prüfung, Rückfragen und Bearbeitungschat

- Arbeitsbereich breiter als die Startansicht: auf großen Displays bis etwa 1440 px. Oben Dokumentname, Version und Status in einer ruhigen Werkzeugleiste.
- Original und Übersetzung als gleichberechtigte, deutlich beschriftete Ansichten nebeneinander. Hellgrauer Außenraum, weißes Dokumentpapier, Zoom und Seitenwahl in eigener kompakter Leiste.
- Zugeordnete Stellen mit konsistenter Markierung und erklärendem Label kennzeichnen. Unleserliche Stellen und benötigter Bildausschnitt müssen direkt neben der Rückfrage erkennbar sein.
- Rückfragen als klare Aufgabenkarte: Frage, passende Originalstelle, Antwortfeld, Aktion. Fokus nach Öffnen zur Frage führen, ohne die aktuelle Dokumentposition unnötig zu verlieren.
- Prüfpunkte, Chat und Werkzeuge in klar benannten Bereichen gruppieren. Nicht jede Zusatzfunktion als gleich große Karte auf eine lange Seite setzen.
- Chat als ruhige graue/weiße Nachrichtenflächen, lesbare Breite, vollständige Absätze. Eingabe mit eindeutigem Senden-Button, Entwurf beim Wechsel erhalten.
- Versionsunterschiede weiterhin mit „Vorher“/„Nachher“, zusätzlicher Textkennzeichnung und gezielter Auswahl anzeigen. Geschützte Angaben erhalten Schloss + Text.
- Direkte Änderungen, einzelne Stelle neu verarbeiten, Stempel, Referenzen, Versionen und Praxisprotokoll erhalten denselben kompakten Accordion-Stil.
- Finale Downloads in einer klar getrennten Abschlussleiste: schwarze Hauptaktion „PDF + Word herunterladen“, einzelne Dateitypen als Nebenaktionen. Bestehende Freigaben und Downloadsperren bleiben wirksam.

## 7. Bibliothek, Dossiers, Dateien und Hinweise

- Bibliothek visuell in „Vorlagen & Profile“, „Glossar & Beispiele“ und „Speicher & Sicherung“ gliedern. Bestehende Formulare in klaren Unterbereichen organisieren; lange Import-/Experteneinstellungen einklappen.
- Vorlageneditor: gut lesbare Steuerelemente links, tatsächliche Layoutvorschau rechts; mobil untereinander. Leere Vorschau mit verständlichem Hinweis, Lade- und Fehlerzustand mit fester Platzreserve.
- Sammlung als ruhige Listenzeilen mit Name, Typ und wenigen klaren Aktionen statt uneinheitlicher Textblöcke.
- Dossiers: Name und Auftragsanzahl als Übersicht, bestätigte Angaben darunter. Konflikte als fachliche Hinweise mit Text und Symbol.
- Dateien: verständlicher Leerzustand, klare Dateizeilen, passende Angaben zur lokalen Auswahl.
- Hinweise: übersichtliche Textabschnitte, Quellen gut lesbar und als externe Links erkennbar.
- Versions- und Installationsangaben klein, aber lesbar. Backup/Wiederherstellen visuell klar auseinanderhalten; Passwort- und Fehlerzustände ordentlich ausrichten.

## 8. Geführte Demo

- Die großzügige Referenzwirkung hier stärker einsetzen: zentrierter kurzer Titel, große Typografie, zwei knappe einführende Sätze, viel Weißraum.
- Vorschlag: „Vom Dokument zur fertigen Übersetzung.“ Darunter: „Dateien hochladen. Angaben prüfen. PDF und Word erhalten.“ Den tatsächlichen fiktiven Charakter gesondert klar benennen.
- Vier Schritte als schlanker schwarzer/grauer Fortschritt. Aktion links, große Dokumentvorschau rechts; mobil zuerst aktuelle Aufgabe, dann Vorschau.
- Rückfrage, Promptänderung, Unterschied und finaler Download bleiben vollständig durchspielbar. Auswahl und Downloadzustände müssen auch ohne Hover verständlich sein.
- Schwarze Hauptaktionen und hellgraue Zweitaktionen, gleiche Buttonhöhen wie im Studio. Hinweise zur geskripteten Demo bleiben sichtbar.
- Unter dem Ablauf kurze Erklärung der drei echten Produktstärken. Keine erfundenen Kundenlogos, Zahlen, Bewertungen oder Qualitätsversprechen ergänzen.
- Neues fiktives Desktop-Screenshot für README erzeugen; vorhandene öffentliche Demo-ZIP nach abgeschlossener Gestaltung aktualisieren.

## 9. Interaktion, mobile Ansichten und Barrierefreiheit

- Aktionsbeschriftungen einschließlich Icon als gesamte Gruppe mittig ausrichten. Keine Abstandstricks, unsichtbaren Pseudoelemente oder `margin-left:auto` innerhalb zentrierter Buttons.
- Primäraktionen mindestens 44 px hoch, einfache Nebenschalter mindestens 40 px; mobile Touchziele 44 px. Iconbuttons nicht kleiner als ihr Touchziel.
- Hover und aktive Zustände über kleine Helligkeits-/Hintergrundänderungen; 120–180 ms Übergänge. Keine verpflichtenden Scrollanimationen oder blockierenden Einblendungen.
- Reduzierte Bewegung berücksichtigen. Systemfokus sichtbar, Tastaturreihenfolge logisch, eingeklappte Inhalte im geschlossenen Zustand nicht fokussierbar.
- Unter 760 px alle Hauptspalten stapeln. Kopfzeile bei Bedarf zweizeilig; Navigation gut lesbar und nicht auf 9–10 px verkleinern.
- Bei schmalen Prüfbereichen Original/Übersetzung über klar beschriftete Ansichten wechseln; bestehende Inhalte und Prüfung dürfen beim Wechsel nicht verloren gehen.
- Keine überlagernde feste Downloadleiste auf dem iPhone. Falls sie später sticky wird, Safe-Area und tatsächliche Höhe berücksichtigen.
- Arabische Inhalte mit geeigneter Textrichtung; Bedienelemente und Dateinamen dürfen dadurch nicht spiegeln oder aus dem Layout laufen.
- Leere, ladende, deaktivierte, erfolgreiche und fehlgeschlagene Zustände jeder wichtigen Komponente gestalten. Toasts ergänzen dauerhafte Inlinehinweise, ersetzen sie nicht.

## 10. Umgesetzter Stand und Prüfungen

- Gemeinsame Schwarz-Weiß-Grau-Tokens und Systemschrift in Studio und Demo; alte violette Override-Schicht entfernt.
- Kopfzeile, Upload, Queue, Bibliothek, Dossiers, Hinweise, Dialoge und dynamische Prüfelemente auf zentrale Komponenten ausgerichtet.
- Prüfansicht als zweispaltiger Vergleich von Original und Übersetzung am Desktop; mobile Umschaltung mit klar benannten Original-/Übersetzungs-Schaltern.
- Zusatzwerkzeuge gruppiert und bei einem neuen Änderungsvorschlag gezielt geöffnet.
- Fiktiver Demo-Screenshot: `docs/demo-preview.jpg`.
- `npm test`: 57/57 bestanden.
- Geführten Browserablauf manuell geprüft; die finalen Aktionen liefern PDF und Word. Verfügbare eingebettete Browserbreite: 616 px, ohne horizontalen Überlauf.
- `npm test` und `npm run acceptance` starten denselben HTTP-Testport; sie müssen nacheinander laufen.

## 11. Umsetzungshinweise für spätere Iterationen

Dieses Kapitel ist eine Checkliste für spätere Iterationen, keine offene Arbeit für den aktuellen Redesign-Auftrag.

1. `AGENTS.md`, `CODEX-HANDOVER.md`, `FEATURES.md` und dieses Konzept lesen. Laufenden Stand und lokale Daten erhalten.
2. Gemeinsame Designvariablen definieren und `dist/style.css` sinnvoll strukturieren. Bestehende wiederholte Overrides zusammenführen; keine weitere unsystematische Override-Schicht anhängen.
3. `dist/index.html` semantisch anpassen. Alle benötigten IDs, Formulare, Event-Anbindungen, `hidden`-Zustände und Download-/Prüfsperren erhalten.
4. Dynamisch gerenderte Oberflächen in `app.js`, `connection.js`, `queue.js`, `review.js`, `workspace.js`, `inspector.js`, `workflow.js` und `studio.js` auf dieselben Komponenten abstimmen. Neue Ansichtsumschalter müssen Eingaben und Fokus erhalten.
5. `dist/demo/index.html`, `demo.css` und gegebenenfalls die reinen Darstellungsteile von `demo.js` angleichen. Gleiche Tokens zwischen Studio und separater statischer Demo; Demo muss weiterhin eigenständig ohne Backend funktionieren.
6. Favicon, Wordmark und sämtliche violetten UI-Sonderfälle prüfen. Keine Funktions-/Modelländerung oder Umgestaltung der Exportvorlagen als Teil dieses Auftrags.
7. Browserprüfung mit fiktiven Daten: Upload mehrerer Seiten, Reihenfolge, Duplikat, Queue, Rückfrage, Prüfung, Chatvorschlag, Version, Bibliothek und finale Downloadaktionen. Desktop 1440/1280, Tablet 768, Mobil 390/375 px; kein horizontaler Seitenüberlauf, keine abgeschnittenen Buttontexte.
8. Geeignete bestehende Tests ausführen, insbesondere Workflow-/Downloadfreigaben nach Strukturänderungen. PDF/Word-Ausgaben nicht durch UI-CSS beeinflussen. Keine Tests hinzufügen, die nur CSS-Werte nachprüfen.
9. Neue Demo-Screenshots, Dokumentationsstand und Windows-/Demo-Pakete erst nach abgeschlossener visueller Prüfung aktualisieren. Keine öffentliche Veröffentlichung im Designauftrag.

## 12. Fertig-Kriterien

- [x] Gemeinsames Schwarz-Weiß-Grau-Design in Studio, Arbeitsbereichen und Demo.
- [x] Violette UI-Sonderfälle aus den zentralen UI- und Demo-Styles entfernt; semantische Statusfarben bleiben erhalten.
- [x] Lesbare Schriftgrößen, konsistente Abstände und mittig ausgerichtete Buttonbeschriftungen.
- [x] Abläufe beibehalten; Regressionstests für Freigaben und finale Downloads bestanden.
- [x] Demo im eingebetteten Browser durchgespielt; verfügbare Tabletansicht ohne horizontalen Überlauf.
- [ ] Echtes iPhone sowie breites Desktopfenster in der Browseransicht geprüft; hier stand nur ein 616-px-Fenster zur Verfügung.
- [x] Demo- und Windows-Paket mit dem neuen Screenshot und dem aktuellen Dokumentationsstand neu gebaut.
- [x] Prüfergebnisse und verbleibende Grenzen dokumentiert.

Grobe Umsetzungsschätzung: 45–75 Minuten für Gestaltung und funktionale/visuelle Prüfung, anschließend etwa 10–15 Minuten für Dokumentation und neue Pakete. Die Schätzung hängt insbesondere vom Umfang der Änderungen am Prüfbereich ab.
