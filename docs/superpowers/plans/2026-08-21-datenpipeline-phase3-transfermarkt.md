# Datenpipeline Phase 3 (Transfermarkt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein lokal per CLI startbares `transfermarkt`-Modul, das den Bundesliga-Katalog in `Player` upsertet (Key `transfermarkt_id`), Marktwerte nach `ValueHistory` schreibt und spieltagsbezogene Verfügbarkeit nach `AvailabilityStatus` legt — inkl. `ScrapeLog` (`transfermarkt-werte` / `transfermarkt-verfuegbarkeit`).

**Architecture:** Erweiterung des bestehenden `scraper/`-Pakets. HTML über `HttpClient.getText` (gleicher Datei-Cache und Mindestabstand wie `getJson`). Cheerio parst eingefrorene HTML-Fixtures. Zwei Sync-Funktionen unabhängig: Marktwerte dürfen Erfolg haben, wenn Verfügbarkeit an leerem `Fixture` scheitert. Kein Mapping auf OpenLigaDB-Vereinsnamen. `SquadMembership` unberührt.

**Tech Stack:** Node 22+, TypeScript ESM (`NodeNext`), Vitest, `tsx`, `cheerio`, natives `fetch`. Directus 12 lokal `http://localhost:8055`.

**Spec:** `docs/superpowers/specs/2026-08-21-datenpipeline-phase3-transfermarkt-design.md`

## Global Constraints

- Feldnamen verbatim: `Player` = `name`, `position` (`Torwart`/`Abwehr`/`Mittelfeld`/`Sturm`), `verein`, `aktueller_marktwert`, neu `transfermarkt_id` (integer, unique). `ValueHistory` = `player_id`, `datum`, `marktwert`. `AvailabilityStatus` = `player_id`, `spieltag`, `status` (`fit`/`fraglich`/`verletzt`/`gesperrt`), `quelle`, `aktualisiert_am`.
- Upsert-Key nur `transfermarkt_id`. Kein Match über Name+Verein.
- Transfermarkt-Vereinsnamen unverändert in `Player.verein`.
- Zeilen ohne `transfermarkt_id` oder ohne mappbare Position skippen. Unbekannte Availability-Labels skippen, nicht auf `fit` defaulten.
- Marktwerte-Plausibilität: 360–700 Spieler mit `transfermarkt_id`. Außerhalb: keine Writes, `ScrapeLog` failed.
- Verfügbarkeit: keine verwertbare Zeile = Fail, nicht „alle fit“. `quelle` immer `transfermarkt`.
- HTTP: vorhandener Client, Default-UA `comunio-helper/0.1 (private)`, `TRANSFERMARKT_MIN_DELAY_MS` Default `1500`. 403/Timeout nicht umgehen.
- Parser-Tests nur gegen `scraper/tests/fixtures/transfermarkt-*.html`. Kein Live-Transfermarkt in Vitest.
- `SquadMembership` nicht anfassen. Kein Cron, kein CSV, kein Kicker, kein Gooey, kein Kader-Picker.
- ScrapeLog-Quellen: `transfermarkt-werte` und `transfermarkt-verfuegbarkeit`.

## File Structure

```
scraper/
  src/shared/http-client.ts          # + getText
  src/transfermarkt/
    positions.ts                     # TM-Position → Directus-Choice
    marktwert.ts                     # "2,00 Mio. €" → integer
    parse-kader.ts                   # Club-HTML → ParsedPlayer[]
    parse-clubs.ts                   # Liga-Startseite → ClubRef[]
    parse-availability.ts            # Verletzte/Gesperrte → ParsedAvailability[]
    validate.ts                      # 360–700
    spieltag.ts                      # next spieltag from Fixture rows
    sync-werte.ts
    sync-verfuegbarkeit.ts
    run.ts
  tests/fixtures/
    transfermarkt-startseite-excerpt.html
    transfermarkt-kader-excerpt.html
    transfermarkt-verletzt-excerpt.html
    transfermarkt-gesperrt-excerpt.html
  tests/shared/http-client.test.ts   # + getText cases
  tests/transfermarkt/*.test.ts
```

