# Security

Dieses Repository ist ein **privates Liga-Tool** (Invite-only, eine Comunio-Gruppe). Kein öffentliches Signup, kein Bug-Bounty. Bis V1.25 kann eine Instanz noch als Einzelnutzer ohne Login laufen; Zielmodell ist Gruppen-Login laut `docs/spec-auth.md`.

## Was nicht ins Repo gehört

- Directus-Admin-Passwort, Static Tokens, `SECRET`, User-Passwörter
- `directus/.env`, `scraper/.env`, `web/.env` (stehen in `.gitignore`)

Gefundene Secrets in Issues oder einer Mail an den Repo-Owner (`schroepa`). Keine Tokens in Ticket-Texten zitieren.

## Erwartetes Modell

- **Heute (Shell):** Die Web-App spricht Directus nur **serverseitig** mit einem Static Token an (`DIRECTUS_TOKEN`, nie `PUBLIC_*`).
- **Ab Gruppen-Login (V1.25):** Login über Directus Auth; Session nur in **httpOnly**-Cookies auf dem Astro-Server. Persönliche Daten (`SquadMembership`, `UserProfile`) mit User-Access-Token und Directus-Filter `$CURRENT_USER`. Ligadaten bleiben für Mitglieder lesbar.
- **Scraper:** weiterhin Admin-/Service-Zugang, nie im Browser. Static Tokens gehören nicht in die Prod-Web-Env, sobald User-Sessions live sind.
