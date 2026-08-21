# Scraper (Datenpipeline Phase 2)

Eigenständiges Node-Paket. Datenquelle dieser Phase: [OpenLigaDB](https://www.openligadb.de/) (ODbL — Namensnennung). Directus bleibt die einzige Quelle der Wahrheit; dieses Paket schreibt nur.

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

Danach im Directus-Admin (http://localhost:8055): Collection `Fixture` (≈306 Zeilen) und `ScrapeLog` (ein `success`-Eintrag mit `quelle=openligadb`) stichprobenartig prüfen.

Rohantworten liegen unter `.cache/` (TTL 12 Stunden) und werden nicht versioniert.

## Tests

```bash
npm test
```

Parser-Tests verwenden nur `tests/fixtures/`, nicht die Live-API.

## Noch nicht in dieser Phase

Cron-Zeitplan, CSV-Fallback, transfermarkt.de, kicker.de — siehe `../docs/spec-datenpipeline.md`.
