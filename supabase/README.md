# Supabase

Postgres + Auth ersetzen Directus. Du legst das Projekt an; Schema und App sind im Repo vorbereitet.

## Einmalig

1. [supabase.com](https://supabase.com) → New project, Region **Frankfurt** (`eu-central-1`), Free.
2. **Authentication → Sign In / Providers** (nicht mehr „Providers“): Email an. Unter **User Signups** den Schalter **Allow new users to sign up** aus (Invite only).
3. **SQL Editor** → Inhalt von `migrations/20260821183000_init.sql` ausführen.
4. **Authentication → Users** → User anlegen (E-Mail + Passwort) für dich und später die Freunde.
5. Keys holen — nicht mehr unter „Project Settings → API“:
   - Oben der grüne Button **Connect** → Tab **API Keys**, oder
   - Zahnrad unten links (**Project Settings**) → **API Keys**
   - **Project URL** → `SUPABASE_URL`
   - Web: **anon** (Legacy) oder **Publishable key** → `SUPABASE_ANON_KEY`
   - Scraper: Tab **Legacy API Keys** → **service_role**, oder neuer **Secret key** → `SUPABASE_SERVICE_ROLE_KEY`

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
