# TranslateOCR 0.8

## Sprachen und Erststart

Englisch ist die Standardsprache beim ersten Start. Die Oberfläche unterstützt Englisch, Deutsch und Arabisch einschließlich RTL-Layout. Ein animiertes Intro erklärt Upload, Modellwahl und Prüfung, fragt Name und bevorzugte Sprache ab und begrüßt den Nutzer bei späteren Starts kurz in der gewählten Sprache. Die Einstellungen werden lokal im verschlüsselten Workspace gespeichert; das lateinische TranslateOCR-Wortzeichen bleibt auch in der arabischen Ansicht links nach rechts gesetzt.

## Private Vorlagen und Beispiele

Die Bibliothek importiert makrofreie DOCX-Dateien als editierbaren Vorschlag für Schrift, Größe, gleichmäßige Seitenränder, Zeilenabstand und Feldnamen. Komplexe frei platzierte Word-Elemente werden nicht originalgetreu geklont. Prüfen und Bestätigen ist erforderlich. Eine Vorlage gibt Dokumentaufbau und Layout vor; ein Ausgabeprofil kann persönliche Kopf-/Fußzeilen und einen eigenen Beglaubigungstext ergänzen. Letzterer wird nur bei bewusster Auswahl im finalen Download eingefügt. Das Programm setzt keine echte Unterschrift oder ein Siegel.

Originale und geprüfte Übersetzungen können ausdrücklich als private Beispielpaare gespeichert werden. Aufträge verwenden nur bei aktivierter Option bis zu zwei passende freigegebene Beispiele, bevorzugt zur gewählten Vorlage. Die Auswahl verwendet Dokumenttyp und Suchbegriffe. Es handelt sich um Referenzen im Modellkontext, nicht um Modelltraining. Die Auswahl ist keine semantische Vektorsuche. Keine automatische Übernahme von Personen oder Zahlen aus Beispielen.

Das Glossar unterscheidet globale Begriffe einer Zielsprache und Schreibweisen für genau einen Auftrag. Neue Begriffe werden nur durch den ausdrücklichen Speicherbefehl übernommen.

## Prüfen und ändern

Vor der ersten echten Übersetzung erfasst ein separater Modellaufruf kritische Originalfelder. Die Übersetzung ordnet Zielwerte zu; ein deterministischer Textvergleich kennzeichnet fehlende Zielwerte. Zahlen und erkennbare Datumswerte werden zusätzlich mit dem Originalwert verglichen; abweichende lateinische Namensschreibweisen werden hervorgehoben. Formatänderungen wie arabische Ziffern zu lateinischen Ziffern oder „7 March 1998“ zu „07.03.1998“ werden berücksichtigt. Andere Kalender und nicht erkannte Formate benötigen die manuelle Prüfung. Diese zwei Modellaufrufe können dieselben Erkennungsfehler machen und sind keine Garantie für Vollständigkeit. Zusätzliche manuelle Pflichtprüfungen bleiben daher immer bestehen. Die zusätzliche Erfassung erhöht Laufzeit und Modellnutzung.

Prüffelder verweisen auf Originaldatei, Seite und – soweit geliefert – einen Bildbereich. Die Position wird vom Modell geschätzt und muss mitgeprüft werden. Nicht vorhandene Koordinaten werden nicht erfunden. Original und passender Übersetzungstext lassen sich nebeneinander prüfen. Rückfragen zeigen das Original, ggf. den zugeordneten Ausschnitt; bessere Aufnahmen können dem Auftrag hinzugefügt werden und bleiben im Originalanhang.

Promptänderungen erzeugen zunächst einen Vorschlag mit sichtbaren Textunterschieden. Einzelne Änderungen können übernommen, der Vorschlag verworfen und frühere Textfassungen als neue Version wiederhergestellt werden. PDF und Word werden gemeinsam neu gebaut. Maximal zehn Textfassungen bleiben je Auftrag erhalten. Vorschläge und offene Rückfragen sperren den finalen Download; jede neue Fassung benötigt erneut bestätigte Prüfpunkte.

Die Anfangsausgabe wird nicht mehr ungefragt heruntergeladen. Zuerst öffnet sich der Prüfbereich. Der manuelle Editor bleibt ein separater freier Exportweg; nur im Auftragsworkflow gibt es versionierte Prüfung und Freigabe.

## Dauerhafter Speicher

