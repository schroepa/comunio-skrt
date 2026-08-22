import { describe, expect, it } from "vitest";
import { fixtureModifier, fixtureText, formScore, priceScore, radarBadge } from "../../src/lib/scores";

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

describe("fixtureModifier", () => {
  it("returns 0 for an empty list, +1 below one third, -1 above two thirds", () => {
    expect(fixtureModifier([])).toBe(0);
    expect(fixtureModifier([20])).toBe(1);
    expect(fixtureModifier([50])).toBe(0);
    expect(fixtureModifier([80])).toBe(-1);
  });
});

describe("fixtureText", () => {
  it("uses unknown copy when no percentiles exist", () => {
    expect(fixtureText(0, 0)).toBe("Gegner unbekannt");
    expect(fixtureText(1, 1)).toBe("günstige Gegner");
    expect(fixtureText(-1, 2)).toBe("schwere Gegner");
    expect(fixtureText(0, 3)).toBe("gemischte Gegner");
  });
});

describe("priceScore", () => {
  const peers = [10, 20, 30];

  it("stays peer-only without a usable previous value", () => {
    expect(priceScore(20, peers)).toBe(50);
    expect(priceScore(20, peers, null)).toBe(50);
    expect(priceScore(20, peers, 0)).toBe(50);
  });

  it("mixes 60% peer and 40% trend when history exists", () => {
    expect(priceScore(20, peers, 20 / 1.2)).toBe(70);
    expect(priceScore(20, peers, 20 / 0.8)).toBe(30);
  });
});
