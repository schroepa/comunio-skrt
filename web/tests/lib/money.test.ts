import { describe, expect, it } from "vitest";
import { budgetRemaining, formatMarketValue, squadValue } from "../../src/lib/money";

describe("squadValue", () => {
  it("sums market values", () => {
    expect(squadValue([10, 20, 5])).toBe(35);
    expect(squadValue([])).toBe(0);
  });
});

describe("formatMarketValue", () => {
  it("uses Mio from one million up", () => {
    expect(formatMarketValue(1_000_000)).toBe("1 Mio");
    expect(formatMarketValue(1_800_000)).toBe("1,8 Mio");
    expect(formatMarketValue(18_000_000)).toBe("18 Mio");
  });

  it("keeps euro amounts under one million", () => {
    expect(formatMarketValue(750_000)).toBe("750.000 €");
    expect(formatMarketValue(0)).toBe("0 €");
  });
});

describe("budgetRemaining", () => {
  it("returns null without a budget", () => {
    expect(budgetRemaining(null, 10)).toBeNull();
    expect(budgetRemaining(undefined, 10)).toBeNull();
  });

  it("subtracts kaderwert", () => {
    expect(budgetRemaining(40, 25)).toBe(15);
  });
});
