import { load } from "cheerio";

export type ClubRef = { transfermarkt_verein_id: number; name: string };

const VEREIN_ID_RE = /\/verein\/(\d+)/;

export function parseClubs(html: string): ClubRef[] {
  const $ = load(html);
  const clubs: ClubRef[] = [];
  const seen = new Set<number>();

  $('a[href*="/verein/"]').each((_, a) => {
    const el = $(a);
    const idMatch = (el.attr("href") ?? "").match(VEREIN_ID_RE);
    if (!idMatch) return;

    const transfermarkt_verein_id = Number(idMatch[1]);
    if (seen.has(transfermarkt_verein_id)) return;

    const name = el.text().trim();
    if (name.length <= 1 || /^\d+$/.test(name)) return;

    seen.add(transfermarkt_verein_id);
    clubs.push({ transfermarkt_verein_id, name });
  });

  return clubs;
}
