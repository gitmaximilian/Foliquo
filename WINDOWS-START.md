# TranslateOCR auf Windows installieren

## Für den späteren GitHub-Release

Der fertige Endnutzerweg ist: passende `TranslateOCR-…-Windows-x64.exe` aus dem GitHub-Release laden, installieren und danach das Startmenü- oder Desktop-Symbol anklicken. Node.js, npm, LibreOffice oder Terminal sollen nicht manuell eingerichtet werden. Die Release-Pipeline und der Windows-Installer sind vorbereitet, aber noch nicht auf GitHub veröffentlicht oder auf einem echten Windows-PC abgenommen. Nicht digital signierte Installationsdateien können eine Windows-SmartScreen-Meldung zeigen.

## Technische Zwischenlösung aus dem Quellcode

Die folgenden Schritte gelten nur, wenn der GitHub-Installer noch nicht veröffentlicht ist oder jemand das Projekt selbst entwickelt. WSL, SSH und Tailscale sind nicht nötig.

## Einrichten

1. Die ZIP vollständig in einen eigenen Ordner entpacken, zum Beispiel `Dokumente\TranslateOCR`. Die Anwendung nicht direkt aus der ZIP starten.
2. `Setup-Windows.cmd` doppelklicken. Es prüft Node.js, bietet bei Bedarf die Installation von Node LTS und LibreOffice über den Windows-Paketmanager an und installiert die Projektabhängigkeiten. Systemfreigaben und Installationsbedingungen bestätigst du selbst.
3. Optional `Install-Windows.cmd` starten, um einen eigenen Installationsordner und eine Desktopverknüpfung anzulegen. Danach `Start-TranslateOCR.cmd` im Zielordner oder die Desktopverknüpfung doppelklicken. Der lokale Dienst startet im Hintergrund und öffnet `http://127.0.0.1:4318/`. Nach einem Computerneustart dieselbe Verknüpfung erneut anklicken. Der Dienst läuft bis zum Herunterfahren weiter; zum vorzeitigen Beenden den TranslateOCR-Node-Prozess im Task-Manager schließen.
4. Standardmäßig „ChatGPT-Konto“ wählen, „Continue with ChatGPT“ anklicken und das eigene berechtigte Konto verbinden. Alternativ im Anbietermenü OpenAI API, Claude API oder DeepSeek API wählen und den eigenen API-Schlüssel direkt auf diesem PC hinterlegen. API-Anbieter können separat Kosten verursachen. Keine Anmeldung oder Schlüssel einer anderen Person übernehmen; Details: `docs/PROVIDERS.md`.

