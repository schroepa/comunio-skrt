import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMatches } from "../../src/openligadb/parse.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/openligadb-matchday1-excerpt.json",
);

describe("parseMatches", () => {
  it("maps frozen OpenLigaDB JSON onto Fixture fields", async () => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    expect(parseMatches(raw)).toEqual([
      {
        spieltag: 1,
        heim_verein: "FC Bayern München",
        auswaerts_verein: "RB Leipzig",
        datum: "2025-08-22T20:30:00",
      },
      {
        spieltag: 1,
        heim_verein: "Bayer 04 Leverkusen",
        auswaerts_verein: "TSG Hoffenheim",
        datum: "2025-08-23T15:30:00",
      },
    ]);
  });

  it("throws when the payload is not an array", () => {
    expect(() => parseMatches({ matchID: 1 })).toThrow(/array/i);
  });

  it("throws when a match is missing team1.teamName", () => {
    expect(() =>
      parseMatches([
        {
          matchDateTime: "2025-08-22T20:30:00",
          group: { groupOrderID: 1 },
          team1: { teamName: "" },
          team2: { teamName: "RB Leipzig" },
        },
      ]),
    ).toThrow(/teamName/);
  });
});
