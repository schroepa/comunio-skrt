# Datenpipeline Phase 2 (OpenLigaDB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein lokal per CLI startbares `openligadb`-Modul, das den Bundesliga-Spielplan einer Saison von der OpenLigaDB-REST-API holt, plausibilisiert und in die Directus-Collection `Fixture` schreibt — inklusive `ScrapeLog`-Eintrag (`success`/`failed`).

**Architecture:** Eigenständiges Node/TypeScript-Paket unter `scraper/`. Gemeinsame Bausteine (`shared/`: HTTP-Client mit Datei-Cache und Mindestabstand, Directus-REST-Client, ScrapeLog-Writer) werden so geschnitten, dass Phase 3/4 (`transfermarkt`, `kicker`) sie unverändert wiederverwenden. Das OpenLigaDB-Modul selbst ist rein: JSON parsen → Fixture-Records bauen → Menge prüfen → upserten. Kein Scraping, kein Cron, kein CSV in dieser Phase. Quelle: `GET https://api.openligadb.de/getmatchdata/{league}/{season}` (eine Anfrage für die ganze Saison, nicht spieltagweise).

**Tech Stack:** Node.js 22+, TypeScript (ESM, `NodeNext`), Vitest, `tsx` als Runner, natives `fetch`. Keine HTTP-Library, kein ORM. Directus 12 lokal auf `http://localhost:8055` (Phase 1).

**Spec:** `docs/spec-datenpipeline.md` (Bauplan Phase 2, Abschnitte Architektur / Fehlerbehandlung & Caching / Testing). Feldnamen aus `CLAUDE.md` und `directus/schema/snapshot.yaml`.

## Global Constraints

- Feldnamen der Directus-Collections verbatim: `Fixture` = `spieltag`, `heim_verein`, `auswaerts_verein`, `datum`; `ScrapeLog` = `quelle`, `zeitstempel`, `status` (`success`/`failed`), `fehlermeldung`.
- OpenLigaDB-Vereinsnamen (`team1.teamName` / `team2.teamName`) unverändert in `heim_verein`/`auswaerts_verein` speichern. Kein Mapping auf Transfermarkt-Namen in dieser Phase.
- Parser-Tests laufen ausschließlich gegen eingefrorene JSON-Fixtures, nie gegen die Live-API.
- Bei fehlgeschlagener Plausibilitätsprüfung oder HTTP-Fehler: keine Writes nach `Fixture`, trotzdem `ScrapeLog` mit `status: failed` und `fehlermeldung`.
- Geheimnisse nicht committen: `scraper/.env` und `scraper/.cache/` gehören in `.gitignore`.
- Außerhalb des Scopes: `transfermarkt/`- und `kicker/`-Module, CSV-Import, Vercel-Cron, Ergebnisse/Tore (kein Feld in `Fixture`).
- ODbL: README muss OpenLigaDB als Datenquelle nennen.

## File Structure

```
scraper/
  package.json
  tsconfig.json
  vitest.config.ts
  .env.example
  README.md
  src/
    shared/
      logger.ts            # dünne console-Hülle
      http-client.ts       # GET JSON + Datei-Cache + Mindestabstand
      directus-client.ts   # Login, list/create/update Items
      scrape-log.ts        # writeScrapeLog(directus, entry)
    openligadb/
      parse.ts             # OpenLigaDB-JSON → ParsedFixture[]
      validate.ts          # Plausibilitätsprüfung der Menge
      sync.ts              # Orchestrierung fetch → parse → validate → upsert → log
      run.ts               # CLI-Entry (liest Env, ruft sync auf)
  tests/
    fixtures/
      openligadb-matchday1-excerpt.json
    shared/
      http-client.test.ts
      directus-client.test.ts
    openligadb/
      parse.test.ts
      validate.test.ts
      sync.test.ts
```

Modify: `.gitignore` (Root) um `scraper/.env` und `scraper/.cache/`.

---

### Task 1: Scraper-Paket und HTTP-Client mit Datei-Cache

