export const ACCESS_COOKIE = "comunio_access";
export const REFRESH_COOKIE = "comunio_refresh";

export type DirectusTokens = {
  access_token: string;
  refresh_token: string;
};

export type SessionUser = {
  id: string;
  email: string;
};

export type AuthResult =
  | { ok: true; tokens: DirectusTokens }
  | { ok: false; reason: "invalid_credentials" | "directus_unreachable" };

type FetchLike = typeof fetch;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loginWithPassword(options: {
  url: string;
  email: string;
  password: string;
  fetchImpl?: FetchLike;
}): Promise<AuthResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: options.email, password: options.password }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return { ok: false, reason: "invalid_credentials" };
    if (!response.ok) return { ok: false, reason: "directus_unreachable" };
    const body = (await readJson(response)) as { data?: { access_token?: unknown; refresh_token?: unknown } };
    const access = body?.data?.access_token;
    const refresh = body?.data?.refresh_token;
    if (typeof access !== "string" || typeof refresh !== "string") {
      return { ok: false, reason: "directus_unreachable" };
    }
    return { ok: true, tokens: { access_token: access, refresh_token: refresh } };
  } catch {
    return { ok: false, reason: "directus_unreachable" };
  }
}

export async function fetchMe(options: {
  url: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<SessionUser | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/users/me`, {
      headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await readJson(response)) as { data?: { id?: unknown; email?: unknown } };
    if (typeof body?.data?.id !== "string" || typeof body.data.email !== "string") return null;
    return { id: body.data.id, email: body.data.email };
  } catch {
    return null;
  }
}

export async function refreshTokens(options: {
  url: string;
  refreshToken: string;
  fetchImpl?: FetchLike;
}): Promise<DirectusTokens | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: options.refreshToken, mode: "json" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await readJson(response)) as { data?: { access_token?: unknown; refresh_token?: unknown } };
    if (typeof body?.data?.access_token !== "string" || typeof body.data.refresh_token !== "string") return null;
    return { access_token: body.data.access_token, refresh_token: body.data.refresh_token };
  } catch {
    return null;
  }
}
