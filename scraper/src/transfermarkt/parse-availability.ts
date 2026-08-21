import { load } from "cheerio";

export type ParsedAvailability = {
  transfermarkt_id: number;
  status: "fraglich" | "verletzt" | "gesperrt";
};

const PLAYER_ID_RE = /\/profil\/spieler\/(\d+)/;
const FRAGLICH_RE = /angeschlagen|fraglich|fitness/;

function collectStatuses(
  html: string,
  statusFor: (rowText: string) => ParsedAvailability["status"],
): { byId: Map<number, ParsedAvailability["status"]>; skipped: number } {
  const $ = load(html);
  const byId = new Map<number, ParsedAvailability["status"]>();
  let skipped = 0;

  $('a[href*="/profil/spieler/"]').each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const idMatch = href.match(PLAYER_ID_RE);
    if (!idMatch) {
      skipped += 1;
      return;
    }

    const transfermarkt_id = Number(idMatch[1]);
    if (byId.has(transfermarkt_id)) return;

    const rowText = $(a).closest("tr").text().toLowerCase();
    byId.set(transfermarkt_id, statusFor(rowText));
  });

  return { byId, skipped };
}

export function parseAvailability(
  injuredHtml: string,
  suspendedHtml: string,
): { rows: ParsedAvailability[]; skipped: number } {
  const injured = collectStatuses(injuredHtml, (rowText) =>
    FRAGLICH_RE.test(rowText) ? "fraglich" : "verletzt",
  );
  const suspended = collectStatuses(suspendedHtml, () => "gesperrt");

  const merged = new Map(injured.byId);
  for (const [id, status] of suspended.byId) {
    merged.set(id, status);
  }

  return {
    rows: [...merged.entries()].map(([transfermarkt_id, status]) => ({
      transfermarkt_id,
      status,
    })),
    skipped: injured.skipped + suspended.skipped,
  };
}
