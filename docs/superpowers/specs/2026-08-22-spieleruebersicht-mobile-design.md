# Design: Spielerübersicht (Club Comunio als Referenz) + Mobile später

**Datum:** 2026-08-22  
**Status:** Now/Next festgehalten, Mobile = Later  
**Referenz:** öffentliche UI [clubcomunio.com/de/spieler](https://clubcomunio.com/de/spieler) (ohne Konto)

## Job

Wenn ich vor der Deadline am Handy oder Desktop den Markt scanne, möchte ich Spieler auf einen Blick vergleichen (Position, Verein, Preis, Form), damit ich Kaufen/Halten/Verkaufen entscheide — ohne erst ein Suchformular ausfüllen zu müssen.

## Was wir uns abschauen (Verhalten, nicht Pixel)

- Katalog immer sichtbar, sortiert — nicht „leer bis Filter“.
- Dichte Zeile: Positions-Chip (Farbe + Kürzel), Name, Verein, Marktwert, Form, primäre Zahl rechts (bei uns: Empfehlung / Formscore, nicht deren PD/Pkt).
- Filter und Sort kompakt (Overlay oder eine Zeile), Liste bleibt der Star.

## Was wir nicht übernehmen

- Spielerfotos, Vereinswappen von Drittanbietern scrapen
- Comunio-Punkteschema (PD, Power, Force, SP %)
- Werbung, Hover-only Details als einziger Pfad (bricht auf Touch)

## Now / Next (Desktop zuerst)

Radar (`/radar`) zur echten Spielerübersicht machen:

1. Alle Katalog-Spieler listen (bestehende Filter bleiben; ohne Filter = volle Liste, sinnvolle Default-Sortierung z. B. Form oder Divergenz).
2. Dichte Zeile statt dünner Textliste: Positions-Chip, Name, Verein, Marktwert, Form (5 Mini-Balken wie in `spec-transfermarkt.md`), Badge.
3. Filter Name / Position / Verein / Marktwert bleiben; Sortieren ergänzen.

Gleiche Zeilenkomponente später in Kader-Suche und Konkurrenz wiederverwenden.

## Later — Mobile

Eigene Optimierung, **nicht** „Desktop verkleinern“. Handy ist der wahrscheinliche Ort vor der Deadline.

| Fläche | Later-Anforderung |
|---|---|
| Radar / Spieler | Eine Spalte; Zeile scannbar ohne horizontales Scrollen; Filter als Bottom-Sheet oder Accordion, nicht als langes Formular über der Liste |
| Kader-Suche | Dieselbe Zeile; Primäraktion „In den Kader“ als 44×44-px-Ziel |
| Aufstellung / Spielfeld | Feld hochkant, Chips stapeln ohne Überlappung, Bank unter dem Feld |
| Nav | Gooey-Nav auf schmalem Viewport prüfen: umbrechen oder Overflow-Menü, keine abgeschnittenen Labels |
| Allgemein | Kein Hover als einzige Info; Fokus/Touch ≥ 24px (AA), besser 44px; Zoom 200 % ohne Funktionsverlust |

**Nicht in Later-Mobile:** native App, Push, PWA-Install-Zwang.

## Messung (grob)

- Radar auf ~360px Breite: Liste nutzbar ohne Pinch-Pan der Tabelle
- Filter setzen in ≤ 2 Taps nach Öffnen des Sheets

## Abhängigkeiten

- `docs/spec-transfermarkt.md` (Radar-Logik, Form-Balken)
- `docs/spec-aufstellung.md` (Spielfeld)
- Daten: vorhandener Katalog, keine neuen Quellen
