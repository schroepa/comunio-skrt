# Mobile-Ansicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unter 1024px ist das Tool auf dem Handy nutzbar: Hamburger rechts, Status im Off-Canvas von rechts, Listen sofort sichtbar, Filter im Bottom-Sheet.

**Architecture:** Ein `Shell.astro` mit zwei Chrome-Zuständen (CSS-Breakpoint `lg` / 1024px). Keine parallelen Routen. Filter bleiben ein GET-Formular; unter `lg` steckt dasselbe Formular in einem nativen `<dialog>`, ab `lg` im Dokumentfluss (`display: contents` auf dem geschlossenen Dialog). Drawer-Zustand bleibt `html[data-sidebar-open]`; Workspace (`#app-workspace`) wird dabei `inert`.

**Tech Stack:** Astro 7, React 19 (bestehende Inseln), Tailwind 4, `liquid-gooey`, Vitest (Node), keine neuen Dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-mobile-ansicht-design.md`

## Global Constraints

- Breakpoint Mobile-Chrome: unter 1024px; ab `lg` heutiges Office (linke Sidebar, Status in der Kopfzeile, Filter inline).
- Copy und UI auf Deutsch. Touch-Ziele `min-h-11` (44px). Eine `h1` pro Seite (`PageHeader`); Compact-Titel in der Mobile-Leiste `aria-hidden`.
- Keine Bottom-Tabs, keine `/m/`-Routen, keine PWA, keine neuen Datenquellen.
- Gooey nur Drawer-Nav und Filter-Chips, nicht als zweite Navigation.
- `NAV_GROUPS` / `officeStatus()` / `PlayerSearchForm`-Felder unverändert.
- Tests: `cd web && npm test` (typecheck + vitest). Vitest-Environment ist `node` — keine jsdom-Annahme.
- Commits klein, Message auf das Warum; keine Secrets.

## File Structure

```
web/src/lib/players.ts              # + catalogFiltersActive() für Filter-Badge
web/src/lib/sidebar-drawer.ts       # setSidebarOpen — inert + data-sidebar-open (neu)
web/src/layouts/Shell.astro         # Header, Status-Ort, Drawer von rechts, viewport-fit
web/src/styles/global.css           # Drawer-Transform, scroll-lock, FilterSheet, safe-area
web/src/components/SidebarToggle.tsx
web/src/components/StatusBar.astro  # layout: "bar" | "stack"
web/src/components/PageHeader.astro # h1 sr-only unter lg
web/src/components/FilterSheet.astro # neu
web/src/pages/radar.astro
web/src/pages/kader.astro
web/src/pages/konkurrenz.astro
web/src/pages/index.astro           # Reihenfolge + Lead-Copy
web/src/components/Pitch.astro
web/src/components/PlayerCatalogRow.astro
web/src/components/EmptyState.astro
web/src/pages/kader-check.astro
web/src/pages/login.astro
web/tests/lib/players.test.ts
web/tests/lib/sidebar-drawer.test.ts # neu
```

---

### Task 1: Filter-Badge-Logik

**Files:**
- Modify: `web/src/lib/players.ts`
- Modify: `web/tests/lib/players.test.ts`

**Interfaces:**
- Consumes: `PlayerFilters`, `hasPlayerFilters(filters: PlayerFilters): boolean`
- Produces: `catalogFiltersActive(filters: PlayerFilters, extras?: { onlySquad?: boolean; sortChanged?: boolean }): boolean`

- [ ] **Step 1: Failing test schreiben**

Am Ende von `web/tests/lib/players.test.ts` Import um `catalogFiltersActive` erweitern und ergänzen:

```ts
describe("catalogFiltersActive", () => {
  const empty = { q: "", position: "", verein: "", mwMin: null, mwMax: null };

  it("is false when catalog query is default", () => {
    expect(catalogFiltersActive(empty)).toBe(false);
    expect(catalogFiltersActive(empty, { onlySquad: false, sortChanged: false })).toBe(false);
  });

  it("is true for player filters, squad-only, or non-default sort", () => {
    expect(catalogFiltersActive({ ...empty, q: "Undav" })).toBe(true);
    expect(catalogFiltersActive(empty, { onlySquad: true })).toBe(true);
    expect(catalogFiltersActive(empty, { sortChanged: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/players.test.ts`

Expected: FAIL — `catalogFiltersActive` is not exported.

- [ ] **Step 3: Minimale Implementierung**

In `web/src/lib/players.ts` direkt nach `hasPlayerFilters`:

```ts
export function catalogFiltersActive(
  filters: PlayerFilters,
  extras: { onlySquad?: boolean; sortChanged?: boolean } = {},
): boolean {
  return hasPlayerFilters(filters) || Boolean(extras.onlySquad) || Boolean(extras.sortChanged);
}
```

- [ ] **Step 4: Test muss grün sein**

Run: `cd web && npx vitest run tests/lib/players.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/players.ts web/tests/lib/players.test.ts
git commit -m "$(cat <<'EOF'
Filter-Badge an der echten Query festmachen.

EOF
)"
```

---

### Task 2: Drawer-Helfer (inert + open-Flag)

**Files:**
- Create: `web/src/lib/sidebar-drawer.ts`
- Create: `web/tests/lib/sidebar-drawer.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces:

```ts
export type FlagRoot = {
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export function isSidebarOpen(root: FlagRoot): boolean;
export function setSidebarOpen(root: FlagRoot, open: boolean, workspace?: FlagRoot | null): void;
```

- [ ] **Step 1: Failing test schreiben**

`web/tests/lib/sidebar-drawer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSidebarOpen, setSidebarOpen, type FlagRoot } from "../../src/lib/sidebar-drawer";

function flagRoot(initial: string[] = []): FlagRoot {
  const attrs = new Set(initial);
  return {
    hasAttribute: (name) => attrs.has(name),
    setAttribute: (name) => {
      attrs.add(name);
    },
    removeAttribute: (name) => {
      attrs.delete(name);
    },
  };
}

describe("setSidebarOpen", () => {
  it("sets and clears the open flag", () => {
    const root = flagRoot();
    expect(isSidebarOpen(root)).toBe(false);
    setSidebarOpen(root, true);
    expect(isSidebarOpen(root)).toBe(true);
    setSidebarOpen(root, false);
    expect(isSidebarOpen(root)).toBe(false);
  });

  it("marks the workspace inert only while open", () => {
    const root = flagRoot();
    const workspace = flagRoot();
    setSidebarOpen(root, true, workspace);
    expect(workspace.hasAttribute("inert")).toBe(true);
    setSidebarOpen(root, false, workspace);
    expect(workspace.hasAttribute("inert")).toBe(false);
  });
});
```

- [ ] **Step 2: Test muss fehlschlagen**

Run: `cd web && npx vitest run tests/lib/sidebar-drawer.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Minimale Implementierung**

`web/src/lib/sidebar-drawer.ts`:

```ts
export type FlagRoot = {
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export function isSidebarOpen(root: FlagRoot): boolean {
  return root.hasAttribute("data-sidebar-open");
}

export function setSidebarOpen(root: FlagRoot, open: boolean, workspace?: FlagRoot | null): void {
  if (open) root.setAttribute("data-sidebar-open", "");
  else root.removeAttribute("data-sidebar-open");
  if (!workspace) return;
  if (open) workspace.setAttribute("inert", "");
  else workspace.removeAttribute("inert");
}
```

- [ ] **Step 4: Test muss grün sein**

Run: `cd web && npx vitest run tests/lib/sidebar-drawer.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/sidebar-drawer.ts web/tests/lib/sidebar-drawer.test.ts
git commit -m "$(cat <<'EOF'
Drawer-Zustand an inert koppeln, damit der Fokus im Menü bleibt.

EOF
)"
```

---

### Task 3: Mobile-Chrome (Shell, Status, Toggle, PageHeader)

**Files:**
- Modify: `web/src/layouts/Shell.astro`
- Modify: `web/src/styles/global.css` (Blöcke `.app-sidebar` / `.sidebar-backdrop` / `prefers-reduced-motion`)
- Modify: `web/src/components/SidebarToggle.tsx`
- Modify: `web/src/components/StatusBar.astro`
- Modify: `web/src/components/PageHeader.astro`

**Interfaces:**
- Consumes: `setSidebarOpen`, `isSidebarOpen` from `../lib/sidebar-drawer`; `officeStatus` unverändert; `title` Prop von Shell.
- Produces: Mobile-Header (Titel links, Icon rechts); Status `layout="stack"` im Drawer, `layout="bar"` ab `lg` in der Kopfzeile; Drawer von rechts; `#app-workspace` für inert.

- [ ] **Step 1: StatusBar um `layout` erweitern**

`web/src/components/StatusBar.astro` Props:

```ts
interface Props {
  status: OfficeStatus;
  userEmail?: string;
  layout?: "bar" | "stack";
}
const { status, userEmail, layout = "bar" } = Astro.props;
```

Root-`div` ersetzen:

- `layout === "bar"`: heutige Klassen `flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-sm`
- `layout === "stack"`: `flex flex-col gap-2 text-sm`
- `userEmail`-Zeile nur bei `layout === "bar"` (Drawer zeigt E-Mail schon beim Logout)

Deadline-Countdown bleibt `client:load` + `compact`.

- [ ] **Step 2: PageHeader — eine sichtbare H1 auf Desktop, sr-only auf Mobile**

`web/src/components/PageHeader.astro`:

```astro
<header class="space-y-2">
  <h1 class="text-3xl font-semibold tracking-tight max-lg:sr-only">{title}</h1>
  {lead ? <p class="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">{lead}</p> : null}
</header>
```

- [ ] **Step 3: SidebarToggle — Icon, Labels, setSidebarOpen**

`web/src/components/SidebarToggle.tsx` ersetzen durch:

```tsx
import { useEffect, useState } from "react";
import { isSidebarOpen, setSidebarOpen } from "../lib/sidebar-drawer";

function workspace(): HTMLElement | null {
  return document.getElementById("app-workspace");
}

function closeSidebar() {
  setSidebarOpen(document.documentElement, false, workspace());
}

export default function SidebarToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(isSidebarOpen(document.documentElement));
    const onLoad = () => {
      closeSidebar();
      sync();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isSidebarOpen(document.documentElement)) {
        closeSidebar();
        sync();
        document.getElementById("sidebar-toggle")?.focus();
      }
    };
    document.addEventListener("astro:page-load", onLoad);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("astro:page-load", onLoad);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <button
      id="sidebar-toggle"
      type="button"
      className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border lg:hidden"
      aria-controls="app-sidebar"
      aria-expanded={open}
      aria-label={open ? "Menü schließen" : "Menü öffnen"}
      onClick={() => {
        const next = !isSidebarOpen(document.documentElement);
        setSidebarOpen(document.documentElement, next, workspace());
        setOpen(next);
        if (next) document.getElementById("sidebar-close")?.focus();
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
```

Backdrop in Shell: `onclick` durch denselben Helper ersetzen — reines HTML darf `data-sidebar-open` und `inert` auf `#app-workspace` entfernen:

```html
onclick="document.documentElement.removeAttribute('data-sidebar-open'); document.getElementById('app-workspace')?.removeAttribute('inert')"
```

- [ ] **Step 4: Shell-Markup**

Viewport:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

`aside#app-sidebar`: Klassen um `max-lg:border-l max-lg:border-r-0` ergänzen. Direkt unter dem Brand-Header (Comunio Assistant) einen Close-Button nur Mobile und den Status-Stack:

```html
<div class="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-4">
  <a href="/" class="text-sm font-semibold tracking-tight no-underline">Comunio Assistant</a>
  <button
    id="sidebar-close"
    type="button"
    class="inline-flex size-11 items-center justify-center rounded-md border border-sidebar-border lg:hidden"
    aria-label="Menü schließen"
    onclick="document.documentElement.removeAttribute('data-sidebar-open'); document.getElementById('app-workspace')?.removeAttribute('inert')"
  >
    <span aria-hidden="true">×</span>
  </button>
</div>
<div class="border-b border-sidebar-border px-3 py-3 lg:hidden">
  <StatusBar status={status} layout="stack" />
</div>
```

Nav-Block und Theme/Logout bleiben darunter wie heute.

Workspace-Wrapper um Header+Main+Footer (das heutige `div.flex.min-w-0.flex-1.flex-col`) bekommt `id="app-workspace"`.

Kopfzeile:

```html
<header class="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top)]">
  <p class="min-w-0 truncate font-semibold lg:hidden" aria-hidden="true">{title}</p>
  <div class="hidden min-w-0 flex-1 lg:block">
    <StatusBar status={status} userEmail={userEmail} layout="bar" />
  </div>
  <SidebarToggle client:load />
</header>
```

`aside` bekommt `role="dialog"` nicht dauerhaft (Desktop ist keine Dialog). Stattdessen: `aria-label="Menü"` am `aside` reicht; Modal-Verhalten über `inert` auf dem Workspace.

- [ ] **Step 5: CSS Drawer von rechts + Scroll-Lock**

In `web/src/styles/global.css` den Block `@media (max-width: 1023px)` für `.app-sidebar` ersetzen:

```css
@media (max-width: 1023px) {
  .app-sidebar {
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 40;
    width: 16rem;
    transform: translateX(100%);
    transition: transform 180ms ease;
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
  }

  html[data-sidebar-open] .app-sidebar {
    transform: translateX(0);
  }

  html[data-sidebar-open] {
    overflow: hidden;
  }

  html[data-sidebar-open] .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 30;
    border: 0;
    background: oklch(0.15 0.01 107 / 0.45);
  }
}
```

In `prefers-reduced-motion` ergänzen:

```css
.app-sidebar,
.sidebar-backdrop,
.filter-sheet-dialog {
  transition: none !important;
}
```

- [ ] **Step 6: Typecheck**

Run: `cd web && npm run typecheck`

Expected: PASS

- [ ] **Step 7: Manuell Chrome**

`cd web && npm run dev` — Viewport 390px: Titel links, Hamburger rechts, Sidebar fährt von rechts, Status oben im Menü, Nav darunter, Theme/Logout unten. Ab 1024px: linke Sidebar, Status in der Kopfzeile, kein Hamburger.

- [ ] **Step 8: Commit**

```bash
git add web/src/layouts/Shell.astro web/src/styles/global.css web/src/components/SidebarToggle.tsx web/src/components/StatusBar.astro web/src/components/PageHeader.astro
git commit -m "$(cat <<'EOF'
Handy-Chrome: Status ins Menü, Öffner nach rechts.

EOF
)"
```

---

### Task 4: Filter-Bottom-Sheet

**Files:**
- Create: `web/src/components/FilterSheet.astro`
- Modify: `web/src/styles/global.css` (FilterSheet-Regeln)
- Modify: `web/src/pages/radar.astro`
- Modify: `web/src/pages/kader.astro`
- Modify: `web/src/pages/konkurrenz.astro`

**Interfaces:**
- Consumes: `catalogFiltersActive` from `../lib/players`; Slot = bestehendes `PlayerSearchForm` (inkl. Radar-Slot).
- Produces: `FilterSheet` Props `{ active?: boolean; title?: string }` — ein Formular, unter `lg` `showModal()`, ab `lg` inline.

- [ ] **Step 1: FilterSheet bauen**

`web/src/components/FilterSheet.astro`:

```astro
---
interface Props {
  active?: boolean;
  title?: string;
}
const { active = false, title = "Filter" } = Astro.props;
---
<div class="filter-sheet">
  <button
    class="filter-sheet-open"
    type="button"
    data-filter-open
    aria-haspopup="dialog"
  >
    {title}
    {active ? <span class="filter-sheet-badge" aria-hidden="true"></span> : null}
    {active ? <span class="sr-only">aktiv</span> : null}
  </button>
  <dialog class="filter-sheet-dialog" data-filter-dialog aria-labelledby="filter-sheet-title">
    <div class="filter-sheet-panel">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 id="filter-sheet-title" class="text-lg font-semibold">{title}</h2>
        <button class="inline-flex size-11 items-center justify-center rounded-md border border-border" type="button" data-filter-close aria-label="Filter schließen">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</div>
<script>
  function bind(root: ParentNode) {
    const dialog = root.querySelector<HTMLDialogElement>("[data-filter-dialog]");
    const open = root.querySelector<HTMLButtonElement>("[data-filter-open]");
    const close = root.querySelector<HTMLButtonElement>("[data-filter-close]");
    if (!dialog || !open || !close) return;
    open.addEventListener("click", () => dialog.showModal());
    close.addEventListener("click", () => dialog.close());
  }
  document.querySelectorAll(".filter-sheet").forEach((node) => bind(node));
  document.addEventListener("astro:page-load", () => {
    document.querySelectorAll(".filter-sheet").forEach((node) => bind(node));
  });
</script>
```

Achtung: `astro:page-load` darf Listener nicht stapeln. Bind nur einmal pro Node, z. B. `if (node.hasAttribute("data-filter-bound")) return; node.setAttribute("data-filter-bound", "");`

- [ ] **Step 2: FilterSheet-CSS**

An `web/src/styles/global.css` anhängen:

```css
.filter-sheet-open {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0 0.75rem;
  font-size: 0.875rem;
}

.filter-sheet-badge {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--primary);
}

.filter-sheet-dialog {
  margin: auto 0 0;
  width: 100%;
  max-width: 100%;
  max-height: min(85dvh, 40rem);
  border: 0;
  border-radius: var(--radius) var(--radius) 0 0;
  padding: 0;
  background: var(--surface);
  color: var(--foreground);
}

.filter-sheet-dialog::backdrop {
  background: oklch(0.15 0.01 107 / 0.45);
}

.filter-sheet-panel {
  overflow: auto;
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
}

@media (min-width: 1024px) {
  .filter-sheet-open {
    display: none;
  }

  .filter-sheet-dialog {
    display: contents;
    position: static;
    max-height: none;
    background: transparent;
    padding: 0;
  }

  .filter-sheet-dialog::backdrop {
    display: none;
  }

  .filter-sheet-panel {
    overflow: visible;
    padding: 0;
  }

  .filter-sheet-panel > div:first-child {
    display: none;
  }
}
```

Native `<dialog>` ohne `open` ist `display: none`. `display: contents` im `lg`-Query muss das UA-`none` überschreiben — `display: contents !important` setzen, falls der Dialog geschlossen bleibt.

- [ ] **Step 3: Seiten wrappen**

`radar.astro`: Import `FilterSheet` und `catalogFiltersActive`. `PlayerSearchForm` (mit Sort/Kader-Slot) in:

```astro
<FilterSheet active={catalogFiltersActive(filters, { onlySquad, sortChanged: sort !== "form" })}>
  <PlayerSearchForm ...>
    ...
  </PlayerSearchForm>
</FilterSheet>
```

Die Ergebnisliste **unter** dem `FilterSheet` lassen (nicht ins Dialog-Slot).

`kader.astro`: Abschnitt „Spieler suchen“ — Formular in `FilterSheet active={catalogFiltersActive(filters)}>`. Trefferliste bleibt darunter.

`konkurrenz.astro`: gleiches Muster; Rivalen-Name bleibt Feld im Formular (liegt damit im Sheet). `active={catalogFiltersActive(filters) || rival.trim().length > 0}` — Rival zählt als aktive Query, sonst wirkt das Sheet leer obwohl `rival` gesetzt ist.

- [ ] **Step 4: Typecheck + Unit-Tests**

Run: `cd web && npm test`

Expected: PASS

- [ ] **Step 5: Manuell Sheet**

390px `/radar`: Liste sofort, Button „Filter“, Sheet von unten, Position-Chip + Filtern, nach Submit Sheet zu und Badge an. 1024px: Formular wie bisher über der Liste, kein Button.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/FilterSheet.astro web/src/styles/global.css web/src/pages/radar.astro web/src/pages/kader.astro web/src/pages/konkurrenz.astro
git commit -m "$(cat <<'EOF'
Listen zuerst zeigen, Filter ins Sheet legen.

EOF
)"
```

---

### Task 5: Übersicht-Reihenfolge

**Files:**
- Modify: `web/src/pages/index.astro`

**Interfaces:**
- Consumes: bestehende Cards/MatchList.
- Produces: unter `lg` DOM-Order Warnungen → Signale → Spiele; ab `xl` Spiele links.

- [ ] **Step 1: Lead-Copy**

PageHeader-Lead ersetzen (Status ist nicht mehr „oben in der Leiste“):

```
Was vor der Deadline zählt: Warnungen, Transfer-Signale, Spiele. Deadline und Budget stecken im Menü.
```

- [ ] **Step 2: Grid-Order**

Das äußere Grid und die zwei Kinder:

```astro
<div class="grid gap-6 xl:grid-cols-12">
  <div class="order-1 space-y-6 xl:order-2 xl:col-span-5">
    <!-- Posteingang Card, dann Transfermarkt Card — Reihenfolge im Markup beibehalten -->
  </div>
  <section class="order-2 min-w-0 xl:order-1 xl:col-span-7">
    <!-- Nächste Spiele -->
  </section>
</div>
```

Karten-Inhalt nicht umbauen.

- [ ] **Step 3: Manuell**

390px Übersicht: zuerst Kader-Check-Karte, dann Transfermarkt, dann Spiele. Desktop `xl`: Spiele links.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/index.astro
git commit -m "$(cat <<'EOF'
Übersicht auf dem Handy mit Warnungen zuerst.

EOF
)"
```

---

### Task 6: Seiten-Dichte (Feld, Zeilen, Touch, Login)

**Files:**
- Modify: `web/src/components/Pitch.astro`
- Modify: `web/src/components/PlayerCatalogRow.astro`
- Modify: `web/src/components/EmptyState.astro`
- Modify: `web/src/pages/kader-check.astro`
- Modify: `web/src/pages/login.astro`
- Modify: `web/src/pages/kader.astro` (Budget-Input `min-h-11`, `w-full` unter `lg` falls nötig)

**Interfaces:**
- Consumes: bestehende Komponenten.
- Produces: Portrait-Pitch unter 1024px; Zeilen ohne Horizontal-Scroll; CTAs 44px.

- [ ] **Step 1: Pitch hochkant**

In `Pitch.astro` `<style>` ergänzen:

```css
@media (max-width: 1023px) {
  .pitch {
    min-height: 28rem;
    aspect-ratio: 3 / 4;
  }
  .player-chip {
    min-width: 4.5rem;
    max-width: 5.75rem;
    font-size: 0.6875rem;
  }
}
```

Namen bleiben im Chip sichtbar (`shirtName`); `title` darf Zusatz bleiben, ist aber nicht der einzige Pfad.

- [ ] **Step 2: Catalog-Zeile**

`PlayerCatalogRow.astro` Root:

```
<article class="grid gap-3 overflow-x-hidden border-b border-border/60 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
```

Slot-Aktionen liegen schon in der zweiten Grid-Zelle; Buttons in den Pages haben `min-h-11` — beibehalten. Name/Verein: `truncate` darf bleiben, solange kein horizontales Page-Scroll entsteht (`overflow-x-hidden` am article + `min-w-0` am Textblock, ist schon da).

- [ ] **Step 3: EmptyState-CTA**

```astro
<a class="text-link inline-flex min-h-11 items-center" href={href}>{cta}</a>
```

- [ ] **Step 4: Kader-Check-Zeilen**

`li` in `kader-check.astro`: `class="flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 text-sm"`

- [ ] **Step 5: Login Safe-Area + Inputs**

`login.astro` Viewport analog Shell `viewport-fit=cover`. `body` `pt-[env(safe-area-inset-top)]`. E-Mail- und Passwort-Inputs `min-h-11`. Theme-Toggle `right-4` um `top-[max(1rem,env(safe-area-inset-top))]`.

Kader-Budget-Input: `class="mt-1 block min-h-11 w-full max-w-xs rounded-md border border-border bg-card px-3 py-2"`

- [ ] **Step 6: Typecheck**

Run: `cd web && npm test`

Expected: PASS

- [ ] **Step 7: Manuell 360 und 390**

Radar ohne Seitwärts-Pan; Aufstellung Chips lesbar ohne Pinch; Login Felder tappbar.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/Pitch.astro web/src/components/PlayerCatalogRow.astro web/src/components/EmptyState.astro web/src/pages/kader-check.astro web/src/pages/login.astro web/src/pages/kader.astro
git commit -m "$(cat <<'EOF'
Handy-Seiten auf eine Spalte und 44-Pixel-Ziele bringen.

EOF
)"
```

---

### Task 7: Abnahme gegen Spec

**Files:** keine neuen, nur prüfen.

**Interfaces:** keine.

- [ ] **Step 1: Checkliste (Spec-Messung)**

Am echten Dev-Server, Viewport 360 und ~390, Hell und Dunkel:

1. Nur der aktuelle Nav-Eintrag ist aktiv (eine Gooey-Pill).
2. Hamburger oben rechts; Drawer von rechts; Status (Deadline + Budget) im offenen Menü.
3. Radar: Liste ohne Filterformular im ersten Screen; Filter ≤ 2 Aktionen nach Öffnen des Sheets.
4. Alle sechs Orte aus dem Drawer erreichbar.
5. Übersicht: Warnungen vor Spielen.
6. Escape schließt Drawer und Sheet; Backdrop ebenfalls.
7. `prefers-reduced-motion`: kein Slide.
8. Zoom 200 %: Nav und Filter noch bedienbar.

- [ ] **Step 2: `cd web && npm test`**

Expected: PASS (53+ Tests plus die neuen).

- [ ] **Step 3: Kein Commit wenn nichts geändert.** Falls CSS-Fixes nötig, eigener Commit:

```bash
git commit -m "$(cat <<'EOF'
Mobile-Chrome nach der Abnahme nachschärfen.

EOF
)"
```

---

## Spec-Abdeckung

| Spec-Abschnitt | Task |
|---|---|
| Chrome Kopfzeile, Hamburger rechts, kein Status in der Leiste | 3 |
| Off-Canvas Reihenfolge Status → Nav → Theme/Logout, von rechts | 3 |
| PageHeader eine h1 / Compact-Titel aria-hidden | 3 |
| Filter Bottom-Sheet, Liste zuerst, Name im Sheet | 1 (Badge), 4 |
| Übersicht Warnungen → Signale → Spiele | 5 |
| Kader Sheet + 44px Aktionen | 4, 6 |
| Kader-Check einspaltig | 6 |
| Aufstellung Portrait, Bank darunter (Bank ist schon darunter) | 6 |
| Login Safe-Area | 6 |
| A11y inert, Escape, dialog, 44px, reduced motion | 2, 3, 4, 6 |
| Desktop unverändert ab lg | 3, 4, 5 |
| Keine parallelen Routen / Tabs / PWA | global, kein Task |
