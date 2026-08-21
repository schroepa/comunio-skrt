# Spec: Dashboard

Teil von V1. Root-Kontext siehe `../CLAUDE.md`.

## Ziel
Dünne Klammer über den anderen V1-Modulen — kein eigenes Datenmodell, keine eigene Logik. Zeigt auf einen Blick: Budget-Status, nächste Deadline, ob im Kader etwas Aufmerksamkeit braucht, und die stärksten Transfermarkt-Signale.

## Bausteine

### 1. Status-Leiste
Drei Kennzahlen nebeneinander:
- Budget übrig
- Aktueller Kaderwert (Summe der Marktwerte aller Spieler mit `SquadMembership.im_kader = true`)
- Nächste Deadline als Countdown (aus `Fixture` abgeleitet)

### 2. Kader-Check-Alerts
Übernimmt die Logik aus `spec-kader-check.md` unverändert. Wird **automatisch bei jedem Laden des Dashboards neu berechnet** — kein manueller Button, kein Cron nötig für V1, da nur vorhandene Daten ausgewertet werden (kein neuer Scrape-Vorgang). Leerer Zustand, wenn keine Auffälligkeiten vorliegen.

### 3. Top-Signale
Kompakte Teaser-Liste der stärksten Kauf-/Verkaufssignale aus `spec-transfermarkt.md` (z. B. Top 2 Kaufen + Top 1 Verkaufen nach Divergenz-Score). Bewusst reduziert gegenüber dem vollen Spieler-Radar: nur Name, eine Zeile Kurzbegründung, Badge — keine Sparkline, kein Formverlauf. Link führt zum vollen Spieler-Radar.

## UI
- Status-Leiste als Metric-Card-Grid, drei Spalten
- Alerts- und Top-Signale-Block jeweils als schlanke Liste, gleiche Badge-Farblogik wie in den anderen Modulen (Kaufen = grün, Verkaufen = rot, Block = rot, Prüfen = amber)
- Kein Klick-Panel/Modal — Details liegen im jeweiligen Zielmodul (Radar bzw. Kader-Check), das Dashboard bleibt bewusst flach

## Nicht-Ziele (V1)
- Keine eigene Berechnungslogik — alle Zahlen kommen aus den anderen Modulen
- Keine Personalisierung/Layout-Anpassung
- Keine Push-Benachrichtigungen (siehe `spec-kader-check.md`)

## Abhängigkeiten
- `spec-transfermarkt.md` (Top-Signale)
- `spec-kader-check.md` (Alerts)
- Datenmodell: `SquadMembership`, `UserProfile`, `Fixture` (siehe `../CLAUDE.md`)
- Ab V1.25: Budget und Kaderwert scoped auf das eingeloggte `Mitglied` (`spec-auth.md`)