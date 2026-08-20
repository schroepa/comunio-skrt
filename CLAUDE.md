# Comunio Assistant – Projekt-Kontext

## Ziel
Persönliches Tool zur Unterstützung bei Comunio-Entscheidungen (Transfermarkt, Aufstellung, Punkteprognose). Comunio bietet keine offizielle API – die Datenbasis kommt aus öffentlich zugänglichen Quellen (Marktwerte, Spielernoten, Spielpläne) sowie aus der manuellen Pflege des eigenen Kaders, da Comunio den eigenen Kaderstand nicht herausgibt.

## Tech-Stack
- Frontend: Astro + React (Islands) + Tailwind + shadcn/ui, gehostet auf Vercel
- Backend/Datenschicht: Directus (Directus Cloud, kostenloser Community-Tier — kein eigener Server nötig; Alternative bei Bedarf: Railway/Render mit Directus-Template)
- Scraper: läuft als Vercel Cron Job (zeitgesteuerte Serverless Function), schreibt über die Directus-REST-API — kein eigenständiger Dauerbetrieb nötig
- Repo: GitHub, Deployment über Vercel-GitHub-Integration

## Datenmodell (Kern-Entitäten)
- **Player**: id, name, position, verein, aktueller_marktwert
- **ValueHistory**: player_id, datum, marktwert
- **RatingHistory**: player_id, spieltag, note, minuten_gespielt
- **Fixture**: spieltag, heim_verein, auswaerts_verein, datum
- **SquadMembership**: player_id, im_kader (bool), kaufpreis, hinzugefuegt_am — manuell gepflegt
- **AvailabilityStatus** *(neu)*: player_id, spieltag, status (fit / fraglich / verletzt / gesperrt), quelle, aktualisiert_am — spieltagsbezogen, da sich der Status wöchentlich ändert
- **CompetitorSquad** *(neu)*: competitor_name, player_id — manuell gepflegt, begrenzt auf 2–3 engste Liga-Rivalen

## Roadmap

**V1 — Fehler vermeiden, Basis-Empfehlungen**
1. Datenpipeline ← aktuelle Phase
2. Spieler-Radar / Transfermarkt-Analyse → `docs/spec-transfermarkt.md`
3. Kader-Check vor Spieltag-Deadline → `docs/spec-kader-check.md`
4. Dashboard (Klammer über 2+3: Budget, Deadline, Alerts) → `docs/spec-dashboard.md`

**V1.5 — Konkurrenz-Vergleich (leicht)**
- Nutzt vorhandenen Formscore, keine Abhängigkeit zur Punkteprognose → `docs/spec-konkurrenzvergleich.md`

**V2 — Prognose & Optimierung**
- Aufstellung-Planer/Optimierer → `docs/spec-aufstellung.md` *(noch offen)*
- Punkteprognose-Engine → `docs/spec-punkteprognose.md` *(noch offen, hängt von der tatsächlichen Datenlage nach Phase 1 ab)*
- Konkurrenz-Vergleich (voll) — echte Punkte-Differenz-Prognose → `docs/spec-konkurrenzvergleich.md`

## Nicht-Ziele für V1
- Keine Punkteprognose-Engine (V2)
- Kein Multi-User/Auth (persönliches Tool, ein Nutzer)
- Keine direkte Comunio-Integration (technisch nicht möglich)
- Keine automatische Aufstellungsoptimierung (V2)

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
  spec-aufstellung.md        ← folgt (V2)
  spec-punkteprognose.md     ← folgt (V2)
```