# Design: Directus kostenfrei hosten + Auth ohne Directus-Seats

**Datum:** 2026-08-21  
**Status:** bereit für Implementierungsplan  
**Baut auf:** `docs/spec-hosting-directus.md`, `docs/spec-auth.md`, lokales `directus/docker-compose.yml`  
**Korrigiert:** früheres Auth-Design (Directus Users als IdP) — Freunde sind **keine** Directus-User

## Ziel

1. Directus **€0/Monat** betreiben (Self-Host).  
2. Genau **ein** Directus-Admin.  
3. Bis **10 App-Nutzer** im Frontend, Datenisolation über eigene Collection — nicht über Directus Roles/Seats.

## Entscheidungen (fest)

| Thema | Wahl | Warum |
|---|---|---|
| Cloud-Produkt | **Kein** Directus Cloud | Starter gratis weg; Cloud ab bezahltem Tier |
| Lizenz/Software | Self-Host Image (wie lokal) | Innovation Grant / Core für privates Kleingruppen-Tool; Hosting selbst |
| Compute | **Oracle Always Free ARM** + Docker Compose | Dauerhaft gratis, genug Ressourcen |
| DB | **SQLite** auf Volume | Identisch lokal; Datenmenge winzig; kein Managed-DB-Zwang |
| HTTPS | Caddy/Traefik + Let’s Encrypt | Pflicht für Tokens über Vercel |
| Studio | Gehärtet (Allowlist / Basic / VPN) | Freunde brauchen Studio nicht; Angriffsfläche klein halten |
| App-Auth | **Astro-Session** gegen Collection `Mitglied` | Keine Directus-Seats; ≤10 Nutzer |
| Directus-Zugriff Web/Scraper | **Ein Static Token** (Admin/Service) | Einfach; Isolation in der Astro-Schicht |

## Abgelehnte Alternativen

| Alternative | Warum nicht |
|---|---|
| Directus Users + Rolle „Mitglied“ je Freund | Verbraucht Seats/RBAC unnötig; User will 1 Admin in Directus |
| Render Free dauerhaft | Sleep 15 min, Free-Postgres 30 Tage, kein Disk auf Free |
| Railway als „gratis“ | Nach Trial typisch Hobby-Kosten |
| Auth nur über Directus Cloud Seats | Widerspricht Kosten- und Seat-Ziel |

## Auth-Modell (Revision)

```
Browser  →  /login (E-Mail/Passwort)
               ↓
        Astro prüft Mitglied (Directus Collection via Static Token)
               ↓
        httpOnly Session-Cookie (Astro/App-Session, nicht Directus JWT)
               ↓
        Alle Directus-Calls mit dem einen Service-Token
               ↓
        Queries immer mit Filter mitglied_id = Session
```

### Schema

**`Mitglied`** *(neu, ersetzt die Idee „UserProfile ↔ directus_users“)*:

| Feld | Typ | Hinweis |
|---|---|---|
| `id` | integer PK | |
| `email` | string, unique | Login |
| `password_hash` | string | nur Hash (bcrypt/argon2), nie Klartext |
| `anzeigename` | string | Shell |
| `budget_uebrig` | integer | Dashboard |
| `aktiv` | boolean | Soft-Disable ohne Löschen |
| `liga_name` | string, optional | Label |
| `angelegt_am` | date/timestamp | |

**`SquadMembership`:** Feld `mitglied_id` (M2O → `Mitglied`), required; Unique `(mitglied_id, player_id)`.  
Kein Bezug auf `directus_users`.

**`CompetitorSquad`:** später ebenfalls `mitglied_id`.

Admin legt Mitglieder in Directus Studio an (oder kleines Admin-only UI später). Passwort: initial Hash setzen (CLI-Skript oder Studio mit gehashtem Wert — Klartext-Passwort-Feld in Directus vermeiden; besser Einladungsfluss der Hash nur serverseitig schreibt).

### Session-Bibliothek

Leichtgewichtig im Astro-Server: z. B. iron-session / Lucia / Better Auth Credentials gegen `Mitglied`. Kein zweites SaaS-IdP. Directus Auth-Endpoints für Freunde **nicht** nutzen.

### Sicherheit

- `DIRECTUS_TOKEN` nur Server (Vercel Env, Scraper Env).
- App erzwingt `mitglied_id`-Filter bei jedem Schreib/Lese auf Kader/Budget; Tests mit zwei Mitgliedern.
- Rate-Limit Login (einfach, IP-basiert) gegen Brute-Force.
- Studio nicht für Freunde.

## Hosting-Laufbuch (Oracle, Kurz)

1. Always-Free-Account, ARM-VM provisionieren (bei Capacity: kleinere Shape oder andere Region).  
2. Docker + Compose installieren.  
3. Repo-`directus/` (oder Prod-Compose-Variante) deployen: Volumes für `database/` und `uploads/`.  
4. `PUBLIC_URL=https://directus.<domain>`, starke `SECRET` / Admin-Passwort.  
5. Reverse Proxy + TLS; Firewall nur 80/443 (und SSH), nicht roh 8055.  
6. Schema apply; Static Token erzeugen; in Vercel `DIRECTUS_URL` + `DIRECTUS_TOKEN`.  
7. Backup-Cron für `data.db`.  
8. Optional: Studio nur via Tailscale.

Prod-Compose kann später als `directus/docker-compose.prod.yml` liegen (Caddy-Sidecar) — nicht Teil dieses Spec-Schnitts zwingend, aber nächster Implementierungsschritt.

## Auswirkungen auf Docs

| Datei | Änderung |
|---|---|
| `CLAUDE.md` Tech-Stack | „Directus Cloud Community“ → Self-Host (Oracle Always Free / Fallback VPS) |
| `spec-auth.md` | Directus-Users-IdP → `Mitglied` + Astro-Session |
| Auth-Design | entsprechend revidieren |
| `SECURITY.md` | ein Service-Token; App-Sessions getrennt |

## Fertig wenn (Acceptance Planung)

- Hosting-Entscheidung und Fallback dokumentiert.  
- Klar: 1 Directus-Admin, ≤10 `Mitglied`-Rows.  
- Auth-Spec widerspricht dem Seat-Modell nicht mehr.  
- Nächster Bau: Prod-Compose + Auth-Implementierungsplan.
