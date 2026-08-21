import { load } from "cheerio";

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z]/g, "");
}

export type ParsedNote = {
  name: string;
  note: number;
  minuten_gespielt: number | null;
};

function parseDeNumber(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 1 || value > 6) return null;
  return value;
}

function parseMinutes(raw: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0 || value > 120) return null;
  return value;
}

export function parseKickerNotes(html: string): ParsedNote[] {
  const $ = load(html);
  const found: ParsedNote[] = [];

  $("tr[data-player]").each((_, row) => {
    const name = $(row).attr("data-player")?.trim() ?? "";
    const note = parseDeNumber($(row).attr("data-note") ?? "");
    if (!name || note == null) return;
    found.push({
      name,
      note,
      minuten_gespielt: parseMinutes($(row).attr("data-minutes") ?? ""),
    });
  });

  if (found.length > 0) return found;

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .toArray()
      .map((cell) => $(cell).text().trim())
      .filter(Boolean);
    if (cells.length < 2) return;
    const name = cells[0];
    const note = cells.map(parseDeNumber).find((value) => value != null);
    if (!name || note == null) return;
    const minutes = cells.map(parseMinutes).find((value) => value != null) ?? null;
    found.push({ name, note, minuten_gespielt: minutes });
  });

  return found;
}
