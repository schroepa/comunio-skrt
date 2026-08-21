import type { DirectusClient } from "../shared/directus-client.ts";
import type { HttpClient } from "../shared/http-client.ts";
import { writeScrapeLog } from "../shared/scrape-log.ts";
import { parseClubs } from "./parse-clubs.ts";
import { parseKader, type ParsedPlayer } from "./parse-kader.ts";
import { validateMarketPlayers } from "./validate.ts";

export const TRANSFERMARKT_START_URL =
  "https://www.transfermarkt.de/bundesliga/startseite/wettbewerb/L1";
export const EXPECTED_CLUB_COUNT = 18;

export type SyncDeps = {
  http: HttpClient;
  directus: DirectusClient;
  now?: Date;
};

export type SyncResult = {
  status: "success" | "failed";
  written: number;
  skipped: number;
  error?: string;
};

type StoredPlayer = {
  id: number;
  transfermarkt_id: number;
};

type StoredValueHistory = {
  id: number;
  player_id: number;
  datum: string;
  marktwert: number;
};

function kaderUrl(vereinId: number): string {
  return `https://www.transfermarkt.de/-/kader/verein/${vereinId}`;
}

function valueKey(playerId: number, datum: string): string {
  return `${playerId}|${datum}`;
}

export async function syncTransfermarktWerte(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? new Date();
  const logOpts = { now };

  try {
    const startHtml = await deps.http.getText(TRANSFERMARKT_START_URL);
    const clubs = parseClubs(startHtml);
    if (clubs.length !== EXPECTED_CLUB_COUNT) {
      const reason = `erwartete ${EXPECTED_CLUB_COUNT} Vereine, erhalten ${clubs.length}`;
      await writeScrapeLog(deps.directus, {
        quelle: "transfermarkt-werte",
        status: "failed",
        fehlermeldung: reason,
        ...logOpts,
      });
      return { status: "failed", written: 0, skipped: 0, error: reason };
    }

    const byId = new Map<number, ParsedPlayer>();
    let skipped = 0;
    for (const club of clubs) {
      const html = await deps.http.getText(kaderUrl(club.transfermarkt_verein_id));
      const parsed = parseKader(html, club.name);
      skipped += parsed.skipped;
      for (const player of parsed.players) {
        if (!byId.has(player.transfermarkt_id)) {
          byId.set(player.transfermarkt_id, player);
        }
      }
    }

    const players = [...byId.values()];
    const valid = validateMarketPlayers(players);
    if (!valid.ok) {
      await writeScrapeLog(deps.directus, {
        quelle: "transfermarkt-werte",
        status: "failed",
        fehlermeldung: valid.reason,
        ...logOpts,
      });
      return { status: "failed", written: 0, skipped, error: valid.reason };
    }

    const existingPlayers = await deps.directus.listItems<StoredPlayer>("Player", {
      limit: "-1",
    });
    const playerIndex = new Map(existingPlayers.map((row) => [row.transfermarkt_id, row]));

    const existingValues = await deps.directus.listItems<StoredValueHistory>("ValueHistory", {
      limit: "-1",
    });
    const valueIndex = new Map(existingValues.map((row) => [valueKey(row.player_id, row.datum), row]));

    const datum = now.toISOString().slice(0, 10);
    let written = 0;

    for (const player of players) {
      const payload = {
        name: player.name,
        position: player.position,
        verein: player.verein,
        aktueller_marktwert: player.aktueller_marktwert,
        transfermarkt_id: player.transfermarkt_id,
      };
      const found = playerIndex.get(player.transfermarkt_id);
      let playerId: number;
      if (found) {
        await deps.directus.updateItem("Player", found.id, payload);
        playerId = found.id;
      } else {
        const created = await deps.directus.createItem<StoredPlayer>("Player", payload);
        playerId = created.id;
      }

      const historyPayload = {
        player_id: playerId,
        datum,
        marktwert: player.aktueller_marktwert,
      };
      const history = valueIndex.get(valueKey(playerId, datum));
      if (history) {
        await deps.directus.updateItem("ValueHistory", history.id, historyPayload);
      } else {
        await deps.directus.createItem("ValueHistory", historyPayload);
      }
      written += 1;
    }

    await writeScrapeLog(deps.directus, {
      quelle: "transfermarkt-werte",
      status: "success",
      fehlermeldung: null,
      ...logOpts,
    });
    return { status: "success", written, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeScrapeLog(deps.directus, {
      quelle: "transfermarkt-werte",
      status: "failed",
      fehlermeldung: message,
      ...logOpts,
    });
    return { status: "failed", written: 0, skipped: 0, error: message };
  }
}
