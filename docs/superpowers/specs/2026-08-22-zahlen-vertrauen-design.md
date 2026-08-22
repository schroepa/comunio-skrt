# Design: Zahlen-Vertrauen (Fixture-Modifier, Club-Map, Marktwert-Verlauf)

**Datum:** 2026-08-22  
**Status:** Abgestimmt, bereit für Implementation Plan  
**Baut auf:** `docs/spec-transfermarkt.md`, `docs/spec-dashboard.md`, `docs/spec-punkteprognose.md`, P2-Design (Modifier dort bewusst 0)  
**Datenschicht:** Supabase (PostgREST). Nicht Directus — der Dateiname `web/src/lib/directus.ts` ist eine Altlast und bleibt in diesem Schnitt.

## Job

Wenn ich Radar, Aufstellung oder Übersicht öffne, sollen Gegner, Heim/Auswärts, Begründung und erwartete Punkte zu denselben Daten passen — und Marktwert-Bewegung sichtbar sein — statt Placebo-Copy („Gegner ohne Mapping“) und ungenutztem `value_history`.

## Entscheidungen (fest)

| Thema | Wahl |
|---|---|
| Gegner-Stärke | Summe `aktueller_marktwert` je kanonischem Verein, dann Perzentil |
| Modifier-Wirkung | Radar-Badge **und** `expectedPoints` / Aufstellung |
| Kaufpreis | nicht in diesem Schnitt |
| Club-Map | Alias-Liste zur Laufzeit, keine Migration, kein Scraper-Change |
| Verlauf | vorheriger `value_history`-Punkt (nicht der heutige Duplikat-Wert) |
| Branch | `feat/zahlen-vertrauen` von `main`, nicht `feat/mobile-ansicht` |
| Datei `directus.ts` | nicht umbenennen |

Nicht in diesem Schnitt: Mobile, Cron, CSV, Push, neue Datenquellen, Wappen/Fotos, Kaufpreis-UI.

## Architektur

Alles read-time in der Astro-App, reine Funktionen, Vitest ohne Live-Supabase.

```
Player.verein ──┐
Fixture-Namen ──┼─► canonicalClub / sameClub ─► Gegner, Venue, Clubwerte
value_history ──┘                                         │
                                                          ▼
                              priceScore 60/40    fixtureModifier −1|0|+1
                                                          │
                    radarBadge + radarReason              └── expectedPoints ×1.10/1.00/0.90
                    pickTopSignals / marketMovers ─► Übersicht
```

### Dateien

| Datei | Rolle |
|---|---|
| `web/src/lib/clubs.ts` | Aliase, `canonicalClub`, `sameClub`, `clubValues` |
| `web/src/lib/scores.ts` | `priceScore` mit Verlauf, `fixtureModifier`, `radarBadge` mit Modifier, ehrliches `radarReason` |
| `web/src/lib/points.ts` | Modifier-Faktor nach Venue |
| `web/src/lib/catalog.ts` | `sameClub` für Gegner/Venue; Verlauf in `radarRows`; Picker für Dashboard |
| `web/src/lib/directus.ts` | `listValueHistory` gegen `GET /rest/v1/value_history` |
| `web/src/pages/index.astro` | Signale 2+1; neuer Marktwert-Block |
| `web/src/pages/aufstellung.astro` | unverändert außer dass `playerPoints` den Modifier mitgibt |
| Tests unter `web/tests/lib/` | clubs, scores, points, catalog, directus |

Kein Scraper, keine SQL-Migration, kein Shell/Nav.

## Vereine

```ts
canonicalClub(name: string): string
sameClub(a: string, b: string): boolean
clubValues(players: Array<{ verein: string; aktueller_marktwert: number }>): Map<string, number>
```

- `canonicalClub`: trim, Lookup in einer Map, die aus **Gruppen** gebaut wird (jeder Gruppen-Eintrag, Schlüssel kleingeschrieben, zeigt auf denselben kanonischen Namen = erstes Element der Gruppe). Kein Treffer: getrimmter Name.
- `sameClub`: `canonicalClub(a) === canonicalClub(b)`. Identische Schreibweise matcht auch ohne Gruppe.
- `clubValues`: Summe `aktueller_marktwert` je `canonicalClub(player.verein)`.

