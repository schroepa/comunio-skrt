import { describe, expect, it } from "vitest";
import type { PlayerRecord } from "../../src/lib/directus";
import { matchSquadImport, parseImportPlayerIds, parseSquadPaste, summarizeSquadImport } from "../../src/lib/squad-import";

function player(partial: Partial<PlayerRecord> & Pick<PlayerRecord, "id" | "name">): PlayerRecord {
  return {
    position: "Mittelfeld",
    verein: "VfB Stuttgart",
    aktueller_marktwert: 1_000_000,
    ...partial,
  };
}

const demirovic = player({ id: 1, name: "Ermedin Demirović", position: "Sturm" });
const tiago = player({ id: 2, name: "Tiago Tomás", position: "Sturm", verein: "VfL Wolfsburg" });
const kevinMueller = player({ id: 3, name: "Kevin Müller", position: "Torwart", verein: "1. FC Schalke 04" });
const thomasMueller = player({ id: 4, name: "Thomas Müller", position: "Sturm", verein: "FC Bayern München" });
const hofmann = player({ id: 5, name: "Jonas Hofmann", position: "Mittelfeld" });
const vanDijk = player({ id: 6, name: "Virgil van Dijk", position: "Abwehr", verein: "FC Liverpool" });
const lukeba = player({ id: 7, name: "Castello Lukeba", position: "Abwehr", verein: "RB Leipzig" });

const catalog = [demirovic, tiago, kevinMueller, thomasMueller, hofmann, vanDijk, lukeba];

describe("parseSquadPaste", () => {
  it("keeps one name per line and skips position headers", () => {
    expect(
      parseSquadPaste(`
        Sturm (4)
        Demirović
        Tiago Tomás

        Tor (2)
        K. Müller
      `),
    ).toEqual(["Demirović", "Tiago Tomás", "K. Müller"]);
  });

  it("strips trailing market values and ignores numeric lines", () => {
    expect(parseSquadPaste("Lukeba 3.940.000\n8.410.000\nBurke")).toEqual(["Lukeba", "Burke"]);
  });

  it("drops duplicate names case-insensitively", () => {
    expect(parseSquadPaste("Kade\nkade\nKADE")).toEqual(["Kade"]);
  });
});

describe("matchSquadImport", () => {
  it("matches a unique last name to the full catalog name", () => {
    expect(matchSquadImport(["Demirović"], catalog)).toEqual([
      { query: "Demirović", status: "matched", player: demirovic },
    ]);
  });

  it("matches accent-insensitive last names", () => {
    expect(matchSquadImport(["Demirovic"], catalog)[0]).toMatchObject({ status: "matched", player: demirovic });
  });

  it("matches a two-word Comunio name", () => {
    expect(matchSquadImport(["Tiago Tomás"], catalog)[0]).toMatchObject({ status: "matched", player: tiago });
  });

  it("matches an initial plus last name", () => {
    expect(matchSquadImport(["K. Müller"], catalog)[0]).toMatchObject({ status: "matched", player: kevinMueller });
  });

  it("matches a name suffix such as van Dijk", () => {
    expect(matchSquadImport(["van Dijk"], catalog)[0]).toMatchObject({ status: "matched", player: vanDijk });
  });

  it("marks a shared last name as ambiguous", () => {
    const result = matchSquadImport(["Müller"], catalog)[0];
    expect(result).toMatchObject({ query: "Müller", status: "ambiguous" });
    if (result.status !== "ambiguous") throw new Error("expected ambiguous");
    expect(result.players.map((row) => row.id).sort()).toEqual([3, 4]);
  });

  it("does not treat a short stem as a last name", () => {
    expect(matchSquadImport(["Hof"], catalog)[0]).toEqual({ query: "Hof", status: "unmatched" });
  });

  it("returns unmatched when the catalog has no candidate", () => {
    expect(matchSquadImport(["Weber"], catalog)[0]).toEqual({ query: "Weber", status: "unmatched" });
  });
});

describe("parseImportPlayerIds", () => {
  it("keeps unique positive integers", () => {
    expect(parseImportPlayerIds(["1", "1", "foo", "2", "-3", "0"])).toEqual([1, 2]);
  });
});

describe("summarizeSquadImport", () => {
  it("counts matched, ambiguous and unmatched rows", () => {
    expect(summarizeSquadImport(matchSquadImport(["Lukeba", "Müller", "Weber"], catalog))).toEqual({
      matched: 1,
      ambiguous: 1,
      unmatched: 1,
    });
  });
});
