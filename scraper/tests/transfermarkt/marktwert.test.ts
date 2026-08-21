import { describe, expect, it } from "vitest";
import { parseMarktwert } from "../../src/transfermarkt/marktwert.ts";

describe("parseMarktwert", () => {
  it("parses Tausend as euro integer", () => {
    expect(parseMarktwert("800 Tsd. €")).toBe(800_000);
  });

  it("parses comma Mio as euro integer", () => {
    expect(parseMarktwert("2,00 Mio. €")).toBe(2_000_000);
  });

  it("parses dotted Mio as euro integer", () => {
    expect(parseMarktwert("1.50 Mio. €")).toBe(1_500_000);
  });

  it("returns null for garbage", () => {
    expect(parseMarktwert("k. A.")).toBeNull();
    expect(parseMarktwert("abc")).toBeNull();
  });
});
