# Frontend Dashboard-Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine lokal unter `http://localhost:4321` laufende Astro-App (`web/`) mit drei Routen, echter nächster Bundesliga-Runde und Deadline aus Directus-`Fixture`, plus ehrlichen Leerzuständen für Kader, Radar und Alerts.

**Architecture:** Astro-SSR (Node-Adapter) rendert Seiten auf dem Server und liest Directus nur dort (`DIRECTUS_TOKEN` nie im Browser). Reine Ableitung in `web/src/lib/fixtures.ts` (testbar, `now` injizierbar). Wenige React-Inseln: Nav und Radar-Filter mit `liquid-gooey` (`client:only="react"`), Deadline-Countdown (`client:load`). Keine SPA. Gooey nicht auf Tabellen oder Metric-Karten.

**Tech Stack:** Astro 5, React 19, Tailwind 4, shadcn/ui (Card, Badge), `liquid-gooey` 0.1.x, Vitest, Node 22+. Directus bleibt `http://localhost:8055`.

**Spec:** `docs/superpowers/specs/2026-08-21-frontend-dashboard-shell-design.md` (plus `docs/spec-dashboard.md`, `docs/spec-transfermarkt.md`, `docs/spec-kader-check.md` für Copy und Spalten).

## Global Constraints

- Feldnamen verbatim: `spieltag`, `heim_verein`, `auswaerts_verein`, `datum`. Collection-Name `Fixture`.
- Env: `DIRECTUS_URL` (Default `http://localhost:8055`), `DIRECTUS_TOKEN` (static token, optional im Schema, damit die App ohne Token startet). Kein `PUBLIC_*`, kein Admin-Passwort im Frontend.
- Directus-Calls nur in Server-Code (`astro:env/server` + `web/src/lib/directus.ts`). `listFixtures` wirft nicht in die Seite; Fehler werden zu `ok: false`.
- Geladen wird nur `Fixture` mit `limit=-1` und `sort=datum`. Kein `Player`, `SquadMembership`, `ValueHistory`, `RatingHistory`, `AvailabilityStatus`, `ScrapeLog`.
- Tests gegen eingefrorene JSON-Fixtures und gemocktes `fetch`. Kein Live-Directus in Vitest.
- Copy verbatim (siehe Spec): Budget/Kaderwert „Noch keine Kadereingabe“; Directus down „Directus nicht erreichbar. In `directus/` `docker compose up -d`.“; Token fehlt „`DIRECTUS_TOKEN` in `web/.env` setzen.“; leeres Fixture „Noch kein Spielplan. Im Ordner `scraper/` `npm run sync:openligadb`.“; Kader-Check „Sobald Spieler im Kader und Verfügbarkeit gepflegt sind, erscheinen Warnungen hier.“; Top-Signale „Kauf-/Verkaufssignale brauchen Noten und Marktwerte.“; Radar-Leerzeile „Noch keine Spielerdaten.“; Footer „Daten: OpenLigaDB (ODbL)“; Saisonende „Saison vorbei“.
- Deadline-V1-Proxy: Kickoff des ersten noch ausstehenden Spiels des nächsten Spieltags, nicht der Comunio-Freitag. `now` in Ableitungen injizierbar.
- `liquid-gooey` nur Nav + deaktivierte Radar-Chips. Item-Kinder ohne opakes `bg-*`; `fill` = `var(--card)`.
- Kein Auth, keine Modals, kein Vercel-Deploy, kein Schema-`season`-Feld, keine Scraper-Änderungen.
- UI-Charakter: dunkles „Nachtspiel“ (tiefes Grün-Schwarz, nicht helles SaaS-Grau). Kein Inter, kein indigo/purple Gradient, keine generischen Dashboard-Illustrationen. Display-Font für Titel (z. B. Syne), Grotesk für UI (z. B. Figtree). Accent für Alerts: rot/amber laut Spec, nicht als Deko-Lila.
- App-Sprache `de`. Datumsformat `de-DE`.

## File Structure

```
web/
  .env.example
  .gitignore                 # falls create-astro eine eigene anlegt: .env nicht committen
  astro.config.mjs
  package.json
  tsconfig.json
  vitest.config.ts
  README.md
  src/
    env.d.ts
    styles/global.css        # shadcn tokens + Fonts
    layouts/Shell.astro
    pages/index.astro
    pages/radar.astro
    pages/kader-check.astro
    lib/utils.ts             # shadcn cn()
    lib/fixtures.ts          # Ableitung Deadline / Spieltag
    lib/directus.ts          # listFixtures, nur Server
    lib/countdown.ts         # formatDeadlineRemaining
    components/Nav.tsx
    components/RadarFilters.tsx
    components/DeadlineCountdown.tsx
    components/EmptyState.astro
    components/MatchList.astro
    components/ui/card.tsx   # shadcn CLI
    components/ui/badge.tsx  # shadcn CLI
  tests/
    fixtures/fixtures-sample.json
    lib/fixtures.test.ts
    lib/directus.test.ts
    lib/countdown.test.ts
```

