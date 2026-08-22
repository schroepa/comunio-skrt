# Zahlen-Vertrauen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gegner, Begründung, Radar-Badges und erwartete Punkte nutzen dieselbe Club-Map und denselben Fixture-Modifier; die Übersicht zeigt Top-Signale 2+1 und Marktwert-Gewinner/-Verlierer aus `value_history`.

**Architecture:** Read-time in der Astro-App. Neue reine Module `clubs.ts` plus Erweiterungen an `scores.ts`, `points.ts`, `catalog.ts`. `listValueHistory` liest Supabase-PostgREST über die bestehende Datei `web/src/lib/directus.ts` (nicht umbenennen). Kein Scraper, keine Migration, kein Shell/Mobile.

**Tech Stack:** Astro 7, TypeScript, Vitest (Node), Tailwind auf bestehenden Seiten. Keine neuen Dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-zahlen-vertrauen-design.md`

## Global Constraints

- Copy und UI auf Deutsch. Kein „Gegner ohne Mapping“.
- Datenschicht ist Supabase (PostgREST), nicht Directus. Datei `web/src/lib/directus.ts` und Fehlercode `directus_unreachable` nicht umbenennen.
- Branch `feat/zahlen-vertrauen` von `main`. Nicht `feat/mobile-ansicht` anfassen (kein Shell, kein Nav, kein `global.css` für Chrome).
- Kaufpreis, Cron, CSV, neue Datenquellen: out of scope.
- Tests: `cd web && npm test` (astro check + vitest). Kein Live-Supabase. Vitest-Environment ist `node`.
- Commits klein, Message auf das Warum; keine Secrets.

## File Structure

```
web/src/lib/clubs.ts                 # NEU: Gruppen, canonicalClub, sameClub, clubValues, rankPercentile
web/tests/lib/clubs.test.ts          # NEU
web/src/lib/scores.ts                # priceScore + Verlauf, fixtureModifier, radarBadge.modifier, radarReason.fixtureText
web/tests/lib/scores.test.ts
web/src/lib/points.ts                # expectedPoints.fixtureModifier
web/tests/lib/points.test.ts
web/src/lib/catalog.ts               # sameClub, fixtureContext, history, pickTopSignals, marketMovers
web/tests/lib/catalog.test.ts        # NEU
web/src/lib/directus.ts              # ValueHistoryRecord + listValueHistory
web/tests/lib/directus.test.ts
web/src/pages/index.astro            # pickTopSignals + Marktwert-Block
web/src/pages/radar.astro            # history + marketPlayers
web/src/pages/aufstellung.astro      # clubValues in playerPoints
docs/README.md                       # Plan-Link
```

---

### Task 1: Club-Aliase

**Files:**
- Create: `web/src/lib/clubs.ts`
- Create: `web/tests/lib/clubs.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `canonicalClub(name: string): string`
  - `sameClub(a: string, b: string): boolean`
  - `clubValues(players: Array<{ verein: string; aktueller_marktwert: number }>): Map<string, number>`
  - `rankPercentile(value: number, peers: number[]): number | null`

- [ ] **Step 1: Failing test schreiben**

`web/tests/lib/clubs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canonicalClub, clubValues, rankPercentile, sameClub } from "../../src/lib/clubs";

const groups = [
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
] as const;

describe("sameClub", () => {
  it("matches every pair inside each required group", () => {
    for (const group of groups) {
      for (const a of group) {
        for (const b of group) {
          expect(sameClub(a, b)).toBe(true);
        }
      }
    }
  });

  it("matches identical unknown names and rejects different clubs", () => {
    expect(sameClub("VfB Stuttgart", "VfB Stuttgart")).toBe(true);
    expect(sameClub("FC Bayern München", "Borussia Dortmund")).toBe(false);
  });
});

describe("canonicalClub", () => {
  it("maps aliases to the group head and leaves unknown names trimmed", () => {
    expect(canonicalClub(" Bayern München ")).toBe("FC Bayern München");
    expect(canonicalClub("VfB Stuttgart")).toBe("VfB Stuttgart");
  });
});

describe("clubValues", () => {
  it("sums market values per canonical club", () => {
    const values = clubValues([
      { verein: "Bayern München", aktueller_marktwert: 10 },
      { verein: "FC Bayern München", aktueller_marktwert: 5 },
      { verein: "VfB Stuttgart", aktueller_marktwert: 7 },
    ]);
    expect(values.get("FC Bayern München")).toBe(15);
    expect(values.get("VfB Stuttgart")).toBe(7);
  });
});

describe("rankPercentile", () => {
  it("returns null with fewer than two peers and ranks otherwise", () => {
    expect(rankPercentile(10, [10])).toBeNull();
    expect(rankPercentile(20, [10, 20, 30])).toBe(50);
  });
});
```

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/clubs.test.ts`

Expected: FAIL — `clubs.ts` existiert nicht.

- [ ] **Step 3: Minimal implementieren**

`web/src/lib/clubs.ts`:

```ts
const CLUB_GROUPS: readonly string[][] = [
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
];

