import type { DirectusClient } from "../shared/directus-client.ts";
import type { HttpClient } from "../shared/http-client.ts";
import { writeScrapeLog } from "../shared/scrape-log.ts";
import { parseAvailability } from "./parse-availability.ts";
import { nextSpieltag } from "./spieltag.ts";

export const TRANSFERMARKT_INJURED_URL =
  "https://www.transfermarkt.de/bundesliga/verletztespieler/wettbewerb/L1";
export const TRANSFERMARKT_SUSPENDED_URL =
  "https://www.transfermarkt.de/bundesliga/sperrenausfaelle/wettbewerb/L1";

export type SyncDeps = {
  http: HttpClient;
  directus: DirectusClient;
  now?: Date;
};

export type SyncResult = {
  status: "success" | "failed";
  written: number;
  error?: string;
};

type StoredFixture = { spieltag: number; datum: string };
type StoredPlayer = { id: number; transfermarkt_id: number };
type StoredAvailability = {
  id: number;
  player_id: number;
  spieltag: number;
  status: string;
  quelle: string;
  aktualisiert_am: string;
};

function availabilityKey(playerId: number, spieltag: number): string {
  return `${playerId}|${spieltag}`;
}

export async function syncTransfermarktVerfuegbarkeit(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? new Date();
  const logOpts = { now };

  try {
    const fixtures = await deps.directus.listItems<StoredFixture>("Fixture", { limit: "-1" });
    const spieltag = nextSpieltag(fixtures, now);
    if (spieltag === null) {
      const reason =
        fixtures.length === 0
          ? "Noch kein Spielplan. Im Ordner scraper/ npm run sync:openligadb."
          : "kein nächster Spieltag";
      await writeScrapeLog(deps.directus, {
        quelle: "transfermarkt-verfuegbarkeit",
        status: "failed",
        fehlermeldung: reason,
        ...logOpts,
      });
      return { status: "failed", written: 0, error: reason };
    }

    const injuredHtml = await deps.http.getText(TRANSFERMARKT_INJURED_URL);
    const suspendedHtml = await deps.http.getText(TRANSFERMARKT_SUSPENDED_URL);
    const parsed = parseAvailability(injuredHtml, suspendedHtml);
    if (parsed.rows.length === 0) {
      const reason = "keine verwertbaren Verfügbarkeitszeilen";
      await writeScrapeLog(deps.directus, {
        quelle: "transfermarkt-verfuegbarkeit",
        status: "failed",
        fehlermeldung: reason,
        ...logOpts,
      });
      return { status: "failed", written: 0, error: reason };
    }

    const existingPlayers = await deps.directus.listItems<StoredPlayer>("Player", {
      limit: "-1",
    });
    const playerIndex = new Map(existingPlayers.map((row) => [row.transfermarkt_id, row]));

    const existingAvailability = await deps.directus.listItems<StoredAvailability>(
      "AvailabilityStatus",
      { limit: "-1" },
    );
    const availabilityIndex = new Map(
      existingAvailability.map((row) => [availabilityKey(row.player_id, row.spieltag), row]),
    );

    const aktualisiertAm = now.toISOString();
    let written = 0;

    for (const row of parsed.rows) {
      const player = playerIndex.get(row.transfermarkt_id);
      if (!player) continue;

      const payload = {
        player_id: player.id,
        spieltag,
        status: row.status,
        quelle: "transfermarkt",
        aktualisiert_am: aktualisiertAm,
      };
      const found = availabilityIndex.get(availabilityKey(player.id, spieltag));
      if (found) {
        await deps.directus.updateItem("AvailabilityStatus", found.id, payload);
      } else {
        await deps.directus.createItem("AvailabilityStatus", payload);
      }
      written += 1;
    }

    await writeScrapeLog(deps.directus, {
      quelle: "transfermarkt-verfuegbarkeit",
      status: "success",
      fehlermeldung: null,
      ...logOpts,
    });
    return { status: "success", written };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeScrapeLog(deps.directus, {
      quelle: "transfermarkt-verfuegbarkeit",
      status: "failed",
      fehlermeldung: message,
      ...logOpts,
    });
    return { status: "failed", written: 0, error: message };
  }
}