Modify: Root-`.gitignore` um `web/.env` ergänzen (analog `scraper/.env`), auch wenn `.env` schon global ignoriert wird.

---

### Task 1: Astro-Paket und Fixture-Ableitung

**Files:**
- Create: `web/` (Astro-Scaffold + Config)
- Create: `web/vitest.config.ts`
- Create: `web/tests/fixtures/fixtures-sample.json`
- Create: `web/tests/lib/fixtures.test.ts`
- Create: `web/src/lib/fixtures.ts`
- Modify: Root-`.gitignore`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `export type FixtureRecord = { spieltag: number; heim_verein: string; auswaerts_verein: string; datum: string }`
  - `export type NextMatchday = { spieltag: number; fixtures: FixtureRecord[]; deadline: Date | null; seasonOver: boolean }`
  - `export function getNextMatchday(fixtures: FixtureRecord[], now: Date): NextMatchday | null` — `null` nur bei leerem Array.
  - `export function nextMatchdayFixtures(fixtures: FixtureRecord[], now: Date): FixtureRecord[]` — `[]` wenn `getNextMatchday` null.
  - `export function deriveDeadline(fixtures: FixtureRecord[], now: Date): Date | null`

  Regeln: Nächster Spieltag = kleinste `spieltag`-Gruppe, in der mindestens ein `datum >= now`. Fixtures der Gruppe nach `datum` aufsteigend. Deadline = frühestes `datum` in der Gruppe mit `datum >= now`. Gibt es keine zukünftigen Spiele: letzter Spieltag, `seasonOver: true`, `deadline: null`, Fixtures = alle der letzten Gruppe.

- [ ] **Step 1: `web/` mit Astro + React + Tailwind + Node-Adapter anlegen**

Vom Repo-Root (Branch von `origin/main`, der bereits `scraper/` enthält). Falls `web/` schon existiert und kein Astro-Projekt ist: nicht überschreiben ohne nachzufragen.

```bash
npm create astro@latest web -- --template minimal --install --no-git --typescript strict --skip-houston
cd web
npx astro add react --yes
npx astro add tailwind --yes
npx astro add node --yes
npm install -D vitest typescript @types/node
```

`web/package.json` Name `comunio-helper-web`, `"private": true`, `"engines": { "node": ">=22" }`. Scripts:

```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "typecheck": "astro check",
  "test": "npm run typecheck && vitest run",
  "test:watch": "vitest"
}
```

`npm install -D @astrojs/check` falls `astro check` es verlangt.

`web/astro.config.mjs` muss SSR aktiv haben (Node-Adapter, `output: "server"`). `env.schema`:

```js
import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react(), tailwind()],
  env: {
    schema: {
      DIRECTUS_URL: envField.string({
        context: "server",
        access: "secret",
        default: "http://localhost:8055",
      }),
      DIRECTUS_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
});
```

Falls `astro add tailwind` bei Astro 5 Vite-Plugin-Tailwind statt `@astrojs/tailwind` setzt: die von der CLI erzeugte Config behalten, nicht beides mischen. `env.schema` und Node-Adapter trotzdem setzen.

`web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

Root-`.gitignore` um die Zeile `web/.env` ergänzen.

Default-Welcome-Page von create-astro durch eine minimale `src/pages/index.astro` ersetzen (`<p>ok</p>`), damit `astro check` nicht an Demo-Assets hängt.

- [ ] **Step 2: Failing Test für die Ableitung schreiben**

`web/tests/fixtures/fixtures-sample.json`:

```json
[
  {
    "spieltag": 1,
    "heim_verein": "FC Bayern München",
    "auswaerts_verein": "RB Leipzig",
    "datum": "2026-08-22T13:30:00.000Z"
  },
  {
    "spieltag": 1,
    "heim_verein": "Bayer 04 Leverkusen",
    "auswaerts_verein": "Eintracht Frankfurt",
    "datum": "2026-08-22T16:30:00.000Z"
  },
  {
    "spieltag": 2,
    "heim_verein": "RB Leipzig",
    "auswaerts_verein": "FC Bayern München",
    "datum": "2026-08-29T13:30:00.000Z"
  },
  {
    "spieltag": 2,
    "heim_verein": "1. FC Union Berlin",
    "auswaerts_verein": "SC Freiburg",
    "datum": "2026-08-30T15:30:00.000Z"
  },
  {
    "spieltag": 34,
    "heim_verein": "VfB Stuttgart",
    "auswaerts_verein": "Borussia Dortmund",
    "datum": "2027-05-22T13:30:00.000Z"
  }
]
```

`web/tests/lib/fixtures.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveDeadline,
  getNextMatchday,
  nextMatchdayFixtures,
  type FixtureRecord,
} from "../../src/lib/fixtures.ts";

const sample = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../fixtures/fixtures-sample.json"), "utf8"),
) as FixtureRecord[];

