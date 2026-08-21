# Security

Dieses Repository ist ein **persönliches Ein-Nutzer-Tool**. Es gibt keine öffentliche Instanz, keine Accounts Dritter und kein Bug-Bounty.

## Was nicht ins Repo gehört

- Supabase Service Role, JWT secrets
- `scraper/.env`, `web/.env` (stehen in `.gitignore`)

Gefundene Secrets in Issues oder einer Mail an den Repo-Owner (`schroepa`). Keine Tokens in Ticket-Texten zitieren.

## Erwartetes Modell

Die Web-App spricht Supabase nur **serverseitig** mit dem **anon** Key plus User-JWT (`SUPABASE_ANON_KEY`, nie Service Role). Der Scraper nutzt den Service Role lokal, nicht im Browser und nicht auf Vercel.