Pflicht-Gruppen (Reihenfolge in der Gruppe egal fürs Matching; kanonisch = Index 0). Test `sameClub` für jedes Paar innerhalb einer Gruppe:

```ts
[
  ["FC Bayern München", "Bayern München"],
  ["TSG Hoffenheim", "1899 Hoffenheim", "TSG 1899 Hoffenheim"],
  ["Bayer 04 Leverkusen", "Bayer Leverkusen"],
  ["RB Leipzig", "RasenBallsport Leipzig"],
  ["Borussia Mönchengladbach", "Borussia M'gladbach"],
  ["1. FC Union Berlin", "1.FC Union Berlin", "Union Berlin"],
  ["1. FSV Mainz 05", "1.FSV Mainz 05", "Mainz 05"],
  ["1. FC Heidenheim", "1. FC Heidenheim 1846"],
  ["1. FC Köln", "1.FC Köln"],
  ["SC Freiburg", "Sport-Club Freiburg"],
  ["VfL Bochum", "VfL Bochum 1848"],
]
```

Weitere Gruppen nur, wenn ein realer `fixture.*_verein` neben einem `Player.verein` nicht matcht. Unbekannter Name bleibt unverändert; kein Match → Gegner „—“, Modifier 0, Venue `unknown`.

## Fixture-Modifier

Nächste 3 Partien des Spielers (wie heute `nextOpponents`, aber `sameClub` statt `===`), chronologisch wie in `listFixtures` (datum aufsteigend). Weniger als 3: Mittelwert der vorhandenen.

Club-Perzentil: unter den Vereinen in `clubValues` (mindestens 2, sonst Modifier 0). Wert `v`, sortierte Stärken `s`, Index des ersten `>= v`, dann `(index / (n - 1)) * 100`. Gegner ohne Eintrag in `clubValues` zählen nicht zum Mittel.

```ts
fixtureModifier(opponentPercentiles: number[]): -1 | 0 | 1
```

| Mittel der Perzentile | Modifier | Gegner-Text |
|---|---|---|
| leere Liste | 0 | Gegner unbekannt |
| &lt; 100/3 | +1 | günstige Gegner |
| &gt; 200/3 | −1 | schwere Gegner |
| sonst | 0 | gemischte Gegner |

`100/3` und `200/3` exakt (nicht 33/66 gerundet).

## Radar

`radarBadge` bekommt `modifier: -1 | 0 | 1` (Default 0). Bestehende Schwellen bleiben. Zusätzlich: Badge `Kaufen` nur wenn `modifier >= 0`, sonst `Beobachten`. `Verkaufen` / `Halten` / Block unverändert durch den Modifier.

Divergenz = Formscore − Preis-Score (null-Form wie heute).

```ts
radarReason(options: {
  trend: "steigend" | "stabil" | "fallend";
  fixtureText: "günstige Gegner" | "gemischte Gegner" | "schwere Gegner" | "Gegner unbekannt";
  priceVsForm: "hinkt" | "passt" | "voraus";
  badge: RadarBadge;
}): string
```

Template genau: `Form {trend}, {fixtureText}, Preis {priceVsForm} → {badge}`  
Kein „Gegner ohne Mapping“.

`RadarRow` zusätzlich `divergence: number | null` (für Dashboard-Sortierung). `detail` auf `/radar` bleibt Reason plus Gegnernamen, wenn nicht „—“.

## Preis-Score

```ts
priceScore(value: number, peerValues: number[], previousValue?: number | null): number
```

- Peer wie heute: Positions-Perzentil, eine Person → 50.
- Verlauf: `previousValue` = Marktwert am **zweitneuesten** `value_history.datum` dieses Spielers. Neueste History-Zeile ist der heutige Stand, nicht der Trend-Anker.
- `previousValue` null, ≤ 0, oder nur ein History-Punkt: Rückgabe = reiner Peer (kein 50er-Dummy-Trend).
- Sonst `trendScore = clamp(0, 100, 50 + ((value - previousValue) / previousValue) * 250)`  (−20 % → 0, 0 % → 50, +20 % → 100).
- Mix: `0.6 * peer + 0.4 * trendScore`.

`value` in der App ist immer `player.aktueller_marktwert`.

## Punkte

`expectedPoints` nach Venue-Faktor:

- Modifier +1 → × 1.10
- 0 → × 1.00
- −1 → × 0.90