describe("getNextMatchday", () => {
  it("returns null for an empty list", () => {
    expect(getNextMatchday([], new Date("2026-08-21T12:00:00.000Z"))).toBeNull();
  });

  it("picks Spieltag 1 when that round is still in the future", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.spieltag).toBe(1);
    expect(view?.seasonOver).toBe(false);
    expect(view?.fixtures).toHaveLength(2);
    expect(view?.deadline?.toISOString()).toBe("2026-08-22T13:30:00.000Z");
    expect(nextMatchdayFixtures(sample, now).map((f) => f.heim_verein)).toEqual([
      "FC Bayern München",
      "Bayer 04 Leverkusen",
    ]);
    expect(deriveDeadline(sample, now)?.toISOString()).toBe("2026-08-22T13:30:00.000Z");
  });

  it("stays on Spieltag 1 after the first kickoff and moves the deadline", () => {
    const now = new Date("2026-08-22T15:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.spieltag).toBe(1);
    expect(view?.deadline?.toISOString()).toBe("2026-08-22T16:30:00.000Z");
    expect(view?.fixtures).toHaveLength(2);
  });

  it("moves to Spieltag 2 once Spieltag 1 is finished", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.spieltag).toBe(2);
    expect(view?.deadline?.toISOString()).toBe("2026-08-29T13:30:00.000Z");
  });

  it("marks the season over when every kickoff is in the past", () => {
    const now = new Date("2027-05-23T12:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.seasonOver).toBe(true);
    expect(view?.spieltag).toBe(34);
    expect(view?.deadline).toBeNull();
    expect(view?.fixtures).toHaveLength(1);
    expect(deriveDeadline(sample, now)).toBeNull();
  });
});
```

Falls `allowImportingTsExtensions` in `web/tsconfig.json` fehlt: Imports ohne `.ts` schreiben und tsconfig so lassen, wie create-astro sie erzeugt. Konsistent in allen Testdateien.

- [ ] **Step 3: Test ausführen, Fail bestätigen**

```bash
cd web && npx vitest run tests/lib/fixtures.test.ts
```

Expected: FAIL — `fixtures.ts` existiert nicht bzw. Exports fehlen.

- [ ] **Step 4: Minimale Ableitung implementieren**

`web/src/lib/fixtures.ts`:

```ts
export type FixtureRecord = {
  spieltag: number;
  heim_verein: string;
  auswaerts_verein: string;
  datum: string;
};

export type NextMatchday = {
  spieltag: number;
  fixtures: FixtureRecord[];
  deadline: Date | null;
  seasonOver: boolean;
};

function kickoff(fixture: FixtureRecord): number {
  return new Date(fixture.datum).getTime();
}

function byKickoff(a: FixtureRecord, b: FixtureRecord): number {
  return kickoff(a) - kickoff(b);
}

export function getNextMatchday(fixtures: FixtureRecord[], now: Date): NextMatchday | null {
  if (fixtures.length === 0) return null;

  const groups = new Map<number, FixtureRecord[]>();
  for (const fixture of fixtures) {
    const list = groups.get(fixture.spieltag) ?? [];
    list.push(fixture);
    groups.set(fixture.spieltag, list);
  }

  const tags = [...groups.keys()].sort((a, b) => a - b);
  const nowMs = now.getTime();
  const upcoming = tags.find((tag) => (groups.get(tag) ?? []).some((f) => kickoff(f) >= nowMs));

  if (upcoming === undefined) {
    const last = tags[tags.length - 1];
    return {
      spieltag: last,
      fixtures: [...(groups.get(last) ?? [])].sort(byKickoff),
      deadline: null,
      seasonOver: true,
    };
  }

  const round = [...(groups.get(upcoming) ?? [])].sort(byKickoff);
  const remaining = round.filter((f) => kickoff(f) >= nowMs);
  return {
    spieltag: upcoming,
    fixtures: round,
    deadline: remaining[0] ? new Date(remaining[0].datum) : null,
    seasonOver: false,
  };
}

export function nextMatchdayFixtures(fixtures: FixtureRecord[], now: Date): FixtureRecord[] {
  return getNextMatchday(fixtures, now)?.fixtures ?? [];
}

export function deriveDeadline(fixtures: FixtureRecord[], now: Date): Date | null {
  return getNextMatchday(fixtures, now)?.deadline ?? null;
}
```

- [ ] **Step 5: Tests grün**

```bash
cd web && npx vitest run tests/lib/fixtures.test.ts
```

Expected: PASS (5 Tests).

- [ ] **Step 6: Commit**

```bash
git add web .gitignore
git commit -m "$(cat <<'EOF'
feat: Astro-Paket und Ableitung von Deadline und nächstem Spieltag

