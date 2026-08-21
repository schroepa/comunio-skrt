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
