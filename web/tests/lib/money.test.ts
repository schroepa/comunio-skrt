import { describe, expect, it } from "vitest";
import { budgetRemaining, squadValue } from "../../src/lib/money";

describe("squadValue", () => {
  it("sums market values", () => {
    expect(squadValue([10, 20, 5])).toBe(35);
    expect(squadValue([])).toBe(0);
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