EOF
)"
```

---

### Task 2: Directus-`listFixtures` (static token, kein Throw in die Seite)

**Files:**
- Create: `web/src/lib/directus.ts`
- Create: `web/tests/lib/directus.test.ts`

**Interfaces:**
- Consumes: `FixtureRecord` aus `web/src/lib/fixtures.ts`.
- Produces:
  - `export type FixtureLoadResult = { ok: true; fixtures: FixtureRecord[] } | { ok: false; reason: "missing_token" | "directus_unreachable" }`
  - `export async function listFixtures(options: { url: string; token: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<FixtureLoadResult>`
  - Request: `GET {url}/items/Fixture?limit=-1&sort=datum`, Header `Authorization: Bearer {token}`, `Accept: application/json`. Timeout-Default 8000 ms via `AbortSignal.timeout`.
  - Leeres `token` (nach trim): sofort `{ ok: false, reason: "missing_token" }`, kein fetch.
  - Netzwerkfehler, Abort, HTTP ≠ 2xx, JSON ohne `data`-Array: `{ ok: false, reason: "directus_unreachable" }`. `console.error` mit Status/Message, kein Stack an den Caller.
  - `data: []` ist Erfolg: `{ ok: true, fixtures: [] }`.
  - Rows ohne `spieltag` (number), `heim_verein`/`auswaerts_verein`/`datum` (nichtleere strings) weglassen.

- [ ] **Step 1: Failing Tests schreiben**

`web/tests/lib/directus.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { listFixtures } from "../../src/lib/directus.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listFixtures", () => {
  it("does not fetch when the token is missing", async () => {
    const fetchImpl = vi.fn();
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "  ",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "missing_token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests Fixture with limit -1, sort datum, and bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            spieltag: 1,
            heim_verein: "FC Bayern München",
            auswaerts_verein: "RB Leipzig",
            datum: "2026-08-22T13:30:00.000Z",
          },
        ],
      }),
    });
    const result = await listFixtures({
      url: "http://localhost:8055/",
      token: "test-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://localhost:8055/items/Fixture?limit=-1&sort=datum");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(result).toEqual({
      ok: true,
      fixtures: [
        {
          spieltag: 1,
          heim_verein: "FC Bayern München",
          auswaerts_verein: "RB Leipzig",
          datum: "2026-08-22T13:30:00.000Z",
        },
      ],
    });
  });

  it("returns unreachable on HTTP 401 without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ errors: [{ message: "Invalid token" }] }),
    });
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "bad",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "directus_unreachable" });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns unreachable when fetch rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "directus_unreachable" });
  });

  it("treats an empty data array as success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, fixtures: [] });
  });
});
```

- [ ] **Step 2: Fail bestätigen**

```bash
cd web && npx vitest run tests/lib/directus.test.ts
```

Expected: FAIL — Modul fehlt.

- [ ] **Step 3: Implementieren**

`web/src/lib/directus.ts`:

```ts
import type { FixtureRecord } from "./fixtures.ts";

export type FixtureLoadResult =
  | { ok: true; fixtures: FixtureRecord[] }
  | { ok: false; reason: "missing_token" | "directus_unreachable" };

const DEFAULT_TIMEOUT_MS = 8000;

function isFixtureRecord(value: unknown): value is FixtureRecord {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.spieltag === "number" &&
    typeof row.heim_verein === "string" &&
    row.heim_verein.length > 0 &&
    typeof row.auswaerts_verein === "string" &&
    row.auswaerts_verein.length > 0 &&
    typeof row.datum === "string" &&
    row.datum.length > 0
  );
}

export async function listFixtures(options: {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<FixtureLoadResult> {
  const token = options.token.trim();
  if (!token) return { ok: false, reason: "missing_token" };

  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  const url = `${base}/items/Fixture?limit=-1&sort=datum`;

  try {
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`Directus HTTP ${response.status} for GET /items/Fixture`);
      return { ok: false, reason: "directus_unreachable" };
    }
    const body = (await response.json()) as { data?: unknown };
    if (!Array.isArray(body.data)) {
      console.error("Directus Fixture response missing data array");
      return { ok: false, reason: "directus_unreachable" };
    }
    const fixtures = body.data.filter(isFixtureRecord).map((row) => ({
      spieltag: row.spieltag,
      heim_verein: row.heim_verein,
      auswaerts_verein: row.auswaerts_verein,
      datum: row.datum,
    }));
    return { ok: true, fixtures };
  } catch (error) {
    console.error("Directus Fixture request failed", error);
    return { ok: false, reason: "directus_unreachable" };
  }
}
```

Diese Datei darf nicht aus React-Inseln importiert werden.

- [ ] **Step 4: Tests grün**

```bash
cd web && npm test
```

Expected: Fixture-Tests + Directus-Tests PASS, `astro check` grün oder nur bekannte Demo-Warnungen — Demo-Reste in diesem Schritt entfernen, falls check failt.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/directus.ts web/tests/lib/directus.test.ts
git commit -m "$(cat <<'EOF'
feat: Directus-Fixture-Loader mit Token- und Fehlerzuständen

EOF
)"
```

---

### Task 3: Shell, Gooey-Nav, shadcn, drei Routen

**Files:**
- Create: `web/src/layouts/Shell.astro`
- Create: `web/src/components/Nav.tsx`
- Create: `web/src/components/EmptyState.astro`
- Modify: `web/src/pages/index.astro`
- Create: `web/src/pages/radar.astro`
- Create: `web/src/pages/kader-check.astro`
- Create: `web/.env.example`
- Modify: `web/src/styles/global.css` (Pfad wie von shadcn/Tailwind angelegt)
- Create: `web/src/components/ui/card.tsx`, `web/src/components/ui/badge.tsx` via CLI

