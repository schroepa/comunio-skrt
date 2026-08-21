# Comunio Assistant — Web

Astro-UI mit Login (Directus-User), eigenem Kader, Radar, Kader-Check, Konkurrenz und Aufstellung. Directus nur serverseitig.

## Voraussetzung

Directus: `directus/` `docker compose up -d`, Schema apply, Rolle `manager` (`node --env-file=../directus/.env ../directus/scripts/ensure-manager-role.mjs` aus `web/` oder vom Repo-Root). User in Directus anlegen, Rolle `manager`.

## Start

1. `cp .env.example .env` — `DIRECTUS_URL=http://localhost:8055`
2. `npm install`
3. `npm run dev` → http://localhost:4321 → `/login`

Kein Static Token mehr für die Seiten. `DIRECTUS_TOKEN` in `.env` ist ungenutzt (kann fehlen).

## Deploy

Adapter `@astrojs/vercel`. Auf Vercel `DIRECTUS_URL` auf die öffentliche Directus-HTTPS-URL setzen. Directus self-hosted (nicht Community-Cloud für 8 User).

## Tests

`npm test` — ohne Live-Directus.
