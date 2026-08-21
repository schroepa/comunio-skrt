# Design: Freundes-Runde P0+P1 (Hosting, Invite-Auth, eigener Kader)

**Datum:** 2026-08-21  
**Status:** bereit für Implementierung  
**Baut auf:** genehmigter Plan „Freundes-Runde“, `CLAUDE.md`, `docs/spec-dashboard.md`  
**Nicht in diesem Schnitt:** Kicker-Noten, Radar-Empfehlungslogik, CompetitorSquad, Aufstellung, Punkteprognose (P2–P4, eigene Specs).

## Ziel

Acht eingeladene Freunde erreichen die App im Browser, melden sich an und pflegen **nur den eigenen Kader**. Getrennte Comunio-Ligen: niemand sieht den Kader eines anderen. Gemeinsam bleibt der Bundesliga-Katalog (`Player`, `Fixture`, Marktwerte, Verfügbarkeit).

## Entscheidungen (fest)

| Thema | Wahl |
|---|---|
| Auth | Variante A: Directus-Nutzer, keine öffentliche Registrierung |
| Session | Directus-`access_token` (+ `refresh_token`) in httpOnly-Cookies, nie im JS |
| Isolation | `SquadMembership.user_id` in jeder Query. Directus 12 Core kann Item-Filter `$CURRENT_USER` nicht speichern (lizenziert). Rolle `manager` hat Collection-Rechte; Token nur httpOnly, Directus-URL nicht an Freunde. |
| Hosting-Ziel | Web: Vercel (`@astrojs/vercel`). Directus: self-hosted (Docker), nicht Community-Cloud für 8 Endnutzer |
| Invite | Admin legt User in Directus an (E-Mail + Passwort oder Invite-Mail). App hat kein Sign-up. |
| Katalog | Lesen mit User-Token. Scraper bleibt Admin/CLI. |
| Kader-UI | neue Route `/kader` (Suche + Hinzufügen/Entfernen) |
| Budget | Collection `ManagerProfile` (ein Datensatz pro User, Feld `budget`). Optional; ohne Eintrag bleibt „Noch keine Kadereingabe“ für Budget übrig. |

## Rollen

- **Administrator:** bestehender Directus-Admin. Scraper, Schema, User anlegen. Kein App-Login nötig (kann sich aber einloggen).
- **manager:** App-Nutzer. Liest Katalog-Collections. CRUD `SquadMembership` und `ManagerProfile` nur eigene Zeilen. Kein `ScrapeLog`, kein Directus-Admin-UI-Zwang.

Public-Rolle bleibt ohne Zugriff auf Collections.

## Schema

### `SquadMembership.user_id`

- Typ UUID, M2O auf `directus_users.id`, required.
- Unique zusammen mit `player_id` (ein Spieler höchstens einmal pro User).
- Filter in Rechten: Directus 12 Core speichert keine Item-Regel `user_id = $CURRENT_USER`. Die App setzt und filtert `user_id` immer selbst.
- Beim Anlegen setzt die App `user_id` auf die Session-User-ID; Directus-Create-Permission darf `user_id` nur auf `$CURRENT_USER` setzen.

Bestehende Zeilen ohne User: vor `schema apply` löschen oder einem Admin zuweisen. Lokal ist `SquadMembership` leer.

### `ManagerProfile` (neu)

- `id` integer PK
- `user_id` UUID unique required (M2O `directus_users`)
- `budget` integer, nullable — Comunio-Restbudget in der gleichen Einheit wie `kaufpreis` / Marktwert (Euro, ganzzahlig)

Rechte analog: nur eigene Zeile.

## Auth-Fluss

```
Browser  POST /login (email, password)
   → Astro Server  POST Directus /auth/login
   → Set-Cookie: comunio_access, comunio_refresh (httpOnly, SameSite=Lax, Secure in Production, Path=/)
   → Redirect /

Jede geschützte Seite:
   → Cookie lesen → Directus /users/me
   → 401: Refresh via /auth/refresh, sonst Redirect /login

POST /logout → Directus /auth/logout, Cookies löschen, Redirect /login
```

