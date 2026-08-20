# Spec: Datenpipeline

Teil von V1. Root-Kontext siehe `../CLAUDE.md`.

## Ziel
Comunio bietet keine offizielle API. Alle nachgelagerten V1-Module (`spec-transfermarkt.md`, `spec-kader-check.md`) hängen vollständig von befüllten Kern-Entitäten ab (`Player`, `ValueHistory`, `RatingHistory`, `Fixture`, `AvailabilityStatus`, `SquadMembership`). Diese Spec beschreibt, wie diese Daten beschafft, validiert und in Directus abgelegt werden — als Fundament, auf dem die anderen Module aufsetzen.

## Datenquellen (Rechercheergebnis)

| Datentyp | Quelle | Zugang | Risiko/Hinweis |
|---|---|---|---|
| Spielplan/Ergebnisse (`Fixture`) | OpenLigaDB | Freie REST/JSON-API, kein Key nötig | Kein Scraping nötig. ODbL-Lizenz (Namensnennung). Kein Corporate-Betreiber, kein SLA — informell gepflegt. |
| Marktwerte (`ValueHistory`) | transfermarkt.de | Scraping (keine offizielle API) | ToS (§11.1) verbietet Bots ausdrücklich; robots.txt technisch offen. Bei privater, niedrigfrequenter Nutzung rechtlich geringes Risiko (BGH-Rechtsprechung zu Screen-Scraping), praktisches Risiko: IP-Sperre. Bewusst in Kauf genommenes, kalkuliertes Risiko (Nutzerentscheidung). |
| Verfügbarkeit (`AvailabilityStatus`) | transfermarkt.de (Bundesliga-weite Sperren/Ausfälle-Übersicht) | Scraping, gleiche Domain wie Marktwerte | Gleiches Risikoprofil wie oben. Ein Modul, zwei Scraper-Funktionen (siehe Architektur). |
| Spielernoten (`RatingHistory`) | kicker.de | Scraping (keine offizielle API) | Aktive Bot-Erkennung vorhanden (blockt bekannte Bot-User-Agents), Notenseiten selbst frei zugänglich, nicht paywallgeschützt. |
| Kaderstand (`SquadMembership`) | — | Rein manuell | Comunio gibt den eigenen Kaderstand nicht heraus (siehe CLAUDE.md). Kein Scraper, nur Directus-Collection. |

Alternativquellen (kicker.de → ran.de bei Notenausfall; transfermarkt.de → keine gleichwertige Alternative für Marktwerte gefunden, jede geprüfte Alternative repliziert letztlich Transfermarkt-Daten) sind als Fallback-Kandidaten vermerkt, aber nicht Teil dieser Spec.

## Architektur

**Directus (SQLite)** bleibt einzige Quelle der Wahrheit. Collections spiegeln 1:1 die Entitäten aus `CLAUDE.md`, plus eine neue Collection:

- `ScrapeLog`: `quelle`, `zeitstempel`, `status` (`success`/`failed`), `fehlermeldung` — nicht in CLAUDE.md vorgesehen, aber nötig, um einen unbeaufsichtigten Cron-Scraper überhaupt debugbar zu machen.

**Scraper-Paket**: eigenständiges Node-Projekt (wie in CLAUDE.md vorgesehen), ein Unterordner je Quelle:

```
scraper/
  openligadb/   → Fixture
  transfermarkt/ → ValueHistory + AvailabilityStatus (zwei Funktionen, eine Domain)
  kicker/       → RatingHistory
  shared/       → Directus-REST-Client, HTTP-Client mit Caching/Rate-Limiting, Logger
```

Jedes Quellen-Modul ist unabhängig ausführbar und einzeln per Cron planbar — ein Ausfall einer Quelle blockiert die anderen nicht.

## Bauplan (Phasen)

