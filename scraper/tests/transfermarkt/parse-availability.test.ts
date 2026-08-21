import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAvailability } from "../../src/transfermarkt/parse-availability.ts";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

async function loadExcerpts() {
  const [injuredHtml, suspendedHtml] = await Promise.all([
    readFile(join(fixturesDir, "transfermarkt-verletzt-excerpt.html"), "utf8"),
    readFile(join(fixturesDir, "transfermarkt-gesperrt-excerpt.html"), "utf8"),
  ]);
  return { injuredHtml, suspendedHtml };
}

describe("parseAvailability", () => {
  it("merges injured and suspended excerpts: Kane verletzt, Musiala fraglich, Neuer gesperrt", async () => {
    const { injuredHtml, suspendedHtml } = await loadExcerpts();
    const result = parseAvailability(injuredHtml, suspendedHtml);
    expect(result.skipped).toBe(0);
    expect(result.rows).toEqual([
      { transfermarkt_id: 132098, status: "verletzt" },
      { transfermarkt_id: 580195, status: "fraglich" },
      { transfermarkt_id: 17259, status: "gesperrt" },
    ]);
  });

  it("lets gesperrt win when the same id appears on both pages", () => {
    const injuredHtml = `
      <table>
        <tr>
          <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
          <td>Wadenverletzung</td>
        </tr>
      </table>
    `;
    const suspendedHtml = `
      <table>
        <tr>
          <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
          <td>Rote Karte</td>
        </tr>
      </table>
    `;
    expect(parseAvailability(injuredHtml, suspendedHtml).rows).toEqual([
      { transfermarkt_id: 132098, status: "gesperrt" },
    ]);
  });

  it("maps row text with fraglich or fitness to fraglich", () => {
    const injuredHtml = `
      <table>
        <tr>
          <td><a href="/a/profil/spieler/1">A</a></td>
          <td>fraglich</td>
        </tr>
        <tr>
          <td><a href="/b/profil/spieler/2">B</a></td>
          <td>Fitness</td>
        </tr>
      </table>
    `;
    expect(parseAvailability(injuredHtml, "<table></table>").rows).toEqual([
      { transfermarkt_id: 1, status: "fraglich" },
      { transfermarkt_id: 2, status: "fraglich" },
    ]);
  });

  it("increments skipped when a profile link has no id", () => {
    const injuredHtml = `
      <table>
        <tr>
          <td><a href="/unbekannt/profil/spieler/">Ohne ID</a></td>
          <td>Wadenverletzung</td>
        </tr>
        <tr>
          <td><a href="/harry-kane/profil/spieler/132098">Harry Kane</a></td>
          <td>Wadenverletzung</td>
        </tr>
      </table>
    `;
    const result = parseAvailability(injuredHtml, "<table></table>");
    expect(result.skipped).toBe(1);
    expect(result.rows).toEqual([{ transfermarkt_id: 132098, status: "verletzt" }]);
  });
});