Bibliothek, Aufträge, Originale, Ergebnisse und Chats liegen verschlüsselt mit AES-256-GCM unter `.local/workspace.enc`. Der automatisch erzeugte Schlüssel liegt separat unter `.local/workspace.key`. Wer auf beide Dateien zugreifen kann, kann entschlüsseln; ein geschütztes Betriebssystemkonto bleibt erforderlich. Die ChatGPT-Anmeldung wird wie bisher separat verwaltet. API-Schlüssel werden im gleichen verschlüsselten Workspace gespeichert, aber weder über den Workspace-Endpunkt an den Browser zurückgegeben noch in Backups aufgenommen.

Standardfrist: 30 Tage nach letzter Fertigstellung, konfigurierbar von 1 bis 365 Tagen. Abgelaufene Ergebnisse werden verworfen; bei einem Neustart werden entsprechend alte Aufträge entfernt. Der Workspace ist auf 256 MB und die aktive Queue auf 160 MB begrenzt. Unter Speicherdruck können ältere fertige Ergebnisse früher aus der Queue entfernt werden. Ein regelmäßiges eigenes Backup ist sinnvoll.

Die Sitzung des verwendeten Browsers bleibt über Neustarts hinweg erhalten. Ein neuer Browser bzw. gelöschte Cookies erhält keinen Zugriff auf alte Aufträge; ein eigenes passwortgeschütztes Backup kann in die neue Sitzung übernommen werden. Nach einem Absturz werden laufende Übersetzungen nicht automatisch erneut gesendet. Gespeicherte wartende Aufträge benötigen bewusstes Fortsetzen.

Backups enthalten private Sammlungen und Aufträge, aber keine ChatGPT-Anmeldung, API-Schlüssel oder Browser-Sitzungstokens. Sie verwenden einen aus dem mindestens zwölfstelligen Passwort per scrypt abgeleiteten Schlüssel. Wiederherstellen ersetzt die aktuellen Sammlungen und ordnet die Aufträge der aktuellen lokalen Sitzung zu.

## Installation, Updates und Modelladapter

Windows: Setup-Windows.cmd richtet benötigte Komponenten ein. Install-Windows.cmd kopiert das Projekt in den gewählten Ordner und erstellt eine Desktopverknüpfung. Start-TranslateOCR.cmd startet die Anwendung. Updates erfolgen aus einem selbst bezogenen, separat entpackten Paket über Update-Windows.cmd. Dateiprüfsummen erkennen Veränderungen; sie ersetzen keine digitale Herausgebersignatur. Die Herkunft des Quellpakets muss vertrauenswürdig sein. Private Daten werden nicht überschrieben. Bei einem Updatefehler wird der bisherige Quellcode wiederhergestellt; Abhängigkeiten müssen ggf. erneut installiert werden.

Es gibt noch keinen signierten EXE-Installer und keinen automatischen Onlinedienst für Updates. Die Windows-Skripte sind auf dem Mac vorbereitet und benötigen eine echte Windows-Abnahme.

Die Modellanbindung ist in `lib/providers.mjs` gekapselt. Unterstützt werden die persönlich autorisierte ChatGPT-Verbindung, OpenAI API, Claude API und DeepSeek API. API-Schlüssel liegen nur im verschlüsselten lokalen Workspace, werden weder an den Browser zurückgegeben noch ins Backup exportiert. Aufträge pinnen Anbieter und Modell für Rückfragen und Bearbeitungen. PDF-Eingaben werden für DeepSeek lokal in Bildseiten gerendert. Anbieterhinweise, Kosten und Grenzen: `docs/PROVIDERS.md`.

„Demo ohne Konto“ ist ein vollständig lokalisierter, geskripteter Beispielablauf auf Deutsch, Englisch und Arabisch. Je Sprache gibt es ein fiktives Original und passende PDF-, Word- und ZIP-Ausgaben. Die Demo sendet keine Modellanfrage und ist keine echte Beglaubigung.

## Open Source

Persönliche Beispiele, Kontodaten, Archive, Backups und echte Urkunden bleiben außerhalb des Releasepakets. Die öffentliche Veröffentlichung, endgültige Lizenzwahl und Prüfung aller Drittanbieterhinweise sind ein eigener noch ausstehender Vorbereitungsschritt. Die lokale Funktionalität ist unabhängig vom früheren Sites-Hosting.

## Ausbau 0.7

### Referenzbenchmark und Entwicklung

