import { afterEach, describe, expect, it, vi } from "vitest";
import { listFixtures } from "../../src/lib/directus";

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
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({
      Authorization: "Bearer test-token",
      Accept: "application/json",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
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
    expect(errorSpy).toHaveBeenCalledWith("Directus HTTP 401 for GET /items/Fixture");
  });

  it("returns unreachable when fetch rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, reason: "directus_unreachable" });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns unreachable when the request aborts", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1,
    });

    expect(result).toEqual({ ok: false, reason: "directus_unreachable" });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns unreachable when the response has no data array", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, reason: "directus_unreachable" });
    expect(errorSpy).toHaveBeenCalledWith("Directus Fixture response missing data array");
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

  it("drops rows with missing or invalid required fields", async () => {
    const validFixture = {
      spieltag: 1,
      heim_verein: "FC Bayern München",
      auswaerts_verein: "RB Leipzig",
      datum: "2026-08-22T13:30:00.000Z",
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          validFixture,
          { ...validFixture, spieltag: "1" },
          { ...validFixture, heim_verein: "" },
          { ...validFixture, auswaerts_verein: "" },
          { ...validFixture, datum: "" },
          null,
        ],
      }),
    });
    const result = await listFixtures({
      url: "http://localhost:8055",
      token: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true, fixtures: [validFixture] });
  });
});
