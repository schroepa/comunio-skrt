import { describe, expect, it } from "vitest";
import { lastFinishedSpieltag } from "../../src/kicker/sync.ts";

describe("lastFinishedSpieltag", () => {
  it("returns 1 when nothing is in the past", () => {
    expect(
      lastFinishedSpieltag([{ spieltag: 2, datum: "2099-01-01T12:00:00.000Z" }], new Date("2026-08-21T12:00:00.000Z")),
    ).toBe(1);
  });

  it("uses the max past matchday", () => {
    expect(
      lastFinishedSpieltag(
        [
          { spieltag: 1, datum: "2026-08-01T12:00:00.000Z" },
          { spieltag: 2, datum: "2026-08-10T12:00:00.000Z" },
          { spieltag: 3, datum: "2099-01-01T12:00:00.000Z" },
        ],
        new Date("2026-08-21T12:00:00.000Z"),
      ),
    ).toBe(2);
  });
});
