import { describe, expect, it } from "vitest";
import { formScore, radarBadge } from "../../src/lib/scores";

describe("formScore", () => {
  it("returns null without notes", () => {
    expect(formScore([])).toBeNull();
  });

  it("gives a perfect 1.0 a score of 100", () => {
    expect(formScore([1])).toBe(100);
  });
});

describe("radarBadge", () => {
  it("hides weak outsiders and blocks injuries", () => {
    expect(radarBadge({ inSquad: false, form: 40, price: 50, gate: "ok" })).toBe("hidden");
    expect(radarBadge({ inSquad: true, form: 80, price: 20, gate: "block" })).toBe("Nicht verfügbar");
  });

  it("marks strong outsiders as buy", () => {
    expect(radarBadge({ inSquad: false, form: 80, price: 40, gate: "ok" })).toBe("Kaufen");
  });
});