const CANONICAL_BY_ALIAS = new Map<string, string>();
for (const group of CLUB_GROUPS) {
  const canonical = group[0];
  for (const name of group) {
    CANONICAL_BY_ALIAS.set(name.trim().toLowerCase(), canonical);
  }
}

export function canonicalClub(name: string): string {
  const trimmed = name.trim();
  return CANONICAL_BY_ALIAS.get(trimmed.toLowerCase()) ?? trimmed;
}

export function sameClub(a: string, b: string): boolean {
  return canonicalClub(a) === canonicalClub(b);
}

export function clubValues(players: Array<{ verein: string; aktueller_marktwert: number }>): Map<string, number> {
  const sums = new Map<string, number>();
  for (const player of players) {
    const key = canonicalClub(player.verein);
    sums.set(key, (sums.get(key) ?? 0) + player.aktueller_marktwert);
  }
  return sums;
}

export function rankPercentile(value: number, peers: number[]): number | null {
  if (peers.length <= 1) return null;
  const sorted = [...peers].sort((a, b) => a - b);
  const index = sorted.findIndex((peer) => peer >= value);
  const rank = index === -1 ? sorted.length - 1 : index;
  return (rank / (sorted.length - 1)) * 100;
}
```

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npx vitest run tests/lib/clubs.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/clubs.ts web/tests/lib/clubs.test.ts
git commit -m "$(cat <<'EOF'
feat: Vereinsnamen OpenLigaDB und Katalog zusammenführen

Alias-Gruppen machen Heim/Auswärts und Gegner unabhängig von der Schreibweise.
EOF
)"
```

---

### Task 2: Fixture-Modifier

**Files:**
- Modify: `web/src/lib/scores.ts`
- Modify: `web/tests/lib/scores.test.ts`

**Interfaces:**
- Consumes: nichts aus Task 1 (nur Zahlen-Arrays)
- Produces:
  - `export type FixtureModifier = -1 | 0 | 1`
  - `export type FixtureText = "günstige Gegner" | "gemischte Gegner" | "schwere Gegner" | "Gegner unbekannt"`
  - `fixtureModifier(opponentPercentiles: number[]): FixtureModifier`
  - `fixtureText(modifier: FixtureModifier, percentileCount: number): FixtureText`

- [ ] **Step 1: Failing test schreiben**

In `web/tests/lib/scores.test.ts` Import erweitern und anhängen:

```ts
import { fixtureModifier, fixtureText, formScore, radarBadge } from "../../src/lib/scores";

describe("fixtureModifier", () => {
  it("returns 0 for an empty list, +1 below one third, -1 above two thirds", () => {
    expect(fixtureModifier([])).toBe(0);
    expect(fixtureModifier([20])).toBe(1);
    expect(fixtureModifier([50])).toBe(0);
    expect(fixtureModifier([80])).toBe(-1);
  });
});

describe("fixtureText", () => {
  it("uses unknown copy when no percentiles exist", () => {
    expect(fixtureText(0, 0)).toBe("Gegner unbekannt");
    expect(fixtureText(1, 1)).toBe("günstige Gegner");
    expect(fixtureText(-1, 2)).toBe("schwere Gegner");
    expect(fixtureText(0, 3)).toBe("gemischte Gegner");
  });
});
```

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/scores.test.ts`

Expected: FAIL — `fixtureModifier` nicht exportiert.

- [ ] **Step 3: Minimal implementieren**

Am Ende von `web/src/lib/scores.ts`:

```ts
export type FixtureModifier = -1 | 0 | 1;
export type FixtureText = "günstige Gegner" | "gemischte Gegner" | "schwere Gegner" | "Gegner unbekannt";

export function fixtureModifier(opponentPercentiles: number[]): FixtureModifier {
  if (opponentPercentiles.length === 0) return 0;
  const mean = opponentPercentiles.reduce((sum, value) => sum + value, 0) / opponentPercentiles.length;
  if (mean < 100 / 3) return 1;
  if (mean > 200 / 3) return -1;
  return 0;
}

export function fixtureText(modifier: FixtureModifier, percentileCount: number): FixtureText {
  if (percentileCount === 0) return "Gegner unbekannt";
  if (modifier === 1) return "günstige Gegner";
  if (modifier === -1) return "schwere Gegner";
  return "gemischte Gegner";
}
```

Schwellen `100 / 3` und `200 / 3` exakt, nicht 33/66.

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npx vitest run tests/lib/scores.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/scores.ts web/tests/lib/scores.test.ts
git commit -m "$(cat <<'EOF'
feat: Fixture-Modifier aus Gegner-Perzentilen

Untere und obere Drittel werden zu günstig bzw. schwer, ohne gerundete 33/66-Schwellen.
EOF
)"
```

---

### Task 3: Preis-Score mit Verlauf

**Files:**
- Modify: `web/src/lib/scores.ts` (`priceScore`)
- Modify: `web/tests/lib/scores.test.ts`

**Interfaces:**
- Consumes: bestehende Peer-Logik
- Produces: `priceScore(value: number, peerValues: number[], previousValue?: number | null): number`

