# Design: Frontend Dashboard-Shell (erster UI-Schnitt)

**Datum:** 2026-08-21  
**Status:** bereit für Implementierungsplan  
**Baut auf:** `docs/spec-dashboard.md`, `docs/spec-transfermarkt.md`, `docs/spec-kader-check.md`, `CLAUDE.md`  
**Datenlage:** Directus hat befülltes `Fixture` (OpenLigaDB, eine Saison). `Player`, `SquadMembership`, `ValueHistory`, `RatingHistory`, `AvailabilityStatus` sind leer bzw. ungenutzt.

## Ziel

Ein lokal im Browser sichtbares Comunio-Tool: Astro-App unter `web/`, drei Routen, echte nächste Spiele und Deadline aus Directus, ehrliche Leerzustände für alles, was noch keine Daten hat. `liquid-gooey` nur in der Navigation (und deaktivierten Radar-Filter-Chips). Kein Scraping, kein Auth, kein Deploy in diesem Schnitt.

## Entscheidungen (fest)

| Thema | Wahl |
|---|---|
| Erste Ansicht | Dashboard-Shell + Spielplan + Leerzustände |
| Navigation | Dashboard, Radar-Stub, Kader-Check-Stub |
| Directus | Nur Astro-Server, Token aus `.env`, nichts im Browser |
| Architektur | Astro-Seiten + wenige React-Inseln (nicht eine SPA) |
| Gooey | Nav-Morph; Filter-Chips vorbereitet aber disabled; nicht auf Tabellen/Metric-Karten |
| Saison | Eine Saison in `Fixture`, kein neues Schema-Feld |

## Routen

| Route | Inhalt |
|---|---|
| `/` | Shell + Status-Leiste + nächste Spiele + leere Alerts + leere Top-Signale |
| `/radar` | Shell + disabled Filter-Chips + leere Radar-Tabelle (Spalten laut `spec-transfermarkt.md`) |
| `/kader-check` | Shell + leere Alert-Liste (Zeilenmuster laut `spec-kader-check.md`) |

Gemeinsame Shell: Seitentitel, Nav-Insel, Footer-Hinweis „Daten: OpenLigaDB (ODbL)“. Kein Login, keine Modals, keine Klick-Panels.

## Layout

**Nav (React-Insel, `client:only="react"`):** drei Ziele — Dashboard, Radar, Kader-Check. `client:only`, weil `liquid-gooey` DOM/SVG-Filter braucht; ein kurzer Nav-Fallback in `Shell.astro` (drei Textlinks ohne Gooey) verhindert eine leere Header-Zeile vor der Hydration. Aktiver Eintrag über `liquid-gooey` Morph (`Liquid` + `Liquid.Item`, `transition="bouncy"`). Kinder mit transparentem Hintergrund; `fill` = `var(--surface)` bzw. Token der shadcn-Card-Fläche. `prefers-reduced-motion` nutzt die Library-Defaults (sofortiges Snappen).

**Dashboard `/`:**

1. Status-Leiste, drei Karten: Budget übrig, Kaderwert, nächste Deadline.
   - Budget und Kaderwert: Leerzustand „Noch keine Kadereingabe“ (kein Dummy-Eurobetrag).
   - Deadline: Countdown (React-Insel) aus abgeleitetem Deadline-Zeitpunkt, oder Leer-/Fehlerzustand (siehe Fehler).
2. Block „Nächste Spiele“: die Partien des relevanten Spieltags (typisch 9), `heim_verein` – `auswaerts_verein`, `datum` lokal formatiert (de-DE).
3. Block „Kader-Check“: leere Liste, Copy: „Sobald Spieler im Kader und Verfügbarkeit gepflegt sind, erscheinen Warnungen hier.“
4. Block „Top-Signale“: leere Liste, Copy: „Kauf-/Verkaufssignale brauchen Noten und Marktwerte.“ Link-Text zum Radar, Ziel `/radar`.

**Radar `/radar`:** Überschrift „Spieler-Radar“. Filter-Chips Position / Preis / „Nur mein Kader“ als Gooey-Gruppe, `disabled`, keine Filterlogik. Tabelle mit Spalten: Spieler, Marktwert, Form, nächste 3 Gegner, Empfehlung. Eine Leerzeile/Empty-Row: „Noch keine Spielerdaten.“

**Kader-Check `/kader-check`:** Überschrift laut Spec. Leere Alert-Liste, gleiche Badge-Farblogik in der Doku der Empty-Copy (rot/amber), aber keine Dummy-Warnungen.

## Datenfluss

```
Browser  →  Astro (SSR)  →  Directus REST (Bearer static token)
                ↓
         nur Collection Fixture
                ↓
         deriveDeadline(fixtures) + nextMatchdayFixtures(fixtures)
```

Env in `web/.env` (gitignored), Vorlage `web/.env.example`:

- `DIRECTUS_URL` — lokal `http://localhost:8055`
- `DIRECTUS_TOKEN` — Directus static token (nicht `ADMIN_PASSWORD`)

