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
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
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

  it("uses default User-Agent when userAgent is omitted", async () => {
    await setup();
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = createHttpClient({
      cacheDir: dir,
      ttlMs: 60_000,
      minDelayMs: 0,
      fetchImpl,
      now: () => 1_000,
    });

    await client.getJson("https://example.test/data");
    const request = fetchImpl.mock.calls[0][0] as Request;
    expect(request.headers.get("User-Agent")).toBe("comunio-helper/0.1 (private)");
  });

  it("serializes concurrent live requests to respect minDelayMs", async () => {
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

    await Promise.all([
      client.getJson("https://example.test/a"),
      client.getJson("https://example.test/b"),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
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

  it("waits minDelayMs after a rejected live fetch", async () => {
    await setup();
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
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

    await expect(client.getJson("https://example.test/a")).rejects.toThrow("network down");
    now = 10_100;
    await client.getJson("https://example.test/b");

    expect(sleep).toHaveBeenCalledWith(150);
  });

  it("fetches HTML text on cache miss with Accept text/html", async () => {
    await setup();
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
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
});