- [ ] **Step 1: Failing test schreiben**

Anhängen an `scores.test.ts`:

Import um `priceScore` erweitern, dann anhängen:

```ts
describe("priceScore", () => {
  const peers = [10, 20, 30];

  it("stays peer-only without a usable previous value", () => {
    expect(priceScore(20, peers)).toBe(50);
    expect(priceScore(20, peers, null)).toBe(50);
    expect(priceScore(20, peers, 0)).toBe(50);
  });

  it("mixes 60% peer and 40% trend when history exists", () => {
    expect(priceScore(20, peers, 20 / 1.2)).toBe(70);
    expect(priceScore(20, peers, 20 / 0.8)).toBe(30);
  });
});
```

Peer von `20` in `[10, 20, 30]` ist 50. `previous = 20/1.2` ist +20 % → Trend 100 → Mix 70. `20/0.8` ist −20 % → Mix 30.

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/scores.test.ts`

Expected: FAIL — drittes Argument wird ignoriert, Mix nicht 70/30.

- [ ] **Step 3: Minimal implementieren**

`priceScore` in `web/src/lib/scores.ts` ersetzen:

```ts
export function priceScore(value: number, peerValues: number[], previousValue?: number | null): number {
  const peer =
    peerValues.length <= 1
      ? 50
      : (() => {
          const sorted = [...peerValues].sort((a, b) => a - b);
          const index = sorted.findIndex((peer) => peer >= value);
          const rank = index === -1 ? sorted.length - 1 : index;
          return (rank / (sorted.length - 1)) * 100;
        })();
  if (previousValue == null || previousValue <= 0) return peer;
  const trend = Math.min(100, Math.max(0, 50 + ((value - previousValue) / previousValue) * 250));
  return 0.6 * peer + 0.4 * trend;
}
```

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npx vitest run tests/lib/scores.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/scores.ts web/tests/lib/scores.test.ts
git commit -m "$(cat <<'EOF'
feat: Preis-Score mit eigener Marktwert-Änderung mischen

Ohne Verlauf bleibt das Positions-Perzentil; mit Verlauf zählen 40 Prozent Trend.
EOF
)"
```

---

### Task 4: Radar-Badge und Begründung

**Files:**
- Modify: `web/src/lib/scores.ts` (`radarBadge`, `radarReason`)
- Modify: `web/tests/lib/scores.test.ts`

**Interfaces:**
- Consumes: `FixtureModifier`, `FixtureText` aus Task 2
- Produces:
  - `radarBadge({ ..., modifier?: FixtureModifier })` — Default `0`
  - `radarReason({ trend, fixtureText, priceVsForm, badge })`

- [ ] **Step 1: Failing tests schreiben**

Bestehenden Buy-Test behalten (ohne `modifier` = 0). Ergänzen:

```ts
  it("downgrades buy to watch on hard fixtures", () => {
    expect(radarBadge({ inSquad: false, form: 80, price: 40, gate: "ok", modifier: -1 })).toBe("Beobachten");
    expect(radarBadge({ inSquad: false, form: 80, price: 40, gate: "ok", modifier: 0 })).toBe("Kaufen");
  });
```

```ts
describe("radarReason", () => {
  it("names the fixture bucket and never claims mapping is missing", () => {
    const text = radarReason({
      trend: "steigend",
      fixtureText: "günstige Gegner",
      priceVsForm: "hinkt",
      badge: "Kaufen",
    });
    expect(text).toBe("Form steigend, günstige Gegner, Preis hinkt → Kaufen");
    expect(text).not.toMatch(/ohne Mapping/);
  });
});
```

Import um `radarReason` erweitern.

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/scores.test.ts`

Expected: FAIL — `modifier` unbekannt bzw. Reason noch „Gegner ohne Mapping“.

- [ ] **Step 3: Minimal implementieren**

`radarBadge` um optionales `modifier: FixtureModifier` mit Default `0` erweitern. Nach der Zeile `if (divergence >= 15) return "Kaufen";` gilt: nur wenn `(options.modifier ?? 0) >= 0`, sonst `"Beobachten"`.

```ts
export function radarBadge(options: {
  inSquad: boolean;
  form: number | null;
  price: number;
  gate: "block" | "warn" | "ok";
  modifier?: FixtureModifier;
}): RadarBadge | "hidden" {
  if (options.gate === "block") return "Nicht verfügbar";
  if (options.form == null) return options.inSquad ? "Beobachten" : "hidden";
  const divergence = options.form - options.price;
  const modifier = options.modifier ?? 0;
  if (options.inSquad) {
    if (divergence <= -15) return "Verkaufen";
    if (divergence > 5) return "Halten";
    return "Beobachten";
  }
  if (divergence >= 15) return modifier >= 0 ? "Kaufen" : "Beobachten";
  if (divergence > 5) return "Beobachten";
  return "hidden";
}

