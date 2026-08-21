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
