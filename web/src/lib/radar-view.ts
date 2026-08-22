import { noteToFormPoints, type RadarBadge } from "./scores";

export type RadarSort = "form" | "market" | "name" | "signal";

export const RADAR_SORTS: Array<{ value: RadarSort; label: string }> = [
  { value: "form", label: "Form" },
  { value: "market", label: "Marktwert" },
  { value: "signal", label: "Empfehlung" },
  { value: "name", label: "Name" },
];

const SORTS = new Set<RadarSort>(["form", "market", "name", "signal"]);

const SIGNAL_ORDER: Record<string, number> = {
  Kaufen: 0,
  Halten: 1,
  Beobachten: 2,
  Verkaufen: 3,
  "Nicht verfügbar": 4,
  "Kein Signal": 5,
};

export type SortableRadarRow = {
  player: { name: string };
  form: number | null;
  market: number;
  badge: RadarBadge | "Kein Signal";
};

export function parseRadarSort(params: URLSearchParams): RadarSort {
  const value = params.get("sort") ?? "";
  return SORTS.has(value as RadarSort) ? (value as RadarSort) : "form";
}

export function sortRadarRows<T extends SortableRadarRow>(rows: T[], sort: RadarSort): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "name") return a.player.name.localeCompare(b.player.name, "de");
    if (sort === "market") return b.market - a.market;
    if (sort === "signal") return (SIGNAL_ORDER[a.badge] ?? 9) - (SIGNAL_ORDER[b.badge] ?? 9);
    const af = a.form;
    const bf = b.form;
    if (af == null && bf == null) return a.player.name.localeCompare(b.player.name, "de");
    if (af == null) return 1;
    if (bf == null) return -1;
    return bf - af;
  });
  return copy;
}

export function positionChip(position: string): { code: string; className: string } {
  if (position === "Torwart") return { code: "TW", className: "bg-amber-400/90 text-amber-950" };
  if (position === "Abwehr") return { code: "ABW", className: "bg-sky-500/90 text-sky-950" };
  if (position === "Mittelfeld") return { code: "MF", className: "bg-emerald-500/90 text-emerald-950" };
  if (position === "Sturm") return { code: "ST", className: "bg-rose-500/90 text-rose-50" };
  return { code: "?", className: "bg-muted text-muted-foreground" };
}

export function formBarHeights(notesNewestFirst: number[]): number[] {
  const used = notesNewestFirst.slice(0, 5).map((note) => noteToFormPoints(note));
  used.reverse();
  const pad = 5 - used.length;
  return [...Array(pad).fill(0), ...used];
}