export function radarReason(options: {
  trend: "steigend" | "stabil" | "fallend";
  fixtureText: FixtureText;
  priceVsForm: "hinkt" | "passt" | "voraus";
  badge: RadarBadge;
}): string {
  return `Form ${options.trend}, ${options.fixtureText}, Preis ${options.priceVsForm} → ${options.badge}`;
}
```

`FixtureModifier` / `FixtureText` müssen **oberhalb** von `radarBadge` stehen oder per Hoist: Types vor den Funktionen platzieren (Task-2-Block nach oben schieben, direkt nach `RadarBadge`).

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npx vitest run tests/lib/scores.test.ts`

Expected: PASS. `astro check` schlägt hier noch fehl, weil `catalog.ts` noch das alte `radarReason` aufruft — das ist Task 6. In diesem Task nur `scores.test.ts` grün. Nicht `npm test` (ganzes typecheck) bis Task 6.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/scores.ts web/tests/lib/scores.test.ts
git commit -m "$(cat <<'EOF'
feat: Radar-Kaufen nur bei nicht-schweren Gegnern

Begründungen nennen günstig, gemischt, schwer oder unbekannt statt Placebo-Mapping.
EOF
)"
```

Wenn `catalog.ts` nach diesem Commit lokal nicht typecheckt: in Task 6 sofort weiter; der Commit darf die Datei `catalog.ts` noch nicht anfassen. `astro check` ist erst nach Task 6 Pflicht.

---

### Task 5: Erwartete Punkte

**Files:**
- Modify: `web/src/lib/points.ts`
- Modify: `web/tests/lib/points.test.ts`

**Interfaces:**
- Consumes: `FixtureModifier` aus `scores.ts` nicht nötig — lokales optionales Feld reicht
- Produces: `expectedPoints({ ..., fixtureModifier?: -1 | 0 | 1 })` nach Venue ×1.10 / ×1.00 / ×0.90, dann Clamp

- [ ] **Step 1: Failing test schreiben**

Anhängen an `points.test.ts`:

```ts
  it("scales the estimate after venue using the fixture modifier", () => {
    const base = {
      notesNewestFirst: [] as number[],
      status: "fit" as const,
      lastThreeMinutes: [90, 90, 90],
      venue: "unknown" as const,
    };
    expect(expectedPoints({ ...base, fixtureModifier: 1 })).toBe(3.3);
    expect(expectedPoints({ ...base, fixtureModifier: -1 })).toBe(2.7);
    expect(expectedPoints({ ...base, fixtureModifier: 0 })).toBe(3);
  });

  it("keeps blocked players at 0 even with a favorable modifier", () => {
    expect(
      expectedPoints({
        notesNewestFirst: [2],
        status: "gesperrt",
        lastThreeMinutes: [90, 90, 90],
        venue: "home",
        fixtureModifier: 1,
      }),
    ).toBe(0);
  });
```

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/points.test.ts`

Expected: FAIL — 3 statt 3.3.

- [ ] **Step 3: Minimal implementieren**

In `expectedPoints` nach den Venue-Faktoren, vor dem `Math.round`:

```ts
  if (input.fixtureModifier === 1) value *= 1.1;
  if (input.fixtureModifier === -1) value *= 0.9;
```

Input-Typ um `fixtureModifier?: -1 | 0 | 1` erweitern. Block-Return unverändert **vor** allen Faktoren.

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npx vitest run tests/lib/points.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/points.ts web/tests/lib/points.test.ts
git commit -m "$(cat <<'EOF'
feat: erwartete Punkte mit Gegner-Schwierigkeit skalieren

Nach Heim/Auswärts verstärkt oder dämpft der Modifier die Schätzung, Block bleibt 0.
EOF
)"
```

---

### Task 6: Catalog — Match, Kontext, Radar-Zeilen

**Files:**
- Modify: `web/src/lib/catalog.ts`
- Create: `web/tests/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `sameClub`, `clubValues`, `canonicalClub`, `rankPercentile` aus `clubs.ts`; `fixtureModifier`, `fixtureText`, `priceScore`, `radarBadge`, `radarReason` aus `scores.ts`; `expectedPoints` aus `points.ts`
- Produces:
  - `venueFor` / `nextOpponents` über `sameClub`
  - `previousMarketValue(playerId: number, history: ValueHistoryRecord[]): number | null`
  - `RadarRow.divergence: number | null`
  - `radarRows(..., spieltag, options?: { includeHidden?: boolean; history?: ValueHistoryRecord[]; marketPlayers?: PlayerRecord[] })`
  - `playerPoints(..., clubValueMap: Map<string, number>)`

`ValueHistoryRecord` in diesem Task lokal duplizieren geht nicht — Import aus `directus.ts` erst Task 8. In Task 6 den Typ in `catalog.ts` selbst definieren **oder** in `directus.ts` nur den Type vorziehen.

**Vor Task 6:** In `web/src/lib/directus.ts` nur den Typ ergänzen (kein Fetch), damit Catalog ihn importieren kann:

```ts
export type ValueHistoryRecord = { player_id: number; datum: string; marktwert: number };
```

Das ist ein reiner Type-Export, keine Logik.

