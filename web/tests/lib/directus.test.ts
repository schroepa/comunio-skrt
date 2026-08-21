import { afterEach, describe, expect, it, vi } from "vitest";
import { listFixtures } from "../../src/lib/directus";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const auth = {
  url: "https://example.supabase.co",
  anonKey: "anon",
  token: "test-token",
};

describe("listFixtures", () => {
  it("does not fetch when the token is missing", async () => {
    const fetchImpl = vi.fn();
    const result = await listFixtures({
      ...auth,
      token: "  ",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, reason: "missing_token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests fixture ordered by datum with bearer and apikey", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          spieltag: 1,
          heim_verein: "FC Bayern München",
          auswaerts_verein: "RB Leipzig",
          datum: "2026-08-22T13:30:00.000Z",
        },
      ],
    });
    const result = await listFixtures({
      ...auth,
      url: "https://example.supabase.co/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/rest/v1/fixture?");
    expect(calledUrl).toContain("order=datum.asc");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer test-token",
        apikey: "anon",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fixtures).toHaveLength(1);
    }
  });

  it("returns unreachable on HTTP 401 without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Invalid token" }),
    });
    const result = await listFixtures({
      ...auth,
      token: "bad",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, reason: "directus_unreachable" });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns unreachable when fetch rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await listFixtures({
      ...auth,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, reason: "directus_unreachable" });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("treats an empty array as success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    const result = await listFixtures({
      ...auth,
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
      json: async () => [
        validFixture,
        { ...validFixture, spieltag: "1" },
        { ...validFixture, heim_verein: "" },
        null,
      ],
    });
    const result = await listFixtures({
      ...auth,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true, fixtures: [validFixture] });
  });
});
