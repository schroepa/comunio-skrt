import { describe, expect, it } from "vitest";
import { mapPosition } from "../../src/transfermarkt/positions.ts";

describe("mapPosition", () => {
  it('maps "Torwart" to Torwart', () => {
    expect(mapPosition("Torwart")).toBe("Torwart");
  });

  it("maps keeper case-insensitively to Torwart", () => {
    expect(mapPosition("Keeper")).toBe("Torwart");
  });

  it("maps defensive labels to Abwehr", () => {
    expect(mapPosition("Innenverteidiger")).toBe("Abwehr");
    expect(mapPosition("Linksverteidiger")).toBe("Abwehr");
    expect(mapPosition("Rechtsverteidiger")).toBe("Abwehr");
    expect(mapPosition("Abwehr")).toBe("Abwehr");
    expect(mapPosition("Libero")).toBe("Abwehr");
  });

  it("maps midfield labels to Mittelfeld", () => {
    expect(mapPosition("Mittelfeld")).toBe("Mittelfeld");
    expect(mapPosition("Flügel")).toBe("Mittelfeld");
    expect(mapPosition("Außen")).toBe("Mittelfeld");
  });

  it("maps attacking labels to Sturm", () => {
    expect(mapPosition("Stürmer")).toBe("Sturm");
    expect(mapPosition("Sturm")).toBe("Sturm");
    expect(mapPosition("Mittelstürmer")).toBe("Sturm");
    expect(mapPosition("Hängende Spitze")).toBe("Sturm");
  });

  it("returns null for unknown labels", () => {
    expect(mapPosition("Cheftrainer")).toBeNull();
  });
});
