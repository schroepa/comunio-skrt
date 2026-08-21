import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveDeadline,
  getNextMatchday,
  nextMatchdayFixtures,
  type FixtureRecord,
} from "../../src/lib/fixtures";

const sample = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../fixtures/fixtures-sample.json"), "utf8"),
) as FixtureRecord[];

describe("getNextMatchday", () => {
  it("returns null for an empty list", () => {
    expect(getNextMatchday([], new Date("2026-08-21T12:00:00.000Z"))).toBeNull();
  });

  it("picks Spieltag 1 when that round is still in the future", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.spieltag).toBe(1);
    expect(view?.seasonOver).toBe(false);
    expect(view?.fixtures).toHaveLength(2);
    expect(view?.deadline?.toISOString()).toBe("2026-08-22T13:30:00.000Z");
    expect(nextMatchdayFixtures(sample, now).map((f) => f.heim_verein)).toEqual([
      "FC Bayern München",
      "Bayer 04 Leverkusen",
    ]);
    expect(deriveDeadline(sample, now)?.toISOString()).toBe("2026-08-22T13:30:00.000Z");
  });

  it("stays on Spieltag 1 after the first kickoff and moves the deadline", () => {
    const now = new Date("2026-08-22T15:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.spieltag).toBe(1);
    expect(view?.deadline?.toISOString()).toBe("2026-08-22T16:30:00.000Z");
    expect(view?.fixtures).toHaveLength(2);
  });

  it("moves to Spieltag 2 once Spieltag 1 is finished", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.spieltag).toBe(2);
    expect(view?.deadline?.toISOString()).toBe("2026-08-29T13:30:00.000Z");
  });

  it("marks the season over when every kickoff is in the past", () => {
    const now = new Date("2027-05-23T12:00:00.000Z");
    const view = getNextMatchday(sample, now);
    expect(view?.seasonOver).toBe(true);
    expect(view?.spieltag).toBe(34);
    expect(view?.deadline).toBeNull();
    expect(view?.fixtures).toHaveLength(1);
    expect(deriveDeadline(sample, now)).toBeNull();
  });
});