Wenn der Windows-Paketmanager fehlt, Node.js 24 LTS von [nodejs.org](https://nodejs.org/) und LibreOffice von [libreoffice.org](https://www.libreoffice.org/download/) installieren und das Setup erneut starten. Bei abweichendem Office-Installationsort kann dein Codex `TRANSLATEOCR_SOFFICE` auf die ausführbare LibreOffice-Datei setzen.

## Verwenden

Vorder- und Rückseite gemeinsam auswählen oder nacheinander hinzufügen. Vor dem Start die Reihenfolge mit den Pfeilen prüfen. Zusatzinfos können die Namensschreibweise und bekannte Angaben vorgeben. Fehlende Angaben werden vor der Übersetzung abgefragt.

Nach der Übersetzung öffnet sich der Prüfbereich. Kritische Angaben am Original prüfen und bestätigen. Danach gibt es PDF und Word zusammen als ZIP. Im Bearbeitungs-Chat kannst du Änderungen per Prompt anfordern und die aktualisierte PDF- oder Textvorschau prüfen. Abschließend „Finale PDF“, „Finales Word“ oder „Beide final herunterladen“ wählen.

Datumsformat: TT.MM.JJJJ. Gewünschte deutsche Begriffe: „Merkmale“ und „keine besonderen Merkmale“. Die PDF enthält die Übersetzung und die Originalseiten; Word enthält den bearbeitbaren Übersetzungstext. Änderungen werden zuerst als Vorschlag angezeigt und können einzeln übernommen werden. Prüfung und tatsächliche Beglaubigung übernimmt der Übersetzer.

## Mit deinem eigenen Codex weiterarbeiten

Den entpackten Ordner als Projekt in Codex öffnen. Zum Start diesen Auftrag verwenden:

> Lies AGENTS.md und CODEX-HANDOVER.md. Richte TranslateOCR auf diesem Windows-PC ein, prüfe Node.js und LibreOffice und führe die Installationsprüfung sowie die Tests aus. Starte danach die lokale Anwendung. Ich verbinde mein eigenes ChatGPT-Konto selbst. Wenn eine Windows-spezifische Abweichung auftaucht, behebe sie im Projekt und prüfe den vollständigen Ablauf mit fiktiven Testdateien.

Das Projekt enthält seine eigene Codex-Dokumentation. Zugangsdaten werden erst bei deiner Anmeldung lokal erzeugt und liegen in `.local/`. Im Übergabepaket sind keine fremden Zugangsdaten oder Dokumente enthalten.

## Wenn etwas nicht funktioniert

Das Startfenster offen lassen und die Fehlermeldung in Codex prüfen lassen. In der Anwendung gibt es „Verbindung & Diagnose“ und pro Auftrag einen Debug-Verlauf mit herunterladbarem Diagnosebericht. Dokumentinhalte und Tokens gehören nicht in Fehlerberichte.

Zum Beenden das Startfenster schließen oder Strg+C drücken. Aufträge und Chats werden lokal verschlüsselt gespeichert und bleiben mit demselben Browser über Neustarts erhalten. Standardfrist: 30 Tage. Unter „Bibliothek“ kannst du Vorlagen, Glossar, Beispiele und verschlüsselte Backups verwalten. Details stehen in FEATURES.md. ChatGPT-Anmeldung und API-Schlüssel bleiben auf diesem PC; Schlüssel werden nicht in Backups oder Updatepakete aufgenommen.

## Stand der Windows-Prüfung

Die Windows-Starter und plattformübergreifenden Konverter sind vorbereitet. Automatisierte Tests und die Office-Installationsprüfung wurden auf dem Entwicklungs-Mac ausgeführt. Die tatsächliche Windows-Abnahme übernimmt dein Codex auf deinem PC. Unterstützte Node-LTS-Version und LibreOffice sind erforderlich; ein API-Schlüssel ist für den ChatGPT-Zugang nicht erforderlich; die Verfügbarkeit entscheidet OpenAI für dein Konto. Alternative API-Anbieter benötigen einen eigenen Schlüssel und können Kosten verursachen.

## Aktualisieren

Laufende Arbeit abschließen und ein Backup erstellen. Die Anwendung beenden. Neues Paket separat entpacken. In der bisherigen Installation Update-Windows.cmd starten und den neuen Quellordner angeben. Prüfsummen kontrollieren die Dateien, sind aber keine Herausgebersignatur. Verwende nur ein Paket aus einer vertrauenswürdigen Quelle. Private Daten bleiben im bisherigen Installationsordner.

## Neue Werkzeuge in 0.7

Im Prüfbereich einzelne Werte oder den Text direkt ohne Modellaufruf korrigieren. Bestätigte Felder können geschützt werden. Jede Änderung erzeugt eine neue PDF-/Word-Version und setzt die Prüfung zurück. Optionale Funktionen sind eingeklappt: Vorlage, Referenzen, Dossier, Scan-Arbeitskopie, Stempel und Versionen. Dossiers speichern bestätigte gemeinsame Angaben und zeigen Widersprüche. Vor dem finalen Download Druckkontrolle und eigene Sichtprüfung durchführen.

Für den eigenen Codex: zusätzlich CONTRIBUTING.md lesen, `npm.cmd run benchmark` für drei fiktive Offline-Exportfälle ausführen. Die vorbereitete CI ersetzt die erste Prüfung auf diesem Windows-PC nicht.

## Neue Werkzeuge in 0.8

Unleserliche Stellen können mit Rückfrage und Fundstelle vor der Übersetzung geklärt werden. Ein einzelnes Feld kann anhand der passenden PDF-Seite neu vorgeschlagen werden; der Rest der Übersetzung bleibt erhalten und die Änderung muss geprüft und übernommen werden. PDF-Seiten können in einer Arbeitskopie umgeordnet werden; die Originalseiten bleiben im Anhang erhalten. Die Bibliothek bietet eine Live-PDF-Vorschau für Tabellenspalten, Absatzabstand und zusammengehaltene Tabellenzeilen.

`npm.cmd run acceptance` erzeugt einen lokalen technischen Abnahmebericht und prüft Installationskonvertierung, Update-Rollback in isolierten temporären Dateien, verschlüsselte Sicherung und Wiederherstellung sowie fiktive Exporte. Dieser Befehl wurde hier auf macOS ausgeführt; der echte Windows-Abnahmelauf und die manuelle Sichtprüfung sind auf dem Ziel-PC noch offen. Siehe [docs/WINDOWS-ABNAHME.md](docs/WINDOWS-ABNAHME.md) und [docs/PRAXISTEST.md](docs/PRAXISTEST.md). Die Demo unter `/demo/` und `TranslateOCR-Demo.zip` sind vollständig fiktiv und machen keine Modellanfragen.