**Files:**
- Create: `scraper/package.json`
- Create: `scraper/tsconfig.json`
- Create: `scraper/vitest.config.ts`
- Create: `scraper/.env.example`
- Create: `scraper/src/shared/logger.ts`
- Create: `scraper/src/shared/http-client.ts`
- Create: `scraper/tests/shared/http-client.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nichts (erstes Anwendungspaket im Repo).
- Produces: `createHttpClient(options: HttpClientOptions): HttpClient` mit `getJson<T>(url: string): Promise<T>`. `HttpClientOptions` = `{ cacheDir: string, ttlMs: number, minDelayMs: number, userAgent: string, fetchImpl?: typeof fetch, now?: () => number, sleep?: (ms: number) => Promise<void> }`. Cache-Datei pro URL: SHA-256(url) als Hex + `.json`, Inhalt `{ storedAt: number, body: unknown }`. Bei Cache-Treffer (now − storedAt < ttlMs) kein `fetch`. Bei Cache-Miss: Mindestabstand `minDelayMs` seit dem letzten Live-Request, dann `fetch` mit Header `User-Agent` und `Accept: application/json`. Non-2xx wirft `Error` mit Statuscode. Default-UA: `comunio-helper/0.1 (private)`.

- [ ] **Step 1: `scraper/`-Paket anlegen**

`scraper/package.json`:

```json
{
  "name": "comunio-helper-scraper",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "sync:openligadb": "tsx --env-file=.env src/openligadb/run.ts"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

`scraper/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

`scraper/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

`scraper/.env.example`:

```env
DIRECTUS_URL=http://localhost:8055
DIRECTUS_EMAIL=admin@comunio.dev
DIRECTUS_PASSWORD=replace-with-strong-password
OPENLIGADB_LEAGUE=bl1
OPENLIGADB_SEASON=2026
```

In Root-`.gitignore` ergänzen:

```
scraper/.env
scraper/.cache/
```

- [ ] **Step 2: Abhängigkeiten installieren**

```bash
cd scraper
npm install
```

Expected: `scraper/node_modules/` und `scraper/package-lock.json` existieren.

- [ ] **Step 3: Failing Test für HTTP-Client schreiben**

`scraper/src/shared/logger.ts` (minimal, damit Imports nicht blockieren):

```ts
export const log = {
  info(message: string, extra?: unknown) {
    if (extra === undefined) console.log(message);
    else console.log(message, extra);
  },
  error(message: string, extra?: unknown) {
    if (extra === undefined) console.error(message);
    else console.error(message, extra);
  },
};
```

`scraper/tests/shared/http-client.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpClient } from "../../src/shared/http-client.ts";

function cacheName(url: string) {
  return createHash("sha256").update(url).digest("hex") + ".json";
}

describe("createHttpClient", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function setup() {
    dir = await mkdtemp(join(tmpdir(), "http-cache-"));
  }

  it("fetches JSON on cache miss and writes the cache file", async () => {
    await setup();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createHttpClient({
      cacheDir: dir,
      ttlMs: 60_000,
      minDelayMs: 0,
      userAgent: "test-agent",
      fetchImpl,
      now: () => 1_000,
    });

    const body = await client.getJson<{ ok: boolean }>("https://example.test/data");
    expect(body).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const request = fetchImpl.mock.calls[0][0] as Request;
    expect(request.headers.get("User-Agent")).toBe("test-agent");
    expect(request.headers.get("Accept")).toBe("application/json");

    const raw = await readFile(join(dir, cacheName("https://example.test/data")), "utf8");
    expect(JSON.parse(raw)).toEqual({ storedAt: 1_000, body: { ok: true } });
  });

  it("returns cached JSON within TTL without calling fetch", async () => {
    await setup();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ n: 1 }), { status: 200 }),
    );
    let now = 1_000;
    const client = createHttpClient({
      cacheDir: dir,
      ttlMs: 60_000,
      minDelayMs: 0,
      userAgent: "test-agent",
      fetchImpl,
      now: () => now,
    });

    await client.getJson("https://example.test/data");
    now = 30_000;
    const second = await client.getJson<{ n: number }>("https://example.test/data");
    expect(second).toEqual({ n: 1 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("refetches after TTL expires", async () => {
    await setup();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ n: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ n: 2 }), { status: 200 }));
    let now = 1_000;
    const client = createHttpClient({
      cacheDir: dir,
      ttlMs: 60_000,
      minDelayMs: 0,
      userAgent: "test-agent",
      fetchImpl,
      now: () => now,
    });

    await client.getJson("https://example.test/data");
    now = 61_001;
    const second = await client.getJson<{ n: number }>("https://example.test/data");
    expect(second).toEqual({ n: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws on non-2xx without writing cache", async () => {
    await setup();
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 403 }));
    const client = createHttpClient({
      cacheDir: dir,
      ttlMs: 60_000,
      minDelayMs: 0,
      userAgent: "test-agent",
      fetchImpl,
      now: () => 1_000,
    });

    await expect(client.getJson("https://example.test/data")).rejects.toThrow(/403/);
    await expect(
      readFile(join(dir, cacheName("https://example.test/data"))),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("waits minDelayMs between live requests", async () => {
    await setup();
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    let now = 10_000;
    const client = createHttpClient({
      cacheDir: dir,
      ttlMs: 0,
      minDelayMs: 250,
      userAgent: "test-agent",
      fetchImpl,
      now: () => now,
      sleep,
    });

    await client.getJson("https://example.test/a");
    now = 10_100;
    await client.getJson("https://example.test/b");
    expect(sleep).toHaveBeenCalledWith(150);
  });
});
```

- [ ] **Step 4: Test ausführen, Expected FAIL**

```bash
cd scraper
npm test
```

Expected: FAIL, Modul `../../src/shared/http-client.ts` nicht gefunden bzw. `createHttpClient` is not a function.

- [ ] **Step 5: HTTP-Client implementieren**

`scraper/src/shared/http-client.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type HttpClient = {
  getJson<T>(url: string): Promise<T>;
};

export type HttpClientOptions = {
  cacheDir: string;
  ttlMs: number;
  minDelayMs: number;
  userAgent: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

function cachePath(cacheDir: string, url: string) {
  const hash = createHash("sha256").update(url).digest("hex");
  return join(cacheDir, `${hash}.json`);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  let lastLiveAt = 0;

  return {
    async getJson<T>(url: string): Promise<T> {
      await mkdir(options.cacheDir, { recursive: true });
      const file = cachePath(options.cacheDir, url);
      try {
        const cached = JSON.parse(await readFile(file, "utf8")) as {
          storedAt: number;
          body: T;
        };
        if (now() - cached.storedAt < options.ttlMs) return cached.body;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          /* corrupt cache: fall through to live fetch */
        }
      }

      const wait = lastLiveAt + options.minDelayMs - now();
      if (wait > 0) await sleep(wait);

      const response = await fetchImpl(
        new Request(url, {
          headers: {
            "User-Agent": options.userAgent,
            Accept: "application/json",
          },
        }),
      );
      lastLiveAt = now();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const body = (await response.json()) as T;
      await writeFile(file, JSON.stringify({ storedAt: now(), body }), "utf8");
      return body;
    },
  };
}
```

- [ ] **Step 6: Tests erneut ausführen**

```bash
cd scraper
npm test
```

Expected: PASS, alle fünf HTTP-Client-Tests grün.

- [ ] **Step 7: Commit**

```bash
git add .gitignore scraper/package.json scraper/package-lock.json scraper/tsconfig.json scraper/vitest.config.ts scraper/.env.example scraper/src/shared/logger.ts scraper/src/shared/http-client.ts scraper/tests/shared/http-client.test.ts
git commit -m "$(cat <<'EOF'
feat: HTTP-Client mit Datei-Cache für das Scraper-Paket

Grundlage für alle Quellen-Module: gecachte GETs, Mindestabstand zwischen Live-Requests.
EOF
)"
```

---

### Task 2: Directus-REST-Client und ScrapeLog-Writer

**Files:**
- Create: `scraper/src/shared/directus-client.ts`
- Create: `scraper/src/shared/scrape-log.ts`
- Create: `scraper/tests/shared/directus-client.test.ts`

**Interfaces:**
- Consumes: natives `fetch` (nicht den HTTP-Cache-Client — Directus-Writes dürfen nicht gecacht werden).
- Produces:
  - `createDirectusClient(options: { baseUrl: string, email: string, password: string, fetchImpl?: typeof fetch }): DirectusClient`
  - `DirectusClient.login(): Promise<void>` — `POST {baseUrl}/auth/login` mit `{ email, password }`, speichert `data.access_token`.
  - `DirectusClient.listItems<T>(collection: string, query?: Record<string, string>): Promise<T[]>` — `GET {baseUrl}/items/{collection}?…`, Authorization Bearer, liest `data`.
  - `DirectusClient.createItem<T>(collection: string, payload: object): Promise<T>` — `POST {baseUrl}/items/{collection}`.
  - `DirectusClient.updateItem<T>(collection: string, id: number, payload: object): Promise<T>` — `PATCH {baseUrl}/items/{collection}/{id}`.
  - `writeScrapeLog(client: DirectusClient, entry: { quelle: string, status: "success" | "failed", fehlermeldung?: string | null, now?: Date }): Promise<void>` — `createItem("ScrapeLog", { quelle, zeitstempel: now.toISOString().slice(0, 19), status, fehlermeldung: fehlermeldung ?? null })`. `zeitstempel` als `YYYY-MM-DDTHH:mm:ss` ohne `Z` (gleiches Format wie Phase-1-Testdaten).

- [ ] **Step 1: Failing Tests schreiben**

`scraper/tests/shared/directus-client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createDirectusClient } from "../../src/shared/directus-client.ts";
import { writeScrapeLog } from "../../src/shared/scrape-log.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createDirectusClient", () => {
  it("logs in and sends Bearer token on subsequent item calls", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) {
        return jsonResponse({ data: { access_token: "tok-1" } });
      }
      if (url.includes("/items/Fixture") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ data: [{ id: 1, spieltag: 1 }] });
      }
      throw new Error(`unexpected ${init?.method} ${url}`);
    });

    const client = createDirectusClient({
      baseUrl: "http://localhost:8055",
      email: "admin@comunio.dev",
      password: "secret",
      fetchImpl,
    });
    await client.login();
    const items = await client.listItems("Fixture", { limit: "-1" });
    expect(items).toEqual([{ id: 1, spieltag: 1 }]);

    const loginCall = fetchImpl.mock.calls[0];
    expect(String(loginCall[0])).toBe("http://localhost:8055/auth/login");
    expect(JSON.parse(String(loginCall[1]?.body))).toEqual({
      email: "admin@comunio.dev",
      password: "secret",
    });

    const listInit = fetchImpl.mock.calls[1][1];
    expect(listInit?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer tok-1" }),
    );
  });

  it("createItem POSTs payload and returns data", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/auth/login")) {
        return jsonResponse({ data: { access_token: "tok-1" } });
      }
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ spieltag: 1, heim_verein: "A" });
      return jsonResponse({ data: { id: 9, spieltag: 1, heim_verein: "A" } });
    });
    const client = createDirectusClient({
      baseUrl: "http://localhost:8055",
      email: "a@b.dev",
      password: "x",
      fetchImpl,
    });
    await client.login();
    const created = await client.createItem("Fixture", { spieltag: 1, heim_verein: "A" });
    expect(created).toEqual({ id: 9, spieltag: 1, heim_verein: "A" });
  });

  it("updateItem PATCHes by id", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/auth/login")) {
        return jsonResponse({ data: { access_token: "tok-1" } });
      }
      expect(String(input)).toBe("http://localhost:8055/items/Fixture/4");
      expect(init?.method).toBe("PATCH");
      return jsonResponse({ data: { id: 4, spieltag: 2 } });
    });
    const client = createDirectusClient({
      baseUrl: "http://localhost:8055",
      email: "a@b.dev",
      password: "x",
      fetchImpl,
    });
    await client.login();
    const updated = await client.updateItem("Fixture", 4, { spieltag: 2 });
    expect(updated).toEqual({ id: 4, spieltag: 2 });
  });

  it("throws when login fails", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ errors: [{ message: "Invalid" }] }, 401));
    const client = createDirectusClient({
      baseUrl: "http://localhost:8055",
      email: "a@b.dev",
      password: "bad",
      fetchImpl,
    });
    await expect(client.login()).rejects.toThrow(/401/);
  });
});

describe("writeScrapeLog", () => {
  it("creates a ScrapeLog item with sliced timestamp", async () => {
    const createItem = vi.fn(async () => ({ id: 1 }));
    const client = { createItem } as unknown as Parameters<typeof writeScrapeLog>[0];
    await writeScrapeLog(client, {
      quelle: "openligadb",
      status: "failed",
      fehlermeldung: "HTTP 403",
      now: new Date("2026-08-21T09:15:30.123Z"),
    });
    expect(createItem).toHaveBeenCalledWith("ScrapeLog", {
      quelle: "openligadb",
      zeitstempel: "2026-08-21T09:15:30",
      status: "failed",
      fehlermeldung: "HTTP 403",
    });
  });
});
```

- [ ] **Step 2: Tests ausführen, Expected FAIL**

```bash
cd scraper
npm test
```

Expected: FAIL, `directus-client.ts` / `scrape-log.ts` nicht gefunden.

- [ ] **Step 3: Client und Writer implementieren**

`scraper/src/shared/directus-client.ts`:

```ts
export type DirectusClient = {
  login(): Promise<void>;
  listItems<T>(collection: string, query?: Record<string, string>): Promise<T[]>;
  createItem<T>(collection: string, payload: object): Promise<T>;
  updateItem<T>(collection: string, id: number, payload: object): Promise<T>;
};

export type DirectusClientOptions = {
  baseUrl: string;
  email: string;
  password: string;
  fetchImpl?: typeof fetch;
};

export function createDirectusClient(options: DirectusClientOptions): DirectusClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  let token: string | null = null;

  async function request(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new Error(`Directus HTTP ${response.status} for ${init.method ?? "GET"} ${path}`);
    }
    return response.json() as Promise<{ data: unknown }>;
  }

  return {
    async login() {
      const body = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: options.email, password: options.password }),
      });
      const data = body.data as { access_token: string };
      token = data.access_token;
    },
    async listItems<T>(collection: string, query: Record<string, string> = {}) {
      const params = new URLSearchParams(query);
      const qs = params.toString();
      const body = await request(`/items/${collection}${qs ? `?${qs}` : ""}`);
      return body.data as T[];
    },
    async createItem<T>(collection: string, payload: object) {
      const body = await request(`/items/${collection}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return body.data as T;
    },
    async updateItem<T>(collection: string, id: number, payload: object) {
      const body = await request(`/items/${collection}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return body.data as T;
    },
  };
}
```

`scraper/src/shared/scrape-log.ts`:

```ts
import type { DirectusClient } from "./directus-client.ts";

export type ScrapeLogStatus = "success" | "failed";

export type ScrapeLogEntry = {
  quelle: string;
  status: ScrapeLogStatus;
  fehlermeldung?: string | null;
  now?: Date;
};

function formatTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19);
}

export async function writeScrapeLog(client: DirectusClient, entry: ScrapeLogEntry) {
  await client.createItem("ScrapeLog", {
    quelle: entry.quelle,
    zeitstempel: formatTimestamp(entry.now ?? new Date()),
    status: entry.status,
    fehlermeldung: entry.fehlermeldung ?? null,
  });
}
```

- [ ] **Step 4: Tests erneut ausführen**

```bash
cd scraper
npm test
```

Expected: PASS, inkl. der neuen Directus-/ScrapeLog-Tests.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/shared/directus-client.ts scraper/src/shared/scrape-log.ts scraper/tests/shared/directus-client.test.ts
git commit -m "$(cat <<'EOF'
feat: Directus-REST-Client und ScrapeLog-Writer

Gemeinsame Schreibschicht für alle Quellen-Module, inkl. Login und Item-CRUD.
EOF
)"
```

---

### Task 3: OpenLigaDB-Parser und Plausibilitätsprüfung

**Files:**
- Create: `scraper/tests/fixtures/openligadb-matchday1-excerpt.json`
- Create: `scraper/src/openligadb/parse.ts`
- Create: `scraper/src/openligadb/validate.ts`
- Create: `scraper/tests/openligadb/parse.test.ts`
- Create: `scraper/tests/openligadb/validate.test.ts`

**Interfaces:**
- Consumes: OpenLigaDB-Match-JSON (Live-Shape, verifiziert 2026-08-21 gegen `GET https://api.openligadb.de/getmatchdata/bl1/2025/1`).
- Produces:
  - `export type ParsedFixture = { spieltag: number, heim_verein: string, auswaerts_verein: string, datum: string }`
  - `parseMatches(raw: unknown): ParsedFixture[]` — erwartet ein Array. Mapping: `group.groupOrderID` → `spieltag`, `team1.teamName` → `heim_verein`, `team2.teamName` → `auswaerts_verein`, `matchDateTime` → `datum` (unverändert, z. B. `2025-08-22T20:30:00`). Wirft, wenn `raw` kein Array ist oder ein Element `group.groupOrderID`, `team1.teamName`, `team2.teamName` oder `matchDateTime` fehlt/leer ist. Tore/`matchResults` werden ignoriert.
  - `validateFixtures(fixtures: ParsedFixture[]): { ok: true } | { ok: false, reason: string }` — Regeln:
    1. `fixtures.length` im Intervall **270–320** (volle Bundesliga-Saison = 34 × 9 = 306; Puffer für unvollständige Veröffentlichung / extra Relegation-Noise, aber 9er-Matchday-Responses werden abgelehnt).
    2. jedes `spieltag` ganzzahlig in **1–34**.
    3. `heim_verein !== auswaerts_verein` und beide nicht leer.
    4. `datum` matcht `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/`.
    5. keine Duplikate des Schlüssels `` `${spieltag}|${heim_verein}|${auswaerts_verein}` ``.

- [ ] **Step 1: Eingefrorenes JSON-Sample anlegen**

`scraper/tests/fixtures/openligadb-matchday1-excerpt.json` — zwei echte Matches, Tore gekürzt, Shape 1:1 wie die API:

```json
[
  {
    "matchID": 77256,
    "matchDateTime": "2025-08-22T20:30:00",
    "leagueSeason": 2025,
    "leagueShortcut": "bl1",
    "group": { "groupName": "1. Spieltag", "groupOrderID": 1, "groupID": 47611 },
    "team1": { "teamId": 40, "teamName": "FC Bayern München", "shortName": "Bayern" },
    "team2": { "teamId": 1635, "teamName": "RB Leipzig", "shortName": "Leipzig" },
    "matchIsFinished": true,
    "matchResults": [],
    "goals": []
  },
  {
    "matchID": 77257,
    "matchDateTime": "2025-08-23T15:30:00",
    "leagueSeason": 2025,
    "leagueShortcut": "bl1",
    "group": { "groupName": "1. Spieltag", "groupOrderID": 1, "groupID": 47611 },
    "team1": { "teamId": 6, "teamName": "Bayer 04 Leverkusen", "shortName": "Leverkusen" },
    "team2": { "teamId": 175, "teamName": "TSG Hoffenheim", "shortName": "Hoffenheim" },
    "matchIsFinished": true,
    "matchResults": [],
    "goals": []
  }
]
```

- [ ] **Step 2: Failing Parser- und Validator-Tests schreiben**

`scraper/tests/openligadb/parse.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMatches } from "../../src/openligadb/parse.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/openligadb-matchday1-excerpt.json",
);

describe("parseMatches", () => {
  it("maps frozen OpenLigaDB JSON onto Fixture fields", async () => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    expect(parseMatches(raw)).toEqual([
      {
        spieltag: 1,
        heim_verein: "FC Bayern München",
        auswaerts_verein: "RB Leipzig",
        datum: "2025-08-22T20:30:00",
      },
      {
        spieltag: 1,
        heim_verein: "Bayer 04 Leverkusen",
        auswaerts_verein: "TSG Hoffenheim",
        datum: "2025-08-23T15:30:00",
      },
    ]);
  });

  it("throws when the payload is not an array", () => {
    expect(() => parseMatches({ matchID: 1 })).toThrow(/array/i);
  });

  it("throws when a match is missing team1.teamName", () => {
    expect(() =>
      parseMatches([
        {
          matchDateTime: "2025-08-22T20:30:00",
          group: { groupOrderID: 1 },
          team1: { teamName: "" },
          team2: { teamName: "RB Leipzig" },
        },
      ]),
    ).toThrow(/teamName/);
  });
});
```

`scraper/tests/openligadb/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ParsedFixture } from "../../src/openligadb/parse.ts";
import { validateFixtures } from "../../src/openligadb/validate.ts";

function makeSeason(count: number): ParsedFixture[] {
  const fixtures: ParsedFixture[] = [];
  let n = 0;
  for (let spieltag = 1; spieltag <= 34 && n < count; spieltag++) {
    for (let i = 0; i < 9 && n < count; i++) {
      fixtures.push({
        spieltag,
        heim_verein: `Heim-${spieltag}-${i}`,
        auswaerts_verein: `Auswaerts-${spieltag}-${i}`,
        datum: "2025-08-22T15:30:00",
      });
      n++;
    }
  }
  return fixtures;
}

describe("validateFixtures", () => {
  it("accepts a full 306-match Bundesliga season", () => {
    expect(validateFixtures(makeSeason(306))).toEqual({ ok: true });
  });

  it("rejects a single matchday (9 matches)", () => {
    const result = validateFixtures(makeSeason(9));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/270/i);
  });

  it("rejects duplicate keys", () => {
    const fixtures = makeSeason(306);
    fixtures[1] = { ...fixtures[0] };
    const result = validateFixtures(fixtures);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/duplikat/i);
  });

  it("rejects spieltag outside 1–34", () => {
    const fixtures = makeSeason(306);
    fixtures[0] = { ...fixtures[0], spieltag: 35 };
    const result = validateFixtures(fixtures);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/spieltag/i);
  });
});
```

- [ ] **Step 3: Tests ausführen, Expected FAIL**

```bash
cd scraper
npm test
```

Expected: FAIL, `parse.ts` / `validate.ts` nicht gefunden.

- [ ] **Step 4: Parser und Validator implementieren**

`scraper/src/openligadb/parse.ts`:

```ts
export type ParsedFixture = {
  spieltag: number;
  heim_verein: string;
  auswaerts_verein: string;
  datum: string;
};

type OpenLigaMatch = {
  matchDateTime?: unknown;
  group?: { groupOrderID?: unknown };
  team1?: { teamName?: unknown };
  team2?: { teamName?: unknown };
};

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`OpenLigaDB match missing ${label}`);
  }
  return value;
}

export function parseMatches(raw: unknown): ParsedFixture[] {
  if (!Array.isArray(raw)) {
    throw new Error("OpenLigaDB payload is not an array");
  }
  return raw.map((item, index) => {
    const match = item as OpenLigaMatch;
    const spieltag = match.group?.groupOrderID;
    if (typeof spieltag !== "number") {
      throw new Error(`OpenLigaDB match[${index}] missing group.groupOrderID`);
    }
    return {
      spieltag,
      heim_verein: requiredString(match.team1?.teamName, "teamName"),
      auswaerts_verein: requiredString(match.team2?.teamName, "teamName"),
      datum: requiredString(match.matchDateTime, "matchDateTime"),
    };
  });
}
```

`scraper/src/openligadb/validate.ts`:

```ts
import type { ParsedFixture } from "./parse.ts";

export const MIN_SEASON_MATCHES = 270;
export const MAX_SEASON_MATCHES = 320;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const DATUM_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function validateFixtures(fixtures: ParsedFixture[]): ValidationResult {
  if (fixtures.length < MIN_SEASON_MATCHES || fixtures.length > MAX_SEASON_MATCHES) {
    return {
      ok: false,
      reason: `erwartete 270–320 Spiele, erhalten ${fixtures.length}`,
    };
  }

  const seen = new Set<string>();
  for (const fixture of fixtures) {
    if (!Number.isInteger(fixture.spieltag) || fixture.spieltag < 1 || fixture.spieltag > 34) {
      return { ok: false, reason: `spieltag außerhalb 1–34: ${fixture.spieltag}` };
    }
    if (!fixture.heim_verein || !fixture.auswaerts_verein) {
      return { ok: false, reason: "leerer Vereinsname" };
    }
    if (fixture.heim_verein === fixture.auswaerts_verein) {
      return { ok: false, reason: `heim und auswärts identisch: ${fixture.heim_verein}` };
    }
    if (!DATUM_RE.test(fixture.datum)) {
      return { ok: false, reason: `ungültiges datum: ${fixture.datum}` };
    }
    const key = `${fixture.spieltag}|${fixture.heim_verein}|${fixture.auswaerts_verein}`;
    if (seen.has(key)) {
      return { ok: false, reason: `duplikat: ${key}` };
    }
    seen.add(key);
  }
  return { ok: true };
}
```

- [ ] **Step 5: Tests erneut ausführen**

```bash
cd scraper
npm test
```

Expected: PASS, Parser- und Validator-Tests grün. Kein Live-HTTP.

- [ ] **Step 6: Commit**

```bash
git add scraper/tests/fixtures/openligadb-matchday1-excerpt.json scraper/src/openligadb/parse.ts scraper/src/openligadb/validate.ts scraper/tests/openligadb/parse.test.ts scraper/tests/openligadb/validate.test.ts
git commit -m "$(cat <<'EOF'
feat: OpenLigaDB-Parser und Plausibilitätsprüfung

Mappt API-JSON auf Fixture-Felder und lehnt unplausible Saisonmengen ab, bevor Directus beschrieben wird.
EOF
)"
```

---

### Task 4: Sync-Orchestrierung (Quelle → Fixture + ScrapeLog)

**Files:**
- Create: `scraper/src/openligadb/sync.ts`
- Create: `scraper/tests/openligadb/sync.test.ts`

**Interfaces:**
- Consumes: `HttpClient.getJson`, `DirectusClient` (`login` wird vom CLI erledigt, Sync erwartet einen bereits eingeloggten Client), `parseMatches`, `validateFixtures`, `writeScrapeLog`.
- Produces: `syncOpenLigaDb(deps: SyncDeps): Promise<SyncResult>`
  - `SyncDeps = { http: HttpClient, directus: DirectusClient, league: string, season: number, now?: Date }`
  - `SyncResult = { status: "success" | "failed", written: number, error?: string }`
  - URL: `` `https://api.openligadb.de/getmatchdata/${league}/${season}` ``
  - Ablauf:
    1. `http.getJson(url)` → bei Throw: `writeScrapeLog(..., failed, message)`, return `{ status: "failed", written: 0, error }`. **Keine** Fixture-Writes.
    2. `parseMatches` → gleicher Fehlerpfad.
    3. `validateFixtures` → bei `ok: false` gleicher Fehlerpfad.
    4. `directus.listItems("Fixture", { limit: "-1" })` einmal. Index-Map Schlüssel `` `${spieltag}|${heim_verein}|${auswaerts_verein}` ``. Directus default-limit ist 100 — `limit=-1` ist Pflicht, sonst fehlen Bestandsdaten und es entstehen Duplikate.
    5. Pro ParsedFixture: Treffer → `updateItem("Fixture", id, payload)` ohne `id`; sonst `createItem("Fixture", payload)`.
    6. Bei Write-Fehler: `writeScrapeLog failed`, return (bereits geschriebene Zeilen bleiben; Retry ist idempotent über denselben Schlüssel).
    7. Erfolg: `writeScrapeLog({ quelle: "openligadb", status: "success", fehlermeldung: null })`, return `{ status: "success", written: fixtures.length }`.
  - `quelle` ist immer der Literal `"openligadb"`.

- [ ] **Step 1: Failing Sync-Tests schreiben**

`scraper/tests/openligadb/sync.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { syncOpenLigaDb } from "../../src/openligadb/sync.ts";
import type { DirectusClient } from "../../src/shared/directus-client.ts";
import type { HttpClient } from "../../src/shared/http-client.ts";
import { MIN_SEASON_MATCHES } from "../../src/openligadb/validate.ts";

function seasonPayload(count = MIN_SEASON_MATCHES) {
  const matches = [];
  let n = 0;
  for (let spieltag = 1; spieltag <= 34 && n < count; spieltag++) {
    for (let i = 0; i < 9 && n < count; i++) {
      matches.push({
        matchDateTime: "2025-08-22T15:30:00",
        group: { groupOrderID: spieltag },
        team1: { teamName: `Heim-${spieltag}-${i}` },
        team2: { teamName: `Auswaerts-${spieltag}-${i}` },
      });
      n++;
    }
  }
  return matches;
}

function mockDirectus() {
  const created: object[] = [];
  const updated: { id: number; payload: object }[] = [];
  const logs: object[] = [];
  const existing: { id: number; spieltag: number; heim_verein: string; auswaerts_verein: string; datum: string }[] = [];
  const client: DirectusClient = {
    async login() {},
    async listItems(collection) {
      if (collection === "Fixture") return existing as never;
      return [];
    },
    async createItem(collection, payload) {
      if (collection === "ScrapeLog") {
        logs.push(payload);
        return { id: logs.length } as never;
      }
      created.push(payload);
      return { id: created.length, ...payload } as never;
    },
    async updateItem(_collection, id, payload) {
      updated.push({ id, payload });
      return { id, ...payload } as never;
    },
  };
  return { client, created, updated, logs, existing };
}

describe("syncOpenLigaDb", () => {
  it("creates fixtures and writes a success ScrapeLog", async () => {
    const { client, created, logs } = mockDirectus();
    const http: HttpClient = { getJson: async () => seasonPayload() };
    const result = await syncOpenLigaDb({
      http,
      directus: client,
      league: "bl1",
      season: 2025,
    });
    expect(result).toEqual({ status: "success", written: MIN_SEASON_MATCHES });
    expect(created).toHaveLength(MIN_SEASON_MATCHES);
    expect(logs).toEqual([
      expect.objectContaining({ quelle: "openligadb", status: "success", fehlermeldung: null }),
    ]);
  });

  it("updates an existing fixture instead of duplicating it", async () => {
    const { client, created, updated, existing } = mockDirectus();
    existing.push({
      id: 42,
      spieltag: 1,
      heim_verein: "Heim-1-0",
      auswaerts_verein: "Auswaerts-1-0",
      datum: "2025-08-01T15:30:00",
    });
    const http: HttpClient = { getJson: async () => seasonPayload() };
    await syncOpenLigaDb({ http, directus: client, league: "bl1", season: 2025 });
    expect(updated).toContainEqual({
      id: 42,
      payload: {
        spieltag: 1,
        heim_verein: "Heim-1-0",
        auswaerts_verein: "Auswaerts-1-0",
        datum: "2025-08-22T15:30:00",
      },
    });
    expect(created).toHaveLength(MIN_SEASON_MATCHES - 1);
  });

  it("does not write fixtures when HTTP fails, but logs failed", async () => {
    const { client, created, logs } = mockDirectus();
    const http: HttpClient = {
      getJson: async () => {
        throw new Error("HTTP 403 for https://api.openligadb.de/getmatchdata/bl1/2025");
      },
    };
    const result = await syncOpenLigaDb({
      http,
      directus: client,
      league: "bl1",
      season: 2025,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(created).toHaveLength(0);
    expect(logs).toEqual([
      expect.objectContaining({ quelle: "openligadb", status: "failed" }),
    ]);
  });

  it("does not write fixtures when plausibility fails", async () => {
    const { client, created, logs } = mockDirectus();
    const http: HttpClient = {
      getJson: async () => seasonPayload(9),
    };
    const result = await syncOpenLigaDb({
      http,
      directus: client,
      league: "bl1",
      season: 2025,
    });
    expect(result.status).toBe("failed");
    expect(created).toHaveLength(0);
    expect(logs[0]).toEqual(expect.objectContaining({ status: "failed" }));
  });
});
```

- [ ] **Step 2: Tests ausführen, Expected FAIL**

```bash
cd scraper
npm test
```

Expected: FAIL, `sync.ts` nicht gefunden.

- [ ] **Step 3: Sync implementieren**

`scraper/src/openligadb/sync.ts`:

```ts
import { parseMatches, type ParsedFixture } from "./parse.ts";
import { validateFixtures } from "./validate.ts";
import type { DirectusClient } from "../shared/directus-client.ts";
import type { HttpClient } from "../shared/http-client.ts";
import { writeScrapeLog } from "../shared/scrape-log.ts";

export type SyncDeps = {
  http: HttpClient;
  directus: DirectusClient;
  league: string;
  season: number;
  now?: Date;
};

export type SyncResult = {
  status: "success" | "failed";
  written: number;
  error?: string;
};

type StoredFixture = ParsedFixture & { id: number };

function fixtureKey(fixture: ParsedFixture) {
  return `${fixture.spieltag}|${fixture.heim_verein}|${fixture.auswaerts_verein}`;
}

export async function syncOpenLigaDb(deps: SyncDeps): Promise<SyncResult> {
  const url = `https://api.openligadb.de/getmatchdata/${deps.league}/${deps.season}`;
  const logOpts = { now: deps.now };

  try {
    const raw = await deps.http.getJson<unknown>(url);
    const fixtures = parseMatches(raw);
    const valid = validateFixtures(fixtures);
    if (!valid.ok) {
      await writeScrapeLog(deps.directus, {
        quelle: "openligadb",
        status: "failed",
        fehlermeldung: valid.reason,
        ...logOpts,
      });
      return { status: "failed", written: 0, error: valid.reason };
    }

    const existing = await deps.directus.listItems<StoredFixture>("Fixture", { limit: "-1" });
    const index = new Map(existing.map((row) => [fixtureKey(row), row]));

    let written = 0;
    for (const fixture of fixtures) {
      const found = index.get(fixtureKey(fixture));
      if (found) {
        await deps.directus.updateItem("Fixture", found.id, fixture);
      } else {
        await deps.directus.createItem("Fixture", fixture);
      }
      written += 1;
    }

    await writeScrapeLog(deps.directus, {
      quelle: "openligadb",
      status: "success",
      fehlermeldung: null,
      ...logOpts,
    });
    return { status: "success", written };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeScrapeLog(deps.directus, {
      quelle: "openligadb",
      status: "failed",
      fehlermeldung: message,
      ...logOpts,
    });
    return { status: "failed", written: 0, error: message };
  }
}
```

Wichtig: der `catch` darf **nicht** einen Fehler in `writeScrapeLog` verschlucken, der nach erfolgreichen Fixture-Writes passiert und so `written` auf 0 setzt. `written` nur im Erfolgspfad erhöhen; im `catch` ist `written: 0` die konservative Angabe für den Aufrufer (Retry bleibt idempotent). Tests prüfen `written: 0` nur im HTTP-/Validierungs-Fail vor dem ersten Write.

- [ ] **Step 4: Tests erneut ausführen**

```bash
cd scraper
npm test
```

Expected: PASS, alle Sync-Tests grün.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/openligadb/sync.ts scraper/tests/openligadb/sync.test.ts
git commit -m "$(cat <<'EOF'
feat: OpenLigaDB-Sync schreibt Fixture und ScrapeLog

Idempotenter Upsert über Spieltag+Vereine; bei HTTP- oder Plausibilitätsfehlern bleibt Fixture unangetastet.
EOF
)"
```