- [ ] **Step 1: Failing tests schreiben**

`web/tests/lib/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextOpponents, previousMarketValue, radarRows, venueFor } from "../../src/lib/catalog";
import type { PlayerRecord, ValueHistoryRecord } from "../../src/lib/directus";
import type { FixtureRecord } from "../../src/lib/fixtures";

function player(partial: Partial<PlayerRecord> & Pick<PlayerRecord, "id" | "name">): PlayerRecord {
  return {
    position: "Sturm",
    verein: "FC Bayern München",
    aktueller_marktwert: 10_000_000,
    ...partial,
  };
}

const bayern = player({ id: 1, name: "A", verein: "FC Bayern München", aktueller_marktwert: 80 });
const cheap = player({ id: 2, name: "B", verein: "TSG Hoffenheim", position: "Mittelfeld", aktueller_marktwert: 10 });
const mid = player({ id: 3, name: "C", verein: "VfB Stuttgart", position: "Abwehr", aktueller_marktwert: 40 });

const fixtures: FixtureRecord[] = [
  {
    spieltag: 1,
    heim_verein: "Bayern München",
    auswaerts_verein: "1899 Hoffenheim",
    datum: "2026-08-22T13:30:00.000Z",
  },
];

describe("venueFor / nextOpponents", () => {
  it("matches OpenLigaDB aliases to catalog club names", () => {
    expect(venueFor(bayern, fixtures)).toBe("home");
    expect(nextOpponents(bayern, fixtures)).toBe("1899 Hoffenheim");
  });
});

describe("previousMarketValue", () => {
  it("returns the second-newest history point", () => {
    const history: ValueHistoryRecord[] = [
      { player_id: 1, datum: "2026-08-21", marktwert: 90 },
      { player_id: 1, datum: "2026-08-14", marktwert: 70 },
      { player_id: 2, datum: "2026-08-21", marktwert: 1 },
    ];
    expect(previousMarketValue(1, history)).toBe(70);
    expect(previousMarketValue(2, history)).toBeNull();
  });
});

describe("radarRows", () => {
  it("writes a real fixture reason instead of mapping-placeholder copy", () => {
    const rows = radarRows([bayern, cheap, mid], new Set(), [], [], fixtures, 1, {
      includeHidden: true,
      marketPlayers: [bayern, cheap, mid],
    });
    const row = rows.find((item) => item.player.id === 1);
    expect(row?.opponents).toBe("1899 Hoffenheim");
    expect(row?.reason).not.toMatch(/ohne Mapping/);
    expect(row?.reason).toMatch(/Gegner/);
  });
});
```

Drei Clubs mit Werten 80 / 40 / 10: Hoffenheim ist das untere Drittel → Modifier +1 für Bayerns Gegner. Reason enthält „günstige Gegner“.

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/catalog.test.ts`

Expected: FAIL — `venueFor` noch `===`, `previousMarketValue` fehlt.

- [ ] **Step 3: Minimal implementieren**

1. `ValueHistoryRecord` in `directus.ts` exportieren (siehe oben).

2. `venueFor` / `nextOpponents`: `===` durch `sameClub` ersetzen. Beim Opponent-Label die Fixture-Schreibweise behalten (nicht umschreiben).

```ts
export function venueFor(player: PlayerRecord, fixtures: FixtureRecord[]): Venue {
  const next = fixtures.find(
    (row) => sameClub(row.heim_verein, player.verein) || sameClub(row.auswaerts_verein, player.verein),
  );
  if (!next) return "unknown";
  return sameClub(next.heim_verein, player.verein) ? "home" : "away";
}

export function nextOpponents(player: PlayerRecord, fixtures: FixtureRecord[]): string {
  const matches = fixtures
    .filter((row) => sameClub(row.heim_verein, player.verein) || sameClub(row.auswaerts_verein, player.verein))
    .slice(0, 3)
    .map((row) => (sameClub(row.heim_verein, player.verein) ? row.auswaerts_verein : row.heim_verein));
  return matches.length === 0 ? "—" : matches.join(", ");
}
```

3. `previousMarketValue`:

```ts
export function previousMarketValue(playerId: number, history: ValueHistoryRecord[]): number | null {
  const rows = history
    .filter((row) => row.player_id === playerId)
    .slice()
    .sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
  if (rows.length < 2) return null;
  return rows[1].marktwert;
}
```

4. Hilfsfunktion intern:

```ts
function opponentPercentiles(player: PlayerRecord, fixtures: FixtureRecord[], values: Map<string, number>): number[] {
  const totals = [...values.values()];
  const names = nextOpponents(player, fixtures);
  if (names === "—") return [];
  const percentiles: number[] = [];
  for (const name of names.split(", ")) {
    const total = values.get(canonicalClub(name));
    if (total == null) continue;
    const percentile = rankPercentile(total, totals);
    if (percentile != null) percentiles.push(percentile);
  }
  return percentiles;
}
```

`nextOpponents` join mit `", "` — split muss denselben Separator nutzen. Vereinsnamen enthalten kein `", "`.

5. `radarRows`: `options` um `history?: ValueHistoryRecord[]` und `marketPlayers?: PlayerRecord[]` erweitern. `const values = clubValues(options.marketPlayers ?? players)`. Pro Spieler:

```ts
    const percentiles = opponentPercentiles(player, fixtures, values);
    const modifier = fixtureModifier(percentiles);
    const previous = previousMarketValue(player.id, options.history ?? []);
    const price = priceScore(player.aktueller_marktwert, peers.get(player.position) ?? [], previous);
    const rawBadge = radarBadge({ inSquad, form, price, gate, modifier });
    const divergence = form == null ? null : form - price;
    const text = fixtureText(modifier, percentiles.length);
    // reason: radarReason({ trend, fixtureText: text, priceVsForm: priceVsForm(form, price), badge: ... })
    // RadarRow.divergence = divergence