Modify: `scraper/package.json` (cheerio, script), `scraper/.env.example`, `scraper/README.md`, `directus/schema/snapshot.yaml` (nach Field-Apply neu exportieren oder Feldblock einfügen).

Live-URLs (Konstanten in `run.ts`):

- Clubs: `https://www.transfermarkt.de/bundesliga/startseite/wettbewerb/L1`
- Kader: `https://www.transfermarkt.de/kader/verein/{id}` (Redirect/kanonische Club-URL akzeptieren; Parser braucht nur `a[href*="/profil/spieler/"]`)
- Verletzte: `https://www.transfermarkt.de/bundesliga/verletztespieler/wettbewerb/L1`
- Gesperrte: `https://www.transfermarkt.de/bundesliga/sperrenspieler/wettbewerb/L1`

---

### Task 1: Schema-Feld `Player.transfermarkt_id`

**Files:**
- Modify: `directus/schema/snapshot.yaml` (Feld `transfermarkt_id` an Collection `Player`)
- Modify: `directus/README.md` (ein Satz: nach Pull `schema apply --yes`)

**Interfaces:**
- Consumes: laufendes Directus, Admin aus `directus/.env`.
- Produces: `Player.transfermarkt_id` integer, unique, not null, indexed. Leere Collection vorausgesetzt.

- [ ] **Step 1: Directus Feld anlegen**

Directus muss laufen (`cd directus && docker compose up -d`). Login-Token holen wie in `directus/README.md`. Dann:

```bash
# TOKEN = static token oder Login-access_token
curl -s -X POST http://localhost:8055/fields/Player \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "field": "transfermarkt_id",
    "type": "integer",
    "meta": {
      "interface": "input",
      "required": true,
      "width": "full",
      "sort": 6
    },
    "schema": {
      "is_nullable": false,
      "is_unique": true,
      "is_indexed": true
    }
  }'
```

Expected: HTTP 200, `"field": "transfermarkt_id"`. Wenn die Collection Testzeilen ohne das Feld hat: Zeilen löschen und erneut anlegen.

- [ ] **Step 2: Snapshot aktualisieren**

```bash
cd directus
docker compose exec directus npx directus schema snapshot --yes ./schema/snapshot.yaml
```

Prüfen, dass `transfermarkt_id` unter `collection: Player` vorkommt. Snapshot committen (keine `.env`).

- [ ] **Step 3: Apply auf frischem Schema verifizieren**

```bash
curl -s http://localhost:8055/fields/Player/transfermarkt_id \
  -H "Authorization: Bearer $TOKEN" | grep transfermarkt_id
```

Expected: Feld sichtbar.

- [ ] **Step 4: Commit**

```bash
git add directus/schema/snapshot.yaml directus/README.md
git commit -m "$(cat <<'EOF'
feat: Player.transfermarkt_id als eindeutiger Upsert-Schlüssel

EOF
)"
```

---

### Task 2: `HttpClient.getText` für HTML

**Files:**
- Modify: `scraper/src/shared/http-client.ts`
- Modify: `scraper/tests/shared/http-client.test.ts`
- Modify: `scraper/package.json` (Dependency `cheerio` — Installation in diesem Task, Nutzung ab Task 3)

**Interfaces:**
- Consumes: bestehendes `getJson` inkl. Cache-Datei `{ storedAt, body }`.
- Produces: `HttpClient` zusätzlich `getText(url: string): Promise<string>`. `Accept: text/html` beim Live-Fetch. Cache-`body` ist ein String. `getJson` unverändert (`Accept: application/json`). Shared `liveFetch` so parametrisieren, dass Accept und Parse (json vs text) übergeben werden. Rate-Limit/`lastLiveAt`/`liveQueue` gelten für beide.

- [ ] **Step 1: Failing Test**

In `scraper/tests/shared/http-client.test.ts` ergänzen:

```ts
it("fetches HTML text on cache miss with Accept text/html", async () => {
  await setup();
  const fetchImpl = vi.fn(
    async () =>
      new Response("<table></table>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
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
  const body = await client.getText("https://example.test/page");
  expect(body).toBe("<table></table>");
  const request = fetchImpl.mock.calls[0][0] as Request;
  expect(request.headers.get("Accept")).toBe("text/html");
});
```

