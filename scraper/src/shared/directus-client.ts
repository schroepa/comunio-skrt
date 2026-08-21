export type DirectusClient = {
  login(): Promise<void>;
  listItems<T>(collection: string, query?: Record<string, string>): Promise<T[]>;
  createItem<T>(collection: string, payload: object): Promise<T>;
  updateItem<T>(collection: string, id: number, payload: object): Promise<T>;
};

export type DirectusClientOptions = {
  baseUrl: string;
  email: string;
  password: string;
  fetchImpl?: typeof fetch;
};

export function createDirectusClient(options: DirectusClientOptions): DirectusClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  let token: string | null = null;

  async function request(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new Error(`Directus HTTP ${response.status} for ${init.method ?? "GET"} ${path}`);
    }
    return response.json() as Promise<{ data: unknown }>;
  }

  return {
    async login() {
      const body = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: options.email, password: options.password }),
      });
      const data = body.data as { access_token: string };
      token = data.access_token;
    },
    async listItems<T>(collection: string, query: Record<string, string> = {}) {
      const params = new URLSearchParams(query);
      const qs = params.toString();
      const body = await request(`/items/${collection}${qs ? `?${qs}` : ""}`);
      return body.data as T[];
    },
    async createItem<T>(collection: string, payload: object) {
      const body = await request(`/items/${collection}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return body.data as T;
    },
    async updateItem<T>(collection: string, id: number, payload: object) {
      const body = await request(`/items/${collection}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return body.data as T;
    },
  };
}
