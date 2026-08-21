# Comunio Assistant — Web

Astro-UI mit Login (Supabase-User), eigenem Kader, Radar, Kader-Check, Konkurrenz und Aufstellung. Supabase nur serverseitig.

## Voraussetzung

Supabase-Projekt nach [`../supabase/README.md`](../supabase/README.md): SQL ausführen, Sign-ups aus, User einladen.

## Start

1. `cp .env.example .env` — `SUPABASE_URL` und `SUPABASE_ANON_KEY`
2. `npm install`
3. `npm run dev` → http://localhost:4321 → `/login`

Kein Service Role in dieser App.

## Deploy

Adapter `@astrojs/vercel`. Auf Vercel dieselben zwei Variablen setzen (kein Service Role).

## Tests

`npm test` — ohne Live-Supabase.