- [ ] **Step 2: Test Fail bestätigen**

```bash
cd scraper && npx vitest run tests/shared/http-client.test.ts
```

Expected: FAIL — `getText` fehlt.

- [ ] **Step 3: Implementieren**

`HttpClient` um `getText(url: string): Promise<string>` erweitern. Intern dieselbe Cache- und Queue-Logik wie `getJson`, aber `response.text()` und Header `Accept: text/html`. Non-2xx wirft `Error` mit `HTTP ${status} for ${url}` (gleicher Text wie JSON-Pfad).

- [ ] **Step 4: Tests grün**

```bash
cd scraper && npm test
```

Expected: bisherige HTTP-Tests plus neuer Test PASS.

- [ ] **Step 5: cheerio hinzufügen**

```bash
cd scraper && npm install cheerio
```

- [ ] **Step 6: Commit**

```bash
git add scraper/src/shared/http-client.ts scraper/tests/shared/http-client.test.ts scraper/package.json scraper/package-lock.json
git commit -m "$(cat <<'EOF'
feat: HTTP-Client holt HTML mit Cache und Rate-Limit

EOF
)"
```

---

### Task 3: Kader-Parser, Marktwert, Position, Plausibilität

**Files:**
- Create: `scraper/src/transfermarkt/positions.ts`
- Create: `scraper/src/transfermarkt/marktwert.ts`
- Create: `scraper/src/transfermarkt/parse-kader.ts`
- Create: `scraper/src/transfermarkt/parse-clubs.ts`
- Create: `scraper/src/transfermarkt/validate.ts`
- Create: `scraper/tests/fixtures/transfermarkt-kader-excerpt.html`
- Create: `scraper/tests/fixtures/transfermarkt-startseite-excerpt.html`
- Create: `scraper/tests/transfermarkt/positions.test.ts`
- Create: `scraper/tests/transfermarkt/marktwert.test.ts`
- Create: `scraper/tests/transfermarkt/parse-kader.test.ts`
- Create: `scraper/tests/transfermarkt/parse-clubs.test.ts`
- Create: `scraper/tests/transfermarkt/validate.test.ts`

**Interfaces:**
- Consumes: `cheerio`, `getText` noch nicht (reine Strings).
- Produces:
  - `export type DirectusPosition = "Torwart" | "Abwehr" | "Mittelfeld" | "Sturm"`
  - `export function mapPosition(raw: string): DirectusPosition | null`
  - `export function parseMarktwert(raw: string): number | null` — Ergebnis in Euro-Integer
  - `export type ParsedPlayer = { transfermarkt_id: number; name: string; position: DirectusPosition; verein: string; aktueller_marktwert: number }`
  - `export function parseKader(html: string, verein: string): { players: ParsedPlayer[]; skipped: number }`
  - `export type ClubRef = { transfermarkt_verein_id: number; name: string }`
  - `export function parseClubs(html: string): ClubRef[]` — unique IDs
  - `export function validateMarketPlayers(players: ParsedPlayer[], bounds?: { min: number; max: number }): { ok: true } | { ok: false; reason: string }` — Default `{ min: 360, max: 700 }`

Position-Map (Substring, case-insensitive, erste Treffer-Reihenfolge):

```ts
const RULES: Array<{ needle: string; pos: DirectusPosition }> = [
  { needle: "torwart", pos: "Torwart" },
  { needle: "keeper", pos: "Torwart" },
  { needle: "innenverteidiger", pos: "Abwehr" },
  { needle: "linksverteidiger", pos: "Abwehr" },
  { needle: "rechtsverteidiger", pos: "Abwehr" },
  { needle: "abwehr", pos: "Abwehr" },
  { needle: "libero", pos: "Abwehr" },
  { needle: "mittelfeld", pos: "Mittelfeld" },
  { needle: "flügel", pos: "Mittelfeld" },
  { needle: "außen", pos: "Mittelfeld" },
  { needle: "stürmer", pos: "Sturm" },
  { needle: "sturm", pos: "Sturm" },
  { needle: "mittelstürmer", pos: "Sturm" },
  { needle: "hängende spitze", pos: "Sturm" },
];
```

