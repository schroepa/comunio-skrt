import { describe, expect, it } from "vitest";
import { nextOpponents, previousMarketValue, radarRows, venueFor } from "../../src/lib/catalog";
import type { PlayerRecord, ValueHistoryRecord } from "../../src/lib/directus";
import type { FixtureRecord } from "../../src/lib/fixtures";

function player(partial: Partial<PlayerRecord> & Pick<PlayerRecord, "id" | "name">): PlayerRecord {
  return {
    position: "Sturm",
    verein: "FC Bayern München",
    aktueller_marktwert: 10_000_000,
    ...partial,
  };
}

const bayern = player({ id: 1, name: "A", verein: "FC Bayern München", aktueller_marktwert: 80 });
const cheap = player({ id: 2, name: "B", verein: "TSG Hoffenheim", position: "Mittelfeld", aktueller_marktwert: 10 });
const mid = player({ id: 3, name: "C", verein: "VfB Stuttgart", position: "Abwehr", aktueller_marktwert: 40 });

const fixtures: FixtureRecord[] = [
  {
    spieltag: 1,
    heim_verein: "Bayern München",
    auswaerts_verein: "1899 Hoffenheim",
    datum: "2026-08-22T13:30:00.000Z",
  },
];

describe("venueFor / nextOpponents", () => {
  it("matches OpenLigaDB aliases to catalog club names", () => {
    expect(venueFor(bayern, fixtures)).toBe("home");
    expect(nextOpponents(bayern, fixtures)).toBe("1899 Hoffenheim");
  });
});

describe("previousMarketValue", () => {
  it("returns the second-newest history point", () => {
    const history: ValueHistoryRecord[] = [
      { player_id: 1, datum: "2026-08-21", marktwert: 90 },
      { player_id: 1, datum: "2026-08-14", marktwert: 70 },
      { player_id: 2, datum: "2026-08-21", marktwert: 1 },
    ];
    expect(previousMarketValue(1, history)).toBe(70);
    expect(previousMarketValue(2, history)).toBeNull();
  });
});

describe("radarRows", () => {
  it("writes a real fixture reason instead of mapping-placeholder copy", () => {
    const rows = radarRows([bayern, cheap, mid], new Set(), [], [], fixtures, 1, {
      includeHidden: true,
      marketPlayers: [bayern, cheap, mid],
    });
    const row = rows.find((item) => item.player.id === 1);
    expect(row?.opponents).toBe("1899 Hoffenheim");
    expect(row?.reason).not.toMatch(/ohne Mapping/);
    expect(row?.reason).toMatch(/Gegner/);
  });
});