Drei vollständig fiktive Fälle (englischer Führerschein, englische Geburtsurkunde, arabischer Führerschein) prüfen Namen, Daten, Nummern, Pflichtinhalte, besondere Bereiche und technische Layoutbefunde. `npm run benchmark` verwendet vorgegebene Übersetzungen für einen Offline-Exporttest. Eigene Ergebnisse und ein Vergleichsbericht lassen sich über `--results` und `--baseline` auswerten. `--live --model MODELL_ID` startet bewusst einen Modelltest mit diesen fiktiven Daten. Die Referenzen sind nicht fachlich als Goldstandard freigegeben; die Offline-Ergebnisse messen keine KI-Übersetzungsqualität.

`npm run setup`, CONTRIBUTING.md sowie Vorlagen für Issues und Pull Requests erleichtern die Mitarbeit. Die CI-Matrix für Node 24 auf Windows, macOS und Linux ist angelegt. Sie läuft erst im veröffentlichten GitHub-Repository und wurde hier nicht auf fremden Betriebssystemen ausgeführt.

### Direkte Korrekturen und geschützte Angaben

Im Prüfbereich können einzelne Feldwerte oder der vollständige Übersetzungstext ohne Modellaufruf bearbeitet werden. PDF und Word werden atomar als neue Version erzeugt; alle Prüfpunkte müssen erneut bestätigt werden. Mehrfach vorkommende Feldwerte benötigen den vollständigen Texteditor, damit keine falsche Stelle ersetzt wird.

Am Original bestätigte Felder können geschützt werden. Die zugehörige ganze Textzeile wird bei Direktkorrektur, Übernahme eines Modellvorschlags und Wiederherstellung gegen Änderungen geschützt. Änderungen benötigen eine ausdrückliche Freigabe genau der betroffenen Felder. Die Freigabe gilt für die angeforderte Änderung; der neue Wert bleibt anschließend geschützt.

### Scan-Arbeitskopien und Formularvorlagen

Bilder können lokal auf Auflösung, Helligkeit und Schärfeindikatoren geprüft werden. Hinweise sind Heuristiken und erkennen nicht jeden Fehler. Bilder lassen sich manuell drehen und über relative Koordinaten beschneiden. PDFs lassen sich seitenweise gemeinsam drehen; PDF-Zuschnitt ist nicht implementiert. Die unveränderten Originale bleiben erhalten und im Originalanhang, während das Modell die korrigierte Arbeitskopie erhält.

Vorlagen können bis zu 60 feste Felder mit Original-/Zielbezeichnung, Datentyp, Pflichtstatus, Datei, Seite und optionalem relativen Bildbereich definieren. Fehlende Pflichtwerte führen vor der Ausgabe zu Rückfragen. Das sind Feldzuordnungen für die Extraktion und strukturierte Ausgabe, keine beliebige pixelgenaue PDF-Formularbefüllung.

### Referenzen und Dossiers

Vor dem Auftrag lassen sich freigegebene Beispiele suchen und bis zu zwei gezielt auswählen. Ohne gezielte Auswahl greift bei aktivierter Beispielnutzung die bestehende automatische Auswahl. Die Ausgabe zeigt verwendete Referenzen und längere wörtliche Textübereinstimmungen. Dieser Nachweis ist kein semantischer Herkunftsbeweis; Werte aus Referenzen werden nicht ungefragt übernommen.

Dossiers bündeln Aufträge derselben lokalen Browsersitzung und ausdrücklich bestätigte gemeinsame Angaben wie Namen, Geburtsdatum und Geburtsort. Widersprüche werden als Prüfpunkte angezeigt. Ein Dossier ersetzt keine Prüfung am Original. Dossiers werden verschlüsselt gespeichert und in private Backups aufgenommen.

### Besondere Bereiche und Druckkontrolle

Erkannte Stempel, Siegel, Handschrift und Unterschriften erscheinen separat mit Originalstelle und Übersetzung. Übersehene Bereiche können manuell ergänzt werden. Änderungen erzeugen eine neue Fassung; eine Vollständigkeitsprüfung bleibt verpflichtend.

Die Druckkontrolle prüft PDF-/Word-Struktur, Seitenzahl und erkennbare Ersatzzeichen. „PDF-Seiten prüfen“ untersucht zusätzlich Textpositionen und fast leere Übersetzungsseiten im Browser. Neue Auffälligkeiten setzen eine vorhandene Druckbestätigung zurück. Tabellenumbrüche, alle Glyphen und das gesamte Schriftbild bleiben visuell zu prüfen; es gibt keine Fehlerfreiheitsgarantie.

