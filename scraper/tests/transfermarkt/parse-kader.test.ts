import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseKader } from "../../src/transfermarkt/parse-kader.ts";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/transfermarkt-kader-excerpt.html",
);

describe("parseKader", () => {
  it("parses two Bayern players and skips the unmapped position", async () => {
    const html = await readFile(fixturePath, "utf8");
    const result = parseKader(html, "FC Bayern München");
    expect(result.skipped).toBe(1);
    expect(result.players).toEqual([
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
    ]);
  });

  it("keeps the first row for a duplicate transfermarkt_id", () => {
    const html = `
      <table>
        <tr>
          <td><a href="/manuel-neuer/profil/spieler/17259">Manuel Neuer</a></td>
          <td>Torwart</td>
          <td>4,00 Mio. €</td>
        </tr>
        <tr>
          <td><a href="/manuel-neuer/profil/spieler/17259">Neuer Duplikat</a></td>
          <td>Torwart</td>
          <td>5,00 Mio. €</td>
        </tr>
      </table>
    `;
    const result = parseKader(html, "FC Bayern München");
    expect(result.skipped).toBe(1);
    expect(result.players).toEqual([
      {
        transfermarkt_id: 17259,
        name: "Manuel Neuer",
        position: "Torwart",
        verein: "FC Bayern München",
        aktueller_marktwert: 4_000_000,
      },
    ]);
  });
});
