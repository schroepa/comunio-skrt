export function parseMarktwert(raw: string): number | null {
  const match = raw.match(/([\d.,]+)\s*(Tsd|Mio|Mrd)/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const unit = match[2].toLowerCase();
  const factor = unit === "tsd" ? 1e3 : unit === "mio" ? 1e6 : 1e9;
  return Math.round(value * factor);
}