**Interfaces:**
- Consumes: keine Directus-Calls in diesem Task (Seiten zeigen nur Shell + Platzhalter).
- Produces: Layout `Shell` mit Props `title: string`. Nav-Insel Props `{ currentPath: string }`. Routen `/`, `/radar`, `/kader-check` rendern die Shell. Fallback-Nav (drei Textlinks) in `Shell.astro`, Gooey-Nav `client:only="react"`.

- [ ] **Step 1: shadcn und liquid-gooey**

```bash
cd web
npx shadcn@latest init -d --base radix
npx shadcn@latest add card badge --yes
npm install liquid-gooey
```

Fonts in der globalen CSS (oder `Shell` `<link>` zu Google Fonts): Syne 700 für `h1`, Figtree für Body. `html` mit `lang="de"` und Klasse `dark`. Hintergrund `--background` Richtung oklch-Dunkelgrün, nicht Neutral-Grau. `--card` so setzen, dass `fill="var(--card)"` auf der Nav lesbar ist.

`web/.env.example`:

```
DIRECTUS_URL=http://localhost:8055
DIRECTUS_TOKEN=
```

- [ ] **Step 2: EmptyState und Shell**

`web/src/components/EmptyState.astro`:

```astro
---
interface Props {
  title?: string;
  body: string;
}
const { title, body } = Astro.props;
---
<div class="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
  {title ? <p class="mb-1 font-medium text-foreground">{title}</p> : null}
  <p>{body}</p>
</div>
```

`web/src/layouts/Shell.astro`:

```astro
---
import "../styles/global.css";
import Nav from "../components/Nav.tsx";

interface Props {
  title: string;
}
const { title } = Astro.props;
const currentPath = Astro.url.pathname;
---
<html lang="de" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · Comunio Assistant</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  </head>
  <body class="min-h-screen bg-background font-sans text-foreground antialiased">
    <div class="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
      <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="font-[Syne] text-lg tracking-tight">Comunio Assistant</p>
        <div class="relative">
          <nav class="nav-fallback flex gap-4 text-sm" aria-label="Hauptnavigation">
            <a href="/">Dashboard</a>
            <a href="/radar">Radar</a>
            <a href="/kader-check">Kader-Check</a>
          </nav>
          <div class="absolute inset-0 has-[.liquid-nav]:static">
            <Nav client:only="react" currentPath={currentPath} />
          </div>
        </div>
      </header>
      <main class="flex-1 space-y-8">
        <slot />
      </main>
      <footer class="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
        Daten: OpenLigaDB (ODbL)
      </footer>
    </div>
  </body>
</html>
```

CSS in `global.css` ergänzen, damit der Fallback verschwindet sobald `.liquid-nav` existiert:

```css
body:has(.liquid-nav) .nav-fallback {
  display: none;
}
```

Falls `has-[.liquid-nav]:static` das Overlay zerlegt: Fallback `aria-hidden="true"` lassen und nach Hydration per CSS `display:none`. Die drei Links müssen vor JS sichtbar sein.

- [ ] **Step 3: Nav-Insel**

`web/src/components/Nav.tsx`:

```tsx
import { Liquid } from "liquid-gooey";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/radar", label: "Radar" },
  { href: "/kader-check", label: "Kader-Check" },
] as const;

type Props = { currentPath: string };

export default function Nav({ currentPath }: Props) {
  return (
    <nav className="liquid-nav" aria-label="Hauptnavigation">
      <Liquid
        fill="var(--card)"
        blur={8}
        contrast={18}
        className="flex items-center gap-1 rounded-full p-1"
        shadow="0 2px 8px rgba(0,0,0,.35)"
      >
        {links.map((link) => {
          const active = currentPath === link.href;
          return (
            <Liquid.Item key={link.href} morph={{ shape: true }} transition="bouncy">
              <a
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="bg-transparent px-4 py-2 text-sm text-foreground no-underline"
                style={{ fontWeight: active ? 600 : 400 }}
              >
                {link.label}
              </a>
            </Liquid.Item>
          );
        })}
      </Liquid>
    </nav>
  );
}
```

Keine opaken Background-Klassen auf den `<a>`. Wenn die installierte `liquid-gooey`-API `className` auf `Liquid` nicht kennt: Wrapper-`div` mit `flex` um die Items, Group-Props laut `node_modules/liquid-gooey` README (`fill`, `blur`, `contrast`, `shadow`).

- [ ] **Step 4: Drei Seiten als Platzhalter**

`web/src/pages/index.astro`:

```astro
---
import Shell from "../layouts/Shell.astro";
---
<Shell title="Dashboard">
  <h1 class="font-[Syne] text-3xl">Dashboard</h1>
</Shell>
```

`web/src/pages/radar.astro`:

```astro
---
import Shell from "../layouts/Shell.astro";
---
<Shell title="Spieler-Radar">
  <h1 class="font-[Syne] text-3xl">Spieler-Radar</h1>
</Shell>
```

`web/src/pages/kader-check.astro`:

```astro
---
import Shell from "../layouts/Shell.astro";
---
<Shell title="Kader-Check vor Spieltag-Deadline">
  <h1 class="font-[Syne] text-3xl">Kader-Check vor Spieltag-Deadline</h1>
</Shell>
```

