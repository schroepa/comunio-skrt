export const THEME_STORAGE_KEY = "comunio-theme";

export type ThemeName = "light" | "dark";

export function parseTheme(value: string | null | undefined): ThemeName | null {
  return value === "light" || value === "dark" ? value : null;
}

export function themeFromPrefersDark(prefersDark: boolean): ThemeName {
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function readStoredTheme(): ThemeName | null {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function resolveTheme(): ThemeName {
  return (
    readStoredTheme() ??
    themeFromPrefersDark(window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}
