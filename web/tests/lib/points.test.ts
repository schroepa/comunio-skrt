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
});
