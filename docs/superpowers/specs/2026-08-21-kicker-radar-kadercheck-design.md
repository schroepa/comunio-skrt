# Design: P2 Kicker-Noten, Radar und Kader-Check (User-Kader)

**Datum:** 2026-08-21  
**Status:** bereit für Implementierung  
**Baut auf:** `docs/spec-datenpipeline.md` Phase 4, `docs/spec-transfermarkt.md`, `docs/spec-kader-check.md`, P0+P1-Auth

## Ziel

Nach dem Spieltag liegen Kicker-Noten in `RatingHistory`. Radar und Kader-Check rechnen auf dem **eingeloggten** Kader plus Katalog. Kein Live-Kicker in Tests.

## Kicker-Sync

- CLI: `npm run sync:kicker` im Ordner `scraper/`.
- Quelle: öffentlich sichtbare Bundesliga-Notenseiten (kein API). Gleicher private UA wie Transfermarkt: `comunio-helper/0.1 (private)`.
- Bei HTTP 403: Lauf abbrechen, `ScrapeLog` `failed` `quelle=kicker`, Sperre nicht umgehen.
- Parser gegen eingefrorene HTML-Fixtures. Unbekannte Spielernamen (kein `Player.name`-Match nach Normalisierung) werden übersprungen, nicht als neue Player angelegt.
- Upsert `RatingHistory` über `player_id` + `spieltag`. Felder verbatim: `note` (float, Kicker-Skala 1–6), `minuten_gespielt` (int, 0–120, nullable wenn die Seite keine Minuten hat).
- Plausibilität: nach einem Spieltag 0 Noten → failed, nicht `written=0` als success. Erfolgreicher Lauf: `ScrapeLog` success mit Anzahl.
- Spieltag: Query `?spieltag=` oder Default = letzter in `Fixture` mit `datum < now` (abgeschlossener Spieltag), sonst 1.
- Matching: `normalizeName` lowercased, Umlaute ae/oe/ue/ss, nur Buchstaben. Exakter Match auf normalisierten `Player.name`; bei Kollision skip.

Vereinsnamen-Mapping Transfermarkt ↔ OpenLigaDB bleibt **aus** (Phase-3-Entscheidung). Fixture-Modifier und „nächste 3 Gegner“ nur wenn `Player.verein` nach Trim gleich `heim_verein` oder `auswaerts_verein` ist, sonst „—“ / Modifier 0.

## Gemeinsame Verfügbarkeits-Prüfung

`web/src/lib/availability.ts` (rein, testbar):

```ts
export type AvailabilityKind = "fit" | "fraglich" | "verletzt" | "gesperrt";
export function availabilityGate(status: AvailabilityKind | null): "block" | "warn" | "ok";
```

- `verletzt` | `gesperrt` → `block`
- `fraglich` → `warn`
- sonst `ok` (fehlender Status zählt als fit)

`robustMinutes(lastThree: number[], possible = 90): boolean` — true = Risiko, wenn Summe Minuten / (3 * possible) < 0.5. Leere Liste: kein Risiko (kein Dummy).

## Formscore und Radar-Zeile

Gewichte letzte 5 Noten, neueste zuerst: 35/25/20/12/8. Fehlende Noten: nur vorhandene anteilig neu gewichten (Summe der verwendeten Gewichte = 1). 0 Noten: Formscore `null`, Badge nicht „Kaufen“.

Notiz → 0–100: `(6 - note) / 5 * 100`, clamp 0–100.

Preis-Score: innerhalb derselben `position` Perzentil des `aktueller_marktwert` (0 = billigster, 100 = teuerster). Eine Person in der Position: 50.

Divergenz = Formscore − Preis-Score.

Badge laut `spec-transfermarkt.md`:

- Gate block → „Nicht verfügbar“ (rot)
- Im Kader, Divergenz ≥ 15 und Fixture-Modifier ≥ 0 → Halten
- Im Kader, Divergenz ≤ −15 → Verkaufen
- Im Kader, sonst → Beobachten oder Halten (Divergenz > 5 → Halten, sonst Beobachten)
- Nicht im Kader, Divergenz ≥ 15 und Modifier ≥ 0 → Kaufen
- Nicht im Kader, Divergenz > 5 → Beobachten
- Nicht im Kader, Divergenz ≤ 5 → ausgeblendet (nicht in der Default-Liste)

Fixture-Modifier: −1 schwere, 0 neutral, +1 günstig; Default 0 ohne Namens-Match. „Günstig“ wenn Gegner in der unteren Tabellenhälfte nicht ableitbar ist — **in diesem Schnitt immer 0**, Spalte „nächste 3 Gegner“ zeigt Teamnamen wenn Match sonst „—“.

Begründung: festes Template `„Form {steigend|stabil|fallend}, {Gegner-Text}, Preis {hinkt|passt|voraus} → {Badge}“` ohne NLG.

Radar-UI: Tabelle füllen, Filter-Chips funktionieren (Position, „Nur mein Kader“). Preis-Chip bleibt disabled (kein Range in diesem Schnitt). Suche: Query `?q=` zeigt auch ausgeblendete Nicht-Kader-Spieler.

## Kader-Check

Für `im_kader` des Users, nächster Spieltag:

1. block → Badge „Startet nicht“
2. warn → „Unsicher, prüfen“
3. `robustMinutes` → „Wenig Spielzeit zuletzt“
4. sonst keine Zeile

Dashboard-Block dieselben Zeilen, max 5, Link zum vollen `/kader-check`.

## Nicht-Ziele P2

- CSV-Fallback, Vercel-Cron
- Vereins-Namensmapping
- Dummy-Noten
