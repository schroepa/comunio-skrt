import { afterEach, describe, expect, it, vi } from "vitest";
import { loginWithPassword } from "../../src/lib/session";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loginWithPassword", () => {
  it("maps 400 to invalid_credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    const result = await loginWithPassword({
      url: "https://example.supabase.co",
      anonKey: "anon",
      email: "a@b.c",
      password: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("returns tokens on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "a", refresh_token: "r" }),
    });
    const result = await loginWithPassword({
      url: "https://example.supabase.co/",
      anonKey: "anon",
      email: "a@b.c",
      password: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, tokens: { access_token: "a", refresh_token: "r" } });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "https://example.supabase.co/auth/v1/token?grant_type=password",
    );
  });
});
