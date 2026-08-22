import { describe, expect, it } from "vitest";
import { canonicalClub, clubValues, rankPercentile, sameClub } from "../../src/lib/clubs";

const groups = [
  ["FC Bayern München", "Bayern München"],
  ["TSG Hoffenheim", "1899 Hoffenheim", "TSG 1899 Hoffenheim"],
  ["Bayer 04 Leverkusen", "Bayer Leverkusen"],
  ["RB Leipzig", "RasenBallsport Leipzig"],
  ["Borussia Mönchengladbach", "Borussia M'gladbach"],
  ["1. FC Union Berlin", "1.FC Union Berlin", "Union Berlin"],
  ["1. FSV Mainz 05", "1.FSV Mainz 05", "Mainz 05"],
  ["1. FC Heidenheim", "1. FC Heidenheim 1846", "1.FC Heidenheim 1846"],
  ["1. FC Köln", "1.FC Köln"],
  ["SC Freiburg", "Sport-Club Freiburg"],
  ["VfL Bochum", "VfL Bochum 1848"],
] as const;

describe("sameClub", () => {
  it("matches every pair inside each required group", () => {
    for (const group of groups) {
      for (const a of group) {
        for (const b of group) {
          expect(sameClub(a, b)).toBe(true);
        }
      }
    }
  });

  it("matches identical unknown names and rejects different clubs", () => {
    expect(sameClub("VfB Stuttgart", "VfB Stuttgart")).toBe(true);
    expect(sameClub("FC Bayern München", "Borussia Dortmund")).toBe(false);
  });
});

describe("canonicalClub", () => {
  it("maps aliases to the group head and leaves unknown names trimmed", () => {
    expect(canonicalClub(" Bayern München ")).toBe("FC Bayern München");
    expect(canonicalClub("VfB Stuttgart")).toBe("VfB Stuttgart");
  });
});

describe("clubValues", () => {
  it("sums market values per canonical club", () => {
    const values = clubValues([
      { verein: "Bayern München", aktueller_marktwert: 10 },
      { verein: "FC Bayern München", aktueller_marktwert: 5 },
      { verein: "VfB Stuttgart", aktueller_marktwert: 7 },
    ]);
    expect(values.get("FC Bayern München")).toBe(15);
    expect(values.get("VfB Stuttgart")).toBe(7);
  });
});

describe("rankPercentile", () => {
  it("returns null with fewer than two peers and ranks otherwise", () => {
    expect(rankPercentile(10, [10])).toBeNull();
    expect(rankPercentile(20, [10, 20, 30])).toBe(50);
  });
});
