# Dokumentation

Produkt-Specs liegen hier im Repo, nicht im Wiki. Implementierungspläne und Design-Entscheidungen unter `superpowers/`.

## Produkt

| Spec | Thema | Status |
|---|---|---|
| [spec-datenpipeline.md](spec-datenpipeline.md) | Quellen, Schema, Scraper-Phasen, CSV-Fallback | Phase 1–4 gebaut. Datenschicht: Supabase |
| [spec-transfermarkt.md](spec-transfermarkt.md) | Spieler-Radar: Form vs. Marktwert | Radar-UI + Formscore |
| [spec-kader-check.md](spec-kader-check.md) | Warnungen vor der Deadline | auf User-Kader |
| [spec-dashboard.md](spec-dashboard.md) | Budget, Deadline, Alerts, Top-Signale | mit Login und Kaderwert |
| [spec-konkurrenzvergleich.md](spec-konkurrenzvergleich.md) | Rivalen der eigenen Liga (leicht) | `/konkurrenz` |
| [spec-aufstellung.md](spec-aufstellung.md) | Elf aus dem Kader | `/aufstellung` |
| [spec-punkteprognose.md](spec-punkteprognose.md) | erwartete Punkte | Engine + Aufstellung |

Auth/Hosting: [Directus → Supabase](superpowers/specs/2026-08-21-directus-zu-supabase-design.md). Historisch: [Freundes-Runde P0+P1](superpowers/specs/2026-08-21-freundesrunde-auth-kader-design.md).

## Betrieb

| Paket | README |
|---|---|
| Supabase | [../supabase/README.md](../supabase/README.md) |
| Scraper CLI | [../scraper/README.md](../scraper/README.md) |
| Web (Astro) | [../web/README.md](../web/README.md) |

## Design- und Baupläne

- [Freundes-Runde P0+P1, Design](superpowers/specs/2026-08-21-freundesrunde-auth-kader-design.md)
- [Freundes-Runde P0+P1, Plan](superpowers/plans/2026-08-21-freundesrunde-auth-kader.md)
- [Kicker/Radar/Kader-Check, Design](superpowers/specs/2026-08-21-kicker-radar-kadercheck-design.md)
- [Frontend-Dashboard-Shell, Design](superpowers/specs/2026-08-21-frontend-dashboard-shell-design.md)
- [Frontend-Dashboard-Shell, Plan](superpowers/plans/2026-08-21-frontend-dashboard-shell.md)
- [Datenpipeline Phase 1](superpowers/plans/2026-08-20-datenpipeline-phase1-fundament.md)
- [Datenpipeline Phase 2 (OpenLigaDB)](superpowers/plans/2026-08-21-datenpipeline-phase2-openligadb.md)
- [Datenpipeline Phase 3, Design](superpowers/specs/2026-08-21-datenpipeline-phase3-transfermarkt-design.md)
- [Datenpipeline Phase 3, Plan](superpowers/plans/2026-08-21-datenpipeline-phase3-transfermarkt.md)

## Assets

- [github-social-preview.jpg](assets/github-social-preview.jpg) — 1280×640, unter 1 MB. GitHub → Settings → General → Social preview. Dafür gibt es keine API.
