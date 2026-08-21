export type DirectusClient = {
  login(): Promise<void>;
  listItems<T>(collection: string, query?: Record<string, string>): Promise<T[]>;
  createItem<T>(collection: string, payload: object): Promise<T>;
  updateItem<T>(collection: string, id: number, payload: object): Promise<T>;
};

export type DirectusClientOptions = {
  baseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
};

const TABLES: Record<string, string> = {
  Player: "player",
  Fixture: "fixture",
  ValueHistory: "value_history",
  RatingHistory: "rating_history",
  AvailabilityStatus: "availability_status",
  ScrapeLog: "scrape_log",
  SquadMembership: "squad_membership",
  ManagerProfile: "manager_profile",
  CompetitorSquad: "competitor_squad",
};

const PAGE_SIZE = 1000;
const MAX_ERROR = 200;

function tableName(collection: string): string {
  const mapped = TABLES[collection] ?? collection;
  return mapped;
}

function toPostgrestQuery(query: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  params.set("select", "*");
  for (const [key, value] of Object.entries(query)) {
    if (key === "limit") continue;
    if (key === "sort") {
      const desc = value.startsWith("-");
      const field = desc ? value.slice(1) : value;
      params.set("order", `${field}.${desc ? "desc" : "asc"}`);
      continue;
    }
    const eq = /^filter\[([^\]]+)\]\[_eq\]$/.exec(key);
    if (eq) {
      params.set(eq[1], `eq.${value}`);
      continue;
    }
  }
  return params;
}

async function readError(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message !== "string" || body.message.length === 0) return null;
    return body.message.length > MAX_ERROR ? `${body.message.slice(0, MAX_ERROR)}…` : body.message;
  } catch {
    return null;
  }
}

export function createDirectusClient(options: DirectusClientOptions): DirectusClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const key = options.serviceRoleKey;

  async function request(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers as Record<string, string> | undefined),
    };
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const message = await readError(response);
      const detail = message ? `: ${message}` : "";
      throw new Error(`Supabase HTTP ${response.status} for ${init.method ?? "GET"} ${path}${detail}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as unknown;
  }

  return {
    async login() {
      /* service role, no user login */
    },
    async listItems<T>(collection: string, query: Record<string, string> = {}) {
      const table = tableName(collection);
      const params = toPostgrestQuery(query);
      const rows: T[] = [];
      let offset = 0;
      for (;;) {
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        const page = (await request(`/rest/v1/${table}?${params.toString()}`)) as T[];
        if (!Array.isArray(page)) return rows;
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return rows;
    },
    async createItem<T>(collection: string, payload: object) {
      const table = tableName(collection);
      const body = (await request(`/rest/v1/${table}`, {
        method: "POST",
        body: JSON.stringify(payload),
      })) as T[] | T;
      return (Array.isArray(body) ? body[0] : body) as T;
    },
    async updateItem<T>(collection: string, id: number, payload: object) {
      const table = tableName(collection);
      const body = (await request(`/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })) as T[] | T;
      return (Array.isArray(body) ? body[0] : body) as T;
    },
  };
}
