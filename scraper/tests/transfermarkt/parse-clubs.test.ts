import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseClubs } from "../../src/transfermarkt/parse-clubs.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/transfermarkt-startseite-excerpt.html",
);

describe("parseClubs", () => {
  it("returns two unique clubs in first-seen order", async () => {
    const html = await readFile(fixturePath, "utf8");
    expect(parseClubs(html)).toEqual([
      { transfermarkt_verein_id: 27, name: "FC Bayern München" },
      { transfermarkt_verein_id: 16, name: "Borussia Dortmund" },
    ]);
  });

  it("skips numeric and one-character club names", () => {
    const html = `
      <a href="/x/startseite/verein/5">5</a>
      <a href="/x/startseite/verein/5">B</a>
      <a href="/x/startseite/verein/5">Bayer 04 Leverkusen</a>
    `;
    expect(parseClubs(html)).toEqual([
      { transfermarkt_verein_id: 5, name: "Bayer 04 Leverkusen" },
    ]);
  });
});