- Login-Seite `/login` ist öffentlich. Alle anderen HTML-Routen inkl. `/` verlangen Session.
- Kein `DIRECTUS_TOKEN` mehr für Seiteninhalte. Env `DIRECTUS_TOKEN` bleibt optional für lokale Notfälle/Tests, wird in der App nicht mehr als Fallback für User-Daten genutzt.
- `DIRECTUS_URL` unverändert. Kein `PUBLIC_*` Token.
- Passwort-Reset: Directus-Admin oder Directus `/auth/password/request` nicht in V1 der App; Owner setzt Passwort im Admin.

Copy Login-Fehler (verbatim): „E-Mail oder Passwort stimmt nicht.“ Bei Directus down: „Directus nicht erreichbar. In `directus/` `docker compose up -d`.“

## Kader-Picker `/kader`

- Überschrift: „Mein Kader“
- Oben: aktueller Kader, gruppiert nach Position (`Torwart` / `Abwehr` / `Mittelfeld` / `Sturm`), Name, Verein, Marktwert, Button „Entfernen“ (`im_kader = false` oder Datensatz löschen — **löschen**, keine Geisterzeilen).
- Suche: Textfeld, filtert `Player` client- oder serverseitig nach `name` (substring, case-insensitive). Ergebnisse: Name, Position, Verein, Marktwert, Button „In den Kader“ (disabled wenn schon drin).
- Leerer Kader: „Noch keine Kadereingabe. Spieler über die Suche hinzufügen.“
- Optional: Zahlfeld „Budget“ speichert `ManagerProfile.budget`. Label „Budget (Comunio)“.
- Keine Dummy-Spieler. Kein Gooey auf der Tabelle.

Nach dem Speichern Redirect auf `/kader` (PRG). Mutations nur per POST-Form/Action auf dem Server mit User-Token.

## Dashboard-Änderung (P1)

- **Kaderwert:** Summe `Player.aktueller_marktwert` aller `SquadMembership` des Users. Leer-Copy bleibt, wenn der Kader leer ist.
- **Budget übrig:** `budget - Kaderwert`, wenn `ManagerProfile.budget` gesetzt; sonst „Noch keine Kadereingabe“.
- Spielplan/Deadline: weiter aus `Fixture`, jetzt mit User-Token statt Static Token. Token-fehlt-Copy entfällt für eingeloggte User; Directus-down-Copy bleibt.

## Shell

- Nav-Einträge: Dashboard, Kader, Radar, Kader-Check.
- Wenn eingeloggt: E-Mail/Name plus Link „Abmelden“ (`POST /logout`).
- Login-Seite ohne die Gooey-Nav der App (nur Wortmarke).

## Hosting (P0)

- Astro-Adapter: `@astrojs/vercel` (Production). `astro dev` bleibt lokal.
- Directus: bestehendes Compose; `PUBLIC_URL` aus Env (Production-URL). SQLite-Volume bleibt; für Production Hinweis in `directus/README.md`: Backup der Datei, nicht Community-Cloud für 8 User.
- Vercel Env: `DIRECTUS_URL` = öffentliche Directus-URL (HTTPS). Kein Admin-Passwort in Vercel.
- CORS: Directus `CORS_ENABLED=true`, `CORS_ORIGIN` = Vercel-App-Origin, Credentials. Login läuft server-seitig (kein Browser→Directus), CORS ist nur relevant falls Admin-UI oder zukünftige Clients.
- Scraper läuft weiter lokal oder später als Cron; nicht auf Vercel in diesem Schnitt.

## Tests

- Auth-Helfer und Directus-Login gegen gemocktes `fetch` (kein Live-Directus).
- Squad-Filter: Requests enthalten `filter[user_id][_eq]=<id>` bzw. die App setzt `user_id` beim Create.
- Budget/Kaderwert-Ableitung rein testbar.
- Keine echten Passwörter in Fixtures.

## Nicht-Ziele P0+P1

- Google/Magic-Link/Clerk
- Öffentliche Registrierung
- Kader der anderen acht
- Radar-Datenbindung, Kicker, Rivalen, Aufstellung
- Passwort-Reset-UI
- Directus Cloud Community
