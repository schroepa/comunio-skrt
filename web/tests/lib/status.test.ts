import { describe, expect, it } from "vitest";
import { officeStatus } from "../../src/lib/status";

describe("officeStatus", () => {
  it("computes budget remainder and hides deadline when the season is over", () => {
    const status = officeStatus({
      now: new Date("2026-06-01T12:00:00.000Z"),
      fixtures: [
        {
          spieltag: 34,
          heim_verein: "FCB",
          auswaerts_verein: "BVB",
          datum: "2026-05-01T14:30:00.000Z",
        },
      ],
      marketValues: [1_000_000, 500_000],
      budget: 3_000_000,
      squadCount: 2,
    });

    expect(status.seasonOver).toBe(true);
    expect(status.deadlineIso).toBeNull();
    expect(status.spieltag).toBe(34);
    expect(status.value).toBe(1_500_000);
    expect(status.remaining).toBe(1_500_000);
  });

  it("keeps an upcoming deadline", () => {
    const status = officeStatus({
      now: new Date("2026-08-01T12:00:00.000Z"),
      fixtures: [
        {
          spieltag: 1,
          heim_verein: "FCB",
          auswaerts_verein: "BVB",
          datum: "2026-08-22T14:30:00.000Z",
        },
      ],
      marketValues: [],
      budget: null,
      squadCount: 0,
    });

    expect(status.seasonOver).toBe(false);
    expect(status.spieltag).toBe(1);
    expect(status.deadlineIso).toBeTruthy();
    expect(status.remaining).toBeNull();
  });
});
