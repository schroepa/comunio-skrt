# Design: Directus → Supabase

**Datum:** 2026-08-21  
**Status:** umgesetzt (Repo). Projekt im Dashboard legst du an.  
**Ersetzt:** Directus als Datenschicht und Auth (`directus/`, `DIRECTUS_*`, Rolle `manager`)

## Ziel

Dieselbe App (Login, isolierter Kader, Radar, Kader-Check, Konkurrenz, Aufstellung, Scraper) ohne selbst gehostetes Directus. **Supabase Cloud (Free):** Postgres + Auth + RLS. Web bleibt auf Vercel. Keine Oracle-VM.

## Entscheidungen (fest, sofern du zustimmst)

| Thema | Wahl |
|---|---|
| Projekt | **Neues** Supabase-Projekt nur für Comunio (nicht das andere App-Projekt) |
| Region | `eu-central-1` (Frankfurt) |
| Auth | Supabase Email+Passwort, **öffentliche Registrierung aus** |
| Invite | Du legst User im Dashboard an (Invite oder Create user). App hat kein Sign-up. |
| Isolation | RLS: `user_id = auth.uid()` auf Kader/Profil/Rivalen |
| Katalog | `authenticated` darf nur **lesen**. Schreiben nur Service Role (Scraper). |
| Datenübernahme | Kein SQLite-Import. Katalog per Scraper neu syncen. Kader ist leer — ok. |
| Directus | Nach Cutover nicht mehr im Happy Path. Ordner `directus/` kann im Repo bleiben bis der erste Prod-Sync steht, dann entfernen. |

## Tabellen (snake_case, Feldnamen deutsch wie bisher)

| Tabelle | Inhalt | RLS |
|---|---|---|
| `player` | Katalog inkl. `transfermarkt_id` unique | SELECT für `authenticated` |
| `fixture` | Spielplan | SELECT authenticated |
| `value_history` | Marktwerte | SELECT authenticated |
| `rating_history` | Kicker-Noten | SELECT authenticated |
| `availability_status` | fit/fraglich/verletzt/gesperrt | SELECT authenticated |
| `scrape_log` | Scraper-Läufe | kein Zugriff für App-User |
| `squad_membership` | `user_id uuid` → `auth.users`, `player_id`, `im_kader`, `kaufpreis`, `hinzugefuegt_am` | CRUD nur eigene Zeilen |
| `manager_profile` | `user_id` unique, `budget` | CRUD nur eigene Zeile |
| `competitor_squad` | `user_id`, `competitor_name`, `player_id` | CRUD nur eigene Zeilen |

Uniques: `player.transfermarkt_id`; `(squad_membership.user_id, player_id)`; `(competitor_squad.user_id, competitor_name, player_id)`.

SQL liegt versioniert unter `supabase/migrations/`. Apply: `supabase db push` oder SQL-Editor einmalig.

## Auth-Fluss (Astro)

`@supabase/ssr` + `@supabase/supabase-js`. Session in httpOnly-Cookies (Supabase-Default-Cookie-Adapter), nie `anon` Key als User-Secret im Browser für Writes — Pages bleiben SSR: Server-Client mit Cookie, Mutations in Form-POSTs.

- `/login`: `signInWithPassword`
- Middleware: Session lesen, sonst Redirect `/login`
- `/logout`: `signOut`
- Copy Login-Fehler unverändert: „E-Mail oder Passwort stimmt nicht.“ Directus-down-Copy wird zu: „Supabase nicht erreichbar.“

Env Web (server only, kein `PUBLIC_` Service Role):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (SSR mit User-JWT nach Login)
- kein Service Role in Vercel für die App

Env Scraper:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (umgeht RLS, nur CLI)

## Scraper

`scraper/src/shared/directus-client.ts` wird zu einem schmalen Supabase-REST-Client (`/rest/v1/...`, Header `apikey` + `Authorization: Bearer <service_role>`). Upsert über `on_conflict` (`transfermarkt_id`, bzw. `player_id,spieltag` bei Ratings). Parser und HTTP-Cache bleiben.

## Web

`web/src/lib/directus.ts` + `session.ts` + Middleware auf Supabase umstellen. Seiten-API (listFixtures, listSquad, …) gleiche TypeScript-Typen, andere Transportschicht. UI-Routen unverändert.

## Was du einmal im Dashboard klickst

1. Projekt anlegen (Free, Frankfurt).
2. Authentication → Providers: Email an. **Disable new user signups** (oder „Allow new users to sign up“ aus).
3. SQL-Migration aus dem Repo ausführen.
4. User für dich + Freunde anlegen, Passwort setzen oder Invite-Mail.
5. Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

## Nicht-Ziele

- Directus-Datenbank migrieren
- Magic Link / Google (du kennst Email+Passwort aus dem anderen Projekt; später optional)
- Supabase Realtime
- Edge Functions
- Oracle / Directus Cloud

## Reihenfolge der Umsetzung (nach Freigabe)

1. SQL-Migration + RLS  
2. Scraper-Client + OpenLigaDB/TM/Kicker gegen Supabase (Tests mit gemocktem fetch)  
3. Web Auth + Data-Layer + bestehende Vitest  
4. READMEs / CLAUDE.md, Directus aus dem Schnellstart  
5. Du: Projekt anlegen, Migration, ersten Sync, Vercel-Env
