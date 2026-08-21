# Spec: Directus kostenfrei hosten

Teil von V1.25 (Betrieb). Root-Kontext siehe `../CLAUDE.md`. Auth-Modell: `spec-auth.md`.

## Ziel

Directus dauerhaft und **ohne monatliche Plattformgebühr** betreiben, damit die Astro-App auf Vercel und der Scraper eine stabile API haben. Maximal **ein Directus-Studio-User (Admin)**. Die bis zu ~10 Liga-Freunde sind **App-Nutzer im Frontend**, keine Directus-Seats.

## Randbedingungen

| Constraint | Wert |
|---|---|
| Directus Studio | genau 1 Admin |
| App-Logins | ≤ 10, Invite-only (`spec-auth.md`) |
| Datenvolumen | klein (Bundesliga-Katalog, Fixtures, Kader) |
| Schreiblast | Scraper niedrigfrequent + manuelle Kaderpflege |
| Budget Hosting | **€0/Monat** Ziel; Fallback wenige Euro nur wenn Free scheitert |
| Lokal heute | Docker + SQLite (`directus/`) |

## Entscheidung: kein Directus Cloud

Directus Cloud hat den früheren kostenlosen Starter-Tier eingestellt. Managed Cloud beginnt praktisch bei bezahltem Hosting (aktuell ab ~$99/mo als Cloud-Add-on; Open Innovation Grant betrifft die **Softwarelizenz**, nicht „Cloud gratis“). Für dieses Projekt: **Self-Host**.

Softwarelizenz: als privates Einpersonen-/Kleingruppen-Projekt unter den üblichen Innovation-Grant-/Core-Grenzen unkritisch — kein Rechtsrat, bei Unsicherheit Directus-Docs prüfen.

## Empfohlener Hosting-Pfad

### Primär: Oracle Cloud Always Free (ARM) + Docker Compose + SQLite

| | |
|---|---|
| Warum | Wirklich dauerhaft gratis (Always Free), genug RAM/CPU für Directus, passt zum lokalen Compose+SQLite-Setup |
| Shape | `VM.Standard.A1.Flex` (Ampere), z. B. 1–2 OCPU / 6–12 GB — volle 4/24 nur wenn verfügbar |
| Persistenz | Block Volume / Boot-Volume: SQLite-Datei + Uploads als Docker-Volumes (wie lokal) |
| HTTPS | Caddy oder Traefik als Reverse Proxy (Let’s Encrypt), Directus nur über `https://…` |
| Studio-Härte | Admin-UI nicht welt-offen: IP-Allowlist, HTTP-Basic vor `/admin`, oder nur Tailscale/VPN |
| API | Öffentlich erreichbar für Vercel (`web`) und Scraper, geschützt durch Static Token (nie im Browser) |

### Fallback A: Mini-VPS (~€3–5/mo, Hetzner/Netcup)

Wenn Oracle-Account oder ARM-Kapazität scheitert: kleines x86-VPS, gleiches Compose. Nicht „gratis“, aber günstig und oft weniger Friction.

### Fallback B: Render Blueprint (nur Experiment)

Offizielles Directus-Blueprint existiert, Free-Web-Service **schläft nach 15 min**, Free-Postgres **läuft nach 30 Tagen aus**, kein Persistent Disk auf Free. **Nicht** für den Liga-Alltag — nur zum Ausprobieren.

### Abgelehnt für Prod

| Option | Grund |
|---|---|
| Directus Cloud | nicht kostenlos |
| Railway-Template | nach Trial typisch kostenpflichtig |
| SQLite auf Vercel Serverless | Directus braucht Dauerprozess; passt nicht |
| Render Free als Dauerbetrieb | Sleep + ephemeral FS / DB-Ablauf |

## Architektur (Prod)

```
Freunde  →  Vercel (Astro web/)  --Static Token-->  Directus API (Oracle VM)
Admin    →  Studio (gehärtet)                      ↑
Scraper  →  Vercel Cron / lokal  --Admin/Token-----┘
                                 SQLite auf Volume
```

Env in Vercel/`web`: `DIRECTUS_URL=https://…`, `DIRECTUS_TOKEN=…` (Service/Admin-Static-Token).  
Directus: `PUBLIC_URL` auf die HTTPS-URL setzen.

## Betrieb (Minimum)

- Automatische Restarts (`restart: unless-stopped`)
- Wöchentliches Backup der SQLite-Datei (Cron → Object Storage / lokaler Download)
- Directus-Image-Pin (wie lokal `12.0.2`), Updates bewusst
- Healthcheck-URL für Uptime (kostenloser Ping); hält die Instanz „wach“, falls je ein Sleep-Host genutzt würde
- Schema weiterhin über `schema/snapshot.yaml` + `schema apply`

## Nicht-Ziele

- Kein Multi-Region / HA
- Kein Managed Postgres, solange SQLite reicht
- Keine Directus-Cloud-Migration
- Keine zusätzlichen Directus-Seats für Freunde

Design-Details und Auth-Anpassung:  
`docs/superpowers/specs/2026-08-21-directus-hosting-kostenfrei-design.md`.
