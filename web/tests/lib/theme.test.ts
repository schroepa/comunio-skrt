import { describe, expect, it } from "vitest";
import { parseTheme, themeFromPrefersDark } from "../../src/lib/theme";

describe("parseTheme", () => {
  it("accepts light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("rejects unknown values", () => {
    expect(parseTheme("system")).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });
});

describe("themeFromPrefersDark", () => {
  it("maps the system preference", () => {
    expect(themeFromPrefersDark(true)).toBe("dark");
    expect(themeFromPrefersDark(false)).toBe("light");
  });
});
