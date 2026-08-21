import { describe, expect, it } from "vitest";
import { formatDeadlineRemaining } from "../../src/lib/countdown";

describe("formatDeadlineRemaining", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("returns läuft when the deadline is not in the future", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-21T11:00:00.000Z"), now)).toBe("läuft");
  });

  it("formats minutes only", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-21T12:09:00.000Z"), now)).toBe("in 9 Min.");
  });

  it("formats hours and minutes", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-21T14:10:00.000Z"), now)).toBe(
      "in 2 Std., 10 Min.",
    );
  });

  it("formats a single day without plural en", () => {
    expect(formatDeadlineRemaining(new Date("2026-08-22T14:00:00.000Z"), now)).toBe(
      "in 1 Tag, 2 Std.",
    );
  });
});
