# Spec: Gruppen-Login (Invite-only)

Teil von V1.25. Root-Kontext siehe `../CLAUDE.md`.

## Ziel

Freunde aus derselben Comunio-Gruppe melden sich an und nutzen denselben Assistenten — jeweils mit **eigenem Kader**, **eigenem Budget** und denselben geteilten Ligadaten (Spielplan, Marktwerte, Verfügbarkeit, später Noten). Kein öffentliches Produkt, keine Selbstregistrierung im Internet.

## Problem

Heute ist das Tool bewusst Ein-Nutzer: die Web-App liest Directus serverseitig mit einem Static Token, `SquadMembership` hat keinen User-Bezug, und `SECURITY.md` / Roadmap schließen Multi-User aus. Sobald mehrere Manager denselben Deploy teilen, müssen Identität und Kader-Daten getrennt sein — sonst überschreiben sich Kader und Alerts.

## Nutzer & Zugang

| Rolle | Wer | Kann |
|---|---|---|
| **Admin** | Repo-/Instanz-Owner | Nutzer anlegen/einladen, Schema, Scraper-Token, Directus-Admin |
| **Mitglied** | Comunio-Gruppenfreund (Invite) | App nutzen, eigenen Kader pflegen, geteilte Ligadaten lesen |

- **Invite-only:** Accounts legt der Admin an (Directus-User oder Einladungslink). Kein öffentliches „Registrieren“.
- **Erster Auth-Pfad:** E-Mail + Passwort über Directus Auth.
- **Optional später:** Magic Link / OAuth, wenn Passwort-Friction in der Gruppe stört — nicht Teil des ersten Schnitts.

## Was geteilt vs. privat ist

| Daten | Sichtbarkeit |
|---|---|
| `Player`, `ValueHistory`, `RatingHistory`, `Fixture`, `AvailabilityStatus` | alle Mitglieder (Lesen) |
| `SquadMembership`, Budget / Profil | nur der jeweilige User (Lesen + Schreiben) |
| `CompetitorSquad` | nur der jeweilige User (manuell); später optional Verknüpfung zu anderen App-Nutzern |
| `ScrapeLog`, Schema, User-Verwaltung | nur Admin |

Radar und Spielplan bleiben **ligaweit gleich**. Dashboard, Kader-Check und Kaderwert filtern immer auf den eingeloggten User.

## Datenmodell (Erweiterungen)

Bestehende Collections bleiben; Ergänzungen:

- **`SquadMembership.user_id`** — M2O auf `directus_users`, required. Unique-Constraint sinnvoll: `(user_id, player_id)`.
- **`UserProfile`** *(neu)*: `user_id`, `anzeigename`, `budget_uebrig` (integer, Comunio-Cash), optional `liga_name`. Ein Profil pro User.
- **`CompetitorSquad.user_id`** — sobald die Collection gebaut wird: pro User, nicht global.

Migration: vorhandene `SquadMembership`-Zeilen ohne User dem Admin-Account zuordnen.

## Auth-Fluss (Web)

```
Browser  →  /login (E-Mail/Passwort)
                ↓
         Astro Server  →  Directus POST /auth/login
                ↓
         httpOnly Session-Cookie (Refresh + Access, nur Server)
                ↓
         Astro Middleware: geschützte Routen brauchen Session
                ↓
         Directus-Calls mit User-Access-Token (persönliche Daten)
         + ggf. weiterhin Service-Token nur für Admin/Scraper, nie im Browser
```

- Geschützt: `/`, `/radar`, `/kader-check` und alle späteren App-Routen.
- Öffentlich: `/login` (und später `/logout`).
- Logout invalidiert Directus-Session und löscht Cookies.
- Static Token aus dem Dashboard-Shell-Schnitt entfällt für normale App-Nutzung; Scraper behält Admin-/Service-Zugang unverändert.

## UI (V1.25)

- Login-Seite: Markenname, kurzer Hinweis „nur für die Liga-Gruppe“, E-Mail, Passwort, Fehlerzustände.
- In der Shell: Anzeigename + Logout.
- Kein Account-Self-Service außer Passwort ändern (kann zunächst über Directus-Admin laufen).
- Keine öffentliche Landing-Page mit Marketing — die App ist die Login-Wand.

## Permissions (Directus)

Rolle **Mitglied**:

- Read: Ligadaten-Collections
- Create/Update/Delete: `SquadMembership` und `UserProfile` mit Filter `user_id = $CURRENT_USER`
- Kein Zugriff auf `ScrapeLog`, keine User-Admin-Rechte

Rolle **Admin**: alles wie bisher (inkl. Schema und Tokens).

## Nicht-Ziele (dieser Schnitt)

- Kein öffentliches Signup / kein SaaS-Billing
- Keine Comunio-OAuth (technisch nicht verfügbar)
- Kein Teilen fremder Kader ohne explizite spätere Spec (Konkurrenzvergleich V1.5 bleibt opt-in / manuell)
- Keine Push-Benachrichtigungen, kein Magic Link im ersten Bau
- Kein Multi-Liga / Multi-Tenant über Gruppen-IDs — eine Instanz = eine Comunio-Gruppe

## Abhängigkeiten & Reihenfolge

- **Ideal vor dem Kader-Picker:** `SquadMembership` wird von Anfang an mit `user_id` geschrieben.
- Geteilte Ligadaten (OpenLigaDB, Transfermarkt) bleiben unverändert.
- V1.5 Konkurrenzvergleich profitiert später optional davon, dass mehrere echte User existieren — bleibt aber unabhängig (manuelle `CompetitorSquad` weiter möglich).

Design-Details und festgehaltene Alternativen: `docs/superpowers/specs/2026-08-21-auth-gruppen-login-design.md`.

## Abhängigkeiten

- Directus Users / Roles / Permissions
- Astro Middleware + Server-Session
- Schema-Änderung `SquadMembership` + `UserProfile`
- Anpassungen an `SECURITY.md` und Roadmap in `CLAUDE.md`
