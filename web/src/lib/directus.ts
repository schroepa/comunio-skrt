import type { FixtureRecord } from "./fixtures";

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

export async function listFixtures(options: {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<FixtureLoadResult> {
  const token = options.token.trim();
  if (!token) return { ok: false, reason: "missing_token" };

  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  const url = `${base}/items/Fixture?limit=-1&sort=datum`;

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`Directus HTTP ${response.status} for GET /items/Fixture`);
      return { ok: false, reason: "directus_unreachable" };
    }

    const body = (await response.json()) as { data?: unknown };
    if (!Array.isArray(body.data)) {
      console.error("Directus Fixture response missing data array");
      return { ok: false, reason: "directus_unreachable" };
    }

    const fixtures = body.data.filter(isFixtureRecord).map((row) => ({
      spieltag: row.spieltag,
      heim_verein: row.heim_verein,
      auswaerts_verein: row.auswaerts_verein,
      datum: row.datum,
    }));

    return { ok: true, fixtures };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Directus Fixture request failed: ${message}`);
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

async function getItems<T>(options: {
  url: string;
  token: string;
  path: string;
  fetchImpl?: typeof fetch;
}): Promise<T[] | null> {
  const token = options.token.trim();
  if (!token) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}${options.path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: unknown };
    return Array.isArray(body.data) ? (body.data as T[]) : null;
  } catch {
    return null;
  }
}

async function mutateItem(options: {
  url: string;
  token: string;
  path: string;
  method: string;
  body?: object;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}${options.path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

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

export async function listPlayers(options: { url: string; token: string; search?: string; fetchImpl?: typeof fetch }) {
  const filter = options.search?.trim()
    ? `&filter[name][_icontains]=${encodeURIComponent(options.search.trim())}`
    : "";
  const limit = options.search?.trim() ? "80" : "-1";
  const rows = await getItems<unknown>({
    ...options,
    path: `/items/Player?limit=${limit}&sort=name${filter}&fields=id,name,position,verein,aktueller_marktwert`,
  });
  return (rows ?? []).filter(isPlayer);
}

export async function listSquad(options: { url: string; token: string; userId: string; fetchImpl?: typeof fetch }) {
  const rows = await getItems<SquadRow>({
    ...options,
    path: `/items/SquadMembership?limit=-1&filter[user_id][_eq]=${encodeURIComponent(options.userId)}&filter[im_kader][_eq]=true`,
  });
  return rows ?? [];
}

export async function addToSquad(options: {
  url: string;
  token: string;
  userId: string;
  playerId: number;
  fetchImpl?: typeof fetch;
}) {
  return mutateItem({
    ...options,
    path: "/items/SquadMembership",
    method: "POST",
    body: {
      user_id: options.userId,
      player_id: options.playerId,
      im_kader: true,
      hinzugefuegt_am: new Date().toISOString().slice(0, 10),
    },
  });
}

export async function removeFromSquad(options: {
  url: string;
  token: string;
  membershipId: number;
  fetchImpl?: typeof fetch;
}) {
  return mutateItem({
    ...options,
    path: `/items/SquadMembership/${options.membershipId}`,
    method: "DELETE",
  });
}

export async function getManagerProfile(options: { url: string; token: string; userId: string; fetchImpl?: typeof fetch }) {
  const rows = await getItems<ManagerProfileRecord>({
    ...options,
    path: `/items/ManagerProfile?limit=1&filter[user_id][_eq]=${encodeURIComponent(options.userId)}`,
  });
  return rows?.[0] ?? null;
}

export async function saveBudget(options: {
  url: string;
  token: string;
  userId: string;
  budget: number;
  profileId?: number;
  fetchImpl?: typeof fetch;
}) {
  if (options.profileId) {
    return mutateItem({
      ...options,
      path: `/items/ManagerProfile/${options.profileId}`,
      method: "PATCH",
      body: { budget: options.budget },
    });
  }
  return mutateItem({
    ...options,
    path: "/items/ManagerProfile",
    method: "POST",
    body: { user_id: options.userId, budget: options.budget },
  });
}

export async function listRatings(options: { url: string; token: string; fetchImpl?: typeof fetch }) {
  return (
    (await getItems<RatingRecord>({
      ...options,
      path: "/items/RatingHistory?limit=-1&sort=-spieltag",
    })) ?? []
  );
}

export async function listAvailability(options: { url: string; token: string; spieltag: number; fetchImpl?: typeof fetch }) {
  return (
    (await getItems<AvailabilityRecord>({
      ...options,
      path: `/items/AvailabilityStatus?limit=-1&filter[spieltag][_eq]=${options.spieltag}`,
    })) ?? []
  );
}

export async function listCompetitors(options: { url: string; token: string; userId: string; fetchImpl?: typeof fetch }) {
  return (
    (await getItems<CompetitorRow>({
      ...options,
      path: `/items/CompetitorSquad?limit=-1&filter[user_id][_eq]=${encodeURIComponent(options.userId)}`,
    })) ?? []
  );
}

export async function addCompetitor(options: {
  url: string;
  token: string;
  userId: string;
  competitorName: string;
  playerId: number;
  fetchImpl?: typeof fetch;
}) {
  return mutateItem({
    ...options,
    path: "/items/CompetitorSquad",
    method: "POST",
    body: {
      user_id: options.userId,
      competitor_name: options.competitorName.trim(),
      player_id: options.playerId,
    },
  });
}

export async function removeCompetitor(options: {
  url: string;
  token: string;
  id: number;
  fetchImpl?: typeof fetch;
}) {
  return mutateItem({
    ...options,
    path: `/items/CompetitorSquad/${options.id}`,
    method: "DELETE",
  });
}

