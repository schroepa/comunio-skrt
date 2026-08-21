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
    await expect(client.login()).rejects.toThrow(
      "Directus HTTP 401 for POST /auth/login: Invalid",
    );
  });

  it("truncates long Directus error messages", async () => {
    const longMessage = "x".repeat(250);
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ errors: [{ message: longMessage }] }, 500),
    );
    const client = createDirectusClient({
      baseUrl: "http://localhost:8055",
      email: "a@b.dev",
      password: "bad",
      fetchImpl,
    });

    await expect(client.login()).rejects.toThrow(
      `Directus HTTP 500 for POST /auth/login: ${"x".repeat(200)}…`,
    );
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