Danach Clamp 0–12, eine Nachkommastelle. Block bleibt 0 vor allen Faktoren. `playerPoints` in `catalog.ts` berechnet denselben Modifier wie das Radar.

## Übersicht (`/index`)

Keine eigene Logik außer Aufruf reiner Funktionen. Input für Signale: `radarRows(...)` **ohne** `includeHidden` (wie die Übersicht heute).

```ts
pickTopSignals(rows: RadarRow[]): RadarRow[]
```

- `Kaufen`, Divergenz absteigend, max 2 (null-Divergenz ans Ende).
- `Verkaufen`, Divergenz aufsteigend (negativ zuerst), max 1.
- Reihenfolge in der Liste: erst Kaufen, dann Verkaufen. Weniger Treffer: so viele wie existieren.

```ts
type MarketMover = { player: PlayerRecord; delta: number };
marketMovers(players: PlayerRecord[], history: ValueHistoryRecord[]): { gainers: MarketMover[]; losers: MarketMover[] }
```

- `delta = aktueller_marktwert − previousValue` (zweitneuestes History-Datum).
- Spieler mit weniger als zwei History-Daten weglassen.
- `gainers`: `delta > 0`, nach `delta` absteigend, 3.
- `losers`: `delta < 0`, nach `delta` aufsteigend (stärkster Verlust zuerst), 3.
- Gleichstand: `name` mit `de`.

UI: bestehender Transfer-Block (Name, Badge, Begründung, Link Radar). Neuer Block **Marktwert** darunter: drei Gewinner / drei Verlierer als `+1.234.567 €` / `−… €` (`de-DE`). Leer: „Noch kein Marktwert-Verlauf.“ Kein Shell-Change.

## Supabase-Lesen

```ts
export type ValueHistoryRecord = { player_id: number; datum: string; marktwert: number };

listValueHistory(options: CatalogAuth): Promise<ValueHistoryRecord[]>
```

`GET /rest/v1/value_history?select=player_id,datum,marktwert&order=datum.desc&limit=20000`  
gleiche Header wie `listRatings`. Fehlschlag oder leeres Array → `[]` (kein Throw). Dann: Preis nur Peer, Marktwert-Block leer, Rest der Seite normal.

Fehlercode `directus_unreachable` in `listFixtures` bleibt (nicht umbenennen).

## Fehler

| Fall | Verhalten |
|---|---|
| `value_history` leer / Request fehl | Peer-only, leerer Marktwert-Block |
| `previousValue` 0 oder fehlend | Peer-only für diesen Spieler |
| Verein nicht alias-matchbar | „Gegner unbekannt“, Modifier 0, Venue unknown |
| &lt; 2 Clubs in `clubValues` | Modifier 0 |
| &lt; 3 Gegner mit Perzentil | Mittelwert der vorhandenen |

## Tests

Kein Live-Supabase. Mindestens:

- `sameClub` für jedes Pflicht-Paar oben plus identische Namen.
- Modifier: leere Liste → 0; Mittel 20 → +1; 50 → 0; 80 → −1.
- `Kaufen` bei Modifier −1 → `Beobachten`; bei 0 und Divergenz ≥ 15 → `Kaufen`.
- `priceScore` Mix 60/40; ohne Verlauf = Peer.
- `expectedPoints` ×1.10 und ×0.90 nach Venue.
- `radarReason` enthält nicht „ohne Mapping“.
- `pickTopSignals` 2+1 Reihenfolge.
- `marketMovers` Sortierung und Ausschluss bei einem History-Punkt.
- `listValueHistory` ruft `/rest/v1/value_history` mit Bearer + apikey; bei HTTP-Fehler `[]`.

## Messung

- Ein Spieler mit gleichem Verein wie `fixture.heim_verein` (nach Alias) zeigt echte Gegnernamen, nicht „—“.
- Begründung nie „Gegner ohne Mapping“.
- Nach zwei Scraper-Läufen mit verschiedenen `value_history.datum`: Übersicht zeigt mindestens einen Gewinner oder Verlierer, sofern sich ein Marktwert geändert hat.

## Danach (nicht dieser Spec)

1. Betrieb: Cron, Frische, CSV-CLI  
2. Kaufpreis-UI  
3. Wochen-Inbox  
4. V2 Rivalen-Punkte-Delta  
