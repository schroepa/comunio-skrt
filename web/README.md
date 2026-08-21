# Comunio Assistant — Web

Astro-UI für Dashboard, Spieler-Radar (Stub) und Kader-Check (Stub). Spielplan kommt aus Directus-`Fixture` (OpenLigaDB, ODbL).

## Voraussetzung

Directus lokal: in `directus/` `docker compose up -d` (siehe `directus/README.md`). Spielplan füllen: in `scraper/` `npm run sync:openligadb`.

## Start

1. Static Token in Directus anlegen (Settings → Access Tokens), Rechte auf `Fixture` lesen.
2. `cp .env.example .env` und `DIRECTUS_TOKEN` setzen.
3. `npm install`
4. `npm run dev` → http://localhost:4321

Ohne Token startet die App trotzdem; Deadline und Spielplan zeigen den Hinweis, `DIRECTUS_TOKEN` in `web/.env` zu setzen.

## Tests

`npm test` — Ableitung und Directus-Client gegen Fixtures/Mocks, kein Live-Directus.
