import { describe, expect, it } from "vitest";
import type { DirectusClient } from "../../src/shared/directus-client.ts";
import type { HttpClient } from "../../src/shared/http-client.ts";
import { syncTransfermarktVerfuegbarkeit } from "../../src/transfermarkt/sync-verfuegbarkeit.ts";

const INJURED_URL = "https://www.transfermarkt.de/bundesliga/verletztespieler/wettbewerb/L1";
const SUSPENDED_URL = "https://www.transfermarkt.de/bundesliga/sperrenausfaelle/wettbewerb/L1";
const NOW = new Date("2026-08-21T12:00:00.000Z");

function mockHttp(pages: Record<string, string>, throwOn?: string): { client: HttpClient; urls: string[] } {
  const urls: string[] = [];
  const client: HttpClient = {
    async getJson<T>(): Promise<T> {
      throw new Error("getJson is not used by Transfermarkt");
    },
    async getText(url: string): Promise<string> {
      urls.push(url);
      if (throwOn && url.includes(throwOn)) {
        throw new Error(`HTTP 403 for ${url}`);
      }
      const body = pages[url];
      if (body === undefined) throw new Error(`unexpected url ${url}`);
      return body;
    },
  };
  return { client, urls };
}

function mockDirectus() {
  const created: { collection: string; payload: Record<string, unknown> }[] = [];
  const updated: { collection: string; id: number; payload: Record<string, unknown> }[] = [];
  const logs: object[] = [];
  const listCalls: { collection: string; query?: Record<string, string> }[] = [];
  const fixtures: Array<{
    id: number;
    spieltag: number;
    heim_verein: string;
    auswaerts_verein: string;
    datum: string;
  }> = [];
  const players: Array<{ id: number; transfermarkt_id: number }> = [];
  const availability: Array<{
    id: number;
    player_id: number;
    spieltag: number;
    status: string;
    quelle: string;
    aktualisiert_am: string;
  }> = [];
  const client: DirectusClient = {
    async login() {},
    async listItems(collection, query) {
      listCalls.push({ collection, query });
      if (collection === "Fixture") return fixtures as never;
      if (collection === "Player") return players as never;
      if (collection === "AvailabilityStatus") return availability as never;
      return [];
    },
    async createItem(collection, payload) {
      if (collection === "ScrapeLog") {
        logs.push(payload);
        return { id: logs.length } as never;
      }
      const record = payload as Record<string, unknown>;
      created.push({ collection, payload: record });
      return { id: created.length, ...record } as never;
    },
    async updateItem(collection, id, payload) {
      const record = payload as Record<string, unknown>;
      updated.push({ collection, id, payload: record });
      return { id, ...record } as never;
    },
  };
  return { client, created, updated, logs, fixtures, players, availability, listCalls };
}

const kaneInjuredHtml = `
  <table>
    <tr>
      <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
      <td>Wadenverletzung</td>
    </tr>
    <tr>
      <td><a href="/jamal-musiala/profil/spieler/580195">Jamal Musiala</a></td>
      <td>angeschlagen</td>
    </tr>
  </table>
`;

const kaneSuspendedHtml = `
  <table>
    <tr>
      <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
      <td>Rote Karte</td>
    </tr>
  </table>
`;

