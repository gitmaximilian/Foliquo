# TranslateOCR Übergabe für Codex

## Auftrag und vorhandener Stand

Dies ist das vollständige lokale Übersetzungsprojekt für den Benutzer auf dessen Windows-PC. Oberfläche und Node-Dienst laufen lokal. Modellzugriff erfolgt wahlweise über persönlich autorisiertes ChatGPT oder API-Schlüssel für OpenAI, Claude und DeepSeek. Keine Konten mit anderen Personen teilen; jeder Benutzer autorisiert sein eigenes Konto bzw. trägt eigene API-Schlüssel ein. Keine Sites-Verknüpfung und kein Fernwartungsdienst.

Die Windows-Einrichtung liegt in `Setup-Windows.cmd`, der Starter in `Start-TranslateOCR.cmd`. `scripts/check-install.mjs` prüft Node, LibreOffice und eine fiktive Word-zu-PDF-Konvertierung ohne OpenAI-Anfrage. Windows selbst wurde auf dem Entwicklungs-Mac nicht ausgeführt; die erste Windows-Abnahme ist der nächste Schritt.

## Erste Schritte auf dem Ziel-PC

1. Windows-Version, Architektur und bestehende Node-/LibreOffice-Installation prüfen. Node 24 LTS ist der empfohlene Stand; das Projekt setzt mindestens Node 22 voraus.
2. `Setup-Windows.cmd` oder die entsprechenden nachvollziehbaren Installationsschritte ausführen. Die Startdateien zeigen fehlende Komponenten und bieten offizielle Windows-Paketmanagerinstallationen an. Systemfreigaben, Installationsvereinbarungen und Kontoanmeldung führt der Benutzer selbst aus.
3. In PowerShell im Projektordner `node scripts/check-install.mjs` und `npm.cmd test` ausführen. `npm.cmd` vermeidet Konflikte mit PowerShell-Skriptausführungsrichtlinien.
4. Mit `Start-TranslateOCR.cmd` oder `node server.mjs` starten. Standardadresse: `http://127.0.0.1:4318/`.
5. Der Benutzer meldet sich mit dem eigenen ChatGPT-Konto an oder hinterlegt einen eigenen API-Schlüssel. Keine Tokens, API-Schlüssel oder Kontodateien aus anderen Installationen übernehmen. Details: `docs/PROVIDERS.md`.
6. Einen fiktiven Auftrag mit zwei Bildseiten, eine Rückfrage, den Bearbeitungs-Chat, die Vorschau und alle finalen Downloads prüfen. Nach Neuladen soll derselbe Chat verfügbar sein, solange der Dienst läuft.

## Architektur

- `server.mjs`: lokaler HTTP-Dienst, Sitzungen/CSRF, OAuth-Rückruf, Queue-, Review- und Export-Endpunkte. Bindet ausschließlich Loopback und prüft Host/Origin.
- `lib/chatgpt.mjs`: dynamischer OAuth-Client, PKCE, State/Nonce, JWT-Prüfung, geschützter Kontospeicher, Token-Erneuerung, Modellkatalog und vollständige Responses-Streams.
- `lib/formats.mjs`: Signatur-/Größenprüfung, Office-Konvertierung, Bildnormalisierung. LibreOffice wird über `TRANSLATEOCR_SOFFICE` oder übliche Windows-/Linux-/Mac-Pfade gefunden. HEIC/HEIF und BMP verwenden plattformunabhängige JavaScript-Konverter; keine Abhängigkeit von macOS sips.
- `lib/translation-policy.mjs`: strukturierte Modellantworten, vollständige Übersetzung oder Rückfragen, Datums- und Terminologieregeln sowie Sperre offener Prüfpunkte.
- `lib/documents.mjs`: PDF-Satz und Anhang aller Originalseiten; arabische Zieltexte über LibreOffice.
- `lib/word.mjs`: bearbeitbare, makrofreie DOCX mit Absätzen und Tabellen; ZIP aus PDF und Word.
- `lib/queue.mjs`: serielle Erstübersetzungen, Status, Abbruch/Pause, Rückfragen, Restzeitschätzung und begrenzter Ergebnisspeicher.
- `lib/reviews.mjs`: eigener Bearbeitungs-Chat pro Auftrag, atomare neue Fassung, Versionsprüfung, Rückfragen und finale Freigabe.
- `lib/diagnostics.mjs`: bereinigte technische Fehlerdetails; Netzwerkursachen erhalten, Dokumente und Tokens nicht protokollieren.
- `dist/`: buildfreie Oberfläche. `app.js` Upload/Editor, `connection.js` lokale Verbindung/Export, `queue.js` Aufträge und `review.js` Chat/Vorschau/finaler Download. PDF.js samt Worker, Fonts, CMaps, WASM und Lizenz liegt lokal unter `dist/vendor/pdfjs/`.
- `tests/`: OAuth-, HTTP-, Queue-, Rückfrage-, Export-, Review- und Portabilitätstests mit fiktiven Daten.

