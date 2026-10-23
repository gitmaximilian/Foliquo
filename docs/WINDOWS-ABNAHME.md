# Windows Abnahme

Diese Prüfung wird auf dem Ziel-PC durchgeführt. Der Mac-Test und eine vorbereitete CI-Konfiguration ersetzen sie nicht. Vor echten Daten mit der festen Demo testen.

1. Das Übergabepaket in einen neuen Ordner entpacken. Setup und optional Install-Windows.cmd ausführen. Windows-Version, Architektur, Node- und LibreOffice-Version dokumentieren.
2. `npm.cmd run acceptance` ausführen. Der Lauf prüft Office-Konvertierung, isolierten Update-Rollback, verschlüsselte Backup-Wiederherstellung und fiktiven Exportbenchmark. Bericht: outputs/acceptance-report.json. Das absichtlich fehlgeschlagene Update betrifft ausschließlich temporäre fiktive Verzeichnisse. Die reale Installation und `.local` werden dabei nicht aktualisiert.
3. `npm.cmd test` ausführen und die lokale Anwendung starten. Mit zwei fiktiven Seiten Upload, Seitenrolle, Reihenfolge und Duplikatmeldung prüfen. Den Demoauftrag, Direktkorrektur, geschütztes Feld, erneute Verarbeitung einer Stelle und alle Downloads prüfen.
4. Ein privates Backup mit ausschließlich fiktiven Testdaten erzeugen. In einer separaten Testinstallation mit eigenem Browserprofil wiederherstellen. Keine echten Kontodateien kopieren. Die Wiederherstellung ersetzt vorhandene Workspace-Daten; nur die vorbereitete Testinstallation verwenden.
5. Das Update in einer separaten Testinstallation aus einem vollständigen Releasepaket durchführen. Danach alte Aufträge, Bibliothek und Kontoverbindung prüfen. Erst nach erfolgreicher Abnahme das normale Update verwenden. Rollback bei geänderter Abhängigkeitsinstallation kann ein erneutes npm ci benötigen.
6. PDF und Word extern öffnen. Tabellen, Schrift, Datum, Beglaubigungsüberschrift und Originalseiten prüfen. Die Beglaubigung selbst bleibt beim Übersetzer.

## Protokoll

- Datum und Prüfer: offen
- Windows und Architektur: offen
- Node und LibreOffice: offen
- Automatische Abnahme: offen
- Manueller Ablauf und Office-Darstellung: offen
- Update und Wiederherstellung in Testinstallation: offen
- Freigabe oder konkrete Fehler: offen

Dem eigenen Codex diesen Auftrag geben: „Lies AGENTS.md, CODEX-HANDOVER.md und docs/WINDOWS-ABNAHME.md. Führe die Abnahme mit fiktiven Daten aus. Erhalte meine Kontoverbindung und privaten Daten. Dokumentiere tatsächlich bestandene und offene Schritte. Ich übernehme neue Anmeldungen selbst.“