Kein Login, keine Dialoge.

- [ ] **Step 5: Manuell prüfen, Tests unverändert**

```bash
cd web && npm test
cd web && npm run dev
```

Browser: `/`, `/radar`, `/kader-check` — Nav-Fallback kurz, dann Gooey-Pills. Footer sichtbar. Kein Directus nötig.

Expected: `npm test` PASS.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: Astro-Shell mit Gooey-Navigation und drei Routen

EOF
)"
```

---

### Task 4: Dashboard mit echten Spielen, Deadline und Leerzuständen

**Files:**
- Create: `web/src/lib/countdown.ts`
- Create: `web/tests/lib/countdown.test.ts`
- Create: `web/src/components/DeadlineCountdown.tsx`
- Create: `web/src/components/MatchList.astro`
- Modify: `web/src/pages/index.astro`

**Interfaces:**
- Consumes: `listFixtures`, `getNextMatchday`, shadcn `Card`/`CardHeader`/`CardTitle`/`CardContent`.
- Produces: `export function formatDeadlineRemaining(deadline: Date, now: Date): string`. Index-Seite mapped `FixtureLoadResult` auf Copy. Countdown-Insel nur wenn `deadline` gesetzt und `seasonOver === false`.

`formatDeadlineRemaining`: `ms <= 0` → `"läuft"`. Sonst ganze Tage/Stunden/Minuten, deutsch: bei Tagen `in ${days} Tag(en), ${hours} Std.`; sonst bei Stunden `in ${hours} Std., ${mins} Min.`; sonst `in ${mins} Min.`. `1 Tag` ohne „en“.

Datumsanzeige in der Spiel-Liste: `Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })`.

- [ ] **Step 1: Failing Countdown-Tests**

`web/tests/lib/countdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDeadlineRemaining } from "../../src/lib/countdown.ts";

describe("formatDeadlineRemaining", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("returns läuft when the deadline is not in the future", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-21T11:00:00.000Z"), now)).toBe("läuft");
  });

  it("formats minutes only", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-21T12:09:00.000Z"), now)).toBe("in 9 Min.");
  });

  it("formats hours and minutes", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-21T14:10:00.000Z"), now)).toBe(
      "in 2 Std., 10 Min.",
    );
  });

  it("formats a single day without plural en", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-22T14:00:00.000Z"), now)).toBe(
      "in 1 Tag, 2 Std.",
    );
  });
});
```

- [ ] **Step 2: Fail, dann `countdown.ts`**

```bash
cd web && npx vitest run tests/lib/countdown.test.ts
```

Expected: FAIL.

`web/src/lib/countdown.ts`:

```ts
export function formatDeadlineRemaining(deadline: Date, now: Date): string {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "läuft";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) {
    const dayLabel = days === 1 ? "Tag" : "Tagen";
    return `in ${days} ${dayLabel}, ${hours} Std.`;
  }
  if (hours > 0) return `in ${hours} Std., ${mins} Min.`;
  return `in ${mins} Min.`;
}
```

```bash
cd web && npx vitest run tests/lib/countdown.test.ts
```

Expected: PASS.

- [ ] **Step 3: MatchList und Countdown-Insel**

`web/src/components/MatchList.astro`:

```astro
---
import type { FixtureRecord } from "../lib/fixtures.ts";

interface Props {
  spieltag: number;
  fixtures: FixtureRecord[];
}
const { spieltag, fixtures } = Astro.props;
const fmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
---
<section class="space-y-3">
  <h2 class="font-[Syne] text-xl">Nächste Spiele · Spieltag {spieltag}</h2>
  <ul class="divide-y divide-border rounded-lg border border-border">
    {fixtures.map((match) => (
      <li class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {match.heim_verein}
          <span class="text-muted-foreground"> – </span>
          {match.auswaerts_verein}
        </span>
        <time class="text-sm text-muted-foreground" datetime={match.datum}>
          {fmt.format(new Date(match.datum))}
        </time>
      </li>
    ))}
  </ul>
</section>
```

`web/src/components/DeadlineCountdown.tsx`:

```tsx
import { useEffect, useState } from "react";
import { formatDeadlineRemaining } from "../lib/countdown.ts";

type Props = { deadlineIso: string };

export default function DeadlineCountdown({ deadlineIso }: Props) {
  const deadline = new Date(deadlineIso);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className="font-[Syne] text-2xl tabular-nums">{formatDeadlineRemaining(deadline, now)}</p>
  );
}
```

Nur einbinden, wenn eine Deadline existiert. `client:load`.

- [ ] **Step 4: Index-Seite verdrahten**

`web/src/pages/index.astro` Frontmatter lädt Directus, fängt nichts mit uncaught throw (Loader gibt Result zurück). Token/URL aus `astro:env/server`.

Logik:

```ts
import { DIRECTUS_TOKEN, DIRECTUS_URL } from "astro:env/server";
import { listFixtures } from "../lib/directus.ts";
import { getNextMatchday } from "../lib/fixtures.ts";