---

### Task 5: CLI, README, Live-Verifikation gegen Directus

**Files:**
- Create: `scraper/src/openligadb/run.ts`
- Create: `scraper/README.md`
- Modify: `scraper/.env.example` nur falls in Task 1 Felder fehlen (sollten vollständig sein)
- Create: `scraper/.env` lokal (nicht committen) — Werte aus `directus/.env` übernehmen (`ADMIN_EMAIL` → `DIRECTUS_EMAIL`, `ADMIN_PASSWORD` → `DIRECTUS_PASSWORD`)

**Interfaces:**
- Consumes: Env `DIRECTUS_URL`, `DIRECTUS_EMAIL`, `DIRECTUS_PASSWORD`, `OPENLIGADB_LEAGUE` (Default `bl1`), `OPENLIGADB_SEASON` (Default `2026`). Cache: `scraper/.cache`, TTL 12h (`43_200_000` ms), `minDelayMs: 250`.
- Produces: CLI `npm run sync:openligadb` im Ordner `scraper/`. Exit 0 bei `status: "success"`, Exit 1 sonst. README mit Start, Attribution (OpenLigaDB / ODbL), und Hinweis dass Cron erst Phase 5 ist.

- [ ] **Step 1: CLI-Entry schreiben**

`scraper/src/openligadb/run.ts`:

```ts
import { resolve } from "node:path";
import { createHttpClient } from "../shared/http-client.ts";
import { createDirectusClient } from "../shared/directus-client.ts";
import { log } from "../shared/logger.ts";
import { syncOpenLigaDb } from "./sync.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
}

const http = createHttpClient({
  cacheDir: resolve(process.cwd(), ".cache"),
  ttlMs: 43_200_000,
  minDelayMs: 250,
  userAgent: "comunio-helper/0.1 (private)",
});

const directus = createDirectusClient({
  baseUrl: requiredEnv("DIRECTUS_URL"),
  email: requiredEnv("DIRECTUS_EMAIL"),
  password: requiredEnv("DIRECTUS_PASSWORD"),
});

await directus.login();
const result = await syncOpenLigaDb({
  http,
  directus,
  league: process.env.OPENLIGADB_LEAGUE ?? "bl1",
  season: Number(process.env.OPENLIGADB_SEASON ?? "2026"),
});

if (result.status === "success") {
  log.info(`openligadb sync ok, written=${result.written}`);
  process.exit(0);
}

log.error(`openligadb sync failed: ${result.error}`);
process.exit(1);
```

- [ ] **Step 2: README schreiben**

`scraper/README.md`:

```markdown
# Scraper (Datenpipeline Phase 2)

Eigenständiges Node-Paket. Datenquelle dieser Phase: [OpenLigaDB](https://www.openligadb.de/) (ODbL — Namensnennung). Directus bleibt die einzige Quelle der Wahrheit; dieses Paket schreibt nur.

## Voraussetzungen

- Node.js 22+
- Laufendes Directus aus `../directus` (`docker compose up -d`)

## Setup

```bash
cd scraper
cp .env.example .env
# DIRECTUS_EMAIL / DIRECTUS_PASSWORD aus directus/.env übernehmen
npm install
```

## OpenLigaDB-Spielplan holen

```bash
npm run sync:openligadb
```

Default: Liga `bl1`, Saison `2026` (Saison 2026/27). Überschreiben über `OPENLIGADB_LEAGUE` / `OPENLIGADB_SEASON` in `.env`.

Danach im Directus-Admin (http://localhost:8055): Collection `Fixture` (≈306 Zeilen) und `ScrapeLog` (ein `success`-Eintrag mit `quelle=openligadb`) stichprobenartig prüfen.

Rohantworten liegen unter `.cache/` (TTL 12 Stunden) und werden nicht versioniert.

## Tests

```bash
npm test
```

Parser-Tests verwenden nur `tests/fixtures/`, nicht die Live-API.

## Noch nicht in dieser Phase

Cron-Zeitplan, CSV-Fallback, transfermarkt.de, kicker.de — siehe `../docs/spec-datenpipeline.md`.
```

