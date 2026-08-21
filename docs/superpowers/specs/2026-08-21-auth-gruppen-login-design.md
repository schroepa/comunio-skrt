# Design: Gruppen-Login (Invite-only Auth)

**Datum:** 2026-08-21 (revidiert: App-Mitglieder, nicht Directus-Seats)  
**Status:** bereit für Implementierungsplan  
**Baut auf:** `docs/spec-auth.md`, `docs/spec-hosting-directus.md`, `SECURITY.md`, Dashboard-Shell (`web/`)  
**Nicht dieser Schnitt:** Kader-Picker-UI, Magic Link, OAuth, Konkurrenzvergleich, öffentliches Signup

## Ziel

Geschlossener Zugang für die Comunio-Freundesgruppe (≤10). Directus bleibt **Ein-Admin-Backend**. Identität der Freunde lebt in Collection `Mitglied` + Astro-Session.

## Entscheidungen (fest)

| Thema | Wahl | Warum |
|---|---|---|
| IdP | **Astro** gegen Collection `Mitglied` | Keine Directus-Seats; max. 10 Frontend-Konten |
| Directus Studio | **1 Admin** | Owner pflegt Schema/Daten; Freunde brauchen Studio nicht |
| Directus API-Zugang | **Ein Static/Service-Token** von Astro + Scraper | Einfach, passt zu Self-Host |
| Isolation | App filtert `mitglied_id` | Directus `$CURRENT_USER` gilt nicht für App-Mitglieder |
| Zugang | Invite-only (Admin legt `Mitglied` an) | Kleine Gruppe |
| Session | httpOnly Cookie (App-Session) | Token/Passwort-Hash nie im Browser-JS |
| Budget | Felder auf `Mitglied` | Kein separates Profil an `directus_users` |
| Kader-Scope | `SquadMembership.mitglied_id` | Trennt Kader der Freunde |
| Hosting | Self-Host gratis — siehe Hosting-Spec | Cloud nicht kostenlos |

## Abgelehnte Alternativen

| Alternative | Warum nicht |
|---|---|
| Directus Users je Freund + RBAC | Widerspricht „nur 1 Directus-Nutzer“; unnötige Seats |
| Clerk / Auth0 | Extra Vendor für ≤10 Personen |
| Shared Passwort / Basic-Auth vor der App | Keine pro-Person-Kader |
| LocalStorage „Name wählen“ | Spoofbar, keine echte Isolation |

## Architektur

```
Freunde ──► Astro (Vercel) ──Service-Token──► Directus (Self-Host, 1 Admin)
               │                                 │
               │ App-Session                     ├─ read: Player, Fixture, …
               │ (Cookie)                        └─ R/W: Mitglied, SquadMembership
               │                                        (App setzt mitglied_id-Filter)
Scraper ───────┴──────────Token/Admin─────────────────────┘
```

### Login-Details

1. Formular `email` + `password` → Astro Action/API.
2. `GET /items/Mitglied?filter[email][_eq]=…` mit Service-Token (Felder inkl. `password_hash` nur serverseitig anfordern).
3. `argon2`/`bcrypt.compare`; bei Fehler generische Meldung.
4. Session speichern: `{ mitgliedId, anzeigename }` in verschlüsseltem httpOnly Cookie (iron-session o. ä.).
5. Middleware: ohne Session → `/login?redirect=…`.
6. Logout: Cookie löschen.

Passwort setzen: kleines CLI `npm run mitglied:set-password -- email@…` das Hash schreibt — Admin tippt kein Hash von Hand in Studio.

### Directus Permissions

Für den **einen** Admin/Service-Token: Lesen Ligadaten, CRUD `Mitglied`/`SquadMembership` (Token ist privilegiert).  
Sicherheit der Trennung liegt in der **Astro-Schicht** (jeder Query mit `filter[mitglied_id][_eq]=session`). Zusätzlich: Directus Studio nicht öffentlich ohne Härte (Hosting-Design).

## Schema

### `Mitglied`

| Feld | Typ | Hinweis |
|---|---|---|
| `id` | integer | PK |
| `email` | string | unique, required |
| `password_hash` | string | required |
| `anzeigename` | string | required |
| `budget_uebrig` | integer | default 0 |
| `aktiv` | boolean | default true; Login verweigern wenn false |
| `liga_name` | string | optional |
| `angelegt_am` | timestamp | |

### `SquadMembership`

| Feld | Typ | Hinweis |
|---|---|---|
| `mitglied_id` | integer M2O → Mitglied | required, indexed |
| bestehend | `player_id`, `im_kader`, `kaufpreis`, `hinzugefuegt_am` | unverändert |

Unique `(mitglied_id, player_id)`.

Migration: bestehende Kaderzeilen dem ersten Mitglied (Owner) zuweisen.

## UI

| Route | Verhalten |
|---|---|
| `/login` | Formular |
| `/logout` | Session weg, Redirect Login |
| App-Routen | Middleware |
| Shell | Anzeigename + Logout |

## Auswirkungen

| Spec / Doku | Änderung |
|---|---|
| Früheres Directus-User-IdP | **verworfen** |
| `spec-hosting-directus.md` | Self-Host, 1 Admin |
| Dashboard / Kader-Check | Scope = Session-`mitglied_id` |
| SECURITY | Service-Token + App-Sessions |

## Implementierungsphasen (Vorschlag)

1. Hosting Prod-Compose (Oracle) + Token in Vercel  
2. Schema `Mitglied` + `mitglied_id`  
3. Auth-Modul Astro (Login/Session/Middleware) + Passwort-CLI  
4. Alle Squad/Budget-Reads an Session binden  
5. Invite-Runbook (Admin: Mitglied anlegen, Passwort-CLI, Freund loggt ein)

## Risiken

| Risiko | Mitigation |
|---|---|
| Service-Token kompromittiert | Nur Server-Env; Studio härten; Token rotieren |
| App vergisst `mitglied_id`-Filter | Zentrale Data-Access-Hilfen + Tests mit 2 Mitgliedern |
| Oracle Capacity | Fallback Mini-VPS dokumentiert |
| Hash in Studio sichtbar für Admin | Akzeptabel (Admin = Owner); Feld nicht an API ohne Auth exposen |

## Fertig wenn

- Login ohne Directus-Seat für Freunde  
- Zwei Mitglieder: getrennte Kader, gleiche Fixtures  
- Directus Studio: nur 1 Admin-Account  
- SECURITY/CLAUDE beschreiben Service-Token + `Mitglied`
