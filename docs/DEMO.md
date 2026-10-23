# TranslateOCR Demo für GitHub

Die geführte Demo liegt unter `dist/demo/` und benötigt keinen Server mit Modellanbindung. Sie verarbeitet ausschließlich vorgegebene fiktive Daten, enthält keine Anmeldung und stellt keine Anfragen an den Modellanbieter. Alle sichtbaren Änderungen sind Teil eines festen Beispiels. PDF, Word und ZIP sind echte vorab erzeugte Beispieldateien.

Lokal in TranslateOCR auf „Geführte Demo ansehen“ klicken oder http://127.0.0.1:4318/demo/ öffnen. Ohne Anwendung kann der Ordner mit einem beliebigen lokalen statischen Webserver angezeigt werden. `npm run demo:build` erzeugt die festen Exporte erneut und erstellt outputs/TranslateOCR-Demo.zip ausschließlich aus der Positivliste der Demo. Der private Workspace wird nicht gelesen.

## Ablauf für ein kurzes Vorführvideo

1. Fiktiven Führerschein mit Vorder-/Rückseite auswählen.
2. Rückfrage zur Namensschreibweise beantworten, zunächst Alex Example wählen.
3. Zeile in der Vorschau anklicken und Original mit Übersetzung vergleichen.
4. Den ausdrücklich als Demo markierten Prompt zur Änderung auf Alex Muster wählen.
5. Unterschied ansehen, übernehmen, Prüfpunkte bestätigen.
6. PDF und Word herunterladen und die PDF samt Originalanhang öffnen.

## Spätere Veröffentlichung

Nur den Inhalt von `dist/demo/` als statische Website bereitstellen, beispielsweise mit GitHub Pages nach Einrichtung des öffentlichen Repositorys. Keine Projektwurzel oder lokale Installation veröffentlichen. Die ZIP kann als Demo-Download in ein späteres Release aufgenommen werden. README-Screenshots dürfen ausschließlich die fiktive Demo zeigen. Ein echter KI-Lauf, Kontozugänge und private Übersetzungen gehören nicht in diese Demo.

Die öffentliche Repository-Veröffentlichung, Projektlizenz, Drittanbieterhinweise und Hosting-Freigabe bleiben eigene Vorbereitungsschritte. Hier wird nichts ungefragt öffentlich hochgeladen.
