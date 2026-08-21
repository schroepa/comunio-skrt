# Security

Dieses Repository ist ein **persönliches Ein-Nutzer-Tool**. Es gibt keine öffentliche Instanz, keine Accounts Dritter und kein Bug-Bounty.

## Was nicht ins Repo gehört

- Directus-Admin-Passwort, Static Tokens, `SECRET`
- `directus/.env`, `scraper/.env`, `web/.env` (stehen in `.gitignore`)

Gefundene Secrets in Issues oder einer Mail an den Repo-Owner (`schroepa`). Keine Tokens in Ticket-Texten zitieren.

## Erwartetes Modell

Die Web-App spricht Directus nur **serverseitig** mit einem Static Token an (`DIRECTUS_TOKEN`, nie `PUBLIC_*`). Der Scraper nutzt Admin-Login lokal, nicht im Browser.
