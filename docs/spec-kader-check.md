# Spec: Kader-Check vor Spieltag-Deadline

Teil von V1. Root-Kontext siehe `../CLAUDE.md`.

## Ziel
Der teuerste und am leichtesten vermeidbare Fehler in Fantasy-Manager-Spielen ist nicht der falsche Transfer, sondern ein verletzter oder gesperrter Spieler, der aus Unachtsamkeit aufgestellt wird und 0 Punkte bringt. Dieses Modul ist bewusst **kein Optimierer**, sondern ein zuverlässiges Warnsystem, das vor jeder Deadline auf genau diesen Fehler prüft.

## Datenbasis
Nutzt vorhandene Entitäten aus `../CLAUDE.md`, keine neuen Felder nötig außer `AvailabilityStatus` (bereits im Root-Datenmodell ergänzt):
- `SquadMembership` (wer ist im eigenen Kader; ab V1.25 gefiltert auf das eingeloggte `Mitglied`, siehe `spec-auth.md`)
- `AvailabilityStatus` (fit / fraglich / verletzt / gesperrt, je Spieltag)
- `RatingHistory.minuten_gespielt` (Rotationsrisiko-Proxy)

## Logik
Für jeden Spieler mit `SquadMembership.im_kader = true`, geprüft vor der nächsten Spieltag-Deadline (aus `Fixture` ableitbar):

1. **Harter Block** — `AvailabilityStatus = verletzt` oder `gesperrt` → rote Warnung „Startet nicht"
2. **Weicher Hinweis** — `AvailabilityStatus = fraglich` → gelbe Warnung „Unsicher, prüfen"
3. **Rotationsrisiko** — Minutenanteil der letzten 3 Spiele unter Schwellenwert (z. B. < 50 % der möglichen Spielzeit) → gelbe Warnung „Wenig Spielzeit zuletzt"
4. Keine Auffälligkeit → kein Eintrag (nur Abweichungen anzeigen, nicht den ganzen Kader bestätigen)

Verwendet dieselbe Verfügbarkeits-Prüfung wie `spec-transfermarkt.md` (Robustheit-Gate) — als gemeinsame Funktion implementieren, nicht duplizieren.

## Timing (V1 vs. später)
- **V1**: wird bei jedem Laden des Dashboards automatisch neu berechnet (reine Auswertung vorhandener Daten, kein neuer Scrape) — kein Button, kein Cron nötig
- **Später** (V2+): proaktive Benachrichtigung vor jeder Deadline, unabhängig davon, ob das Dashboard geöffnet wird — nicht Teil von V1

## UI
- Erscheint als Alert-Block im Dashboard
- Jede Warnzeile: Spielername, Grund, Badge (rot = harter Block, amber = Hinweis)
- Gleiches Hover-Tooltip-Pattern wie im Spieler-Radar für die Kurzbegründung

## Nicht-Ziele (V1)
- Keine automatischen Push-Benachrichtigungen
- Kein Ersatzspieler-Vorschlag (das wäre der Aufstellung-Optimierer, V2)
- Keine externe Kalender-Integration