1. **Fundament**: Directus lokal aufsetzen (SQLite), alle sechs Collections anlegen (inkl. `ScrapeLog`), manuell mit Testeinträgen prüfen. Kein Scraper-Code.
2. **Erster End-to-End-Beweis**: `openligadb`-Modul — Spielplan/Ergebnisse abrufen und in `Fixture` schreiben. Beweist den kompletten Pfad Quelle → Directus inkl. `ScrapeLog`, ohne Scraping-Risiko.
3. **Marktwerte + Verfügbarkeit**: `transfermarkt`-Modul mit den zwei Scraper-Funktionen (Marktwerte, Sperren/Ausfälle), gemeinsame Caching-/Rate-Limit-Logik.
4. **Spielernoten**: `kicker`-Modul, eigenes Markup/eigene Domain.
5. **Fallback & Betrieb**: CSV-Import-Pfad je Quelle, Cron-Zeitpläne scharf schalten.

`SquadMembership` braucht nur die Directus-Collection aus Phase 1, keine eigene Bauphase — bleibt dauerhaft manuell gepflegt.

## Fehlerbehandlung & Caching

- Jedes Modul läuft isoliert; ein fehlgeschlagener Scraper (Netzwerkfehler, Timeout, 403) wird in `ScrapeLog` als `failed` inkl. Fehlermeldung erfasst, blockiert aber nicht die anderen Module im selben Cron-Lauf.
- **Plausibilitätsprüfung vor dem Schreiben**: grobe Sanity-Checks auf die Ergebnismenge (z. B. Anzahl gefundener Marktwerte nahe der erwarteten Kadergröße). Bei starker Abweichung wird der Lauf als `failed` geloggt statt bestehende gute Daten mit falschen/leeren Daten zu überschreiben. Zentraler Schutz gegen unbemerkte Markup-Änderungen.
- Rohantworten (HTML/JSON) werden lokal mit TTL zwischengespeichert — schont Rate-Limits und erlaubt Debugging ohne erneuten Live-Request.

## Scheduling

| Modul | Frequenz |
|---|---|
| `openligadb` | täglich |
| `transfermarkt` (Marktwerte) | 1×/Woche |
| `transfermarkt` (Sperren/Ausfälle) | täglich in den letzten 2 Tagen vor der Spieltag-Deadline, sonst 2×/Woche |
| `kicker` (Noten) | 1×, kurz nach Ende des jeweiligen Spieltags |

## CSV-Fallback

- Pro Quelle ein dokumentiertes CSV-Format, das die Felder der jeweiligen Directus-Collection abbildet (z. B. `player_id, datum, marktwert` für `ValueHistory`).
- Ein gemeinsames Import-Skript (nutzt denselben Directus-Client wie die Scraper) liest die CSV und schreibt sie ein — manuell angestoßen bei dauerhaftem Scraper-Ausfall.
- Kein eigenes UI in V1, reines CLI-Skript genügt für ein Einzelnutzer-Tool.

## Testing/Validierung

- Pro Quelle ein eingefrorenes HTML/JSON-Sample als Fixture; Parser-Logik wird dagegen getestet, nicht gegen die Live-Seite. Fängt Regressionen im eigenen Parsing-Code ab (Markup-Änderungen der Quelle selbst fängt die Plausibilitätsprüfung oben ab).
- Nach jedem Scraper-Lauf: manuelle Stichprobenkontrolle im Directus-Admin-UI, kein automatisiertes Test-Dashboard.

## Nicht-Ziele (V1)
- Keine automatischen Benachrichtigungen bei Verletzungen/Sperren (Aufgabe von `spec-kader-check.md`, dort ohnehin V2)
- Kein UI für den CSV-Import (CLI genügt)
- Kein historischer Backfill vor dem ersten Scraper-Lauf — Zeitreihen (`ValueHistory`, `RatingHistory`) beginnen mit Inbetriebnahme

## Abhängigkeiten
- Nachgelagert: `spec-transfermarkt.md` und `spec-kader-check.md` setzen auf den hier befüllten Entitäten auf.
- Teilt keine Logik mit anderen Specs (reine Datenbeschaffung).