`mapPosition("Torwart")` → `"Torwart"`. Unbekannt → `null`.

Marktwert: `800 Tsd. €` → `800000`; `2,00 Mio. €` → `2000000`; `1.50 Mio. €` → `1500000`; Müll → `null`. Regex grob: `([\d.,]+)\s*(Tsd|Mio|Mrd)` dann Komma zu Punkt, Tsd×1e3, Mio×1e6, Mrd×1e9, `Math.round`.

Kader-HTML-Vertrag: jede Spielerzeile enthält `a[href*="/profil/spieler/{id}"]`. ID aus `/profil/spieler/(\d+)`. Name = Linktext trim. Position = Text einer Zelle, die `mapPosition` nicht-null ergibt (erste passende Zelle der Zeile). Marktwert = erste Zelle, deren Text `parseMarktwert` nicht-null ergibt. `verein` kommt als Argument, nicht aus der Zeile. Duplikate derselben ID: erste behalten, weitere `skipped++`. Ohne ID / Position / Marktwert: nicht in `players`, `skipped++`.

Club-HTML-Vertrag: Links `a[href*="/verein/"]`, ID aus `/verein/(\d+)`, Name = trim Linktext, Länge > 1, keine reinen Zahlen. Unique nach ID. Reihenfolge belassen.

- [ ] **Step 1: Fixtures anlegen**

`scraper/tests/fixtures/transfermarkt-kader-excerpt.html`:

```html
<table class="items">
  <tr>
    <td><a href="/manuel-neuer/profil/spieler/17259">Manuel Neuer</a></td>
    <td>Torwart</td>
    <td>4,00 Mio. €</td>
  </tr>
  <tr>
    <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
    <td>Mittelstürmer</td>
    <td>70,00 Mio. €</td>
  </tr>
  <tr>
    <td><a href="/unbekannt/profil/spieler/1">Ohne Pos</a></td>
    <td>Cheftrainer</td>
    <td>1,00 Mio. €</td>
  </tr>
</table>
```

`scraper/tests/fixtures/transfermarkt-startseite-excerpt.html`: zwei Clubs, Bayern `verein/27`, Dortmund `verein/16`, plus ein Duplikat-Link auf 27.

- [ ] **Step 2: Failing Tests (Auszug, alle Dateien anlegen)**

`parse-kader.test.ts`: `parseKader(html, "FC Bayern München")` → zwei Spieler (Neuer 17259 Torwart 4_000_000, Kane 132098 Sturm 70_000_000), `skipped === 1`.

`parse-clubs.test.ts`: zwei unique Clubs, IDs 27 und 16.

`validate.test.ts`: Default-Bounds, 2 Spieler → `{ ok: false }`; `validateMarketPlayers(two, { min: 1, max: 10 })` → `{ ok: true }`; 0 Spieler mit `{ min: 1, max: 10 }` → failed.

`marktwert.test.ts` / `positions.test.ts`: die Zahlen und Positionsbeispiele oben.

- [ ] **Step 3: Fail, dann minimale Implementation, Tests grün**

```bash
cd scraper && npx vitest run tests/transfermarkt
```

Expected: erst FAIL, nach Code PASS.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/transfermarkt scraper/tests/transfermarkt scraper/tests/fixtures/transfermarkt-*.html
git commit -m "$(cat <<'EOF'
feat: Transfermarkt-Parser für Kader, Marktwert und Vereine