## Wesentliche Produktregeln

Alle ausgewählten Dateien bilden einen Auftrag, z.B. Vorder- und Rückseite. Die Reihenfolge muss bis in Modellanfrage und PDF-Anhang erhalten bleiben. Nur die Zielsprache wird ausgewählt; Ausgangssprache und Dokumenttyp werden erkannt. Zusatzinfos und Rückfrageantworten bleiben dem Auftrag zugeordnet.

Vollständige Daten erscheinen als TT.MM.JJJJ. In deutschen Übersetzungen steht „Merkmale“ statt „Kennzeichen“ und „keine besonderen Merkmale“ statt „unversehrt“. Einzelne nicht sinnvoll übersetzbare arabische Buchstaben werden beschrieben und mit Lautschrift wiedergegeben. Mehrdeutige Angaben werden zuerst abgefragt. Offene Prüflisten oder Platzhalter gehören nicht in die finale Ausgabe.

Die gewünschte Überschrift lautet „Beglaubigte Übersetzung aus … ins …“. Die eigentliche Prüfung/Beglaubigung erfolgt anschließend durch den Übersetzer; keine Unterschrift, Siegel oder persönliche Eidserklärung automatisch erfinden.

Nach der ersten Ausgabe öffnet sich ein eigener Chat mit PDF-/Textvorschau. Erst Prüfung, dann finaler Download; kein automatischer Anfangsdownload. Promptänderungen werden vor der Übernahme als auswählbarer Vorschlag gezeigt. Änderungen erhalten nicht betroffene Inhalte und Originalseiten. Erst vollständig erzeugte PDF und Word werden gemeinsam als neue Version übernommen. Bei Fehlern bleibt die vorherige Version erhalten. Während einer Änderung und bei Rückfragen finale Downloads sperren. Veraltete Versionen serverseitig ablehnen. Derselbe Änderungsrequest darf nicht doppelt ausgeführt werden.

## Betrieb und Datenschutz

Die Anmeldung liegt unter `.local/chatgpt.json`; `.local/` ist privat und Git-ignoriert. Keine Passwörter erfragen, keine Tokens loggen, keine Kontoverbindungen als Teil eines Updates kopieren. Dokumente werden erst bei Auftragserteilung oder einer angeforderten Änderung an OpenAI übermittelt. Die Vorschau wird lokal gerendert.

Stand 0.7: Bibliothek, Aufträge und Chats werden verschlüsselt unter .local/workspace.enc gespeichert. Details, Grenzen und Prüflogik stehen in FEATURES.md. Vor Updates laufende Arbeit abschließen; Kontodaten, workspace.key und workspace.enc erhalten. Standardfrist 30 Tage; Backup per Oberfläche.

Der Dienst bleibt auf `127.0.0.1`. Eine Änderung auf öffentliche Bindung, fremde Origins oder Mehrbenutzerbetrieb ist ein eigenes Vorhaben und nicht für die Windows-Einrichtung nötig. Sicherheitsprüfungen von TLS, JWT und CSRF erhalten.

## Häufige Windows-Themen

