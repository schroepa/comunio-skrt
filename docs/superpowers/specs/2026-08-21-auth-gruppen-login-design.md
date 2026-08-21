# Design: Gruppen-Login (Invite-only Auth)

**Datum:** 2026-08-21  
**Status:** bereit für Implementierungsplan  
**Baut auf:** `docs/spec-auth.md`, `CLAUDE.md`, `SECURITY.md`, Dashboard-Shell (`web/`)  
**Nicht dieser Schnitt:** Kader-Picker-UI, Magic Link, OAuth, Konkurrenzvergleich, öffentliches Signup

## Ziel

Geschlossener Zugang für die Comunio-Freundesgruppe: jeder Freund loggt sich ein, sieht geteilte Ligadaten und pflegt **nur den eigenen** Kader/Budget. Eine Instanz = eine Liga-Gruppe.

## Entscheidungen (fest)

| Thema | Wahl | Warum |
|---|---|---|
| IdP | **Directus Users** (E-Mail/Passwort) | Schon im Stack; Roles/Permissions und Tokens vorhanden; kein Extra-Vendor |
| Zugang | **Invite-only** (Admin legt User an) | Kleine Gruppe; kein Spam/Signup-Abuse; passt zu „persönliches Tool für Freunde“ |
| Session | Astro Server + **httpOnly Cookies** (Access + Refresh) | Token nie im Browser-JS; passt zur bestehenden SSR-only-Directus-Regel |
| App-Schutz | Astro **Middleware** auf allen App-Routen | Eine Gatekeeper-Stelle statt Checks pro Seite |
| Persönliche Daten | Directus-Calls mit **User-Access-Token** | Row-Level-Filter `$CURRENT_USER` greifen serverseitig in Directus |
| Scraper | Unverändert Admin-/Service-Login bzw. Static Token | Scraper ist kein User der Web-App |
| Budget | Collection **`UserProfile`** | Dashboard braucht `budget_uebrig` pro Person; gehört nicht an `SquadMembership` |
| Kader-Scope | `SquadMembership.user_id` required | Sonst kollidieren Kader der Freunde |
| Tenant-Modell | **Eine Deploy-Instanz = eine Gruppe** | Kein `liga_id`/Multi-Tenant in V1.25 |
| Registrierung | Kein Self-Signup in der App | Admin legt Accounts in Directus an (UI oder API) |

## Abgelehnte Alternativen

| Alternative | Warum nicht jetzt |
|---|---|
| Clerk / Auth.js / Supabase Auth | Extra IdP, doppelte User-Quelle neben Directus |
| Nur Basic-Auth / HTTP-Passwort vor Vercel | Keine pro-User-Kader; alle teilen denselben Static Token |
| Shared Static Token + „Name wählen“ im LocalStorage | Keine echte Isolation, spoofbar, nicht für Deploy mit Freunden |
| Öffentliches Signup mit Invite-Code | Mehr Angriffsfläche; für ~5–15 Freunde Overkill; Admin-Anlage reicht |
| OAuth (Google/GitHub) | Friction niedriger, aber Setup + Account-Linking; später optional |
| Magic Link only | Braucht Mail-Provider in Directus/Cloud; Passwort ist für kleinen Kreis einfacher zu starten |

## Architektur

```
                    ┌─────────────┐
   Freunde ────────►│  web/ Astro │
                    │  Middleware │
                    └──────┬──────┘
                           │ User JWT (Server)
                           ▼
                    ┌─────────────┐     Shared read
                    │  Directus   │◄──────────────── Player, Fixture, …
                    │  Roles:     │
                    │  Admin /    │     Own read/write
                    │  Mitglied   │◄──────────────── SquadMembership, UserProfile
                    └──────┬──────┘
                           ▲
                    scraper│ Admin/Service Token (unverändert)
```

### Session-Details

1. `POST /auth/login` an Directus mit E-Mail/Passwort.
2. Response: `access_token`, `refresh_token`, `expires`.
3. Server setzt httpOnly, Secure, SameSite=Lax Cookies (Namen z. B. `ds_access`, `ds_refresh`).
4. Middleware: fehlt Access → Refresh versuchen → sonst Redirect `/login?redirect=…`.
5. Logout: Directus `/auth/logout` + Cookies löschen.

Env (`web/.env`): `DIRECTUS_URL` bleibt. `DIRECTUS_TOKEN` entfällt für App-Seiten (oder nur noch als optionaler Dev-Bypass lokal, dokumentiert und nicht für Prod mit Freunden).

### Directus Permissions (Skizze)

**Rolle `Mitglied`:**

