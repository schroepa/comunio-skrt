# Spec: Punkteprognose-Engine

Teil von V2. Root-Kontext siehe `../CLAUDE.md`. Input sind vorhandene Entitäten, kein ML.

## Ziel

Jedem Kader-Spieler eine **erwartete Punktzahl** für den nächsten Spieltag zuordnen (eine Zahl, eine Nachkommastelle). Die Aufstellung maximiert die Summe. Keine Illusion von Genauigkeit in der UI-Copy: „Schätzung, keine Garantie“.

## Formel (fest)

Ausgang: Formscore 0–100 (P2). Mapping auf Punkte: `1 + formscore / 100 * 7` (Bandbreite grob 1–8, Comunio-alltäglich).

Multiplikatoren, nacheinander:

1. `availabilityGate = block` → erwartete Punkte **0** (nicht aufstellen).
2. `availabilityGate = warn` → × 0.6.
3. `robustMinutes` Risiko → × 0.7.
4. Heimspiel laut Fixture-Namensmatch → × 1.05, Auswärts × 0.95, kein Match × 1.0.

Clamp Ergebnis auf 0–12, eine Nachkommastelle.

Ohne Noten: Formscore null → Basis 3.0 vor Multiplikatoren (neutrale Schätzung), in der UI als „ohne Note“ markieren.

## Tests

Reine Funktion `expectedPoints(input) → number` gegen Fixtures. Kein Live-Directus.

## Nicht-Ziele

- Saison-Simulation
- Gegner-xG oder Tabellenplatz (kein Mapping)
- Historischer Backfill vor erster Kicker-Notiz
