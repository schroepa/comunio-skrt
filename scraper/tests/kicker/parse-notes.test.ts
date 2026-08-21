import { describe, expect, it } from "vitest";
import { parseKickerNotes } from "../../src/kicker/parse-notes.ts";

describe("parseKickerNotes", () => {
  it("reads data-player rows", () => {
    const html = `<table><tr data-player="Florian Wirtz" data-note="1,5" data-minutes="90"></tr></table>`;
    expect(parseKickerNotes(html)).toEqual([{ name: "Florian Wirtz", note: 1.5, minuten_gespielt: 90 }]);
  });

  it("falls back to table cells", () => {
    const html = `<table><tr><td>Jamal Musiala</td><td>2,0</td><td>85</td></tr></table>`;
    expect(parseKickerNotes(html)).toEqual([{ name: "Jamal Musiala", note: 2, minuten_gespielt: 85 }]);
  });
});
