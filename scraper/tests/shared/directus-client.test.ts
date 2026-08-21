import { describe, expect, it, vi } from "vitest";
import { createDirectusClient } from "../../src/shared/directus-client.ts";
import { writeScrapeLog } from "../../src/shared/scrape-log.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function client(fetchImpl: typeof fetch) {
  return createDirectusClient({
    baseUrl: "https://example.supabase.co",
    serviceRoleKey: "service-key",
    fetchImpl,
  });
}

describe("createDirectusClient (Supabase REST)", () => {
  it("lists fixture via PostgREST with service role", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain("/rest/v1/fixture?");
      expect(url).toContain("select=*");
      return jsonResponse([{ id: 1, spieltag: 1 }]);
    });

    const items = await client(fetchImpl as unknown as typeof fetch).listItems("Fixture", { limit: "-1" });
    expect(items).toEqual([{ id: 1, spieltag: 1 }]);
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service-key");
    expect(headers.apikey).toBe("service-key");
  });

  it("createItem POSTs and unwraps representation array", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ spieltag: 1, heim_verein: "A" });
      return jsonResponse([{ id: 9, spieltag: 1, heim_verein: "A" }]);
    });
    const created = await client(fetchImpl as unknown as typeof fetch).createItem("Fixture", {
      spieltag: 1,
      heim_verein: "A",
    });
    expect(created).toEqual({ id: 9, spieltag: 1, heim_verein: "A" });
  });

  it("updateItem PATCHes by id", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.supabase.co/rest/v1/fixture?id=eq.4");
      expect(init?.method).toBe("PATCH");
      return jsonResponse([{ id: 4, spieltag: 2 }]);
    });
    const updated = await client(fetchImpl as unknown as typeof fetch).updateItem("Fixture", 4, { spieltag: 2 });
    expect(updated).toEqual({ id: 4, spieltag: 2 });
  });

  it("translates Directus eq filters", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("spieltag=eq.3");
      return jsonResponse([]);
    });
    await client(fetchImpl as unknown as typeof fetch).listItems("RatingHistory", {
      "filter[spieltag][_eq]": "3",
    });
  });

  it("throws truncated PostgREST errors", async () => {
    const longMessage = "x".repeat(250);
    const fetchImpl = vi.fn(async () => jsonResponse({ message: longMessage }, 500));
    await expect(client(fetchImpl as unknown as typeof fetch).createItem("ScrapeLog", {})).rejects.toThrow(
      `Supabase HTTP 500 for POST /rest/v1/scrape_log: ${"x".repeat(200)}…`,
    );
  });
});

describe("writeScrapeLog", () => {
  it("creates a ScrapeLog item with sliced timestamp", async () => {
    const createItem = vi.fn(async () => ({ id: 1 }));
    const catalog = { createItem } as unknown as Parameters<typeof writeScrapeLog>[0];
    await writeScrapeLog(catalog, {
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