- LibreOffice liegt gewöhnlich unter `C:\Program Files\LibreOffice\program\soffice.com` oder `.exe`. Ein abweichender Pfad kann per `TRANSLATEOCR_SOFFICE` konfiguriert werden. Die Konvertierung verwendet pro Vorgang ein eigenes temporäres Profil.
- Nach Node-Installation kann ein neues Terminal nötig sein. Die CMD-Starter ergänzen den üblichen Node-Pfad für ihren eigenen Prozess.
- Sharp installiert passende plattformspezifische Abhängigkeiten über `npm ci`; keine Mac-`node_modules` wiederverwenden.
- HEIC und BMP werden anhand der fiktiven Fixtures in den Portabilitätstests geprüft. Beschädigte oder nicht unterstützte Varianten müssen eine klare Meldung liefern.
- Browser-Rückruf muss exakt `http://127.0.0.1:4318/auth/callback` verwenden. `localhost` ist kein austauschbarer OAuth-Rückruf.
- `fetch failed` ist kein ausreichender Fehlerbericht: Diagnose-ID, Schritt, Codes und erreichbare Endpunkte prüfen. Keine automatische Wiederholung von Übersetzungs-POSTs nach unklarem Übertragungsabbruch.
- Bei PDF.js-Updates Bibliothek, Worker und Assets gemeinsam aktualisieren; beide Versionen müssen zusammenpassen.

## Änderungen prüfen

Nach funktionalen Änderungen passende Tests ausführen, dann den konkreten Ablauf im Browser prüfen. Bei Layoutänderungen PDF und Word rendern und visuell kontrollieren. Für Modelltests fiktive Dokumente verwenden; echte Personendokumente nur auf ausdrücklichen Benutzerauftrag verarbeiten. Nach erfolgreicher Windows-Abnahme diese Datei um Windows-Version, Node-/LibreOffice-Version, Testergebnis und noch vorhandene Einschränkungen ergänzen.

## Ausbau 0.6

Lies FEATURES.md für die vollständige Bedienung und bekannte Grenzen. Neue Module: workspace.mjs (AES-GCM/Sicherung/Bibliothek), template-import.mjs (sicherer DOCX-Import), verification.mjs (Prüffelder/Diffs), revisions.mjs (Auswahl/Wiederherstellen), providers.mjs (produktiver Adapter und feste Demo). Neue Oberfläche: workspace.js und inspector.js. Keine echten Dokumente als Fixtures hinzufügen. Neue Modellfunktionen müssen unabhängig von fiktiver Demo und technischen Tests fachlich evaluiert werden. API-Schlüssel liegen im verschlüsselten Workspace und sind aus Backups ausgeschlossen; siehe `docs/PROVIDERS.md`.

## Ausbau 0.7

Neue Module: protection.mjs (bestätigte ganze Feldzeilen schützen), form-fields.mjs (Vorlagenfelder, Inventarzusammenführung und besondere Bereiche), scans.mjs (unveränderte Originale plus korrigierte Arbeitskopien), memory.mjs (explizite Referenzen und Nachweise), dossiers.mjs (sitzungseigene gemeinsame Angaben), preflight.mjs (Artefaktprüfung) und benchmark.mjs. Oberfläche: workflow.js, scan-metrics.mjs und layout-audit.mjs. Direkte Änderungen müssen über commitDirect laufen; Versionsprüfung, Schutz und atomare PDF-/Word-Erzeugung erhalten.

73 Tests; drei fiktive Offline-Exportfälle. `npm run acceptance` erzeugt einen lokalen technischen Bericht. CI-Matrix und nativer Installer-Release laufen im öffentlichen Repository `gitmaximilian/TranslateOCR`. Der macOS-ARM64-DMG wurde lokal geprüft; Windows und Linux sowie die Intel-Mac-Pakete müssen auf echten Zielsystemen abgenommen werden. Vor Qualitätsaussagen fachlich freigegebene Referenzen und echte Modell-Evaluation ergänzen. Details: FEATURES.md, CONTRIBUTING.md und docs/.