| Collection | Create | Read | Update | Delete | Filter |
|---|---|---|---|---|---|
| Player, ValueHistory, RatingHistory, Fixture, AvailabilityStatus | — | ✓ | — | — | — |
| SquadMembership | ✓ | ✓ | ✓ | ✓ | `user_id = $CURRENT_USER` |
| UserProfile | ✓* | ✓ | ✓ | — | `user_id = $CURRENT_USER` |
| ScrapeLog | — | — | — | — | — |

\*Create nur wenn noch kein Profil existiert (App legt Profil beim ersten Login an, oder Admin pre-creates).

**Rolle `Admin`:** volle Rechte inkl. User-Management.

## Schema

### `SquadMembership` (Erweiterung)

| Feld | Typ | Hinweis |
|---|---|---|
| `user_id` | uuid, M2O → `directus_users` | required, indexed |
| bestehend | `player_id`, `im_kader`, `kaufpreis`, `hinzugefuegt_am` | unverändert |

Unique: `(user_id, player_id)`.

### `UserProfile` (neu)

| Feld | Typ | Hinweis |
|---|---|---|
| `id` | integer PK | |
| `user_id` | uuid, M2O → `directus_users` | unique, required |
| `anzeigename` | string | Anzeige in Shell |
| `budget_uebrig` | integer | Comunio-Restbudget in € |
| `liga_name` | string, optional | nur Label, kein Tenant-Key |

Snapshot `directus/schema/snapshot.yaml` aktualisieren; lokal `schema apply --yes`.

### Migration Einzelnutzer → Gruppe

1. Admin-User existiert bereits.
2. Alle bestehenden `SquadMembership` ohne `user_id` → Admin zuweisen.
3. `UserProfile` für Admin mit aktuellem Budget anlegen (manuell).
4. Danach `user_id` auf required setzen.

## UI-Schnitt

| Route | Verhalten |
|---|---|
| `/login` | Formular; nach Erfolg Redirect auf `redirect` oder `/` |
| `/logout` | POST/GET Logout, Redirect `/login` |
| `/`, `/radar`, `/kader-check`, … | Middleware: Session Pflicht |
| Shell | Anzeigename aus `UserProfile` (Fallback: Directus `first_name` / E-Mail), Logout-Link |

Login-UI bleibt schlicht (Produkt-Tool, keine Marketing-Landing). Bestehende Shell-Optik beibehalten.

## Auswirkungen auf bestehende Specs

| Spec / Doku | Änderung |
|---|---|
| `CLAUDE.md` | Nicht-Ziel „Kein Multi-User/Auth“ entfernen; V1.25 + `UserProfile` / `user_id` ergänzen |
| `SECURITY.md` | Modell: Sessions statt „nur Static Token für die App“; weiterhin keine Tokens im Browser |
| `spec-dashboard.md` | Budget/Kaderwert scoped auf Session-User |
| `spec-kader-check.md` | `SquadMembership` Filter = aktueller User |
| `spec-transfermarkt.md` | Radar bleibt geteilt; Filter „Nur mein Kader“ = Session-User |
| Kader-Picker (folgt) | Schreibt immer `user_id` aus Session |
| Scraper / Datenpipeline | Unverändert (keine User-Dimension) |

## Implementierungsphasen (Vorschlag für Folge-Plan)

1. **Schema + Roles** in Directus (inkl. Snapshot, Migration Admin-Kader).
2. **Auth-Modul in `web/`** — login/logout, Cookies, Middleware, Directus auth client.
3. **Datenaufrufe umstellen** — Fixture/Player mit User-Token; Squad/Profile gefiltert.
4. **Shell** — User-Anzeige + Logout; Login-Seite.
5. **Doku** — Invite-Runbook (wie Freunde anlegen), SECURITY/README.

## Risiken

| Risiko | Mitigation |
|---|---|
| Refresh-Token-Diebstahl (Cookie) | httpOnly + Secure + kurze Access-TTL; HTTPS auf Vercel |
| Mitglied sieht fremden Kader durch fehlenden Filter | Directus-Permission-Filter **und** App filtert explizit; Tests |
| Static Token bleibt in Prod-Env und umgeht Auth | Token aus Web-Prod-Env entfernen; nur Scraper/Admin |
| Freunde teilen Passwörter | Kurzes Invite-Runbook; später Magic Link |
| Directus Cloud vs. self-host Limits | Roles/Users im Community-Tier prüfen vor Prod-Invite |

## Fertig wenn (Acceptance)

- Unauthenticated Request auf `/` landet auf `/login`.
- Zwei Test-User haben getrennte `SquadMembership`; keiner sieht den Kader des anderen über die App.
- Beide sehen dieselben `Fixture`-Daten.
- Scraper schreibt weiter ohne Web-Session.
- SECURITY.md und CLAUDE.md beschreiben das neue Modell.
