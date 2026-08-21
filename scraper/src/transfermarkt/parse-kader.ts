import { load } from "cheerio";
import { parseMarktwert } from "./marktwert.ts";
import { type DirectusPosition, mapPosition } from "./positions.ts";

export type ParsedPlayer = {
  transfermarkt_id: number;
  name: string;
  position: DirectusPosition;
  verein: string;
  aktueller_marktwert: number;
};

const PLAYER_ID_RE = /\/profil\/spieler\/(\d+)/;

export function parseKader(
  html: string,
  verein: string,
): { players: ParsedPlayer[]; skipped: number } {
  const $ = load(html);
  const players: ParsedPlayer[] = [];
  const seen = new Set<number>();
  let skipped = 0;

  $("tr").each((_, tr) => {
    const row = $(tr);
    const link = row.find('a[href*="/profil/spieler/"]').first();
    if (link.length === 0) return;

    const idMatch = (link.attr("href") ?? "").match(PLAYER_ID_RE);
    if (!idMatch) {
      skipped += 1;
      return;
    }

    const transfermarkt_id = Number(idMatch[1]);
    if (seen.has(transfermarkt_id)) {
      skipped += 1;
      return;
    }

    let position: DirectusPosition | null = null;
    let marktwert: number | null = null;
    row.find("td").each((_, td) => {
      const text = $(td).text().trim();
      if (position === null) {
        const mapped = mapPosition(text);
        if (mapped) position = mapped;
      }
      if (marktwert === null) {
        const parsed = parseMarktwert(text);
        if (parsed !== null) marktwert = parsed;
      }
    });

    if (position === null || marktwert === null) {
      skipped += 1;
      return;
    }

    players.push({
      transfermarkt_id,
      name: link.text().trim(),
      position,
      verein,
      aktueller_marktwert: marktwert,
    });
    seen.add(transfermarkt_id);
  });

  return { players, skipped };
}
