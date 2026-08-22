# Spec: Aufstellung

Teil von V2. Root-Kontext siehe `../CLAUDE.md`. Hängt von P1 (Kader) und der Punkteprognose-Engine ab.

## Ziel

Vor der Deadline eine legale Elf aus dem eigenen Kader vorschlagen, die die Summe der erwarteten Punkte maximiert. Kein Ersatz für den Comunio-Klick — der User übernimmt manuell.

## Regeln (Comunio-typisch, fest)

- Genau 11 Spieler.
- Genau 1 `Torwart`.
- `Abwehr` 3–5, `Mittelfeld` 2–5, `Sturm` 1–3.
- Summe der Feldspieler-Positionen + TW = 11.
- Nur `SquadMembership.im_kader = true` des Users.
- `availabilityGate = block` darf nicht in der Elf landen (Bank erlaubt).

## Algorithmus

Vollständige Enumeration legaler 11er-Untermengen ist bei Kader ≤ 25 akzeptabel; sonst greedy: sortiere nach erwarteten Punkten, fülle Positionsmindestzahlen, dann Rest nach Score unter Max-Constraints.

Output: Liste 11 IDs + Bank (übriger Kader) + Summe erwarteter Punkte + Formation als `Abwehr-Mittelfeld-Sturm` (TW separat).

## UI `/aufstellung`

- Überschrift „Aufstellung“
- Vorgeschlagene Elf gruppiert nach Position, erwartete Punkte pro Kopf, Summe.
- Button „Neu berechnen“ lädt die Seite neu (SSR).
- Leer: „Kader ist zu klein für eine Elf“ oder Kader-Check-Hinweis wenn alle TW blockiert sind.

**Mobile (Later):** Spielfeld hochkant, Chips ohne Überlappung — siehe `docs/superpowers/specs/2026-08-22-spieleruebersicht-mobile-design.md`. Nicht im aktuellen Desktop-Schnitt.

## Nicht-Ziele

- Live-Sync nach Comunio
- Mehrere Formationen zum Durchklicken (eine legale reicht)
- Captain-Bonus
