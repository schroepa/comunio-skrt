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
