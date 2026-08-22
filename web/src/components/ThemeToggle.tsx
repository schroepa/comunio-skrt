import { useEffect, useState } from "react";
import { applyTheme, resolveTheme, type ThemeName } from "../lib/theme";
import GooeySegment from "./GooeySegment";

const options = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
] as const;

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(() => resolveTheme());

  useEffect(() => {
    const sync = () => setTheme(resolveTheme());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <GooeySegment
      ariaLabel="Darstellung"
      fill="muted"
      value={theme}
      options={options}
      submitOnChange={false}
      onChange={(value) => {
        const next = value === "dark" ? "dark" : "light";
        setTheme(next);
        applyTheme(next);
      }}
    />
  );
}