const load = await listFixtures({
  url: DIRECTUS_URL,
  token: DIRECTUS_TOKEN ?? "",
});

const scheduleError =
  !load.ok && load.reason === "missing_token"
    ? "`DIRECTUS_TOKEN` in `web/.env` setzen."
    : !load.ok
      ? "Directus nicht erreichbar. In `directus/` `docker compose up -d`."
      : load.ok && load.fixtures.length === 0
        ? "Noch kein Spielplan. Im Ordner `scraper/` `npm run sync:openligadb`."
        : null;

const matchday =
  load.ok && load.fixtures.length > 0 ? getNextMatchday(load.fixtures, new Date()) : null;
```

Backticks in der Token-Copy in der Astro-Datei als normale Zeichen, nicht als Markdown. Die sichtbare UI-Zeichenkette ist exakt: `` `DIRECTUS_TOKEN` in `web/.env` setzen. ``

Layout der Seite:

1. `h1` Dashboard.
2. Drei `Card`s im Grid `md:grid-cols-3`:
   - Budget übrig → EmptyState-Body „Noch keine Kadereingabe“.
   - Kaderwert → dieselbe Copy.
   - Nächste Deadline → wenn `scheduleError`: derselbe Fehlertext wie der Spielplan; wenn `matchday.seasonOver`: „Saison vorbei“; wenn `matchday.deadline`: `<DeadlineCountdown client:load deadlineIso={matchday.deadline.toISOString()} />`; sonst der `scheduleError`.
3. Block Nächste Spiele: bei `scheduleError` EmptyState mit diesem Text; sonst `<MatchList spieltag={matchday.spieltag} fixtures={matchday.fixtures} />`.
4. Block Kader-Check: EmptyState „Sobald Spieler im Kader und Verfügbarkeit gepflegt sind, erscheinen Warnungen hier.“
5. Block Top-Signale: EmptyState „Kauf-/Verkaufssignale brauchen Noten und Marktwerte.“ plus `<a href="/radar">Zum Spieler-Radar</a>`.

Kein Dummy-Eurobetrag. Kein Gooey auf den Karten. Seite darf bei Directus-Down nicht 500 sein.

`DIRECTUS_TOKEN` optional: wenn `astro:env` den Import ohne Default zur Build-Zeit ablehnt, `import { getSecret } from "astro:env/server"` nutzen oder `typeof DIRECTUS_TOKEN === "undefined" ? "" : DIRECTUS_TOKEN`. Entscheidend: Dev-Server startet ohne `.env`.

- [ ] **Step 5: Tests und typecheck**

```bash
cd web && npm test
```

Expected: alle bisherigen Tests PASS. `astro check` PASS.

Ohne Token: `npm run dev`, `/` zeigt Token-Copy in Deadline- und Spielplan-Karte, Nav bleibt. Mit Token+Directus+Fixtures: echte Vereinsnamen.

- [ ] **Step 6: Commit**

```bash
git add web/src web/tests
git commit -m "$(cat <<'EOF'
feat: Dashboard zeigt Spielplan und Deadline aus Directus

EOF
)"
```

---

### Task 5: Radar- und Kader-Check-Stubs, README, Live-Check

**Files:**
- Create: `web/src/components/RadarFilters.tsx`
- Modify: `web/src/pages/radar.astro`
- Modify: `web/src/pages/kader-check.astro`
- Create: `web/README.md`

**Interfaces:**
- Consumes: `Liquid` / `Liquid.Item` wie die Nav; `EmptyState`; `Badge`.
- Produces: Radar-Seite mit disabled Gooey-Chips (Position, Preis, „Nur mein Kader“) ohne Filterlogik; Tabelle Spalten Spieler, Marktwert, Form, nächste 3 Gegner, Empfehlung; eine Leerzeile „Noch keine Spielerdaten.“. Kader-Check-Seite: leere Alert-Liste, Copy wie Dashboard plus Legende rot = „Startet nicht“, amber = „Unsicher, prüfen“ / „Wenig Spielzeit zuletzt“. Keine Dummy-Spieler.

- [ ] **Step 1: RadarFilters**

`web/src/components/RadarFilters.tsx`:

```tsx
import { Liquid } from "liquid-gooey";

const chips = ["Position", "Preis", "Nur mein Kader"] as const;

export default function RadarFilters() {
  return (
    <Liquid fill="var(--card)" blur={8} contrast={18} className="flex flex-wrap gap-1 p-1">
      {chips.map((label) => (
        <Liquid.Item key={label} transition="bouncy">
          <button
            type="button"
            disabled
            className="bg-transparent px-3 py-1.5 text-sm text-muted-foreground"
          >
            {label}
          </button>
        </Liquid.Item>
      ))}
    </Liquid>
  );
}
```

`client:only="react"` auf der Radar-Seite. `disabled` verhindert Klicks; keine `onClick`-Filter.

- [ ] **Step 2: Radar-Seite**

`web/src/pages/radar.astro`:

```astro
---
import Shell from "../layouts/Shell.astro";
import RadarFilters from "../components/RadarFilters.tsx";
---
<Shell title="Spieler-Radar">
  <h1 class="font-[Syne] text-3xl">Spieler-Radar</h1>
  <RadarFilters client:only="react" />
  <table class="mt-6 w-full text-left text-sm">
    <caption class="sr-only">Spieler-Radar, noch ohne Daten</caption>
    <thead>
      <tr class="border-b border-border text-muted-foreground">
        <th class="py-2 pr-3 font-medium">Spieler</th>
        <th class="py-2 pr-3 font-medium">Marktwert</th>
        <th class="py-2 pr-3 font-medium">Form</th>
        <th class="py-2 pr-3 font-medium">nächste 3 Gegner</th>
        <th class="py-2 font-medium">Empfehlung</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="py-6 text-muted-foreground" colspan="5">Noch keine Spielerdaten.</td>
      </tr>
    </tbody>
  </table>