- [ ] **Step 3: Lokales `.env` anlegen und Directus-Erreichbarkeit prüfen**

```bash
cd /Users/ptrck/Developer/comunio-helper/directus
docker compose ps
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8055/server/ping
```

Expected: Service `running`, Ping `200`. Falls Directus nicht läuft: `docker compose up -d` und 10s warten.

`scraper/.env` aus `.env.example` kopieren und Passwort aus `directus/.env` eintragen. Nicht committen.

- [ ] **Step 4: Unit-Tests (Regression)**

```bash
cd scraper
npm test
```

Expected: PASS, gesamte Suite grün.

- [ ] **Step 5: Live-Lauf gegen Directus**

```bash
cd scraper
npm run sync:openligadb
```

Expected: Log-Zeile `openligadb sync ok, written=306` (oder 270–320) und Exit 0.

Falls die Saison 2026 bei OpenLigaDB noch unvollständig ist (`erwartete 270–320 Spiele, erhalten N` mit N < 270): in `.env` `OPENLIGADB_SEASON=2025` setzen und den Lauf wiederholen. Das ist ein Daten-, kein Code-Problem; Default 2026 im Repo belassen.

Verifikation:

```bash
TOKEN=$(curl -s -X POST http://localhost:8055/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DIRECTUS_EMAIL\",\"password\":\"$DIRECTUS_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

curl -s "http://localhost:8055/items/Fixture?limit=1" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:8055/items/Fixture?aggregate[count]=id" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:8055/items/ScrapeLog?sort=-id&limit=1" -H "Authorization: Bearer $TOKEN"
```

