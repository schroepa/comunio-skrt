import { describe, expect, it } from "vitest";
import { availabilityGate, robustMinutes } from "../../src/lib/availability";

describe("availabilityGate", () => {
  it("blocks injured and suspended", () => {
    expect(availabilityGate("verletzt")).toBe("block");
    expect(availabilityGate("gesperrt")).toBe("block");
  });

  it("warns on doubtful and treats missing as fit", () => {
    expect(availabilityGate("fraglich")).toBe("warn");
    expect(availabilityGate("fit")).toBe("ok");
    expect(availabilityGate(null)).toBe("ok");
  });
});

describe("robustMinutes", () => {
  it("flags low minutes share", () => {
    expect(robustMinutes([20, 10, 0])).toBe(true);
    expect(robustMinutes([90, 90, 90])).toBe(false);
    expect(robustMinutes([])).toBe(false);
  });
});
