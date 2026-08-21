import { resolve } from "node:path";
import { createDirectusClient } from "../shared/directus-client.ts";
import { createHttpClient } from "../shared/http-client.ts";
import { log } from "../shared/logger.ts";
import { syncKicker } from "./sync.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

const http = createHttpClient({
  cacheDir: resolve(process.cwd(), ".cache"),
  ttlMs: 43_200_000,
  minDelayMs: Number(process.env.KICKER_MIN_DELAY_MS ?? "1500"),
  userAgent: "comunio-helper/0.1 (private)",
});

const catalog = createDirectusClient({
  baseUrl: requiredEnv("SUPABASE_URL"),
  serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
});

await catalog.login();
const spieltag = process.env.KICKER_SPIELTAG ? Number(process.env.KICKER_SPIELTAG) : undefined;
const season = process.env.KICKER_SEASON ?? "2026-27";
const matchday = spieltag ?? 1;
const notesUrl =
  process.env.KICKER_NOTES_URL ??
  `https://www.kicker.de/1-bundesliga/spieltag/${season}/${matchday}`;

const result = await syncKicker({
  http,
  directus: catalog,
  now: new Date(),
  notesUrl,
  spieltag,
});

if (result.status === "success") {
  log.info(`kicker sync ok, written=${result.written} skipped=${result.skipped}`);
  process.exit(0);
}

log.error(`kicker sync failed: ${result.error}`);
process.exit(1);
