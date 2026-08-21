import { describe, expect, it } from "vitest";
import type { ParsedFixture } from "../../src/openligadb/parse.ts";
import { validateFixtures } from "../../src/openligadb/validate.ts";

function makeSeason(count: number): ParsedFixture[] {
  const fixtures: ParsedFixture[] = [];
  let n = 0;
  for (let spieltag = 1; spieltag <= 34 && n < count; spieltag++) {
    for (let i = 0; i < 9 && n < count; i++) {
      fixtures.push({
        spieltag,
        heim_verein: `Heim-${spieltag}-${i}`,
        auswaerts_verein: `Auswaerts-${spieltag}-${i}`,
        datum: "2025-08-22T15:30:00",
      });
      n++;
    }
  }
  return fixtures;
}

describe("validateFixtures", () => {
  it("accepts a full 306-match Bundesliga season", () => {
    expect(validateFixtures(makeSeason(306))).toEqual({ ok: true });
  });

  it("rejects a single matchday (9 matches)", () => {
    const result = validateFixtures(makeSeason(9));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/270/i);
  });

  it("rejects duplicate keys", () => {
    const fixtures = makeSeason(306);
    fixtures[1] = { ...fixtures[0] };
    const result = validateFixtures(fixtures);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/duplikat/i);
  });

  it("rejects spieltag outside 1–34", () => {
    const fixtures = makeSeason(306);
    fixtures[0] = { ...fixtures[0], spieltag: 35 };
    const result = validateFixtures(fixtures);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/spieltag/i);
  });
});