Server-Modul `web/src/lib/directus.ts`: `listFixtures()` → `GET /items/Fixture?limit=-1&sort=datum`. Feldnamen verbatim: `spieltag`, `heim_verein`, `auswaerts_verein`, `datum`.

Ableitung `web/src/lib/fixtures.ts` (rein, testbar):

- `now` injizierbar für Tests.
- **Nächster Spieltag:** kleinste `spieltag`-Gruppe, in der mindestens ein `datum` ≥ `now` liegt. Gibt es keine zukünftigen Spiele: letzter Spieltag der Saison, UI zeigt „Saison vorbei“ statt Countdown.
- **Deadline:** frühestes `datum` in dieser Spieltag-Gruppe (Kickoff des ersten noch ausstehenden Spiels; wenn alle Spiele der Gruppe in der Zukunft liegen, das Minimum der Gruppe). Das ist ein V1-Proxy: die echte Comunio-Markt-Deadline (typisch Freitag) steht nicht in Directus und wird nicht erfunden.
- **Nächste Spiele:** alle Fixtures dieser `spieltag`-Gruppe, sortiert nach `datum`.

Nicht geladen in diesem Schnitt: `Player`, `SquadMembership`, `ValueHistory`, `RatingHistory`, `AvailabilityStatus`, `ScrapeLog`.

## Fehler und Leerzustände

| Lage | UI |
|---|---|
| Directus unreachable, Timeout, HTTP ≠ 2xx, 401 | App-Shell bleibt. Spielplan-Karte: „Directus nicht erreichbar. In `directus/` `docker compose up -d`.“ Deadline-Karte gleicher Hinweis. Nav und Stubs weiter nutzbar. Kein 500 der ganzen Seite. |
| Token fehlt in Env | Gleicher Fehlerzustand, Copy: „`DIRECTUS_TOKEN` in `web/.env` setzen.“ |
| `Fixture` leer (`data: []`) | Deadline + Spielplan: „Noch kein Spielplan. Im Ordner `scraper/` `npm run sync:openligadb`.“ |
| Fixture ok | Echte Vereinsnamen und Zeiten. |

Fehlerdetails (Statuscode) nur in Server-Logs, nicht als Stacktrace im Browser.

## Komponenten (Dateien)

```
web/
  .env.example
  astro.config.mjs
  package.json
  src/
    env.d.ts
    layouts/Shell.astro
    pages/index.astro
    pages/radar.astro
    pages/kader-check.astro
    lib/directus.ts
    lib/fixtures.ts
    components/Nav.tsx          # Liquid Gooey, client:load
    components/DeadlineCountdown.tsx  # client:load, nur wenn Deadline existiert
    components/EmptyState.astro
    components/MatchList.astro
  tests/
    fixtures/fixtures-sample.json   # eingefrorene Directus-ähnliche Fixture-Rows
    lib/fixtures.test.ts
```

shadcn/ui: Card, Badge (für Empty-Copy-Legende optional), Button nur wenn die Library ihn für Nav-Items braucht. Keine Data-Table-Library in diesem Schnitt — Radar-Tabelle als semantisches `<table>` mit Tailwind.

`liquid-gooey`: Peer React ≥18. Nav-Items ohne opake `bg-*` auf dem Item-Child; Farbe trägt der Liquid-`fill`.

## Lokal sehen

Voraussetzung: Directus auf `:8055` (`cd directus && docker compose up -d`).

```bash
cd web
cp .env.example .env   # Token aus Directus-Admin → Settings → Access Tokens
npm install
npm run dev            # http://localhost:4321
```

Kein Frontend ohne Directus-Token: die Seite startet, Spielplan-Karte zeigt den Env-/Connect-Fehler.

## Tests

- `deriveDeadline` / `nextMatchdayFixtures` gegen `tests/fixtures/fixtures-sample.json` (Vitest in `web/`).
- Fälle: Spieltag 1 in der Zukunft; mitten in der Saison; alle `datum` in der Vergangenheit; leeres Array.
- Kein Live-Directus in CI/Tests.
- Kein Screenshot-Test, kein Gooey-Visual-Regression in diesem Schnitt.

## Nicht-Ziele (dieser Schnitt)

- Transfermarkt- und Kicker-Scraper, CSV, Cron
- Punkteprognose, Auth, Multi-User
- Gooey auf Tabellen, Metric-Karten, Alert-Zeilen
- Directus-Schema ändern (`season`-Feld)
- Vercel-Deploy und Production-URL
- Budget-Zahl, Kaderwert-Summe, echte Radar-Scores, echte Kader-Warnungen

## Abhängigkeiten / Reihenfolge danach

1. Dieser Schnitt: `web/` sichtbar mit Spielplan.
2. Datenpipeline Phase 3 (Transfermarkt) und Kaderpflege → Radar- und Kader-Check-Blöcke ersetzen Leerzustände, ohne Nav/Routen umzubauen.
3. Vercel, sobald Directus nicht nur localhost ist.
