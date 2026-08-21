import { describe, expect, it } from "vitest";
import type { ParsedPlayer } from "../../src/transfermarkt/parse-kader.ts";
import { validateMarketPlayers } from "../../src/transfermarkt/validate.ts";

const two: ParsedPlayer[] = [
  {
    transfermarkt_id: 17259,
    name: "Manuel Neuer",
    position: "Torwart",
    verein: "FC Bayern München",
    aktueller_marktwert: 4_000_000,
  },
  {
    transfermarkt_id: 132098,
    name: "Harry Kane",
    position: "Sturm",
    verein: "FC Bayern München",
    aktueller_marktwert: 70_000_000,
  },
];

describe("validateMarketPlayers", () => {
  it("rejects two players against default 360–700 bounds", () => {
    const result = validateMarketPlayers(two);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/360|700/);
  });

  it("accepts two players when bounds are 1–10", () => {
    expect(validateMarketPlayers(two, { min: 1, max: 10 })).toEqual({ ok: true });
  });

  it("rejects zero players when bounds are 1–10", () => {
    const result = validateMarketPlayers([], { min: 1, max: 10 });
    expect(result.ok).toBe(false);
  });
});