## Technische Abnahme dieses Stands

67 automatisierte Tests bestanden. Der vollständige geführte Demoablauf bis zum Download wurde im Browser auf Deutsch, Englisch und Arabisch geprüft. Je Sprache sind PDF, Word und ZIP vorhanden; die arabische Originalurkunde enthält beide Seiten. `npm run acceptance` lief zuvor auf macOS (Node 23.11, arm64) durch: Office-Konvertierung, neun isolierte technische Abnahmetests und drei fiktive Offline-Exportfälle. PDF und Word wurden gerendert und visuell kontrolliert. Mobile Demo wurde bei 390 Pixeln geprüft; Seiteninhalt blieb bei 390 Pixeln ohne horizontales Überlaufen.

## Ausbau 0.8

Namensschreibweisen können für jeden Auftrag vorgegeben werden. Wenn ein arabischer Name eine lateinische Pass-/Dokumentschreibweise benötigt oder eine Stelle unleserlich bleibt, fragt TranslateOCR vor dem Übersetzen nach. Antworten und erkannte Fundstellen werden für den Auftrag festgehalten.

Im Prüfbereich lassen sich Originalfelder und Übersetzung nebeneinander markieren. Ein gezielter Neuversuch sendet nur die entsprechende Original-PDF-Seite an den gewählten Adapter, erhält andere Felder und stellt eine Änderung als Vorschlag dar. Bei Bildern wird das gesamte Bild verwendet. Das Feld darf nicht geschützt sein; offene Rückfragen müssen beantwortet sein.

Duplikate werden anhand des Datei-Inhalts erkannt. Dateien lassen sich als Vorderseite, Rückseite oder Beilage markieren. Für PDFs kann die Reihenfolge sämtlicher Seiten in einer Arbeitskopie geändert werden; keine Originalseite wird weggelassen und der Anhang nutzt weiterhin das Original. Rotieren/Beschneiden bleibt wie beschrieben manuell.

Wiederholte Änderungen an allgemeinen Begriffen können in der Bibliothek vorgeschlagen werden, wenn dieselbe Änderung in mindestens zwei Fassungen vorkommt. Namen, Geburtsangaben und Nummern werden ausgeschlossen. Der Benutzer muss einen Vorschlag ausdrücklich ins Glossar übernehmen. Das ist eine vorsichtige Gedächtnisstütze und kein Lernen oder Trainieren des Modells.

Die Ausgabeprofilvorschau zeigt die tatsächlich generierte PDF-Vorschau. Spaltenbreite, Absatzabstand und zusammengehaltene Tabellenzeilen sind konfigurierbar; `[Seitenumbruch]` fügt einen Umbruch ein. Das Word bleibt bearbeitbar.

Die Praxis-Testfunktion erfasst Zeit, Bewertungen und Korrekturanzahl. Der anonyme Bericht entfernt Identitäten, Dokumenttexte, Dateinamen und Notizen. Die zehn-Fälle-Prüfung mit einem Übersetzer ist vorbereitet, aber noch nicht durchgeführt. Die UI-Metriken stellen keine fachliche Qualitätsaussage dar.

`dist/demo/` ist eine vollständig fiktive, statische geführte Demo ohne Modellanfrage, auf Deutsch, Englisch und Arabisch. Jede Sprache hat eigene Original-, PDF-, Word- und ZIP-Dateien; die Demoänderung ist fest vorgegeben. Screenshot: `docs/demo-preview.png`. `outputs/TranslateOCR-Demo.zip` kann als separater GitHub-Demoanhang dienen. Das vollständige `outputs/TranslateOCR-Windows.zip` enthält Releaseprüfsummen und Codex-Dokumentation, aber keine persönlichen Daten. Release-Hashlisten sind keine digitale Herausgebersignatur.

Die CI-Matrix ist vorbereitet und noch nicht remote gelaufen. Windows-Installation, Update, Sicherungswiederherstellung und Word-Darstellung sind auf dem Ziel-PC noch zu prüfen. Öffentliche GitHub-Veröffentlichung, Lizenzwahl und Drittanbieterhinweise bleiben offen. Provider-Abdeckung: lokale adapterbezogene Tests und Browserprüfung sind bestanden; echte Modellaufrufe mit privaten API-Schlüsseln sowie fachliche Bewertung durch einen Übersetzer stehen noch aus.
