import { resolve } from "node:path";
import { createHttpClient } from "../shared/http-client.ts";
import { createDirectusClient } from "../shared/directus-client.ts";
import { log } from "../shared/logger.ts";
import { syncOpenLigaDb } from "./sync.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
}

const http = createHttpClient({
  cacheDir: resolve(process.cwd(), ".cache"),
  ttlMs: 43_200_000,
  minDelayMs: 250,
  userAgent: "comunio-helper/0.1 (private)",
});

const directus = createDirectusClient({
  baseUrl: requiredEnv("DIRECTUS_URL"),
  email: requiredEnv("DIRECTUS_EMAIL"),
  password: requiredEnv("DIRECTUS_PASSWORD"),
});

await directus.login();
const result = await syncOpenLigaDb({
  http,
  directus,
  league: process.env.OPENLIGADB_LEAGUE ?? "bl1",
  season: Number(process.env.OPENLIGADB_SEASON ?? "2026"),
});

if (result.status === "success") {
  log.info(`openligadb sync ok, written=${result.written}`);
  process.exit(0);
}

log.error(`openligadb sync failed: ${result.error}`);
process.exit(1);
