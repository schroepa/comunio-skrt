import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type HttpClient = {
  getJson<T>(url: string): Promise<T>;
};

export type HttpClientOptions = {
  cacheDir: string;
  ttlMs: number;
  minDelayMs: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_USER_AGENT = "comunio-helper/0.1 (private)";

function cachePath(cacheDir: string, url: string) {
  const hash = createHash("sha256").update(url).digest("hex");
  return join(cacheDir, `${hash}.json`);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  let lastLiveAt = 0;
  let liveQueue: Promise<unknown> = Promise.resolve();

  async function liveFetch<T>(url: string, file: string): Promise<T> {
    const wait = lastLiveAt + options.minDelayMs - now();
    if (wait > 0) await sleep(wait);

    const response = await fetchImpl(
      new Request(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json",
        },
      }),
    );
    lastLiveAt = now();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    const body = (await response.json()) as T;
    await writeFile(file, JSON.stringify({ storedAt: now(), body }), "utf8");
    return body;
  }

  return {
    async getJson<T>(url: string): Promise<T> {
      await mkdir(options.cacheDir, { recursive: true });
      const file = cachePath(options.cacheDir, url);
      try {
        const cached = JSON.parse(await readFile(file, "utf8")) as {
          storedAt: number;
          body: T;
        };
        if (now() - cached.storedAt < options.ttlMs) return cached.body;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          /* corrupt cache: fall through to live fetch */
        }
      }

      const result = liveQueue.then(() => liveFetch<T>(url, file));
      liveQueue = result.catch(() => undefined);
      return result;
    },
  };
}