```

6. `playerPoints` letztes Argument `clubValueMap: Map<string, number>`:

```ts
export function playerPoints(
  player: PlayerRecord,
  ratings: RatingRecord[],
  availability: AvailabilityRecord[],
  fixtures: FixtureRecord[],
  spieltag: number,
  clubValueMap: Map<string, number>,
): { points: number; blocked: boolean } {
  const status = asStatus(availability.find((row) => row.player_id === player.id && row.spieltag === spieltag)?.status ?? undefined);
  const gate = availabilityGate(status);
  const percentiles = opponentPercentiles(player, fixtures, clubValueMap);
  return {
    points: expectedPoints({
      notesNewestFirst: notesFor(player.id, ratings),
      status,
      lastThreeMinutes: minutesFor(player.id, ratings),
      venue: venueFor(player, fixtures),
      fixtureModifier: fixtureModifier(percentiles),
    }),
    blocked: gate === "block",
  };
}
```

`aufstellung.astro` in **diesem** Task anpassen, sonst typecheck rot:

```ts
const clubValueMap = clubValues(players);
const stats = playerPoints(player, ratings, availability, load.ok ? load.fixtures : [], spieltag, clubValueMap);
```

Import `clubValues` aus `../lib/clubs`.

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npm test`

Expected: 0 errors, alle Vitest-Dateien grün inkl. `catalog.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/catalog.ts web/src/lib/directus.ts web/src/pages/aufstellung.astro web/tests/lib/catalog.test.ts
git commit -m "$(cat <<'EOF'
feat: Radar und Aufstellung über Club-Map und Modifier verdrahten

Gegner und Heimspiel erkennen Aliase; die Elf nutzt dieselbe Schwierigkeit wie das Radar.
EOF
)"
```

---

### Task 7: Dashboard-Picker

**Files:**
- Modify: `web/src/lib/catalog.ts`
- Modify: `web/tests/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `RadarRow`, `previousMarketValue`, `PlayerRecord`, `ValueHistoryRecord`
- Produces:
  - `pickTopSignals(rows: RadarRow[]): RadarRow[]`
  - `type MarketMover = { player: PlayerRecord; delta: number }`
  - `marketMovers(players: PlayerRecord[], history: ValueHistoryRecord[]): { gainers: MarketMover[]; losers: MarketMover[] }`

- [ ] **Step 1: Failing tests schreiben**

Anhängen an `catalog.test.ts`:

Import um `marketMovers`, `pickTopSignals` und `RadarRow` erweitern. Factory und Tests anhängen:

```ts
function row(partial: Pick<RadarRow, "badge" | "divergence" | "player">): RadarRow {
  return {
    market: 1,
    form: 80,
    notes: [],
    opponents: "—",
    reason: "",
    inSquad: false,
    ...partial,
  };
}

describe("pickTopSignals", () => {
  it("returns two buys by divergence then one sell", () => {
    const picked = pickTopSignals([
      row({ badge: "Kaufen", divergence: 20, player: mid }),
      row({ badge: "Verkaufen", divergence: -40, player: cheap }),
      row({ badge: "Beobachten", divergence: 10, player: mid }),
      row({ badge: "Kaufen", divergence: 40, player: bayern }),
      row({ badge: "Kaufen", divergence: 30, player: cheap }),
    ]);
    expect(picked.map((item) => [item.badge, item.divergence])).toEqual([
      ["Kaufen", 40],
      ["Kaufen", 30],
      ["Verkaufen", -40],
    ]);
  });
});
```

```ts
describe("marketMovers", () => {
  it("takes three gainers and three losers and skips single-point history", () => {
    const squad = [
      player({ id: 1, name: "Aaa", aktueller_marktwert: 120 }),
      player({ id: 2, name: "Bbb", aktueller_marktwert: 50 }),
      player({ id: 3, name: "Ccc", aktueller_marktwert: 10 }),
    ];
    const history: ValueHistoryRecord[] = [
      { player_id: 1, datum: "2026-08-21", marktwert: 120 },
      { player_id: 1, datum: "2026-08-14", marktwert: 100 },
      { player_id: 2, datum: "2026-08-21", marktwert: 50 },
      { player_id: 2, datum: "2026-08-14", marktwert: 80 },
      { player_id: 3, datum: "2026-08-21", marktwert: 10 },
    ];
    const { gainers, losers } = marketMovers(squad, history);
    expect(gainers.map((item) => item.player.id)).toEqual([1]);
    expect(gainers[0].delta).toBe(20);
    expect(losers.map((item) => item.player.id)).toEqual([2]);
    expect(losers[0].delta).toBe(-30);
  });
});
```

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/catalog.test.ts`