</Shell>
```

Semantisches `<table>`, keine Data-Table-Library, kein Gooey auf der Tabelle.

- [ ] **Step 3: Kader-Check-Seite**

```astro
---
import Shell from "../layouts/Shell.astro";
import EmptyState from "../components/EmptyState.astro";
import { Badge } from "../components/ui/badge.tsx";
---
<Shell title="Kader-Check vor Spieltag-Deadline">
  <h1 class="font-[Syne] text-3xl">Kader-Check vor Spieltag-Deadline</h1>
  <p class="text-sm text-muted-foreground">
    Später: <Badge variant="destructive">Startet nicht</Badge>
    bei Verletzung oder Sperre,
    <Badge variant="secondary">Unsicher, prüfen</Badge>
    / wenig Spielzeit zuletzt in Amber. Keine Dummy-Warnungen.
  </p>
  <ul aria-label="Kader-Warnungen" class="mt-4"></ul>
  <EmptyState body="Sobald Spieler im Kader und Verfügbarkeit gepflegt sind, erscheinen Warnungen hier." />
</Shell>
```

Wenn shadcn-`Badge` kein Amber-Variant hat: `className` mit amber-Token, nicht eine erfundene Spielerzeile. `variant="secondary"` nur wenn der Default zu grau ist — Amber-Farbe setzen (`bg-amber-500/20 text-amber-200` o. ä.).

- [ ] **Step 4: `web/README.md`**

Inhalt (vollständig so schreiben):

```markdown
# Comunio Assistant — Web

Astro-UI für Dashboard, Spieler-Radar (Stub) und Kader-Check (Stub). Spielplan kommt aus Directus-`Fixture` (OpenLigaDB, ODbL).

## Voraussetzung

Directus lokal: in `directus/` `docker compose up -d` (siehe `directus/README.md`). Spielplan füllen: in `scraper/` `npm run sync:openligadb`.

## Start

1. Static Token in Directus anlegen (Settings → Access Tokens), Rechte auf `Fixture` lesen.
2. `cp .env.example .env` und `DIRECTUS_TOKEN` setzen.
3. `npm install`
4. `npm run dev` → http://localhost:4321

Ohne Token startet die App trotzdem; Deadline und Spielplan zeigen den Hinweis, `DIRECTUS_TOKEN` in `web/.env` zu setzen.

## Tests

`npm test` — Ableitung und Directus-Client gegen Fixtures/Mocks, kein Live-Directus.
```

- [ ] **Step 5: Live-Verifikation (nicht in CI)**

```bash
cd web && npm test
cd web && npm run dev
```

Checkliste:

- `/` ohne `.env`: Token-Copy, keine 500, Nav + Stubs gehen.
- `/` mit Token, Directus aus: Directus-Copy + `docker compose`-Hinweis.
- `/` mit Directus + 306 Fixtures: echte Vereinsnamen, Countdown oder „Saison vorbei“, drei Metric-Karten ohne Fake-Euro.
- `/radar`: disabled Chips, Leerzeile „Noch keine Spielerdaten.“
- `/kader-check`: leere Liste, Spec-Copy.
- Footer überall: „Daten: OpenLigaDB (ODbL)“.

Expected: `npm test` PASS. Dev-Server auf 4321.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "$(cat <<'EOF'
feat: Radar- und Kader-Check-Stubs plus Web-README

EOF
)"
```

---

## Spec-Abdeckung (Selbstcheck)

| Spec-Anforderung | Task |
|---|---|
| `web/` Astro + React + Tailwind + shadcn | 1, 3 |
| Routen `/`, `/radar`, `/kader-check` | 3, 5 |
| Nav Gooey Morph + Fallback | 3 |
| Directus nur Server, Token `.env` | 2, 4 |
| Nur Collection `Fixture`, `limit=-1` | 2 |
| Deadline-Proxy + nächster Spieltag | 1, 4 |
| Fehler/Leer Copy verbatim | 4, 5 |
| Budget/Kaderwert leer, kein Dummy | 4 |
| Radar-Spalten + disabled Chips | 5 |
| Kader-Check leere Alerts + Badge-Farben | 5 |
| Tests frozen JSON, kein Live-Directus | 1, 2, 4 |
| Kein Deploy, kein Scraper, kein season-Feld | — nicht im Plan |
| `npm run dev` :4321 | 3–5 |