describe("syncTransfermarktVerfuegbarkeit", () => {
  it("fails without fixtures and does not write AvailabilityStatus", async () => {
    const { client, created, logs } = mockDirectus();
    const http = mockHttp({
      [INJURED_URL]: kaneInjuredHtml,
      [SUSPENDED_URL]: kaneSuspendedHtml,
    });
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(result.error).toBe("Noch kein Spielplan. Im Ordner scraper/ npm run sync:openligadb.");
    expect(created.filter((row) => row.collection === "AvailabilityStatus")).toHaveLength(0);
    expect(logs).toEqual([
      expect.objectContaining({
        quelle: "transfermarkt-verfuegbarkeit",
        status: "failed",
      }),
    ]);
    expect(http.urls).toEqual([]);
  });

  it("upserts availability and lets gesperrt win", async () => {
    const { client, created, updated, fixtures, players, availability, logs, listCalls } =
      mockDirectus();
    fixtures.push({
      id: 1,
      spieltag: 2,
      heim_verein: "Heim",
      auswaerts_verein: "Auswaerts",
      datum: "2026-08-22T15:30:00",
    });
    players.push({ id: 7, transfermarkt_id: 132098 }, { id: 8, transfermarkt_id: 580195 });
    availability.push({
      id: 3,
      player_id: 7,
      spieltag: 2,
      status: "verletzt",
      quelle: "transfermarkt",
      aktualisiert_am: "2026-08-20T10:00:00.000Z",
    });
    const http = mockHttp({
      [INJURED_URL]: kaneInjuredHtml,
      [SUSPENDED_URL]: kaneSuspendedHtml,
    });
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result).toEqual({ status: "success", written: 2, skipped: 0 });
    expect(updated).toContainEqual({
      collection: "AvailabilityStatus",
      id: 3,
      payload: {
        player_id: 7,
        spieltag: 2,
        status: "gesperrt",
        quelle: "transfermarkt",
        aktualisiert_am: NOW.toISOString(),
      },
    });
    expect(created).toContainEqual({
      collection: "AvailabilityStatus",
      payload: {
        player_id: 8,
        spieltag: 2,
        status: "fraglich",
        quelle: "transfermarkt",
        aktualisiert_am: NOW.toISOString(),
      },
    });
    expect(logs).toEqual([
      expect.objectContaining({
        quelle: "transfermarkt-verfuegbarkeit",
        status: "success",
        fehlermeldung: null,
      }),
    ]);
    expect(http.urls).toEqual([INJURED_URL, SUSPENDED_URL]);
    expect(listCalls).toContainEqual({ collection: "Fixture", query: { limit: "-1" } });
    expect(listCalls).toContainEqual({ collection: "Player", query: { limit: "-1" } });
    expect(listCalls).toContainEqual({
      collection: "AvailabilityStatus",
      query: { limit: "-1" },
    });
  });

  it("resets leftover transfermarkt availability for this spieltag to fit", async () => {
    const { client, created, updated, fixtures, players, availability } = mockDirectus();
    fixtures.push({
      id: 1,
      spieltag: 2,
      heim_verein: "Heim",
      auswaerts_verein: "Auswaerts",
      datum: "2026-08-22T15:30:00",
    });
    players.push(
      { id: 7, transfermarkt_id: 132098 },
      { id: 9, transfermarkt_id: 999 },
      { id: 10, transfermarkt_id: 1000 },
    );
    availability.push(
      {
        id: 3,
        player_id: 7,
        spieltag: 2,
        status: "verletzt",
        quelle: "transfermarkt",
        aktualisiert_am: "2026-08-20T10:00:00.000Z",
      },
      {
        id: 4,
        player_id: 9,
        spieltag: 2,
        status: "verletzt",
        quelle: "transfermarkt",
        aktualisiert_am: "2026-08-20T10:00:00.000Z",
      },
      {
        id: 5,
        player_id: 9,
        spieltag: 1,
        status: "verletzt",
        quelle: "transfermarkt",
        aktualisiert_am: "2026-08-13T10:00:00.000Z",
      },
      {
        id: 6,
        player_id: 10,
        spieltag: 2,
        status: "verletzt",
        quelle: "manual",
        aktualisiert_am: "2026-08-20T10:00:00.000Z",
      },
    );
    const listedOnlyKane = `
      <table>
        <tr>
          <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
          <td>Wadenverletzung</td>
        </tr>
      </table>
    `;
    const http = mockHttp({
      [INJURED_URL]: listedOnlyKane,
      [SUSPENDED_URL]: "<table></table>",
    });
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("success");
    expect(result.written).toBe(1);
    expect(updated).toContainEqual({
      collection: "AvailabilityStatus",
      id: 3,
      payload: {
        player_id: 7,
        spieltag: 2,
        status: "verletzt",
        quelle: "transfermarkt",
        aktualisiert_am: NOW.toISOString(),
      },
    });
    expect(updated).toContainEqual({
      collection: "AvailabilityStatus",
      id: 4,
      payload: {
        player_id: 9,
        spieltag: 2,
        status: "fit",
        quelle: "transfermarkt",
        aktualisiert_am: NOW.toISOString(),
      },
    });
    expect(updated.filter((row) => row.id === 5)).toHaveLength(0);
    expect(updated.filter((row) => row.id === 6)).toHaveLength(0);
    expect(created.filter((row) => row.collection === "AvailabilityStatus")).toHaveLength(0);
    expect(updated.filter((row) => row.payload.status === "fit")).toHaveLength(1);
  });

  it("fails when no listed player matches the catalog, without resetting to fit", async () => {
    const { client, created, updated, logs, fixtures, players, availability } = mockDirectus();
    fixtures.push({
      id: 1,
      spieltag: 1,
      heim_verein: "Heim",
      auswaerts_verein: "Auswaerts",
      datum: "2026-08-22T15:30:00",
    });
    players.push({ id: 9, transfermarkt_id: 999 });
    availability.push({
      id: 4,
      player_id: 9,
      spieltag: 1,
      status: "verletzt",
      quelle: "transfermarkt",
      aktualisiert_am: "2026-08-20T10:00:00.000Z",
    });
    const http = mockHttp({
      [INJURED_URL]: kaneInjuredHtml,
      [SUSPENDED_URL]: kaneSuspendedHtml,
    });
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(result.error).toBe("kein gelisteter Spieler im Katalog");
    expect(updated).toHaveLength(0);
    expect(created.filter((row) => row.collection === "AvailabilityStatus")).toHaveLength(0);
    expect(logs).toEqual([
      expect.objectContaining({
        quelle: "transfermarkt-verfuegbarkeit",
        status: "failed",
        fehlermeldung: "kein gelisteter Spieler im Katalog",
      }),
    ]);
  });

  it("returns skipped count from availability parse", async () => {
    const { client, fixtures, players } = mockDirectus();
    fixtures.push({
      id: 1,
      spieltag: 1,
      heim_verein: "Heim",
      auswaerts_verein: "Auswaerts",
      datum: "2026-08-22T15:30:00",
    });
    players.push({ id: 7, transfermarkt_id: 132098 });
    const injuredWithSkip = `
      <table>
        <tr>
          <td><a href="/unbekannt/profil/spieler/">Ohne ID</a></td>
          <td>Wadenverletzung</td>
        </tr>
        <tr>
          <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
          <td>Wadenverletzung</td>
        </tr>
      </table>
    `;
    const http = mockHttp({
      [INJURED_URL]: injuredWithSkip,
      [SUSPENDED_URL]: "<table></table>",
    });
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result).toEqual({ status: "success", written: 1, skipped: 1 });
  });

  it("skips unknown transfermarkt ids that are not in the player catalog", async () => {
    const { client, created, fixtures, players } = mockDirectus();
    fixtures.push({
      id: 1,
      spieltag: 1,
      heim_verein: "Heim",
      auswaerts_verein: "Auswaerts",
      datum: "2026-08-22T15:30:00",
    });
    players.push({ id: 7, transfermarkt_id: 132098 });
    const http = mockHttp({
      [INJURED_URL]: kaneInjuredHtml,
      [SUSPENDED_URL]: kaneSuspendedHtml,
    });
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result).toEqual({ status: "success", written: 1, skipped: 0 });
    expect(created.filter((row) => row.collection === "AvailabilityStatus")).toEqual([
      {
        collection: "AvailabilityStatus",
        payload: {
          player_id: 7,
          spieltag: 1,
          status: "gesperrt",
          quelle: "transfermarkt",
          aktualisiert_am: NOW.toISOString(),
        },
      },
    ]);
  });

  it("fails when availability pages have no usable rows", async () => {
    const { client, created, logs, fixtures } = mockDirectus();
    fixtures.push({
      id: 1,
      spieltag: 1,
      heim_verein: "Heim",
      auswaerts_verein: "Auswaerts",
      datum: "2026-08-22T15:30:00",
    });
    const http = mockHttp({
      [INJURED_URL]: "<table></table>",
      [SUSPENDED_URL]: "<table></table>",
    });
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(created.filter((row) => row.collection === "AvailabilityStatus")).toHaveLength(0);
    expect(logs).toEqual([
      expect.objectContaining({
        quelle: "transfermarkt-verfuegbarkeit",
        status: "failed",
      }),
    ]);
  });

  it("does not write availability when HTTP fails, but logs failed", async () => {
    const { client, created, logs, fixtures } = mockDirectus();
    fixtures.push({
      id: 1,
      spieltag: 1,
      heim_verein: "Heim",
      auswaerts_verein: "Auswaerts",
      datum: "2026-08-22T15:30:00",
    });
    const http = mockHttp({}, INJURED_URL);
    const result = await syncTransfermarktVerfuegbarkeit({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(created.filter((row) => row.collection === "AvailabilityStatus")).toHaveLength(0);
    expect(logs).toEqual([
      expect.objectContaining({
        quelle: "transfermarkt-verfuegbarkeit",
        status: "failed",
      }),
    ]);
  });
});