Expected: FAIL — Funktionen fehlen.

- [ ] **Step 3: Minimal implementieren**

```ts
export function pickTopSignals(rows: RadarRow[]): RadarRow[] {
  const byDivDesc = (a: RadarRow, b: RadarRow) => {
    if (a.divergence == null && b.divergence == null) return a.player.name.localeCompare(b.player.name, "de");
    if (a.divergence == null) return 1;
    if (b.divergence == null) return -1;
    return b.divergence - a.divergence;
  };
  const buys = rows.filter((row) => row.badge === "Kaufen").sort(byDivDesc).slice(0, 2);
  const sells = rows
    .filter((row) => row.badge === "Verkaufen")
    .sort((a, b) => {
      if (a.divergence == null && b.divergence == null) return a.player.name.localeCompare(b.player.name, "de");
      if (a.divergence == null) return 1;
      if (b.divergence == null) return -1;
      return a.divergence - b.divergence;
    })
    .slice(0, 1);
  return [...buys, ...sells];
}

export type MarketMover = { player: PlayerRecord; delta: number };

export function marketMovers(
  players: PlayerRecord[],
  history: ValueHistoryRecord[],
): { gainers: MarketMover[]; losers: MarketMover[] } {
  const movers: MarketMover[] = [];
  for (const player of players) {
    const previous = previousMarketValue(player.id, history);
    if (previous == null) continue;
    const delta = player.aktueller_marktwert - previous;
    if (delta === 0) continue;
    movers.push({ player, delta });
  }
  const byName = (a: MarketMover, b: MarketMover) => a.player.name.localeCompare(b.player.name, "de");
  const gainers = movers.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta || byName(a, b)).slice(0, 3);
  const losers = movers.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta || byName(a, b)).slice(0, 3);
  return { gainers, losers };
}
```

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npx vitest run tests/lib/catalog.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/catalog.ts web/tests/lib/catalog.test.ts
git commit -m "$(cat <<'EOF'
feat: Top-Signale und Marktwert-Gewinner ableiten

