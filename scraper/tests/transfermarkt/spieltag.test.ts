import { describe, expect, it } from "vitest";
import { nextSpieltag } from "../../src/transfermarkt/spieltag.ts";

const now = new Date("2026-08-21T12:00:00.000Z");

describe("nextSpieltag", () => {
  it("returns spieltag 2 when spieltag 1 is yesterday and spieltag 2 is tomorrow", () => {
    const fixtures = [
      { spieltag: 1, datum: "2026-08-20T15:00:00.000Z" },
      { spieltag: 2, datum: "2026-08-22T15:00:00.000Z" },
    ];
    expect(nextSpieltag(fixtures, now)).toBe(2);
  });

  it("returns null when every kickoff is in the past", () => {
    const fixtures = [
      { spieltag: 1, datum: "2026-08-20T15:00:00.000Z" },
      { spieltag: 2, datum: "2026-08-20T17:00:00.000Z" },
    ];
    expect(nextSpieltag(fixtures, now)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(nextSpieltag([], now)).toBeNull();
  });

  it("stays on a matchday that still has a kickoff at or after now", () => {
    const fixtures = [
      { spieltag: 1, datum: "2026-08-20T15:00:00.000Z" },
      { spieltag: 1, datum: "2026-08-21T16:30:00.000Z" },
      { spieltag: 2, datum: "2026-08-29T13:30:00.000Z" },
    ];
    expect(nextSpieltag(fixtures, now)).toBe(1);
  });
});
