# Design: Datenpipeline Phase 3 (Transfermarkt — Player, Marktwerte, Verfügbarkeit)

**Datum:** 2026-08-21  
**Status:** bereit für Implementierungsplan  
**Baut auf:** `docs/spec-datenpipeline.md` (Phase 3), `CLAUDE.md`, Directus-Snapshot  
**Nicht dieser Schnitt:** Kader-Picker-UI, Kicker-Noten, Cron, CSV-Import, Gooey-Nav (eigener kleiner UI-Fix)

## Ziel

Ein lokal per CLI startbares `transfermarkt`-Modul im vorhandenen `scraper/`-Paket. Es legt den Bundesliga-Spieler-Katalog in Directus an und hält Marktwerte sowie spieltagsbezogene Verfügbarkeit aktuell — ohne dass jemand Spieler per CSV oder Formular tippt. `SquadMembership` bleibt leer, bis ein späterer Kader-Picker den Katalog nur noch durchsucht.

## Entscheidungen (fest)

| Thema | Wahl |
|---|---|
| Umfang | Marktwerte **und** Verfügbarkeit in einem Schnitt (volle Phase 3) |
| Identität | Neues eindeutiges Feld `Player.transfermarkt_id` (integer). Kein Upsert über Name+Verein. |
| Katalog | Scraper erzeugt/aktualisiert `Player`. Keine manuelle Player-Anlage in diesem Schnitt. |
| Kader | `SquadMembership` unberührt. Picker folgt, sobald der Katalog steht. |
| Vereinsnamen | Transfermarkt-Namen unverändert in `Player.verein`. Kein Mapping auf OpenLigaDB-Namen. |
| Position | Mapping auf Directus-Choices: `Torwart` / `Abwehr` / `Mittelfeld` / `Sturm`. Unmappbar → Zeile skippen. |
| HTTP | Vorhandener `shared/http-client` (Datei-Cache, `minDelayMs`). Transfermarkt konservativer als OpenLigaDB (höherer Delay). |
| Live-Seite | Niedrigfrequent, privater UA, kein Umgehen einer IP-Sperre. |

## Schema

Neues Feld an Collection `Player`:

- `transfermarkt_id`: integer, required, unique, indexed
- Snapshot `directus/schema/snapshot.yaml` aktualisieren; lokal `schema apply --yes`

Bestehende Felder unverändert: `name`, `position`, `verein`, `aktueller_marktwert`.

`ValueHistory`: `player_id`, `datum` (Lauf-Datum), `marktwert`.  
`AvailabilityStatus`: `player_id`, `spieltag`, `status` (`fit` / `fraglich` / `verletzt` / `gesperrt`), `quelle` = `transfermarkt`, `aktualisiert_am`.

## Datenfluss

```
CLI sync:transfermarkt
        │
        ├─ Marktwerte: Team-/Spielerlisten Transfermarkt
        │     parse → Player upsert (transfermarkt_id)
        │           → Player.aktueller_marktwert
        │           → ValueHistory für heute
        │
        └─ Verfügbarkeit: Sperren/Ausfälle-Übersicht
              parse → Status je Spieler
                    → AvailabilityStatus für den relevanten Spieltag
```

Relevanter Spieltag: aus Directus-`Fixture` ableiten (gleiche Regel wie das Frontend: nächste Runde mit mindestens einem `datum >= now`). Ist `Fixture` leer: Availability-Teil **failed** mit Hinweis, zuerst `npm run sync:openligadb` zu fahren; der Marktwerte-Teil darf trotzdem laufen, wenn seine eigene Plausibilität hält. Zwei `ScrapeLog`-Einträge (`quelle: transfermarkt-werte` / `transfermarkt-verfuegbarkeit`), damit ein Teil fehlschlagen kann ohne den anderen zu löschen.

## Fehlerbehandlung

- HTTP-Fehler, Timeout, 403, leeres/unerwartetes Markup: keine Writes der betroffenen Funktion, `ScrapeLog` `failed`.
- Plausibilität Marktwerte: Anzahl geparster Spieler mit `transfermarkt_id` im Fenster **360–700** (18 Kader). Außerhalb: kein Write.
- Plausibilität Verfügbarkeit: Seite ohne verwertbare Spielerzeilen = Fail, nicht „alle fit“.
- Zeilen ohne `transfermarkt_id` oder ohne mappbare Position: skippen, Zähler in den Logs, Lauf trotzdem `success` wenn die Menge im Fenster bleibt.
- IP-Sperre: nicht umgehen. CLI bricht ab.

## CLI und Betrieb

```bash
cd scraper
npm run sync:transfermarkt
```

Env: vorhandene Directus-Login-Variablen aus Phase 2. Keine Transfermarkt-Credentials. Optional `TRANSFERMARKT_MIN_DELAY_MS` (Default konservativ, z. B. 1500).

Kein Cron, kein Vercel in diesem Schnitt.

## Tests

- Eingefrorene HTML-Fixtures unter `scraper/tests/fixtures/transfermarkt-*.html` (Auszug, nicht die ganze Liga).
- Parser-, Validate-, Sync-Tests analog OpenLigaDB: Upsert-Key `transfermarkt_id`, kein Write bei Fail, Availability-Mapping der vier Statuswerte. Unbekannte Transfermarkt-Labels skippen, nicht auf `fit` defaulten. Die konkrete Label-Tabelle steht im Implementierungsplan und kommt aus den eingefrorenen HTML-Fixtures.
- Kein Live-Transfermarkt in Vitest.
- Nach Implementierung: ein manueller Live-Lauf gegen lokales Directus, Stichprobe in der Admin-UI.

## Danach (nicht dieser Spec)

1. Gooey-Nav auf Move-Indikator (View Transitions + persist, `fill` = `--primary`) — eigener kleiner UI-Fix, kein Scraper.
2. Kader-Picker in `web/`: Suche im `Player`-Katalog, `SquadMembership` setzen (im_kader, kaufpreis).
3. Kicker-Noten (Phase 4), CSV-Fallback, Cron.