EOF
)"
```

---

### Task 4: Availability-Parser und Spieltag aus Fixture

**Files:**
- Create: `scraper/src/transfermarkt/parse-availability.ts`
- Create: `scraper/src/transfermarkt/spieltag.ts`
- Create: `scraper/tests/fixtures/transfermarkt-verletzt-excerpt.html`
- Create: `scraper/tests/fixtures/transfermarkt-gesperrt-excerpt.html`
- Create: `scraper/tests/transfermarkt/parse-availability.test.ts`
- Create: `scraper/tests/transfermarkt/spieltag.test.ts`

**Interfaces:**
- Consumes: `ParsedPlayer` nicht nötig; IDs aus Profil-Links.
- Produces:
  - `export type ParsedAvailability = { transfermarkt_id: number; status: "fraglich" | "verletzt" | "gesperrt" }`
  - `export function parseAvailability(injuredHtml: string, suspendedHtml: string): { rows: ParsedAvailability[]; skipped: number }`
  - `export function nextSpieltag(fixtures: Array<{ spieltag: number; datum: string }>, now: Date): number | null` — gleiche Regel wie `web/src/lib/fixtures.ts` `getNextMatchday`: kleinste Spieltag-Gruppe mit mindestens einem `datum >= now`; wenn keine Zukunft: `null` (nicht letzten Spieltag verwenden — Availability-Sync soll dann failed mit „Saison vorbei / kein nächster Spieltag“). **Abweichung vom Frontend bewusst:** Spec verlangt Availability für den *relevanten* nächsten Spieltag; ohne zukünftige Spiele gibt es nichts zu schreiben → `null`.

Availability-Regeln:

1. Alle `a[href*="/profil/spieler/"]` auf der Gesperrt-Seite → `gesperrt`.
2. Alle solchen Links auf der Verletzt-Seite: Zeilentext (tr) lowercase enthält `angeschlagen` oder `fraglich` oder `fitness` → `fraglich`, sonst `verletzt`.
3. Dieselbe ID auf beiden Seiten: `gesperrt` gewinnt.
4. Kein Link/ID: `skipped++`.

Verletzten-Fixture: eine Zeile Kane + „Wadenverletzung“, eine Zeile mit „angeschlagen“. Gesperrt-Fixture: eine Zeile Neuer. Merge: Kane verletzt, angeschlagen-Spieler fraglich, Neuer gesperrt.

`nextSpieltag`: Tests mit zwei Fixtures (Spieltag 1 gestern, Spieltag 2 morgen) → 2; alle in der Vergangenheit → `null`; leeres Array → `null`.

- [ ] **Step 1: Fixtures + failing tests**
- [ ] **Step 2: Fail bestätigen**
- [ ] **Step 3: Implementieren, Tests grün**

```bash
cd scraper && npx vitest run tests/transfermarkt/parse-availability.test.ts tests/transfermarkt/spieltag.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add scraper/src/transfermarkt/parse-availability.ts scraper/src/transfermarkt/spieltag.ts scraper/tests/transfermarkt/parse-availability.test.ts scraper/tests/transfermarkt/spieltag.test.ts scraper/tests/fixtures/transfermarkt-verletzt-excerpt.html scraper/tests/fixtures/transfermarkt-gesperrt-excerpt.html
git commit -m "$(cat <<'EOF'
feat: Transfermarkt-Verfügbarkeit und Spieltag aus Fixture

