import { describe, expect, it } from "vitest";
import { radarRows } from "../../src/lib/catalog";
import type { PlayerRecord, RatingRecord } from "../../src/lib/directus";
import { formBarHeights, parseRadarSort, positionChip, sortRadarRows, type SortableRadarRow } from "../../src/lib/radar-view";

function player(id: number, name: string, extra: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    id,
    name,
    position: "Sturm",
    verein: "VfB Stuttgart",
    aktueller_marktwert: 10_000_000,
    ...extra,
  };
}

describe("radarRows includeHidden", () => {
  const weak = player(1, "Schwach", { aktueller_marktwert: 20_000_000 });
  const ratings: RatingRecord[] = [{ player_id: 1, spieltag: 1, note: 4, minuten_gespielt: 90 }];

  it("skips weak outsiders by default", () => {
    const rows = radarRows([weak], new Set(), ratings, [], [], 1);
    expect(rows).toEqual([]);
  });

  it("keeps them when includeHidden is set", () => {
    const rows = radarRows([weak], new Set(), ratings, [], [], 1, { includeHidden: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.badge).toBe("Kein Signal");
    expect(rows[0]?.notes).toEqual([4]);
  });
});

describe("parseRadarSort", () => {
  it("defaults to form", () => {
    expect(parseRadarSort(new URLSearchParams())).toBe("form");
  });

  it("accepts known keys", () => {
    expect(parseRadarSort(new URLSearchParams("sort=market"))).toBe("market");
  });
});

describe("sortRadarRows", () => {
  const rows = [
    { player: { name: "B" }, form: 10, market: 3, badge: "Verkaufen" },
    { player: { name: "A" }, form: 80, market: 1, badge: "Kaufen" },
    { player: { name: "C" }, form: null, market: 2, badge: "Kein Signal" },
  ] as SortableRadarRow[];

  it("sorts by form descending with nulls last", () => {
    expect(sortRadarRows(rows, "form").map((row) => row.player.name)).toEqual(["A", "B", "C"]);
  });

  it("sorts by name", () => {
    expect(sortRadarRows(rows, "name").map((row) => row.player.name)).toEqual(["A", "B", "C"]);
  });

  it("puts buy signals first", () => {
    expect(sortRadarRows(rows, "signal").map((row) => row.badge)).toEqual(["Kaufen", "Verkaufen", "Kein Signal"]);
  });
});

describe("positionChip", () => {
  it("maps German positions to short codes", () => {
    expect(positionChip("Torwart").code).toBe("TW");
    expect(positionChip("Abwehr").code).toBe("ABW");
    expect(positionChip("Mittelfeld").code).toBe("MF");
    expect(positionChip("Sturm").code).toBe("ST");
  });
});

describe("formBarHeights", () => {
  it("pads to five bars, oldest on the left", () => {
    expect(formBarHeights([1, 6])).toEqual([0, 0, 0, 0, 100]);
  });
});
