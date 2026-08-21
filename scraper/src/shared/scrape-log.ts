import type { DirectusClient } from "./directus-client.ts";

export type ScrapeLogStatus = "success" | "failed";

export type ScrapeLogEntry = {
  quelle: string;
  status: ScrapeLogStatus;
  fehlermeldung?: string | null;
  now?: Date;
};

function formatTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19);
}

export async function writeScrapeLog(client: DirectusClient, entry: ScrapeLogEntry) {
  await client.createItem("ScrapeLog", {
    quelle: entry.quelle,
    zeitstempel: formatTimestamp(entry.now ?? new Date()),
    status: entry.status,
    fehlermeldung: entry.fehlermeldung ?? null,
  });
}
