#!/usr/bin/env node
/**
 * Creates Directus role `manager`, policy "Manager App", and collection permissions.
 * Directus 12 Core forbids custom item filters (`user_id = $CURRENT_USER`).
 * Isolation is therefore: httpOnly cookie + Astro always filters by session user.
 * Usage: node --env-file=directus/.env directus/scripts/ensure-manager-role.mjs
 */
const base = (process.env.DIRECTUS_URL ?? "http://localhost:8055").replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error("Need ADMIN_EMAIL and ADMIN_PASSWORD");
  process.exit(1);
}

async function request(token, path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Directus ${response.status} ${path}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body;
}

const login = await request(null, "/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
const token = login.data.access_token;

const roles = await request(token, "/roles?limit=-1");
let role = (roles.data ?? []).find((row) => row.name === "manager");
if (!role) {
  const created = await request(token, "/roles", {
    method: "POST",
    body: JSON.stringify({ name: "manager", icon: "supervised_user_circle", description: "App-Nutzer, eigener Kader" }),
  });
  role = created.data;
}

const policies = await request(token, "/policies?limit=-1");
let policy = (policies.data ?? []).find((row) => row.name === "Manager App");
if (!policy) {
  const created = await request(token, "/policies", {
    method: "POST",
    body: JSON.stringify({
      name: "Manager App",
      icon: "sports_soccer",
      description: "Katalog lesen, Kader schreiben. Item-Filter nur in der Astro-App (Directus 12 Core).",
      admin_access: false,
      app_access: false,
    }),
  });
  policy = created.data;
}

const accessRows = await request(token, `/access?filter[role][_eq]=${role.id}&filter[policy][_eq]=${policy.id}`);
if (!accessRows.data?.length) {
  await request(token, "/access", {
    method: "POST",
    body: JSON.stringify({ role: role.id, policy: policy.id }),
  });
}

const existing = await request(token, `/permissions?filter[policy][_eq]=${policy.id}&limit=-1`);
for (const row of existing.data ?? []) {
  if (row.id) await request(token, `/permissions/${row.id}`, { method: "DELETE" });
}

const readAll = ["Player", "Fixture", "ValueHistory", "AvailabilityStatus", "RatingHistory"];
const writeOwn = ["SquadMembership", "ManagerProfile", "CompetitorSquad"];

for (const collection of readAll) {
  await request(token, "/permissions", {
    method: "POST",
    body: JSON.stringify({ policy: policy.id, collection, action: "read", fields: ["*"], permissions: {} }),
  });
}

for (const collection of writeOwn) {
  for (const action of ["create", "read", "update", "delete"]) {
    await request(token, "/permissions", {
      method: "POST",
      body: JSON.stringify({
        policy: policy.id,
        collection,
        action,
        fields: ["*"],
        permissions: {},
      }),
    });
  }
}

console.log(`Role manager + policy "Manager App" ready (${role.id}). Assign the role to invited users.`);
