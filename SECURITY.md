# Security

Dieses Repository ist ein **privates Liga-Tool** (Invite-only, eine Comunio-Gruppe). Kein öffentliches Signup, kein Bug-Bounty.

## Was nicht ins Repo gehört

- Directus-Admin-Passwort, Static Tokens, `SECRET`, Mitglieder-Passwörter / Hashes aus Prod
- `directus/.env`, `scraper/.env`, `web/.env` (stehen in `.gitignore`)

Gefundene Secrets in Issues oder einer Mail an den Repo-Owner (`schroepa`). Keine Tokens in Ticket-Texten zitieren.

## Erwartetes Modell

- **Directus:** genau **ein** Studio-Admin; Self-Host (siehe `docs/spec-hosting-directus.md`). Studio härten (nicht ungeschützt öffentlich).
- **Web-App:** spricht Directus nur **serverseitig** mit einem Service-/Static-Token (`DIRECTUS_TOKEN`, nie `PUBLIC_*`).
- **App-Logins (≤10):** Session in httpOnly-Cookies; Identität in Collection `Mitglied` (`docs/spec-auth.md`). Kaderzugriff immer über `mitglied_id` der Session filtern.
- **Scraper:** Admin-/Service-Zugang, nie im Browser.
