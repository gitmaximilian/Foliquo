# Modellanbieter und Zugangsdaten

TranslateOCR kann entweder mit einer persönlichen ChatGPT-Anmeldung oder mit API-Schlüsseln für OpenAI, Anthropic Claude und DeepSeek arbeiten. Die App läuft lokal auf `127.0.0.1`; der gewählte Anbieter verarbeitet Dokumente, sobald ein Auftrag startet. Demo-Aufträge bleiben fiktiv und rufen kein Modell auf.

## ChatGPT-Konto

„Continue with ChatGPT“ öffnet den offiziellen Sign-in-with-ChatGPT-Ablauf. TranslateOCR fordert dabei separat die ausdrücklich angezeigte Erlaubnis zur Plan-Nutzung an. Das ist kein API-Schlüssel und keine Zusage, dass jedes ChatGPT-Konto für jeden Zweck oder jedes Modell freigeschaltet ist. OpenAI legt die Verfügbarkeit und Limits fest. SIWC ist für Anwendungen gedacht, die im lokalen Runtime-Kontext des jeweiligen Kontoinhabers laufen; das Konto darf nicht an einen anderen Benutzer weitergegeben werden.

OpenAI-Dokumentation: [Sign in with ChatGPT für Open-Source-Projekte](https://developers.openai.com/siwc/token-sharing-open-source), [Anmeldung und lokale Sitzung](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [Profile und Sitzungen](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions) und [Bedingungen](https://openai.com/policies/sign-in-with-chatgpt-terms/).

## API-Anbieter

Im Anbietermenü einen Anbieter wählen, den persönlichen Schlüssel im Passwortfeld einfügen und speichern. Der Schlüssel wird nur an den lokalen TranslateOCR-Dienst geschickt und im verschlüsselten `.local/workspace.enc` gespeichert. TranslateOCR gibt ihn nie an den Browser zurück, schreibt ihn nicht in Logs und nimmt ihn nicht in Backups oder Releasepakete auf. Auf einem zweiten Rechner muss der dortige Benutzer den eigenen Schlüssel erneut hinterlegen.

- **OpenAI API:** Schlüssel über die [OpenAI API-Plattform](https://platform.openai.com/api-keys). Die API wird separat vom ChatGPT-Abo abgerechnet; [Informationen zur getrennten Abrechnung](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).
- **Claude API:** Schlüssel und Guthaben über [Anthropic Console](https://console.anthropic.com/). Text, Bilder und PDF-Seiten werden über die Claude Messages API gesendet; siehe [PDF-Unterstützung](https://docs.anthropic.com/en/docs/build-with-claude/pdf-support) und [Modelle](https://docs.anthropic.com/en/docs/about-claude/models).
- **DeepSeek API:** Schlüssel und Guthaben über die [DeepSeek-Plattform](https://platform.deepseek.com/). Das in TranslateOCR angebotene Vision-Modell verarbeitet Fotos und konvertiert PDF-Seiten lokal in Bilder, bevor sie an DeepSeek gesendet werden. Siehe [Vision-Unterstützung](https://api-docs.deepseek.com/guides/vision/) und [Preise](https://api-docs.deepseek.com/quick_start/pricing/).

API-Aufrufe können bei diesen Anbietern Kosten erzeugen. Lies vor Verwendung aktuelle Preise, Aufbewahrungs- und Datenschutzbedingungen des jeweiligen Anbieters. Übersetze nur Dokumente, zu deren Übermittlung du berechtigt bist. Bei sensiblen Urkunden sind die Anforderungen des Auftraggebers und die Datenschutzvorgaben zu beachten.

## Sicherheit und Grenzen

TranslateOCR unterstützt ausschließlich feste offizielle API-Endpunkte; freie Server-URLs sind absichtlich nicht konfigurierbar. Das reduziert das Risiko, dass Zugangsdaten versehentlich an fremde Server gesendet werden. Das Speichern eines Schlüssels testet ihn nicht. „Modelle laden“ prüft den Anbieterzugriff, ohne Dokumente hochzuladen. Ein fehlgeschlagener Modellaufruf kann dennoch auf einen inaktiven Schlüssel, fehlende API-Abrechnung, regionale Einschränkungen oder Anbieterlimits hinweisen.

Die Jobs speichern Anbieter und Modell, damit Rückfragen, gezielte Neuvorschläge und spätere Überarbeitungen beim selben Anbieter bleiben. Ein Anbieterwechsel gilt nur für neue Aufträge. Vorhandene Dateien und Übersetzungen werden nicht automatisch neu verarbeitet.

API-Zugangsdaten gehören nicht in Issues, Screenshots, Logs, Git oder Chat-Nachrichten. Entferne einen Schlüssel im Anbieterbereich oder widerrufe ihn beim Anbieter, falls er offengelegt wurde.
