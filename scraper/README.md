# Scraper (Datenpipeline Phase 2–3)

Eigenständiges Node-Paket. Directus bleibt die einzige Quelle der Wahrheit; dieses Paket schreibt nur.

Datenquellen:

- [OpenLigaDB](https://www.openligadb.de/) (ODbL — Namensnennung) für den Spielplan
- [transfermarkt.de](https://www.transfermarkt.de/) für Spielerkatalog, Marktwerte und Verfügbarkeit — private, niedrigfrequente Nutzung; bei HTTP 403 den Lauf abbrechen, die Sperre nicht umgehen

## Voraussetzungen

- Node.js 22+
- Laufendes Directus aus `../directus` (`docker compose up -d`)

## Setup

```bash
cd scraper
cp .env.example .env
# DIRECTUS_EMAIL / DIRECTUS_PASSWORD aus directus/.env übernehmen
npm install
```

## OpenLigaDB-Spielplan holen

```bash
npm run sync:openligadb
```

Default: Liga `bl1`, Saison `2026` (Saison 2026/27). Überschreiben über `OPENLIGADB_LEAGUE` / `OPENLIGADB_SEASON` in `.env`.

`Fixture` enthält immer genau eine Saison. Vor einem Saisonwechsel muss die Collection vollständig geleert werden; andernfalls werden Spiele verschiedener Saisons vermischt. Insbesondere darf der in Task 5 verwendete Fallback `OPENLIGADB_SEASON=2025` nicht gegen eine bereits mit Saison 2026 befüllte `Fixture`-Collection laufen.

Danach im Directus-Admin (http://localhost:8055): Collection `Fixture` (≈306 Zeilen) und `ScrapeLog` (ein `success`-Eintrag mit `quelle=openligadb`) stichprobenartig prüfen.

Rohantworten liegen unter `.cache/` (TTL 12 Stunden) und werden nicht versioniert.

## Transfermarkt-Katalog, Marktwerte und Verfügbarkeit

```bash
npm run sync:transfermarkt
```

Läuft nacheinander: zuerst Marktwerte (`Player` upsert über `transfermarkt_id`, `ValueHistory` für das Laufdatum), dann Verfügbarkeit (`AvailabilityStatus` für den nächsten Spieltag aus `Fixture`). Exit-Code 0 nur wenn **beide** Teile `success` sind. Marktwerte können geschrieben bleiben, auch wenn Verfügbarkeit fehlschlägt (dann Exit 1).

`TRANSFERMARKT_MIN_DELAY_MS` (Default `1500`) steuert den Mindestabstand zwischen Live-HTTP-Requests. User-Agent bleibt `comunio-helper/0.1 (private)`.

Danach im Directus-Admin prüfen:

- `Player`: 360–700 Zeilen, Feld `transfermarkt_id` gesetzt
- `ValueHistory`: Stichprobe für das Laufdatum
- `AvailabilityStatus`: Stichprobe für den nächsten Spieltag (`quelle=transfermarkt`)
- `ScrapeLog`: zwei Zeilen, `quelle=transfermarkt-werte` und `quelle=transfermarkt-verfuegbarkeit`

Ist `Fixture` leer, schlägt nur der Verfügbarkeitsteil fehl — zuerst `npm run sync:openligadb` ausführen.

## Tests

```bash
npm test
```

Parser-Tests verwenden nur `tests/fixtures/`, nicht die Live-API und nicht Live-Transfermarkt.

## Noch nicht in dieser Phase

Cron-Zeitplan, CSV-Fallback, kicker.de — siehe `../docs/spec-datenpipeline.md`.
