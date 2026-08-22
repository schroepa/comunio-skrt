# Comunio Assistant – Projekt-Kontext

## Ziel
Persönliches Tool für bis zu acht eingeladene Freunde (getrennte Comunio-Ligen). Unterstützung bei Transfermarkt, Aufstellung, Punkteprognose. Comunio bietet keine offizielle API – Katalog aus öffentlichen Quellen, Kader manuell pro User (`SquadMembership.user_id`).

## Tech-Stack
- Frontend: Astro + React (Islands) + Tailwind + shadcn/ui, gehostet auf Vercel
- Backend/Datenschicht: Supabase (Postgres + Auth, Region `eu-central-1`). Schema in `supabase/migrations/`
- Scraper: CLI, schreibt über PostgREST mit Service Role. Nicht für Freunde.
- Auth: Supabase Email+Passwort, Sign-ups aus, httpOnly-Session in der Astro-App
- Repo: GitHub, Deployment über Vercel-GitHub-Integration

## Datenmodell (Kern-Entitäten)
- **Player**: id, name, position, verein, aktueller_marktwert
- **ValueHistory**: player_id, datum, marktwert
- **RatingHistory**: player_id, spieltag, note, minuten_gespielt
- **Fixture**: spieltag, heim_verein, auswaerts_verein, datum
- **squad_membership**: player_id, user_id, im_kader (bool), kaufpreis, hinzugefuegt_am — manuell, isoliert per RLS (`user_id = auth.uid()`)
- **ManagerProfile**: user_id, budget
- **AvailabilityStatus**: player_id, spieltag, status (fit / fraglich / verletzt / gesperrt), quelle, aktualisiert_am
- **CompetitorSquad**: user_id, competitor_name, player_id — 2–3 Rivalen der eigenen Liga, nicht die App-Freunde

## Roadmap

**V1 — Fehler vermeiden, Basis-Empfehlungen**
1. Datenpipeline ← aktuelle Phase
2. Spieler-Radar / Transfermarkt-Analyse → `docs/spec-transfermarkt.md`
3. Kader-Check vor Spieltag-Deadline → `docs/spec-kader-check.md`
4. Dashboard (Klammer über 2+3: Budget, Deadline, Alerts) → `docs/spec-dashboard.md`

**V1.5 — Konkurrenz-Vergleich (leicht)**
- Nutzt vorhandenen Formscore, keine Abhängigkeit zur Punkteprognose → `docs/spec-konkurrenzvergleich.md`

**V2 — Prognose & Optimierung**
- Aufstellung-Planer/Optimierer → `docs/spec-aufstellung.md`
- Punkteprognose-Engine → `docs/spec-punkteprognose.md`
- Konkurrenz-Vergleich (voll) — echte Punkte-Differenz-Prognose → `docs/spec-konkurrenzvergleich.md`

**Later — Mobile**
- Eigene Handy-Layouts (Radar/Kader/Aufstellung), nicht nur schmales Desktop — `docs/superpowers/specs/2026-08-22-mobile-ansicht-design.md`

## Nicht-Ziele
- Keine öffentliche Registrierung, kein gemeinsames Passwort
- Keine direkte Comunio-Integration (technisch nicht möglich)
- Kader der Freunde untereinander nicht sichtbar

## Datenbeschaffung (Entscheidung getroffen)
Recherche-Ergebnis: Spielpläne laufen über OpenLigaDB (offene REST/JSON-API, ODbL-Lizenz, kein Scraping nötig — sauberster Fall). Marktwerte (transfermarkt.de) und Spielernoten (kicker.de) sind nur per Scraping verfügbar; beide Seiten bieten keine API, Transfermarkts ToS untersagt Scraping explizit (§11.1), robots.txt ist technisch offen. Rechtlich bei privater, niedrigfrequenter Nutzung nach aktueller Einschätzung eher geringes praktisches Risiko (IP-Sperre, keine Klage), aber ein bewusster ToS-Verstoß, kein Graubereich — Claude ist kein Anwalt, das ist keine Rechtsberatung.

**Entscheidung: vorsichtig scrapen.** Niedrigfrequent, gecacht, unauffälliger User-Agent, robustes Error-Handling für Markup-Änderungen. Bei IP-Sperre: auf manuellen CSV-Import umschalten, nicht versuchen, die Sperre zu umgehen. Diese Grundsatzentscheidung ist getroffen und muss nicht erneut aufgerollt werden.

## Dateistruktur
```
CLAUDE.md                    ← dieser Root-Kontext
docs/
  spec-transfermarkt.md      ← fertig
  spec-kader-check.md        ← fertig
  spec-dashboard.md          ← fertig
  spec-konkurrenzvergleich.md ← fertig (leicht: V1.5, voll: V2)
  spec-aufstellung.md        ← V2
  spec-punkteprognose.md     ← V2
supabase/                    ← SQL + RLS, README zum Anlegen des Projekts
```