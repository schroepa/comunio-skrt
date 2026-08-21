import type { DirectusClient } from "../shared/directus-client.ts";
import type { HttpClient } from "../shared/http-client.ts";
import { writeScrapeLog } from "../shared/scrape-log.ts";
import { normalizeName, parseKickerNotes } from "./parse-notes.ts";

export type SyncKickerResult =
  | { status: "success"; written: number; skipped: number }
  | { status: "failed"; error: string };

type PlayerRow = { id: number; name: string };
type RatingRow = { id: number; player_id: number; spieltag: number };
type FixtureRow = { spieltag: number; datum: string };

export function lastFinishedSpieltag(fixtures: FixtureRow[], now: Date): number {
  const past = fixtures.filter((row) => new Date(row.datum).getTime() < now.getTime());
  if (past.length === 0) return 1;
  return Math.max(...past.map((row) => row.spieltag));
}

export async function syncKicker(options: {
  http: HttpClient;
  directus: DirectusClient;
  now: Date;
  notesUrl: string;
  spieltag?: number;
}): Promise<SyncKickerResult> {
  const { http, directus, now } = options;
  try {
    const fixtures = await directus.listItems<FixtureRow>("Fixture", { limit: "-1" });
    const spieltag = options.spieltag ?? lastFinishedSpieltag(fixtures, now);
    const html = await http.getText(options.notesUrl);
    const parsed = parseKickerNotes(html);
    if (parsed.length === 0) {
      await writeScrapeLog(directus, {
        quelle: "kicker",
        status: "failed",
        fehlermeldung: "Keine Noten im Markup",
        now,
      });
      return { status: "failed", error: "Keine Noten im Markup" };
    }

    const players = await directus.listItems<PlayerRow>("Player", { limit: "-1" });
    const byName = new Map<string, PlayerRow[]>();
    for (const player of players) {
      const key = normalizeName(player.name);
      const list = byName.get(key) ?? [];
      list.push(player);
      byName.set(key, list);
    }
    const existing = await directus.listItems<RatingRow>("RatingHistory", {
      limit: "-1",
      "filter[spieltag][_eq]": String(spieltag),
    });
    const existingByPlayer = new Map(existing.map((row) => [row.player_id, row]));

    let written = 0;
    let skipped = 0;
    for (const note of parsed) {
      const matches = byName.get(normalizeName(note.name)) ?? [];
      if (matches.length !== 1) {
        skipped += 1;
        continue;
      }
      const player = matches[0];
      const payload = {
        player_id: player.id,
        spieltag,
        note: note.note,
        minuten_gespielt: note.minuten_gespielt,
      };
      const old = existingByPlayer.get(player.id);
      if (old) await directus.updateItem("RatingHistory", old.id, payload);
      else await directus.createItem("RatingHistory", payload);
      written += 1;
    }

    if (written === 0) {
      await writeScrapeLog(directus, {
        quelle: "kicker",
        status: "failed",
        fehlermeldung: "Keine Noten gematcht",
        now,
      });
      return { status: "failed", error: "Keine Noten gematcht" };
    }

    await writeScrapeLog(directus, { quelle: "kicker", status: "success", now });
    return { status: "success", written, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed: SyncKickerResult = { status: "failed", error: message };
    try {
      await writeScrapeLog(directus, {
        quelle: "kicker",
        status: "failed",
        fehlermeldung: message.slice(0, 200),
        now,
      });
    } catch {
      /* log write may also fail */
    }
    return failed;
  }
}
