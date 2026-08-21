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

Nach einem `git pull` dasselbe `schema apply --yes` ausführen, damit neue Felder (`SquadMembership.user_id`, `ManagerProfile`, `CompetitorSquad`) ankommen.

Invite-Rolle (einmal, Directus muss laufen):

```bash
node --env-file=directus/.env directus/scripts/ensure-manager-role.mjs
```

Danach in der Admin-UI User anlegen und die Rolle **manager** zuweisen. Keine öffentliche Registrierung.

Directus 12 Core speichert keine Item-Filter (`$CURRENT_USER`). Die App filtert trotzdem nach Session-User; Directus-Admin-URL nicht an die Freundesrunde geben.

Production: `PUBLIC_URL` in `.env` auf die HTTPS-URL von Directus setzen.

## Collections

`Player`, `ValueHistory`, `RatingHistory`, `Fixture`, `AvailabilityStatus`, `SquadMembership` (`user_id`), `ManagerProfile`, `CompetitorSquad`, `ScrapeLog`.
