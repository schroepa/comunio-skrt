import { resolve } from "node:path";
import { createHttpClient } from "../shared/http-client.ts";
import { createDirectusClient } from "../shared/directus-client.ts";
import { log } from "../shared/logger.ts";
import { syncTransfermarktWerte } from "./sync-werte.ts";
import { syncTransfermarktVerfuegbarkeit } from "./sync-verfuegbarkeit.ts";

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
  minDelayMs: Number(process.env.TRANSFERMARKT_MIN_DELAY_MS ?? "1500"),
  userAgent: "comunio-helper/0.1 (private)",
});

const catalog = createDirectusClient({
  baseUrl: requiredEnv("SUPABASE_URL"),
  serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
});

await catalog.login();
const now = new Date();
const werte = await syncTransfermarktWerte({ http, directus: catalog, now });
const verfuegbarkeit = await syncTransfermarktVerfuegbarkeit({ http, directus: catalog, now });

if (werte.status === "success") {
  log.info(`transfermarkt-werte sync ok, written=${werte.written} skipped=${werte.skipped}`);
} else {
  log.error(`transfermarkt-werte sync failed: ${werte.error}`);
}

if (verfuegbarkeit.status === "success") {
  log.info(
    `transfermarkt-verfuegbarkeit sync ok, written=${verfuegbarkeit.written} skipped=${verfuegbarkeit.skipped}`,
  );
} else {
  log.error(`transfermarkt-verfuegbarkeit sync failed: ${verfuegbarkeit.error}`);
}

if (werte.status === "success" && verfuegbarkeit.status === "success") {
  process.exit(0);
}

process.exit(1);
