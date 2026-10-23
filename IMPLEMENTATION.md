# TranslateOCR Ausbau

Ziel: alle zehn vereinbarten Verbesserungen in der lokalen Anwendung. Keine öffentliche Veröffentlichung persönlicher Daten. Keine Änderung vorhandener Kontoverbindungen.

- [x] 1 Word-Vorlagen importieren, editieren, bestätigen, deterministisch verwenden
- [x] 2 private Beispielpaare und passende Beispiele in Modellkontext
- [x] 3 Glossar mit globalem und auftragsbezogenem Geltungsbereich
- [x] 4 verknüpfte Original- und Übersetzungsprüfung
- [x] 5 kritische Felder gegen Ausgabe prüfen und vor Finale bestätigen
- [x] 6 Rückfragen mit Originalausschnitt und ergänzender Aufnahme
- [x] 7 Textänderungen prüfen, einzelne Änderungen übernehmen, Version zurückholen
- [x] 8 verschlüsselte dauerhafte Aufträge, Neustart, Löschfristen, Backup
- [x] 9 persönliche Ausgabeprofile und expliziter Beglaubigungsbereich
- [x] 10 Windows-Installer, sichere Updates, Modelladapter, Demo

Prüfung: bestehende und neue Integrationstests; PDF/Word rendern; Browserabläufe mit fiktiven Daten. Echte Windows-Abnahme ist auf dem Mac nicht möglich.

Stand 0.6: alle zehn Funktionsbereiche implementiert. Bewusste Grenzen: DOCX-Strukturvorschlag statt beliebiger Layout-Klon, Referenzsammlung statt Modelltraining, austauschbare Adapter im Code statt ungetesteter Anbieterwahl, Windows-CMD-Installer statt signierter EXE. Details in FEATURES.md. Keine öffentliche Veröffentlichung in diesem Umsetzungsschritt.

## Ausbau 0.7

- [x] 1 Fiktiver Referenzbenchmark, Kennzahlen und Regressionen
- [x] 2 Direkte versionierte Korrekturen ohne Modellaufruf
- [x] 3 Schutz bestätigter Felder mit expliziter Freigabe
- [x] 4 Scan-Heuristiken und korrigierte Arbeitskopien
- [x] 5 Feste Vorlagenfelder mit Pflichtwert-Rückfragen
- [x] 6 Gezielte Referenzauswahl und nachvollziehbare Nutzung
- [x] 7 Private Dossiers, bestätigte Angaben und Konflikte
- [x] 8 Separate Stempel-/Handschriftprüfung und manuelle Ergänzung
- [x] 9 Technische Druckkontrolle plus visuelle Bestätigung
- [x] 10 Contributor-Setup, fiktive Fixtures und CI-Matrix

Design: zentrierte Buttontexte, konsistente Abstände, eingeklappte optionale Funktionen und mobile Navigation. Grenzen und tatsächliche Abnahme in FEATURES.md.


## Ausbau 0.8.1 · Anbieterwahl

- [x] ChatGPT-Anmeldung klar von separaten OpenAI-, Claude- und DeepSeek-API-Schlüsseln trennen
- [x] Lokale Schlüsselablage verschlüsseln, nicht an den Browser zurückgeben und aus Backups auslassen
- [x] Anbieter und Modell pro Auftrag für spätere Überarbeitung beibehalten
- [x] Feste offizielle Endpunkte, Anbieterdiagnose und getrennte Abrechnungshinweise
- [x] Fiktive Adaptertests, PDF-zu-Bild-Test für DeepSeek und Browserprüfung

## Nächste Arbeitsschritte (in dieser Reihenfolge)

- [x] 1. Mehrsprachige Oberfläche (Englisch als Startstandard, Deutsch und Arabisch mit RTL-Unterstützung) und animiertes Erststart-Intro mit bevorzugter Sprache, Namen und Begrüßung bei jedem Start.
- [x] 2. Vollständiger Design- und Layoutcheck aller Ansichten: Größenverhältnisse, Abstände, Ausrichtung und responsive Darstellung geprüft; Review-Bereiche auf den passenden Ablauf begrenzt, Provider-Karte entzerrt und arabische TranslateOCR-Wortmarke samt Logo korrekt in Leserichtung gehalten.
- [ ] 3. Desktop-Installer für Windows, macOS und Linux. **Umgesetzt:** Electron-Fenster ohne manuelles Browseröffnen, lokal gespeicherte Konten/Workspace, OAuth-Rückruf für Systembrowser, Windows/macOS/Linux-Installerkonfiguration, App-Icons und GitHub-Release-Workflow; macOS-ARM64-DMG lokal gebaut, DMG und gebündelte LibreOffice-Konvertierung geprüft. **Offen:** Remote/Tag/Release, Windows- und Linux-Build/Abnahme, macOS-Intel-Abnahme, Install-/Updateabnahme und gegebenenfalls Herausgebersignierung. Keine Terminal-, Node- oder npm-Schritte für Endnutzer vorgesehen. Mobile Apps/PWA-Zugriff sind ausdrücklich nicht Teil dieses Ziels. Details: `docs/INSTALLABLE-APP.md`.
- [x] 4. **Letzter Warteschlangenplatz:** Demoablauf und fiktive Führerscheinbeispiele auf Deutsch, Englisch und Arabisch lokalisiert. Je Sprache Original mit Vorder- und Rückseite sowie eigene PDF-, Word- und ZIP-Ausgaben erstellt; den gesamten Browserablauf bis zum Download in allen drei Sprachen geprüft.
