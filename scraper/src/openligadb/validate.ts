import type { ParsedFixture } from "./parse.ts";

export const MIN_SEASON_MATCHES = 270;
export const MAX_SEASON_MATCHES = 320;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const DATUM_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function validateFixtures(fixtures: ParsedFixture[]): ValidationResult {
  if (fixtures.length < MIN_SEASON_MATCHES || fixtures.length > MAX_SEASON_MATCHES) {
    return {
      ok: false,
      reason: `erwartete 270–320 Spiele, erhalten ${fixtures.length}`,
    };
  }

  const seen = new Set<string>();
  for (const fixture of fixtures) {
    if (!Number.isInteger(fixture.spieltag) || fixture.spieltag < 1 || fixture.spieltag > 34) {
      return { ok: false, reason: `spieltag außerhalb 1–34: ${fixture.spieltag}` };
    }
    if (!fixture.heim_verein || !fixture.auswaerts_verein) {
      return { ok: false, reason: "leerer Vereinsname" };
    }
    if (fixture.heim_verein === fixture.auswaerts_verein) {
      return { ok: false, reason: `heim und auswärts identisch: ${fixture.heim_verein}` };
    }
    if (!DATUM_RE.test(fixture.datum)) {
      return { ok: false, reason: `ungültiges datum: ${fixture.datum}` };
    }
    const key = `${fixture.spieltag}|${fixture.heim_verein}|${fixture.auswaerts_verein}`;
    if (seen.has(key)) {
      return { ok: false, reason: `duplikat: ${key}` };
    }
    seen.add(key);
  }
  return { ok: true };
}
