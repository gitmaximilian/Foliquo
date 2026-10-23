# TranslateOCR Desktop-Installer

## Ziel

Der Nutzer soll auf GitHub die zum Computer passende Installationsdatei laden, TranslateOCR installieren und danach über ein App-Symbol starten. Er soll weder Node.js, npm, Terminal, Paketmanager noch Projektdateien selbst einrichten müssen. Beim ersten Start meldet er sich mit seinem eigenen Modellkonto an. Dokumente, Zugangsdaten und der verschlüsselte Workspace bleiben auf seinem Computer.

## Umgesetzt

- **Desktopfenster:** Electron startet den lokalen Dienst direkt in einem TranslateOCR-Fenster. Der Nutzer muss keinen Browser öffnen; die Renderer-Sandbox bleibt aktiviert.
- **Lokale Daten:** ChatGPT-Verbindung, verschlüsselter Workspace und Sitzungen liegen im TranslateOCR-Benutzerordner des Betriebssystems. Jede Installation verwendet das eigene Konto.
- **Anmeldung:** ChatGPT öffnet sich im Systembrowser. Der OAuth-Rückruf ist an einen einmaligen, ablaufenden Zustand und PKCE gebunden; nach erfolgreicher Rückkehr aktualisiert sich das Desktopfenster.
- **Paketbau:** Windows-NSIS-Installer, macOS-DMG sowie Linux-DEB/RPM sind konfiguriert. Eine GitHub-Action baut Windows, macOS ARM64, macOS Intel und Linux und lädt Installer beim Versionstag als Release hoch.
- **LibreOffice:** Das macOS-Paket enthält LibreOffice; Windows baut es aus der CI-installierten LibreOffice-Version ein. Linux-Installationspakete deklarieren LibreOffice Writer als reguläre Systemabhängigkeit, die der grafische Paketmanager beim Installieren mitauflöst.
- **Getestet:** Ein macOS-ARM64-DMG wurde lokal gebaut und die Prüfsumme validiert. Die LibreOffice-Konvertierung aus dem gebündelten macOS-Paket wurde erfolgreich geprüft. Der vollständige App-Start, Windows- und Linux-Build sowie der Release-Upload sind noch nicht abgenommen.

Die macOS-App ist nicht mit einer Apple Developer ID signiert oder notarisiert. Windows- und macOS-Systeme können deshalb eine Herausgeber-/Sicherheitsmeldung zeigen. Signierung verlangt Herausgeberkonten und Zertifikate; diese sind nicht vorhanden.

## Status

Das neue öffentliche Repository ist [gitmaximilian/TranslateOCR](https://github.com/gitmaximilian/TranslateOCR). Die MIT-Lizenz und ein bereinigter Startverlauf sind enthalten; persönliche lokale Daten und die frühere Sites-Projekt-ID wurden nicht übertragen. Der automatisierte 0.8.3-Plattformbuild läuft.

Noch ausstehend sind die tatsächlichen grafischen Installationstests auf Windows, macOS Intel/ARM und Linux sowie Updates und Datenmigration auf den Zielrechnern. macOS und Windows bleiben ohne Herausgeberzertifikate unsigniert und können beim Start Sicherheitsmeldungen anzeigen.

## Nicht im Ziel

TranslateOCR bleibt eine lokale Einzelplatz-Desktop-Anwendung für Windows, macOS und Linux. Es wird kein öffentlicher Übersetzungsserver eingerichtet. Installer-Updates werden zunächst manuell vom GitHub-Release heruntergeladen; ein automatischer In-App-Updater ist noch nicht enthalten.

## Releases herunterladen

Installer werden in den [GitHub-Releases](https://github.com/gitmaximilian/TranslateOCR/releases/latest) veröffentlicht, sobald alle Plattformjobs für den Versions-Tag erfolgreich sind. Die Windows-ZIP ist nur eine Quell-/Übergabeversion und kein fertiger Desktop-Installer.
