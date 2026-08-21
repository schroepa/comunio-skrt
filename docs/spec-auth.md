# Spec: Gruppen-Login (Invite-only)

Teil von V1.25. Root-Kontext siehe `../CLAUDE.md`. Hosting: `spec-hosting-directus.md`.

## Ziel

Freunde aus derselben Comunio-Gruppe melden sich in der **Astro-App** an und nutzen denselben Assistenten — jeweils mit **eigenem Kader**, **eigenem Budget** und denselben geteilten Ligadaten. Kein öffentliches Produkt, keine Selbstregistrierung.

**Wichtig:** Directus hat nur **einen Admin** (Studio). Die bis zu ~10 Freunde sind **App-Mitglieder** (`Mitglied`), keine Directus-User/Seats.

## Problem

Heute liest die Web-App Directus mit einem Static Token und `SquadMembership` hat keinen Mitglieder-Bezug. Sobald mehrere Manager denselben Deploy teilen, müssen Identität und Kader getrennt sein — ohne Directus mit vielen Studio-Accounts aufzublähen oder Cloud-Seats zu bezahlen.

## Nutzer & Zugang

| Rolle | Wo | Wer | Kann |
|---|---|---|---|
| **Directus-Admin** | Directus Studio | Instanz-Owner (1 Person) | Schema, Tokens, Mitglieder anlegen, Scraping-Daten prüfen |
| **Mitglied** | Frontend-Login | Comunio-Freund (≤10) | App nutzen, eigenen Kader/Budget pflegen, Ligadaten sehen |

- **Invite-only:** Admin legt `Mitglied`-Datensätze an (Studio oder später kleines Admin-UI). Kein öffentliches Signup.
- **Auth-Pfad:** E-Mail + Passwort, geprüft in Astro gegen `Mitglied.password_hash`.
- Directus `/auth/login` wird von Freunden **nicht** benutzt.

## Was geteilt vs. privat ist

| Daten | Sichtbarkeit |
|---|---|
| `Player`, `ValueHistory`, `RatingHistory`, `Fixture`, `AvailabilityStatus` | alle eingeloggten Mitglieder (Lesen via App) |
| `SquadMembership`, Budget-Felder auf `Mitglied` | nur das jeweilige Mitglied |
| `CompetitorSquad` | nur das jeweilige Mitglied |
| `ScrapeLog`, Schema, Tokens | nur Directus-Admin |

## Datenmodell

- **`Mitglied`** *(neu)*: `email`, `password_hash`, `anzeigename`, `budget_uebrig`, `aktiv`, optional `liga_name`, `angelegt_am`
- **`SquadMembership.mitglied_id`** — M2O → `Mitglied`, required; Unique `(mitglied_id, player_id)`
- Kein FK auf `directus_users` für App-Nutzer

## Auth-Fluss (Web)

```
Browser  →  /login
               ↓
        Astro: Mitglied per E-Mail laden (Directus + Service-Token)
               ↓
        Passwort gegen password_hash prüfen
               ↓
        httpOnly App-Session-Cookie (Astro)
               ↓
        Middleware schützt App-Routen
               ↓
        Directus-Calls weiterhin mit einem Service-Token;
        Filter immer mitglied_id = Session
```

- Geschützt: `/`, `/radar`, `/kader-check`, …
- Öffentlich: `/login`, `/logout`
- Scraper: unverändert Admin-/Service-Token, kein App-Login

## UI (V1.25)

- Login-Seite: Markenname, Hinweis „nur Liga-Gruppe“, E-Mail, Passwort
- Shell: Anzeigename + Logout
- Mitglieder-Anlage zunächst über Directus Studio (Admin); Passwort-Hash serverseitig setzen (Hilfsskript), kein Klartext-Feld als Workflow

## Nicht-Ziele

- Keine Directus-Seats / Roles pro Freund
- Kein öffentliches Signup / kein SaaS
- Keine Comunio-OAuth
- Kein Magic Link im ersten Bau
- Kein Multi-Tenant (eine Instanz = eine Gruppe)

## Abhängigkeiten & Reihenfolge

- Hosting-Entscheidung: `spec-hosting-directus.md` (Self-Host, 1 Admin)
- Ideal vor dem Kader-Picker: `mitglied_id` von Anfang an
- Design: `docs/superpowers/specs/2026-08-21-auth-gruppen-login-design.md`  
  und Hosting-Design: `docs/superpowers/specs/2026-08-21-directus-hosting-kostenfrei-design.md`