EOF
)"
```

---

### Task 5: Sync, CLI, README, Live-Check

**Files:**
- Create: `scraper/src/transfermarkt/sync-werte.ts`
- Create: `scraper/src/transfermarkt/sync-verfuegbarkeit.ts`
- Create: `scraper/src/transfermarkt/run.ts`
- Create: `scraper/tests/transfermarkt/sync-werte.test.ts`
- Create: `scraper/tests/transfermarkt/sync-verfuegbarkeit.test.ts`
- Modify: `scraper/package.json` script `sync:transfermarkt`
- Modify: `scraper/.env.example` (`TRANSFERMARKT_MIN_DELAY_MS=1500`)
- Modify: `scraper/README.md`

**Interfaces:**
- Consumes: `HttpClient.getText`, `DirectusClient`, Parser/Validate/Spieltag aus Task 3–4, `writeScrapeLog`.
- Produces:
  - `export async function syncTransfermarktWerte(deps: { http: HttpClient; directus: DirectusClient; now?: Date }): Promise<{ status: "success" | "failed"; written: number; error?: string }>`
  - `export async function syncTransfermarktVerfuegbarkeit(deps: { http: HttpClient; directus: DirectusClient; now?: Date }): Promise<{ status: "success" | "failed"; written: number; error?: string }>`
  - CLI `run.ts` ruft erst Werte, dann Verfügbarkeit auf. Exit-Code 0 nur wenn **beide** `success`. Werte-Erfolg + Verfügbarkeit-Fail → Exit 1, aber Player/ValueHistory bleiben stehen.

`syncTransfermarktWerte`:

1. `getText` Startseite → `parseClubs`. Nicht genau 18 Clubs → failed log `transfermarkt-werte`, keine Writes (`reason` z. B. `erwartete 18 Vereine, erhalten N`).
2. Pro Club `getText` Kader-URL, `parseKader`, Spieler mergen (ID unique).
3. `validateMarketPlayers`. Fail → log failed, return.
4. `directus.listItems("Player", { limit: "-1" })`. Index `transfermarkt_id → { id, ... }`.
5. Pro ParsedPlayer: wenn vorhanden `updateItem` mit name, position, verein, aktueller_marktwert, transfermarkt_id; sonst `createItem`. `ValueHistory` create `{ player_id, datum: YYYY-MM-DD von now, marktwert }` — wenn für player_id+datum schon ein Eintrag existiert (Liste ValueHistory limit -1, Key `player_id|datum`), update statt create.
6. `writeScrapeLog` success `quelle: transfermarkt-werte`.

`syncTransfermarktVerfuegbarkeit`:

1. `listItems("Fixture", { limit: "-1" })`. `nextSpieltag` → `null` → failed log mit Text `Noch kein Spielplan. Im Ordner scraper/ npm run sync:openligadb.` (oder „kein nächster Spieltag“), keine Availability-Writes.
2. `getText` verletzt + gesperrt URLs, `parseAvailability`. `rows.length === 0` → failed, kein Write.
3. Player-Index nach `transfermarkt_id`. Unbekannte IDs skippen (Spieler noch nicht im Katalog).
4. Existing Availability `listItems` limit -1, Key `player_id|spieltag`. Upsert `status`, `quelle: "transfermarkt"`, `aktualisiert_am: ISO now`.
5. Success-Log `transfermarkt-verfuegbarkeit`.

HTTP-Fehler in try/catch → failed log der betroffenen Funktion, keine Writes dieser Funktion.

Tests: gemocktes `http.getText` und `directus` wie OpenLigaDB-Sync-Tests. Fälle: Werte success+upsert; Validate-Fail keine createItem; Verfügbarkeit ohne Fixture failed und kein Availability-Write; Verfügbarkeit upsert gesperrt gewinnt.

`run.ts` analog `openligadb/run.ts`: `minDelayMs: Number(process.env.TRANSFERMARKT_MIN_DELAY_MS ?? "1500")`, `ttlMs` 43_200_000.

README-Abschnitt Transfermarkt: ToS-Hinweis eine Zeile (private Nutzung, bei 403 nicht umgehen), Commands, zwei ScrapeLog-Quellen, `transfermarkt_id`. OpenLigaDB-Teil behalten.

- [ ] **Step 1: Failing Sync-Tests**
- [ ] **Step 2: Fail, Implementierung, `cd scraper && npm test` PASS**
- [ ] **Step 3: CLI + README + .env.example**
- [ ] **Step 4: Live (manuell, nicht CI)**

Directus up, Fixture bereits gefüllt. `cd scraper && npm run sync:transfermarkt`. Bei 403: ScrapeLog failed, **nicht** retry mit anderem UA. Bei Erfolg: Player-Zahl 360–700 in Admin, eine ValueHistory-Stichprobe, Availability-Stichprobe, zwei Log-Zeilen.

- [ ] **Step 5: Commit**

```bash
git add scraper
git commit -m "$(cat <<'EOF'
feat: Transfermarkt-Sync schreibt Player, Marktwerte und Verfügbarkeit

EOF
)"
```

---

## Spec-Abdeckung (Selbstcheck)

| Spec | Task |
|---|---|
| `transfermarkt_id` unique | 1 |
| HTML-Cache + Delay 1500 | 2, 5 |
| Player upsert + ValueHistory | 3, 5 |
| Position-Map, skip unmappbar | 3 |
| 360–700 | 3, 5 |
| Availability vier Status, unknown skip, leere Seite fail | 4, 5 |
| Spieltag aus Fixture, leer → Werte ok / Avail fail | 4, 5 |
| Zwei ScrapeLog-Quellen | 5 |
| Kein Live-TM in Tests | 3–5 |
| Kein Squad/CSV/Cron/Kicker/Gooey | — nicht im Plan |
