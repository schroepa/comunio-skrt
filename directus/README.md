# Directus-Setup (Datenpipeline Phase 1)

Lokales Directus-Backend (SQLite) für den Comunio Assistant. Siehe `../docs/spec-datenpipeline.md` für den vollständigen Kontext.

## Starten

1. `directus/.env` aus `.env.example` erzeugen (Werte für `SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` setzen).
2. `docker compose up -d`
3. Admin-UI: http://localhost:8055 (Login mit den Werten aus `.env`)

## Schema neu aufsetzen

Nach frischem Checkout und leerer Datenbank:
```bash
docker compose up -d
docker compose exec directus npx directus schema apply --yes ./schema/snapshot.yaml
```

Nach einem `git pull` dasselbe `schema apply --yes` ausführen, damit neue Felder (z. B. `Player.transfermarkt_id`) in der laufenden Instanz ankommen.

## Collections

`Player`, `ValueHistory`, `RatingHistory`, `Fixture`, `AvailabilityStatus`, `SquadMembership` (siehe `../CLAUDE.md`), plus `ScrapeLog` (siehe `../docs/spec-datenpipeline.md`, Abschnitt „Architektur"). Ab V1.25 zusätzlich `UserProfile` und `SquadMembership.user_id` (siehe `../docs/spec-auth.md`) — noch nicht im Snapshot.
