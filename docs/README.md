# Dokumentation

Produkt-Specs liegen hier im Repo, nicht im Wiki. Implementierungspläne und Design-Entscheidungen unter `superpowers/`.

## Produkt (V1)

| Spec | Thema | Status |
|---|---|---|
| [spec-datenpipeline.md](spec-datenpipeline.md) | Quellen, Directus, Scraper-Phasen, CSV-Fallback | Phase 1–3 gebaut (Schema, OpenLigaDB, Transfermarkt). Kicker, Cron, CSV folgen |
| [spec-transfermarkt.md](spec-transfermarkt.md) | Spieler-Radar: Form vs. Marktwert, Filter, Badges | Spec fertig, UI noch Stub |
| [spec-kader-check.md](spec-kader-check.md) | Warnungen vor der Deadline (verletzt/gesperrt/Rotation) | Spec fertig, UI noch Stub |
| [spec-dashboard.md](spec-dashboard.md) | Budget, Deadline, Alerts, Top-Signale | Shell + Spielplan/Deadline; Rest Leerzustände |
| [spec-auth.md](spec-auth.md) | Invite-only Login für die Comunio-Gruppe | Spec + Design fertig, Implementierung offen |

Geplant, Datei noch nicht im Repo: `spec-konkurrenzvergleich.md` (V1.5/V2), `spec-aufstellung.md` (V2), `spec-punkteprognose.md` (V2).

## Betrieb

| Paket | README |
|---|---|
| Directus lokal | [../directus/README.md](../directus/README.md) |
| Scraper CLI | [../scraper/README.md](../scraper/README.md) |
| Web (Astro) | [../web/README.md](../web/README.md) |

## Design- und Baupläne

Ausführliche SDD-Artefakte (nicht die Produkt-Specs):

- [Gruppen-Login, Design](superpowers/specs/2026-08-21-auth-gruppen-login-design.md)
- [Frontend-Dashboard-Shell, Design](superpowers/specs/2026-08-21-frontend-dashboard-shell-design.md)
- [Frontend-Dashboard-Shell, Plan](superpowers/plans/2026-08-21-frontend-dashboard-shell.md)
- [Datenpipeline Phase 1](superpowers/plans/2026-08-20-datenpipeline-phase1-fundament.md)
- [Datenpipeline Phase 2 (OpenLigaDB)](superpowers/plans/2026-08-21-datenpipeline-phase2-openligadb.md)
- [Datenpipeline Phase 3, Design](superpowers/specs/2026-08-21-datenpipeline-phase3-transfermarkt-design.md)
- [Datenpipeline Phase 3, Plan](superpowers/plans/2026-08-21-datenpipeline-phase3-transfermarkt.md)

## Assets

- [github-social-preview.jpg](assets/github-social-preview.jpg) — 1280×640, unter 1 MB. GitHub → Settings → General → Social preview. Dafür gibt es keine API.