## Ausbau 0.8

Studio-Funktionen liegen in `lib/studio.mjs` und `lib/refine.mjs`, Scan-Korrekturen in `lib/scans.mjs`, Freigabe-/Rollback-Update in `lib/release.mjs`. `dist/studio.js` hält Synchronisierung, gezielte Feldvorschläge, Praxisbericht und Live-Layoutvorschau. Die Seitenreihenfolge ist eine Arbeitskopie und verändert das Original nicht. Die Demo aus `dist/demo/` ist eine feste lokale Webdemo mit gebündelten PDF-/Word-Beispielen; `scripts/build-demo.mjs` baut sie ausschließlich aus fiktiven Inhalten und erstellt `outputs/TranslateOCR-Demo.zip`.

Der Korrekturvorschlag vergleicht aufeinanderfolgende Fassungen und zeigt allgemeine Wiederholungen nur zur ausdrücklichen Glossarfreigabe; automatische Modellanpassung findet nicht statt. Der gezielte Neuversuch verarbeitet eine Seite des Ausgangs-PDFs und zeigt erst einen Vorschlag; er ersetzt keine vollständige Neuübersetzung oder fachliche Prüfung.

`tests/acceptance.test.mjs` testet Update und Wiederherstellung mit temporären fiktiven Daten. `scripts/acceptance.mjs` hält den Laufbericht lokal unter outputs/ fest. Echter Windows-Installer, Updateablauf und Office-Darstellung bleiben auf dem Zielrechner zu prüfen; Vorgehen in docs/WINDOWS-ABNAHME.md. Fachliche Zehn-Fälle-Prüfung siehe docs/PRAXISTEST.md. Demo-Anleitung und öffentliches Veröffentlichungsmodell siehe docs/DEMO.md. Der öffentliche Quellstand ist unter MIT-Lizenz auf GitHub veröffentlicht; Installerstatus steht in docs/INSTALLABLE-APP.md.

## Native Desktop-Paketierung und GitHub-Releases

`desktop/main.mjs` startet das lokale HTTP-Modul direkt in einem abgesicherten Electron-Fenster und speichert Daten in Electron `userData/.local`. Der Dienst bindet weiterhin nur an `127.0.0.1`. Externe HTTPS-Navigation öffnet sich im Systembrowser. `allowExternalOAuthCallback` aktiviert den Systembrowser-Rückruf mit dem einmaligen OAuth-State und PKCE; die App aktualisiert sich, sobald der gemeinsame lokale ChatGPT-Connector erfolgreich ist. Renderer-Sandbox, Context-Isolation und deaktivierte Node-Integration beibehalten.

`npm run desktop:build` erzeugt einen Windows-NSIS-, macOS-DMG- oder Linux-DEB/RPM-Build für das jeweilige Hostsystem. Das CI-Workflow `desktop-release.yml` richtet LibreOffice ein, baut Windows, macOS ARM64, macOS Intel und Linux und veröffentlicht Artefakte bei einem `v*`-Tag. macOS/Windows sind derzeit unsigniert. Linux-Pakete deklarieren LibreOffice Writer als Paketabhängigkeit. Öffentliches Repo: `https://github.com/gitmaximilian/TranslateOCR`; Download-Link: `https://github.com/gitmaximilian/TranslateOCR/releases/latest`. Installationspfade müssen auf echten Zielsystemen manuell abgenommen werden.

Lokal wurde ein macOS-ARM64-DMG erstellt, dessen Prüfsumme gültig ist; die enthaltene LibreOffice-Konvertierung wurde mit einem fiktiven Dokument geprüft. Electron-App-Start, Windows/Linux-Paketierung, Intel-Mac-Builds und Release-Upload sind nicht auf diesem Rechner abgenommen. Es gibt weiterhin kein eingerichtetes Git-Remote und keine gewählte Open-Source-Lizenz. `.gitignore` schützt lokale Daten, Schlüssel, Backups und Buildausgaben. Details: `docs/INSTALLABLE-APP.md`.
