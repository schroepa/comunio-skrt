# Design: Mobile-Ansicht (ganzes Tool)

**Datum:** 2026-08-22  
**Status:** Abgestimmt, bereit für Implementation Plan  
**Ergänzt:** [Spielerübersicht + Mobile Later](2026-08-22-spieleruebersicht-mobile-design.md) — Later wird hier konkret.

## Job

Wenn ich vor der Deadline am Handy bin, will ich Kader, Check und Radar in wenigen Taps erreichen, Status (Deadline, Budget) sehen und Spieler vergleichen — ohne pinch-pan, ohne ein Formular, das die Liste verdeckt, und ohne Hover.

## Entscheidungen (fest)

| Thema | Wahl |
|---|---|
| Navigation | Hamburger + Off-Canvas, keine untere Tab-Leiste |
| Status | Spieltag, Deadline, Budget, Kader **in der Sidebar**, nicht in der Kopfzeile |
| Menü-Button | Oben **rechts**, Icon, nicht das Wort „Menü“ |
| Drawer-Richtung | Von **rechts** (gleiche Seite wie der Button) |
| Filter (Radar, Kader-Suche, Konkurrenz) | Button „Filter“ → **Bottom-Sheet**; Liste ist sofort da |
| Desktop | Unverändert: linke Sidebar, Status in der Kopfzeile, Filter inline |
| Architektur | **Ein Shell**, zwei Chrome-Zustände per Viewport — keine parallelen `/m/`-Seiten |

Breakpoint: **unter 1024px** = Mobile-Chrome (bereits der Drawer-Breakpoint). Ab `lg` gilt das heutige Office-Layout.

Nicht im Scope: native App, PWA-Install-Zwang, Push, Bottom-Tabs, neue Datenquellen.

## Chrome

### Kopfzeile (nur &lt; 1024px)

- Sticky, `viewport-fit=cover`, Safe-Area oben.
- Links: Seitentitel nur visuell (`aria-hidden`). Die eine `h1` bleibt in `PageHeader` und ist unter `lg` `sr-only`; der Lead-Text darf sichtbar bleiben.
- Rechts: Icon-Button 44×44 CSS-px, `aria-expanded`, `aria-controls="app-sidebar"`, Label „Menü öffnen“ / „Menü schließen“.
- Keine Statuswerte in dieser Leiste.

Ab `lg`: heutige Kopfzeile mit StatusBar, Toggle unsichtbar, Sidebar links und fest.

### Off-Canvas (nur &lt; 1024px)

Reihenfolge oben → unten:

1. Statusblock: Spieltag, Deadline (Countdown), Budget, Kader — gleiche Daten wie heute `StatusBar` / `officeStatus()`.
2. Navigation (bestehende Gruppen Büro / Kader / Transfermarkt / Liga, Gooey-Pill nur für den aktiven Eintrag).
3. Unten: Theme-Toggle, E-Mail, Abmelden.

Verhalten:

- Öffnen über den rechten Button; Schließen über Button, Backdrop, Escape, oder nach Navigation (`astro:page-load`, bereits vorhanden).
- Backdrop, Scroll-Lock am `body`, Fokus im Panel (mindestens: Fokus auf Schließen/erstes Element, Tab bleibt im Drawer).
- Safe-Area rechts/unten.
- `z-index` über Inhalt, unter nichts Mission-Critical.

### PageHeader

- Eine `h1` pro Seite bleibt.
- Unter `lg`: `h1` ist `sr-only`, Lead kompakt sichtbar. Ab `lg`: heutige große H1.
- Kein zweiter sichtbarer Titel unter der Compact-Bar.

## Seiten

Gemeinsam: eine Spalte, kein horizontales Scrollen der Kerninhalte, Touch-Ziele ≥ 44×44 CSS-px (WCAG 2.5.8 plus 44px-Praxis), keine Information nur per Hover, Zoom 200 % ohne Funktionsverlust.

### Listen: Radar, Kader-Suche, Konkurrenz

- Katalog/Treffer **sofort** sichtbar.
- Kompakte Leiste: Button **Filter** (Badge, wenn Filter aktiv). Radar-Sortierung und Kader-Toggle liegen im Sheet (heute schon Slot in `PlayerSearchForm`).
- Ein Formular, zwei Präsentationen: unter `lg` im nativen `<dialog>` als Bottom-Sheet; ab `lg` wie heute im Fluss.
- Sheet: Felder unverändert (Name, Position-Gooey, Verein, Marktwert, Slot, Filtern / Zurücksetzen). Submit = GET, Dialog zu. Schließen ohne Submit verwirft ungesendete Änderungen (GET-Form, keine Client-State-Falle).
- Zeilen (`PlayerCatalogRow`): stapeln, Name/Verein/Preis umbrechen statt overflow; Primäraktion (z. B. „In den Kader“) 44×44.

