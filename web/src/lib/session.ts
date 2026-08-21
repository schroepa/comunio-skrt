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

function authHeaders(anonKey: string, token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function loginWithPassword(options: {
  url: string;
  anonKey: string;
  email: string;
  password: string;
  fetchImpl?: FetchLike;
}): Promise<AuthResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  if (!base || !options.anonKey.trim()) return { ok: false, reason: "directus_unreachable" };
  try {
    const response = await fetchImpl(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(options.anonKey),
      body: JSON.stringify({ email: options.email, password: options.password }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 400 || response.status === 401) return { ok: false, reason: "invalid_credentials" };
    if (!response.ok) return { ok: false, reason: "directus_unreachable" };
    const body = (await readJson(response)) as { access_token?: unknown; refresh_token?: unknown };
    if (typeof body?.access_token !== "string" || typeof body.refresh_token !== "string") {
      return { ok: false, reason: "directus_unreachable" };
    }
    return { ok: true, tokens: { access_token: body.access_token, refresh_token: body.refresh_token } };
  } catch {
    return { ok: false, reason: "directus_unreachable" };
  }
}

export async function fetchMe(options: {
  url: string;
  anonKey: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<SessionUser | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/auth/v1/user`, {
      headers: authHeaders(options.anonKey, options.token),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await readJson(response)) as { id?: unknown; email?: unknown };
    if (typeof body?.id !== "string" || typeof body.email !== "string") return null;
    return { id: body.id, email: body.email };
  } catch {
    return null;
  }
}

export async function refreshTokens(options: {
  url: string;
  anonKey: string;
  refreshToken: string;
  fetchImpl?: FetchLike;
}): Promise<DirectusTokens | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: authHeaders(options.anonKey),
      body: JSON.stringify({ refresh_token: options.refreshToken }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await readJson(response)) as { access_token?: unknown; refresh_token?: unknown };
    if (typeof body?.access_token !== "string" || typeof body.refresh_token !== "string") return null;
    return { access_token: body.access_token, refresh_token: body.refresh_token };
  } catch {
    return null;
  }
}
