import { describe, expect, it } from "vitest";
import { expectedPoints } from "../../src/lib/points";

describe("expectedPoints", () => {
  it("returns 0 when blocked", () => {
    expect(
      expectedPoints({
        notesNewestFirst: [2],
        status: "gesperrt",
        lastThreeMinutes: [90, 90, 90],
        venue: "home",
      }),
    ).toBe(0);
  });

  it("uses 3.0 as base without notes", () => {
    expect(
      expectedPoints({
        notesNewestFirst: [],
        status: "fit",
        lastThreeMinutes: [90, 90, 90],
        venue: "unknown",
      }),
    ).toBe(3);
  });

  it("scales the estimate after venue using the fixture modifier", () => {
    const base = {
      notesNewestFirst: [] as number[],
      status: "fit" as const,
      lastThreeMinutes: [90, 90, 90],
      venue: "unknown" as const,
    };
    expect(expectedPoints({ ...base, fixtureModifier: 1 })).toBe(3.3);
    expect(expectedPoints({ ...base, fixtureModifier: -1 })).toBe(2.7);
    expect(expectedPoints({ ...base, fixtureModifier: 0 })).toBe(3);
  });

  it("keeps blocked players at 0 even with a favorable modifier", () => {
    expect(
      expectedPoints({
        notesNewestFirst: [2],
        status: "gesperrt",
        lastThreeMinutes: [90, 90, 90],
        venue: "home",
        fixtureModifier: 1,
      }),
    ).toBe(0);
  });
});