Namenssuche sitzt **im Sheet**, nicht extra in der Compact-Leiste.

### Übersicht

Unter `lg` Stapel: **Warnungen → Transfer-Signale → Spiele**. Ab `lg` heutiges 12-Spalten-Office (Spiele links).

### Mein Kader

Budget-Formular kompakt, Kaderliste nach Position, Suche/Filter wie oben. Aktionen Add/Remove mit 44px und bestehender Confirm beim Entfernen.

### Kader-Check

Einspaltig, Zeilen volle Breite, gleiche Touch-Ziele. Kein Sheet nötig.

### Aufstellung

Spielfeld volle Breite, **hochkant** (Höhe &gt; Breite), Chips stapeln ohne Überlappung, Bank **unter** dem Feld. Kein Pinch als einziger Weg, Namen zu lesen.

### Login

Schon schmal; Safe-Area und 44px-Felder prüfen, sonst nichts Neues.

## Komponenten / Dateien

| Datei | Änderung |
|---|---|
| `web/src/layouts/Shell.astro` | Mobile-Header, Status in Sidebar, Drawer von rechts |
| `web/src/styles/global.css` | Drawer-Transform, Safe-Area, `viewport-fit=cover` |
| `web/src/components/SidebarToggle.tsx` | Icon rechts, a11y-Labels |
| `web/src/components/StatusBar.astro` | Wiederverwenden im Drawer (Mobile) und Header (Desktop) |
| `web/src/components/PageHeader.astro` | Mobile: H1 nicht doppelt sichtbar |
| `web/src/components/FilterSheet.astro` (neu) | Dialog-Sheet &lt; lg, inline ≥ lg |
| `web/src/components/PlayerSearchForm.astro` | Unveränderte Felder, Wrapping durch FilterSheet |
| `web/src/pages/radar.astro`, `kader.astro`, `konkurrenz.astro` | Form in FilterSheet |
| `web/src/pages/index.astro` | Mobile-Reihenfolge der Blöcke |
| `web/src/components/Pitch.astro` | Portrait-Layout &lt; lg |
| `web/src/pages/login.astro` | Nur Safe-Area / Touch, falls nötig |

Keine neuen Routen, keine zweite Nav-Quelle (`NAV_GROUPS` bleibt).

## Fehler und Zustände

- Drawer/Sheet: Escape und Backdrop schließen immer.
- Leere Listen: bestehende `EmptyState`, CTA 44px.
- Filter ohne Treffer: Copy wie heute + Sheet weiterhin erreichbar.
- Countdown im Drawer: gleiche Compact-Variante wie bisher.

## A11y (WCAG 2.2 AA)

- Ein `h1`, Skip-Link bleibt.
- Dialog: `aria-labelledby`, Fokus beim Öffnen, Restore beim Schließen.
- Icon-Menü: zugänglicher Name.
- Kontrast Status/Text auf `--surface`.
- `prefers-reduced-motion`: Drawer/Sheet ohne Slide.
- Target Size 2.5.8 erfüllt; praxisnah 44px.

## Messung

- 360px Breite: Radar-Liste ohne horizontales Pan der Tabelle.
- Filter setzen in ≤ 2 Taps nach Öffnen des Sheets (öffnen → Feld/Chip → Filtern).
- Alle sechs Orte aus dem Drawer in einem Tap nach Öffnen.
- Status (Deadline + Budget) sichtbar, sobald das Menü offen ist.

## Test

- Manuell: iPhone-Breite (~390) und 360, Hell/Dunkel, Drawer + Sheet + Navigation mit View Transitions.
- Keyboard: Tab durch Header → Inhalt; Dialog-Fokus; Escape.
- Bestehende Unit-Tests unverändert (`officeStatus`, Radar-Sort, Theme). Kein neuer Unit-Zwang für CSS-Chrome.
- Optional: ein Viewport-Smoke in Playwright nur wenn das Repo schon Browser-Tests hat — sonst manuell.

## Abhängigkeiten

- `web/src/layouts/Shell.astro`, `web/src/lib/nav.ts`, `web/src/lib/status.ts`
- `docs/spec-transfermarkt.md`, `docs/spec-kader-check.md`, `docs/spec-aufstellung.md`
- Gooey bleibt; auf Mobile nur im Drawer und in Filter-Chips, nicht als zweite Nav.