Übersicht bekommt zwei Kauf- und ein Verkaufssignal plus Verlaufs-Deltas, ohne eigene Seitenlogik.
EOF
)"
```

---

### Task 8: `listValueHistory`

**Files:**
- Modify: `web/src/lib/directus.ts`
- Modify: `web/tests/lib/directus.test.ts`

**Interfaces:**
- Consumes: `getItems`, `CatalogAuth`, `ValueHistoryRecord` (Task 6)
- Produces: `listValueHistory(options: CatalogAuth): Promise<ValueHistoryRecord[]>`

- [ ] **Step 1: Failing test schreiben**

In `directus.test.ts` Import `{ listFixtures, listValueHistory }`. Neuer `describe`:

```ts
describe("listValueHistory", () => {
  it("requests value_history newest first with bearer and apikey", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ player_id: 1, datum: "2026-08-21", marktwert: 1000000 }],
    });
    const rows = await listValueHistory({
      ...auth,
      url: "https://example.supabase.co/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/rest/v1/value_history?");
    expect(calledUrl).toContain("select=player_id,datum,marktwert");
    expect(calledUrl).toContain("order=datum.desc");
    expect(calledUrl).toContain("limit=20000");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer test-token",
        apikey: "anon",
      }),
    );
    expect(rows).toEqual([{ player_id: 1, datum: "2026-08-21", marktwert: 1000000 }]);
  });

  it("returns an empty list on HTTP error without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(
      listValueHistory({ ...auth, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/directus.test.ts`

Expected: FAIL — `listValueHistory` nicht exportiert.

- [ ] **Step 3: Minimal implementieren**

Neben `listRatings`:

```ts
function isValueHistory(value: unknown): value is ValueHistoryRecord {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.player_id === "number" &&
    typeof row.datum === "string" &&
    row.datum.length > 0 &&
    typeof row.marktwert === "number"
  );
}

export async function listValueHistory(options: CatalogAuth) {
  const rows = await getItems<unknown>({
    ...options,
    path: "/rest/v1/value_history?select=player_id,datum,marktwert&order=datum.desc&limit=20000",
  });
  return (rows ?? []).filter(isValueHistory);
}
```

`getItems` gibt bei Fehler `null` → `[]`. Kein Throw. Kein `console.error` Pflicht (Spec: leeres Array).

- [ ] **Step 4: Tests müssen passieren**

Run: `cd web && npx vitest run tests/lib/directus.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/directus.ts web/tests/lib/directus.test.ts
git commit -m "$(cat <<'EOF'
feat: Marktwert-Verlauf aus Supabase lesen

value_history war schon da; die App kann den vorherigen Punkt jetzt für Score und Übersicht nutzen.
EOF
)"
```

---

### Task 9: Seiten verdrahten

**Files:**
- Modify: `web/src/pages/index.astro`
- Modify: `web/src/pages/radar.astro`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `listValueHistory`, `radarRows` mit `history` / `marketPlayers`, `pickTopSignals`, `marketMovers`
- Produces: Übersicht mit 2+1 Signalen und Marktwert-Block; Radar-Zeilen mit Verlauf im Preis-Score

- [ ] **Step 1: Kein neuer Unit-Test** — Seiten sind Astro. Absicherung: `cd web && npm test` nach der Änderung (typecheck).

- [ ] **Step 2: `index.astro`**

Imports: `kaderAlerts, marketMovers, pickTopSignals, radarRows` und `listValueHistory`.

In `Promise.all` `listValueHistory(db)` ergänzen (Variable `history`).

```ts
const rows = radarRows(
  players,
  new Set(squad.map((row) => row.player_id)),
  ratings,
  availability,
  load.ok ? load.fixtures : [],
  spieltag,
  { history },
);
const signals = pickTopSignals(rows);
const movers = marketMovers(players, history);
```

Bestehende `.filter(Kaufen||Verkaufen).slice(0,3)` entfernen. Top-Signale-Liste: `signals.map` ohne extra slice.

Nach dem Top-Signale-`section` neuen Block (bestehende Klassen `font-[Syne]` beibehalten, kein Shell-Umbau):

```astro
  <section class="space-y-3">
    <h2 class="font-[Syne] text-xl">Marktwert</h2>
    {movers.gainers.length === 0 && movers.losers.length === 0 ? (
      <EmptyState body="Noch kein Marktwert-Verlauf." />
    ) : (
      <div class="grid gap-4 sm:grid-cols-2">
        <ul class="space-y-2">
          {movers.gainers.map((item) => (
            <li class="text-sm">
              {item.player.name}
              <span class="block tabular-nums text-muted-foreground">
                +{item.delta.toLocaleString("de-DE")} €
              </span>
            </li>
          ))}
        </ul>
        <ul class="space-y-2">
          {movers.losers.map((item) => (
            <li class="text-sm">
              {item.player.name}
              <span class="block tabular-nums text-muted-foreground">
                −{Math.abs(item.delta).toLocaleString("de-DE")} €
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </section>
```

Minuszeichen in der Copy: Unicode minus `−` (U+2212), wie in der Spec.

- [ ] **Step 3: `radar.astro`**

`listValueHistory` in denselben `Promise.all` wie `listPlayers`. `radarRows` aufrufen mit:

```ts
  radarRows(catalog, squadIds, ratings, availability, load.ok ? load.fixtures : [], spieltag, {
    includeHidden: true,
    history,
    marketPlayers: players,
  }),
```

`marketPlayers: players` ist der **ungefilterte** Katalog, damit Filter die Club-Stärke nicht verzerren.

- [ ] **Step 4: `docs/README.md`**

Unter Design- und Baupläne, direkt unter dem Zahlen-Vertrauen-Spec-Link:

```markdown
- [Zahlen-Vertrauen, Plan](superpowers/plans/2026-08-22-zahlen-vertrauen.md)
```

- [ ] **Step 5: Typecheck + Tests**

Run: `cd web && npm test`

Expected: 0 errors, alle Tests grün.

Manuell (Executor, nicht in CI): eingeloggt `/` — Begründung ohne „ohne Mapping“; nach zwei `value_history`-Datenpunkten Gewinner/Verlierer. `/radar` Gegnernamen wenn Alias matcht. `/aufstellung` lädt.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/index.astro web/src/pages/radar.astro docs/README.md
git commit -m "$(cat <<'EOF'
feat: Übersicht und Radar mit Verlauf und ehrlichen Gegnern

Signale folgen der Divergenz; Marktwert-Gewinner brauchen zwei History-Punkte.
EOF
)"
```

---

## Self-Review

**Spec coverage**

| Spec-Abschnitt | Task |
|---|---|
| Club-Gruppen / sameClub | 1 |
| fixtureModifier + Texte | 2 |
| priceScore 60/40 | 3 |
| Kaufen nur modifier ≥ 0, Reason | 4 |
| expectedPoints ×1.10/0.90 | 5 |
| sameClub in venue/opponents, radarRows, playerPoints | 6 |
| pickTopSignals 2+1, marketMovers | 7 |
| listValueHistory | 8 |
| index + radar verdrahten | 9 |
| Kaufpreis / Cron / Mobile / Datei umbenennen | bewusst kein Task |

**Placeholder scan:** keine TBD-Schritte. Task 4 merkt an, dass `npm test` erst nach Task 6 Pflicht ist.

**Typen:** `ValueHistoryRecord`, `FixtureModifier`, `RadarRow.divergence`, `playerPoints(..., clubValueMap)`, `radarRows` options `history` / `marketPlayers` — in späteren Tasks identisch zu Task 1–6.