Expected: mindestens ein Fixture mit `heim_verein`/`auswaerts_verein` als OpenLigaDB-`teamName` (z. B. `FC Bayern München`); Count im Intervall 270–320; letzter `ScrapeLog`-Eintrag `quelle=openligadb`, `status=success`.

Zweiter Lauf derselben Saison:

```bash
npm run sync:openligadb
```

Expected: wieder success; Count unverändert (Upsert, keine Duplikate). Cache-Hit: OpenLigaDB wird nicht erneut live geholt, solange `.cache/` jünger als 12h ist.

- [ ] **Step 6: Commit**

```bash
git add scraper/src/openligadb/run.ts scraper/README.md
git commit -m "$(cat <<'EOF'
feat: OpenLigaDB-CLI synchronisiert den Spielplan nach Directus

Erster End-to-End-Pfad Quelle → Fixture inkl. ScrapeLog, lokal per npm-Skript startbar.
EOF
)"
```

---

## Self-Review (Spec-Abgleich)

| Spec-Anforderung (`docs/spec-datenpipeline.md`) | Task |
|---|---|
| Phase 2: OpenLigaDB → `Fixture`, Pfad Quelle → Directus | Task 4 + 5 |
| `ScrapeLog` success/failed inkl. Fehlermeldung | Task 2 + 4 |
| Modul unabhängig ausführbar | Task 5 CLI |
| Plausibilitätsprüfung vor dem Schreiben | Task 3 Validator, Task 4 bricht vor Writes ab |
| Rohantworten lokal mit TTL cachen | Task 1 HTTP-Client, Task 5 TTL 12h |
| Parser-Tests gegen eingefrorenes JSON, nicht Live | Task 3 Fixture-Datei |
| ODbL-Namensnennung | Task 5 README |
| CSV-Import, Cron, transfermarkt, kicker | bewusst nicht — Phase 3–5 |
| `SquadMembership` manuell | unberührt |

Keine Platzhalter, keine „ähnlich wie Task N“-Verweise. Signaturen `createHttpClient`, `createDirectusClient`, `parseMatches`, `validateFixtures`, `syncOpenLigaDb`, `writeScrapeLog` sind in späteren Tasks identisch zu den früheren `Produces`-Blöcken.
