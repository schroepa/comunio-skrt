import type { FixtureRecord } from "./fixtures";

export type CatalogAuth = {
  url: string;
  anonKey: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type FixtureLoadResult =
  | { ok: true; fixtures: FixtureRecord[] }
  | { ok: false; reason: "missing_token" | "directus_unreachable" };

const DEFAULT_TIMEOUT_MS = 8000;

function isFixtureRecord(value: unknown): value is FixtureRecord {
  if (typeof value !== "object" || value === null) return false;

  const row = value as Record<string, unknown>;
  return (
    typeof row.spieltag === "number" &&
    typeof row.heim_verein === "string" &&
    row.heim_verein.length > 0 &&
    typeof row.auswaerts_verein === "string" &&
    row.auswaerts_verein.length > 0 &&
    typeof row.datum === "string" &&
    row.datum.length > 0
  );
}

function restHeaders(anonKey: string, token: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function getItems<T>(options: CatalogAuth & { path: string }): Promise<T[] | null> {
  const token = options.token.trim();
  const anonKey = options.anonKey.trim();
  if (!token || !anonKey) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}${options.path}`, {
      headers: restHeaders(anonKey, token),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as unknown;
    return Array.isArray(body) ? (body as T[]) : null;
  } catch {
    return null;
  }
}

async function mutateItem(options: CatalogAuth & { path: string; method: string; body?: object }): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}${options.path}`, {
      method: options.method,
      headers: restHeaders(options.anonKey, options.token),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listFixtures(options: CatalogAuth): Promise<FixtureLoadResult> {
  const token = options.token.trim();
  if (!token || !options.anonKey.trim()) return { ok: false, reason: "missing_token" };

  try {
    const rows = await getItems<unknown>({
      ...options,
      path: "/rest/v1/fixture?select=spieltag,heim_verein,auswaerts_verein,datum&order=datum.asc&limit=10000",
    });
    if (rows == null) {
      console.error("Supabase HTTP error for GET /rest/v1/fixture");
      return { ok: false, reason: "directus_unreachable" };
    }
    const fixtures = rows.filter(isFixtureRecord).map((row) => ({
      spieltag: row.spieltag,
      heim_verein: row.heim_verein,
      auswaerts_verein: row.auswaerts_verein,
      datum: row.datum,
    }));
    return { ok: true, fixtures };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Supabase Fixture request failed: ${message}`);
    return { ok: false, reason: "directus_unreachable" };
  }
}

export type PlayerRecord = {
  id: number;
  name: string;
  position: string;
  verein: string;
  aktueller_marktwert: number;
};

export type SquadRow = {
  id: number;
  player_id: number;
  im_kader: boolean;
  kaufpreis: number | null;
};

export type ManagerProfileRecord = {
  id: number;
  user_id: string;
  budget: number | null;
};

export type RatingRecord = {
  player_id: number;
  spieltag: number;
  note: number;
  minuten_gespielt: number | null;
};

export type AvailabilityRecord = {
  player_id: number;
  spieltag: number;
  status: string;
};

export type CompetitorRow = {
  id: number;
  competitor_name: string;
  player_id: number;
};

function isPlayer(value: unknown): value is PlayerRecord {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.name === "string" &&
    typeof row.position === "string" &&
    typeof row.verein === "string" &&
    typeof row.aktueller_marktwert === "number"
  );
}

export async function listPlayers(options: CatalogAuth & { search?: string }) {
  const filter = options.search?.trim()
    ? `&name=ilike.*${encodeURIComponent(options.search.trim())}*`
    : "";
  const limit = options.search?.trim() ? "80" : "10000";
  const rows = await getItems<unknown>({
    ...options,
    path: `/rest/v1/player?select=id,name,position,verein,aktueller_marktwert&order=name.asc&limit=${limit}${filter}`,
  });
  return (rows ?? []).filter(isPlayer);
}

export async function listSquad(options: CatalogAuth & { userId: string }) {
  return (
    (await getItems<SquadRow>({
      ...options,
      path: `/rest/v1/squad_membership?select=id,player_id,im_kader,kaufpreis&user_id=eq.${encodeURIComponent(options.userId)}&im_kader=eq.true&limit=10000`,
    })) ?? []
  );
}

export async function addToSquad(options: CatalogAuth & { userId: string; playerId: number }) {
  return mutateItem({
    ...options,
    path: "/rest/v1/squad_membership",
    method: "POST",
    body: {
      user_id: options.userId,
      player_id: options.playerId,
      im_kader: true,
      hinzugefuegt_am: new Date().toISOString().slice(0, 10),
    },
  });
}

export async function removeFromSquad(options: CatalogAuth & { membershipId: number }) {
  return mutateItem({
    ...options,
    path: `/rest/v1/squad_membership?id=eq.${options.membershipId}`,
    method: "DELETE",
  });
}

export async function getManagerProfile(options: CatalogAuth & { userId: string }) {
  const rows = await getItems<ManagerProfileRecord>({
    ...options,
    path: `/rest/v1/manager_profile?select=id,user_id,budget&user_id=eq.${encodeURIComponent(options.userId)}&limit=1`,
  });
  return rows?.[0] ?? null;
}

export async function saveBudget(options: CatalogAuth & { userId: string; budget: number; profileId?: number }) {
  if (options.profileId) {
    return mutateItem({
      ...options,
      path: `/rest/v1/manager_profile?id=eq.${options.profileId}`,
      method: "PATCH",
      body: { budget: options.budget },
    });
  }
  return mutateItem({
    ...options,
    path: "/rest/v1/manager_profile",
    method: "POST",
    body: { user_id: options.userId, budget: options.budget },
  });
}

export async function listRatings(options: CatalogAuth) {
  return (
    (await getItems<RatingRecord>({
      ...options,
      path: "/rest/v1/rating_history?select=player_id,spieltag,note,minuten_gespielt&order=spieltag.desc&limit=10000",
    })) ?? []
  );
}

export async function listAvailability(options: CatalogAuth & { spieltag: number }) {
  return (
    (await getItems<AvailabilityRecord>({
      ...options,
      path: `/rest/v1/availability_status?select=player_id,spieltag,status&spieltag=eq.${options.spieltag}&limit=10000`,
    })) ?? []
  );
}

export async function listCompetitors(options: CatalogAuth & { userId: string }) {
  return (
    (await getItems<CompetitorRow>({
      ...options,
      path: `/rest/v1/competitor_squad?select=id,competitor_name,player_id&user_id=eq.${encodeURIComponent(options.userId)}&limit=10000`,
    })) ?? []
  );
}

export async function addCompetitor(options: CatalogAuth & { userId: string; competitorName: string; playerId: number }) {
  return mutateItem({
    ...options,
    path: "/rest/v1/competitor_squad",
    method: "POST",
    body: {
      user_id: options.userId,
      competitor_name: options.competitorName.trim(),
      player_id: options.playerId,
    },
  });
}

export async function removeCompetitor(options: CatalogAuth & { id: number }) {
  return mutateItem({
    ...options,
    path: `/rest/v1/competitor_squad?id=eq.${options.id}`,
    method: "DELETE",
  });
}
