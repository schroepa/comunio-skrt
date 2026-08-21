# Freundes-Runde P0+P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invite-only Login über Directus-User, isolierter Kader (`SquadMembership.user_id`), Picker unter `/kader`, Web auf Vercel-Adapter, Directus self-hosted.

**Architecture:** Astro-SSR setzt httpOnly-Cookies nach `POST /auth/login`. Alle geschützten Seiten rufen Directus mit dem User-Token auf. Rechte in Directus filtern `user_id = $CURRENT_USER`. Katalog bleibt geteilt.

**Tech Stack:** Astro 7, `@astrojs/vercel`, Directus 12, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-freundesrunde-auth-kader-design.md`

## Global Constraints

- Kein Token im Browser, kein `PUBLIC_*` Secret, kein Sign-up.
- Feldnamen verbatim, Copy Login-Fehler verbatim laut Spec.
- Isolation in Directus-Rechten, nicht nur in der App.
- Tests ohne Live-Directus.
- App-Sprache `de`. Iconoir falls Icons, nicht Lucide.

## File Structure

```
directus/schema/snapshot.yaml          # user_id, ManagerProfile, später CompetitorSquad
directus/scripts/ensure-manager-role.mjs
web/src/middleware.ts
web/src/lib/session.ts
web/src/lib/directus.ts                # User-Token, Players, Squad
web/src/lib/money.ts                   # Kaderwert / Budget übrig
web/src/pages/login.astro
web/src/pages/logout.ts
web/src/pages/kader.astro
web/src/pages/kader/actions.ts         # oder Form POST auf kader.astro
web/src/layouts/Shell.astro
web/src/components/Nav.tsx
web/astro.config.mjs                   # vercel adapter
```

---

### Task 1: Schema `user_id` + `ManagerProfile`

Snapshot: `SquadMembership.user_id` UUID M2O `directus_users`. Collection `ManagerProfile` (`user_id`, `budget`). Relation-Einträge analog `player_id`.

Nach Apply lokal: `docker compose exec directus npx directus schema apply --yes ./schema/snapshot.yaml`.

### Task 2: Session, Login, Middleware

`loginWithDirectus`, `readMe`, `refreshSession` gegen gemocktes fetch. Cookies `comunio_access` / `comunio_refresh`. Middleware: außer `/login` und Assets → Redirect.

### Task 3: Kader-API und Money

`searchPlayers`, `listSquad`, `addToSquad`, `removeFromSquad`, `getProfile`, `saveBudget`. `squadValue` / `budgetRemaining` rein.

### Task 4: UI `/kader` + Dashboard-Zahlen + Nav

### Task 5: Rolle `manager` + Hosting-Doku + Vercel-Adapter

P2–P4 folgen den Specs `docs/superpowers/specs/2026-08-21-kicker-radar-kadercheck-design.md`, `docs/spec-konkurrenzvergleich.md`, `docs/spec-aufstellung.md`, `docs/spec-punkteprognose.md` in derselben Lieferung.
