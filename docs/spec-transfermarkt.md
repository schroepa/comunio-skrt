# Spec: Transfermarkt-Analyse (Spieler-Radar)

Teil von V1. Root-Kontext siehe `../CLAUDE.md`.

## Ziel
Kernidee: Divergenz zwischen Form und Marktwert ist das eigentliche Signal, nicht die reine Formbewertung. Ein Spieler, der besser spielt als sein aktueller Marktwert widerspiegelt, wird vom Comunio-Preisalgorithmus erst mit Verzögerung nach oben korrigiert — das ist das Kaufsignal. Umgekehrt: Preis schon hoch, Leistung stagniert oder fällt → Verkaufssignal, bevor der Wert wieder sinkt.

## Empfehlungslogik

- **Formscore** (0–100): letzte 5 Kicker-Noten, gewichtet 35/25/20/12/8 % (neueste zuerst)
- **Preis-Score** (0–100): aktueller Marktwert relativ zur eigenen Wertentwicklung und zu vergleichbaren Spielern der Position
- **Divergenz** = Formscore − Preis-Score (positiv = unterbewertet, negativ = überbewertet)
- **Fixture-Modifier**: verstärkt/dämpft die Divergenz je nach Schwierigkeit der nächsten 3 Gegner
- **Robustheit-Gate**: Spielminuten der letzten 3 Partien als Rotationsrisiko-Proxy; `AvailabilityStatus = verletzt/gesperrt` überschreibt alles andere (harter Block). **Diese Verfügbarkeits-Prüfung wird als gemeinsame Funktion implementiert und von `spec-kader-check.md` wiederverwendet — nicht duplizieren.**

### Badge-Mapping

| Divergenz | Im Kader | Nicht im Kader |
|---|---|---|
| stark positiv, Fixtures günstig | Halten | Kaufen |
| leicht positiv / gemischt | Halten | Beobachten |
| leicht negativ | Beobachten | ausgeblendet |
| stark negativ | Verkaufen | ausgeblendet |
| Verletzung/Sperre | Nicht verfügbar | Nicht verfügbar |

Spieler außerhalb des eigenen Kaders mit negativem Signal werden im Radar standardmäßig **nicht** angezeigt (nur bei aktiver Suche), sonst wird die Liste unnötig voll.

### Begründungstext
Textbaustein-System statt freiem Text: „[Form-Trend] + [Fixture-Aussage] + [Preis-Aussage] → [Badge]", z. B. „Form steigend, günstige Gegner voraus, Preis hinkt der Leistung hinterher → Kaufen". Je Score-Bucket 3–4 feste Formulierungen, kein freies NLG.

## UI

Haupt-Screen „Spieler-Radar":
- **Voller Katalog** sichtbar (auch ohne Filter); schwache Outsider als „Kein Signal“ statt ausgeblendet
- Dichte Zeile: Positions-Chip, Name, Verein, Marktwert, Form-Balken, Badge
- Filter: Name, Position, Verein, Marktwert, „Nur mein Kader“
- Sortierung: Form (Default), Marktwert, Empfehlung, Name

**Mobile:** nicht Teil dieses V1-Schnitts. Später eigene Layouts (eine Spalte, Filter als Sheet) — `docs/superpowers/specs/2026-08-22-spieleruebersicht-mobile-design.md`.

## Abhängigkeiten
- Datenmodell: `Player`, `ValueHistory`, `RatingHistory`, `Fixture`, `AvailabilityStatus` (siehe `../CLAUDE.md`)
- Teilt die Verfügbarkeits-/Robustheit-Prüfung mit `spec-kader-check.md`
