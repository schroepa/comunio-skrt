import { describe, expect, it } from "vitest";
import {
  marketMovers,
  nextOpponents,
  pickTopSignals,
  previousMarketValue,
  radarRows,
  type RadarRow,
  venueFor,
} from "../../src/lib/catalog";
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
    expect(row?.reason).toContain("günstige Gegner");
  });
});

function row(partial: Pick<RadarRow, "badge" | "divergence" | "player">): RadarRow {
  return {
    market: 1,
    form: 80,
    notes: [],
    opponents: "—",
    reason: "",
    inSquad: false,
    ...partial,
  };
}

describe("pickTopSignals", () => {
  it("returns two buys by divergence then one sell", () => {
    const picked = pickTopSignals([
      row({ badge: "Kaufen", divergence: 20, player: mid }),
      row({ badge: "Verkaufen", divergence: -40, player: cheap }),
      row({ badge: "Beobachten", divergence: 10, player: mid }),
      row({ badge: "Kaufen", divergence: 40, player: bayern }),
      row({ badge: "Kaufen", divergence: 30, player: cheap }),
    ]);
    expect(picked.map((item) => [item.badge, item.divergence])).toEqual([
      ["Kaufen", 40],
      ["Kaufen", 30],
      ["Verkaufen", -40],
    ]);
  });
});

describe("marketMovers", () => {
  it("takes three gainers and three losers and skips single-point history", () => {
    const squad = [
      player({ id: 1, name: "Aaa", aktueller_marktwert: 120 }),
      player({ id: 2, name: "Bbb", aktueller_marktwert: 50 }),
      player({ id: 3, name: "Ccc", aktueller_marktwert: 10 }),
    ];
    const history: ValueHistoryRecord[] = [
      { player_id: 1, datum: "2026-08-21", marktwert: 120 },
      { player_id: 1, datum: "2026-08-14", marktwert: 100 },
      { player_id: 2, datum: "2026-08-21", marktwert: 50 },
      { player_id: 2, datum: "2026-08-14", marktwert: 80 },
      { player_id: 3, datum: "2026-08-21", marktwert: 10 },
    ];
    const { gainers, losers } = marketMovers(squad, history);
    expect(gainers.map((item) => item.player.id)).toEqual([1]);
    expect(gainers[0].delta).toBe(20);
    expect(losers.map((item) => item.player.id)).toEqual([2]);
    expect(losers[0].delta).toBe(-30);
  });
});
