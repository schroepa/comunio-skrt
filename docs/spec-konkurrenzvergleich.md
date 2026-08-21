# Spec: Konkurrenz-Vergleich (leicht)

Teil von V1.5. Root-Kontext siehe `../CLAUDE.md`. Getrennte Comunio-Ligen: die acht App-Nutzer sind **keine** gegenseitigen Rivalen.

## Ziel

Jeder User pflegt 2–3 engste Liga-Rivalen als Spielerliste (`CompetitorSquad`). Vergleich nutzt den vorhandenen Formscore (P2), keine Punkteprognose.

## Datenmodell

`CompetitorSquad`:

- `id` integer
- `user_id` UUID, M2O `directus_users`, required
- `competitor_name` string required (Anzeigename des Rivalen, z. B. „Stefan“)
- `player_id` M2O `Player`, required
- Unique `(user_id, competitor_name, player_id)`
- Rechte: nur eigene Zeilen, max 3 verschiedene `competitor_name` pro User (App-Validierung; Directus nicht zählen)

## UI `/konkurrenz`

- Pro Rivale eine Spalte/Karte: Name, Anzahl Spieler, mittlerer Formscore der hinterlegten Spieler (nur mit Noten).
- Eigene Zeile: „Mein Kader“ mit gleichem Mittelwert.
- Spieler hinzufügen wie Kader-Picker, gebunden an einen Rivalen-Namen.
- Leerer Zustand: „Noch keine Rivalen. Trage 2–3 Kader aus deiner Comunio-Liga ein — nicht die App-Freunde.“

## Nicht-Ziele

- Punkte-Differenz-Prognose (V2, `spec-punkteprognose.md`)
- Automatischer Import fremder Comunio-Kader
- Die acht App-Accounts als Rivalen vorschlagen
