import { describe, expect, it } from "vitest";
import type { DirectusClient } from "../../src/shared/directus-client.ts";
import type { HttpClient } from "../../src/shared/http-client.ts";
import { syncTransfermarktWerte } from "../../src/transfermarkt/sync-werte.ts";

const START_URL = "https://www.transfermarkt.de/bundesliga/startseite/wettbewerb/L1";
const NOW = new Date("2026-08-21T12:00:00.000Z");
const TODAY = "2026-08-21";
const PLAYERS_PER_CLUB = 20;
const CLUB_COUNT = 18;

function clubsHtml(count: number): string {
  const rows = Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    return `<tr><td><a href="/club-${id}/startseite/verein/${id}">Club ${id}</a></td></tr>`;
  });
  return `<table>${rows.join("")}</table>`;
}

function kaderHtml(startId: number, count: number): string {
  const rows = Array.from({ length: count }, (_, i) => {
    const id = startId + i;
    return `<tr>
      <td><a href="/p/profil/spieler/${id}">Player ${id}</a></td>
      <td>Torwart</td>
      <td>1,00 Mio. €</td>
    </tr>`;
  });
  return `<table>${rows.join("")}</table>`;
}

function kaderUrl(vereinId: number): string {
  return `https://www.transfermarkt.de/-/kader/verein/${vereinId}`;
}

function validPages(): Record<string, string> {
  const pages: Record<string, string> = { [START_URL]: clubsHtml(CLUB_COUNT) };
  for (let club = 1; club <= CLUB_COUNT; club++) {
    pages[kaderUrl(club)] = kaderHtml((club - 1) * PLAYERS_PER_CLUB + 1, PLAYERS_PER_CLUB);
  }
  return pages;
}

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
  const players: Array<{
    id: number;
    transfermarkt_id: number;
    name: string;
    position: string;
    verein: string;
    aktueller_marktwert: number;
  }> = [];
  const valueHistory: Array<{ id: number; player_id: number; datum: string; marktwert: number }> = [];
  let nextId = 1000;
  const client: DirectusClient = {
    async login() {},
    async listItems(collection, query) {
      listCalls.push({ collection, query });
      if (collection === "Player") return players as never;
      if (collection === "ValueHistory") return valueHistory as never;
      return [];
    },
    async createItem(collection, payload) {
      if (collection === "ScrapeLog") {
        logs.push(payload);
        return { id: logs.length } as never;
      }
      const record = payload as Record<string, unknown>;
      created.push({ collection, payload: record });
      const id = nextId++;
      return { id, ...record } as never;
    },
    async updateItem(collection, id, payload) {
      const record = payload as Record<string, unknown>;
      updated.push({ collection, id, payload: record });
      return { id, ...record } as never;
    },
  };
  return { client, created, updated, logs, players, valueHistory, listCalls };
}

describe("syncTransfermarktWerte", () => {
  it("creates players and value history and writes a success ScrapeLog", async () => {
    const { client, created, logs, listCalls } = mockDirectus();
    const http = mockHttp(validPages());
    const result = await syncTransfermarktWerte({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result).toEqual({ status: "success", written: 360, skipped: 0 });
    expect(created.filter((row) => row.collection === "Player")).toHaveLength(360);
    expect(created.filter((row) => row.collection === "ValueHistory")).toHaveLength(360);
    expect(created).toContainEqual({
      collection: "Player",
      payload: {
        name: "Player 1",
        position: "Torwart",
        verein: "Club 1",
        aktueller_marktwert: 1_000_000,
        transfermarkt_id: 1,
      },
    });
    expect(created).toContainEqual({
      collection: "ValueHistory",
      payload: { player_id: 1000, datum: TODAY, marktwert: 1_000_000 },
    });
    expect(logs).toEqual([
      expect.objectContaining({
        quelle: "transfermarkt-werte",
        status: "success",
        fehlermeldung: null,
      }),
    ]);
    expect(http.urls[0]).toBe(START_URL);
    expect(http.urls).toHaveLength(1 + CLUB_COUNT);
    expect(listCalls).toContainEqual({ collection: "Player", query: { limit: "-1" } });
    expect(listCalls).toContainEqual({ collection: "ValueHistory", query: { limit: "-1" } });
  });

  it("returns skipped count from kader parse across clubs", async () => {
    const { client } = mockDirectus();
    const pages = validPages();
    pages[kaderUrl(1)] = kaderHtml(1, PLAYERS_PER_CLUB).replace(
      "</table>",
      `<tr>
        <td><a href="/x/profil/spieler/">Ohne ID</a></td>
        <td>Torwart</td>
        <td>1,00 Mio. €</td>
      </tr></table>`,
    );
    const http = mockHttp(pages);
    const result = await syncTransfermarktWerte({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result).toEqual({ status: "success", written: 360, skipped: 1 });
  });

  it("updates an existing player and today's value history instead of duplicating them", async () => {
    const { client, created, updated, players, valueHistory } = mockDirectus();
    players.push({
      id: 42,
      transfermarkt_id: 1,
      name: "Alt",
      position: "Abwehr",
      verein: "Altverein",
      aktueller_marktwert: 500_000,
    });
    valueHistory.push({ id: 7, player_id: 42, datum: TODAY, marktwert: 500_000 });
    const http = mockHttp(validPages());
    const result = await syncTransfermarktWerte({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("success");
    expect(updated).toContainEqual({
      collection: "Player",
      id: 42,
      payload: {
        name: "Player 1",
        position: "Torwart",
        verein: "Club 1",
        aktueller_marktwert: 1_000_000,
        transfermarkt_id: 1,
      },
    });
    expect(updated).toContainEqual({
      collection: "ValueHistory",
      id: 7,
      payload: { player_id: 42, datum: TODAY, marktwert: 1_000_000 },
    });
    expect(created.filter((row) => row.collection === "Player")).toHaveLength(359);
    expect(created.filter((row) => row.collection === "ValueHistory")).toHaveLength(359);
  });

  it("does not write players when club count is not 18", async () => {
    const { client, created, logs } = mockDirectus();
    const http = mockHttp({ [START_URL]: clubsHtml(2) });
    const result = await syncTransfermarktWerte({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(result.error).toBe("erwartete 18 Vereine, erhalten 2");
    expect(created).toHaveLength(0);
    expect(logs).toEqual([
      expect.objectContaining({ quelle: "transfermarkt-werte", status: "failed" }),
    ]);
    expect(http.urls).toEqual([START_URL]);
  });

  it("does not write players when plausibility fails", async () => {
    const { client, created, logs } = mockDirectus();
    const pages: Record<string, string> = { [START_URL]: clubsHtml(CLUB_COUNT) };
    for (let club = 1; club <= CLUB_COUNT; club++) {
      pages[kaderUrl(club)] = kaderHtml(club, 1);
    }
    const http = mockHttp(pages);
    const result = await syncTransfermarktWerte({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(created).toHaveLength(0);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        quelle: "transfermarkt-werte",
        status: "failed",
        fehlermeldung: "erwartete 360–700 Spieler, erhalten 18",
      }),
    );
  });

  it("does not write players when HTTP fails, but logs failed", async () => {
    const { client, created, logs } = mockDirectus();
    const http = mockHttp({}, START_URL);
    const result = await syncTransfermarktWerte({
      http: http.client,
      directus: client,
      now: NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.written).toBe(0);
    expect(created).toHaveLength(0);
    expect(logs).toEqual([
      expect.objectContaining({ quelle: "transfermarkt-werte", status: "failed" }),
    ]);
  });
});
