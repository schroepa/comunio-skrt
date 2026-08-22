import { describe, expect, it } from "vitest";
import { filterPlayers, hasPlayerFilters, parsePlayerFilters, uniqueClubs } from "../../src/lib/players";
import type { PlayerRecord } from "../../src/lib/directus";

function player(partial: Partial<PlayerRecord> & Pick<PlayerRecord, "id" | "name">): PlayerRecord {
  return {
    position: "Mittelfeld",
    verein: "TSG Hoffenheim",
    aktueller_marktwert: 1_000_000,
    ...partial,
  };
}

const proemel = player({ id: 1, name: "Grischa Prömel", position: "Mittelfeld", verein: "TSG Hoffenheim", aktueller_marktwert: 4_000_000 });
const undav = player({ id: 2, name: "Deniz Undav", position: "Sturm", verein: "VfB Stuttgart", aktueller_marktwert: 18_000_000 });
const urb = player({ id: 3, name: "Jonas Urbig", position: "Torwart", verein: "FC Bayern München", aktueller_marktwert: 8_000_000 });

describe("parsePlayerFilters", () => {
  it("reads combined query params", () => {
    const filters = parsePlayerFilters(
      new URLSearchParams("q=prö&position=Mittelfeld&verein=TSG+Hoffenheim&mw_min=1000000&mw_max=5000000"),
    );
    expect(filters).toEqual({
      q: "prö",
      position: "Mittelfeld",
      verein: "TSG Hoffenheim",
      mwMin: 1_000_000,
      mwMax: 5_000_000,
    });
  });

  it("treats blank bounds as unset", () => {
    expect(parsePlayerFilters(new URLSearchParams("mw_min=&mw_max=abc"))).toEqual({
      q: "",
      position: "",
      verein: "",
      mwMin: null,
      mwMax: null,
    });
  });
});

describe("hasPlayerFilters", () => {
  it("is false when everything is empty", () => {
    expect(hasPlayerFilters({ q: "", position: "", verein: "", mwMin: null, mwMax: null })).toBe(false);
  });

  it("is true for a lone club or price bound", () => {
    expect(hasPlayerFilters({ q: "", position: "", verein: "VfB Stuttgart", mwMin: null, mwMax: null })).toBe(true);
    expect(hasPlayerFilters({ q: "", position: "", verein: "", mwMin: 0, mwMax: null })).toBe(true);
  });
});

describe("filterPlayers", () => {
  const catalog = [proemel, undav, urb];

  it("matches name case-insensitively as substring", () => {
    expect(filterPlayers(catalog, { q: "prö", position: "", verein: "", mwMin: null, mwMax: null })).toEqual([proemel]);
  });

  it("combines position, club and market range", () => {
    expect(
      filterPlayers(catalog, {
        q: "",
        position: "Sturm",
        verein: "VfB Stuttgart",
        mwMin: 10_000_000,
        mwMax: 20_000_000,
      }),
    ).toEqual([undav]);
  });

  it("excludes values outside the range", () => {
    expect(filterPlayers(catalog, { q: "", position: "", verein: "", mwMin: 10_000_000, mwMax: null })).toEqual([undav]);
    expect(filterPlayers(catalog, { q: "", position: "", verein: "", mwMin: null, mwMax: 5_000_000 })).toEqual([proemel]);
  });
});

describe("uniqueClubs", () => {
  it("sorts German names and drops empties", () => {
    expect(uniqueClubs([undav, urb, proemel, player({ id: 9, name: "X", verein: "" })])).toEqual([
      "FC Bayern München",
      "TSG Hoffenheim",
      "VfB Stuttgart",
    ]);
  });
});
