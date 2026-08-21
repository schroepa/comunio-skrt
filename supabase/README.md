# Supabase

Postgres + Auth ersetzen Directus. Du legst das Projekt an; Schema und App sind im Repo vorbereitet.

## Einmalig

1. [supabase.com](https://supabase.com) → New project, Region **Frankfurt** (`eu-central-1`), Free.
2. **Authentication → Providers → Email** an. Sign-ups **aus** (Invite only).
3. **SQL Editor** → Inhalt von `migrations/20260821183000_init.sql` ausführen.
4. **Authentication → Users** → User anlegen (E-Mail + Passwort) für dich und später die Freunde.
5. **Project Settings → API:** `Project URL` und `anon` `public` Key.

Web (`web/.env`):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

Scraper (`scraper/.env`):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # secret, nur CLI
```

Service Role nie nach Vercel und nie an Freunde.

6. Katalog: `cd scraper && npm run sync:openligadb && npm run sync:transfermarkt`
7. App: `cd web && npm run dev` → `/login`
8. Vercel: dieselben `SUPABASE_URL` und `SUPABASE_ANON_KEY` (kein Service Role)

## Directus

Lokales Directus ist nicht mehr der Happy Path. Ordner `directus/` bleibt vorerst im Repo, wird nicht mehr von Web/Scraper genutzt.
